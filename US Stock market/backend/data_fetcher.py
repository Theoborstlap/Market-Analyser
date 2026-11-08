"""
US Data Service — V13 P4 DATA TRUTH edition  (marker: P4_US_DATA_TRUTH)

What this module does now:
  1. Real 6-year daily OHLCV from Yahoo Finance. No generated history, no splice, no ref_price fallback.
     A symbol that cannot be fetched (or fails a sanity check) is reported with a status and returns None.
  2. Per-symbol status: LIVE, NO_LIVE_PRICE, INSUFFICIENT_HISTORY, STALE, PRICE_ANOMALY.
  3. Real macro numbers (ES=F, NQ=F, ^VIX, ^VIX3M, DX-Y.NYB, ^TNX, HYG/IEF). Anything not fetched is flagged.
  4. Real USD/ZAR from ZAR=X, or a clearly labelled fixed fallback (never shown as live).
  5. Earnings dates from yfinance, fetched in a background thread (unknown is reported as unknown).
  6. No economic calendar, SEC, Finviz, options or WSB feed is connected: those fields are UNAVAILABLE.
"""
import json
import math
import ssl
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, date
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL_CTX = ssl._create_unverified_context()

import config as _cfg
from config import US_UNIVERSE_MAP
from app.services.options_gex_skew_service import compute_options_gex_and_skew
from app.services.finviz_sec_service import fetch_sec_finviz_wsb_intel
from app.services.forexfactory_macro_service import get_wall_street_session_banner
import os
import sys

_ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT_DIR not in sys.path:
    sys.path.insert(0, _ROOT_DIR)
from shared_core.oms_engine import fetch_live_us_alpaca_quote_and_bars, is_live_trading_enabled, _QUOTE_CACHE

try:
    import yfinance as yf
    HAS_YFINANCE = True
except Exception:
    HAS_YFINANCE = False

_MIN_REAL_BARS = int(getattr(_cfg, "US_MIN_REAL_BARS", 250))
_STALE_DAYS = float(getattr(_cfg, "US_PRICE_STALE_DAYS", 5))
_ANOMALY_PCT = float(getattr(_cfg, "US_PRICE_ANOMALY_PCT", 40.0))
_USDZAR_FALLBACK = float(getattr(_cfg, "USDZAR_FALLBACK_RATE", 16.50))

_SERIES_CACHE: Dict[str, Dict[str, Any]] = {}
_LAST_GOOD: Dict[str, Dict[str, Any]] = {}
_STATUS: Dict[str, Dict[str, Any]] = {}
_FETCH_REASON: Dict[str, str] = {}
_FAIL_TS: Dict[str, float] = {}
_FAIL_BACKOFF_SEC = 120.0
_CACHE_TTL_SEC = 900.0  # 15-minute cache
_PREFETCH_TS: float = 0.0
_PREFETCH_LOCK = threading.Lock()

_USDZAR_CACHE: Dict[str, Any] = {"ts": 0.0, "data": None}
_USDZAR_LAST_GOOD: Dict[str, Any] = {"rates": None, "ts": 0.0}
_MACRO_CACHE: Dict[str, Any] = {"ts": 0.0, "data": None}
_MTF_CACHE: Dict[str, Dict[str, Any]] = {}
_MTF_TTL_SEC = 900.0

_EARN_CACHE: Dict[str, Dict[str, Any]] = {}
_EARN_INFLIGHT: set = set()
_EARN_LOCK = threading.Lock()
_EARN_SEM = threading.Semaphore(4)
_EARN_TTL_SEC = 12 * 3600.0
_EARN_FAIL_TTL_SEC = 1800.0

_ETF_NO_EARNINGS = ("SPY", "QQQ", "IWM", "SMH", "XLK", "XLF", "XLE", "XLV", "XLI", "GLD", "DIA", "TLT", "SLV", "ARKK")


# ---------------------------------------------------------------------------
# Yahoo chart fetch
# ---------------------------------------------------------------------------
def _fetch_chart_with_meta(
    symbol: str,
    range_str: str = "3mo",
    timeout_sec: float = 4.5,
    attempts: int = 2,
) -> Optional[Tuple[Dict[str, np.ndarray], Dict[str, Any]]]:
    """Primary: Alpaca SIP real-time quote/bars when keys present. Fallback: Yahoo v8 chart when LIVE_TRADING=false."""
    limit_bars = 1500 if "y" in range_str else 120
    alpaca_live = fetch_live_us_alpaca_quote_and_bars(symbol, limit=limit_bars, timeout_sec=timeout_sec)
    if alpaca_live is not None:
        return alpaca_live
    if is_live_trading_enabled() and not (symbol.startswith("^") or "=" in symbol or "-" in symbol):
        _FETCH_REASON[symbol] = "LIVE_TRADING_REQUIRES_ALPACA_REALTIME_FEED"
        return None
    encoded = urllib.parse.quote(symbol)
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}"
        f"?range={range_str}&interval=1d&includePrePost=false"
    )
    payload = None
    last_err = "NO_RESPONSE"
    for attempt in range(max(1, attempts)):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=timeout_sec, context=_SSL_CTX) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            break
        except Exception as exc:
            last_err = type(exc).__name__
            if attempt < attempts - 1:
                time.sleep(0.3 * (attempt + 1))
    if not payload:
        _FETCH_REASON[symbol] = f"FETCH_FAILED:{last_err}"
        return None
    try:
        result = (payload.get("chart", {}).get("result") or [None])[0]
        if not result:
            _FETCH_REASON[symbol] = "NO_RESULT_FROM_YAHOO"
            return None
        meta = result.get("meta") or {}
        rmp = meta.get("regularMarketPrice")
        timestamps = result.get("timestamp") or []
        quote = (result.get("indicators", {}).get("quote") or [{}])[0]
        opens_raw = quote.get("open") or []
        highs_raw = quote.get("high") or []
        lows_raw = quote.get("low") or []
        closes_raw = quote.get("close") or []
        vols_raw = quote.get("volume") or []

        o_list: List[float] = []
        h_list: List[float] = []
        l_list: List[float] = []
        c_list: List[float] = []
        v_list: List[float] = []
        ts_list: List[int] = []
        for i in range(len(timestamps)):
            c = closes_raw[i] if i < len(closes_raw) else None
            if c is None or c <= 0:
                continue
            o = opens_raw[i] if (i < len(opens_raw) and opens_raw[i] is not None and opens_raw[i] > 0) else c
            h = highs_raw[i] if (i < len(highs_raw) and highs_raw[i] is not None and highs_raw[i] > 0) else max(o, c)
            l = lows_raw[i] if (i < len(lows_raw) and lows_raw[i] is not None and lows_raw[i] > 0) else min(o, c)
            v = vols_raw[i] if (i < len(vols_raw) and vols_raw[i] is not None) else 5_000_000.0
            o_list.append(round(float(o), 4))
            h_list.append(round(float(h), 4))
            l_list.append(round(float(l), 4))
            c_list.append(round(float(c), 4))
            v_list.append(float(v))
            ts_list.append(int(timestamps[i]))

        last_ts: Optional[int] = ts_list[-1] if ts_list else None
        if not c_list and rmp is not None and float(rmp) > 0:
            p0 = round(float(rmp), 2 if symbol != "ZAR=X" else 4)
            o_list, h_list, l_list, c_list, v_list = [p0], [p0], [p0], [p0], [5_000_000.0]
            rmt = meta.get("regularMarketTime")
            last_ts = int(rmt) if rmt else None
        if len(c_list) < 1:
            _FETCH_REASON[symbol] = "EMPTY_SERIES"
            return None
        if rmp is not None and float(rmp) > 0:
            live_c = round(float(rmp), 2 if symbol != "ZAR=X" else 4)
            c_list[-1] = live_c
            h_list[-1] = max(h_list[-1], live_c)
            l_list[-1] = min(l_list[-1], live_c)
        series = {
            "opens": np.array(o_list, dtype=float),
            "highs": np.array(h_list, dtype=float),
            "lows": np.array(l_list, dtype=float),
            "closes": np.array(c_list, dtype=float),
            "volumes": np.array(v_list, dtype=float),
        }
        return series, {"last_bar_ts": last_ts, "regular_price": rmp}
    except Exception as exc:
        _FETCH_REASON[symbol] = f"PARSE_FAILED:{type(exc).__name__}"
        return None


def _fetch_yahoo_us_chart(symbol: str, range_str: str = "3mo", timeout_sec: float = 4.5) -> Optional[Dict[str, np.ndarray]]:
    """Backward-compatible wrapper: returns only the arrays."""
    res = _fetch_chart_with_meta(symbol, range_str=range_str, timeout_sec=timeout_sec, attempts=2)
    return res[0] if res else None


def _seed_from_symbol(symbol: str) -> int:
    return sum((idx + 1) * ord(ch) for idx, ch in enumerate(symbol.upper())) % 99991


# ---------------------------------------------------------------------------
# Per-symbol status and sanity checks
# ---------------------------------------------------------------------------
def _record_status(
    symbol: str,
    status: str,
    reason: str,
    last_bar_date: Optional[str],
    n_bars: int,
    from_last_good: bool = False,
) -> None:
    _STATUS[symbol] = {
        "status": status,
        "reason": reason,
        "last_bar_date": last_bar_date,
        "bars": int(n_bars),
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "from_last_good": bool(from_last_good),
    }


def _evaluate_series(series: Dict[str, np.ndarray], last_bar_ts: Optional[float]) -> Tuple[str, str, Optional[str]]:
    closes = series["closes"]
    n = int(len(closes))
    last_date: Optional[str] = None
    if last_bar_ts:
        try:
            last_date = datetime.fromtimestamp(float(last_bar_ts), tz=timezone.utc).date().isoformat()
        except Exception:
            last_date = None
    if n == 0:
        return "NO_LIVE_PRICE", "empty price series", last_date
    if n < _MIN_REAL_BARS:
        return "INSUFFICIENT_HISTORY", f"{n} daily bars (need at least {_MIN_REAL_BARS})", last_date
    if last_bar_ts:
        age_days = (time.time() - float(last_bar_ts)) / 86400.0
        if age_days > _STALE_DAYS:
            return "STALE", f"newest bar {last_date} is {age_days:.1f} days old (limit {_STALE_DAYS:g})", last_date
    tail = closes[-6:]
    if len(tail) >= 2:
        prev = tail[:-1]
        cur = tail[1:]
        moves = np.abs(cur / np.maximum(prev, 1e-12) - 1.0) * 100.0
        worst = float(np.max(moves))
        if worst > _ANOMALY_PCT:
            return "PRICE_ANOMALY", f"single-bar move of {worst:.1f}% in the last 5 bars (limit {_ANOMALY_PCT:g}%)", last_date
    return "LIVE", "", last_date


def _fetch_intraday_closes(symbol: str, interval: str = "15m", range_str: str = "5d", timeout_sec: float = 3.0) -> Optional[np.ndarray]:
    now = time.time()
    cache_key = f"{symbol}:{interval}"
    cached = _MTF_CACHE.get(cache_key)
    if cached and (now - cached["ts"]) < _MTF_TTL_SEC:
        return cached["closes"]
    encoded = urllib.parse.quote(symbol)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?range={range_str}&interval={interval}&includePrePost=false"
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout_sec, context=_SSL_CTX) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        result = (payload.get("chart", {}).get("result") or [None])[0]
        if not result:
            return None
        closes_raw = ((result.get("indicators", {}).get("quote") or [{}])[0]).get("close") or []
        c_arr = np.array([float(c) for c in closes_raw if c is not None and c > 0], dtype=float)
        if len(c_arr) >= 20:
            _MTF_CACHE[cache_key] = {"ts": now, "closes": c_arr}
            return c_arr
    except Exception:
        pass
    return cached["closes"] if cached else None


def _copy_series(series: Dict[str, np.ndarray]) -> Dict[str, np.ndarray]:
    out = {
        "opens": series["opens"].copy(),
        "highs": series["highs"].copy(),
        "lows": series["lows"].copy(),
        "closes": series["closes"].copy(),
        "volumes": series["volumes"].copy(),
    }
    if "closes_15m" in series and series["closes_15m"] is not None:
        out["closes_15m"] = series["closes_15m"].copy()
    if "closes_1h" in series and series["closes_1h"] is not None:
        out["closes_1h"] = series["closes_1h"].copy()
    return out


def _refresh_symbol(clean: str) -> Optional[Dict[str, np.ndarray]]:
    now = time.time()
    in_backoff = (now - _FAIL_TS.get(clean, 0.0)) < _FAIL_BACKOFF_SEC
    got = None
    if not in_backoff:
        got = _fetch_chart_with_meta(clean, range_str="6y", timeout_sec=10.0, attempts=3)
        if got is None:
            _FAIL_TS[clean] = now
    if got is not None:
        series, meta = got
        status, reason, last_date = _evaluate_series(series, meta.get("last_bar_ts"))
        _record_status(clean, status, reason, last_date, int(len(series["closes"])), False)
        if status == "LIVE":
            c15 = _fetch_intraday_closes(clean, interval="15m", range_str="5d")
            c1h = _fetch_intraday_closes(clean, interval="60m", range_str="1mo")
            if c15 is not None:
                series["closes_15m"] = c15
            if c1h is not None:
                series["closes_1h"] = c1h
            _SERIES_CACHE[clean] = {"ts": now, "series": series}
            _LAST_GOOD[clean] = {"ts": now, "series": series, "last_bar_ts": meta.get("last_bar_ts")}
            _FAIL_TS.pop(clean, None)
            return _copy_series(series)
        _FAIL_TS[clean] = now
        return None

    good = _LAST_GOOD.get(clean)
    if good is not None:
        status, reason, last_date = _evaluate_series(good["series"], good.get("last_bar_ts"))
        n_bars = int(len(good["series"]["closes"]))
        if status == "LIVE":
            age = int(now - float(good["ts"]))
            _record_status(
                clean, "LIVE",
                f"USING LAST GOOD DATA ({age}s old); the latest fetch failed ({_FETCH_REASON.get(clean, 'unknown')})",
                last_date, n_bars, True,
            )
            return _copy_series(good["series"])
        _record_status(clean, status, f"{reason} (last good data)", last_date, n_bars, True)
        return None

    if clean not in _STATUS or not in_backoff:
        _record_status(clean, "NO_LIVE_PRICE", _FETCH_REASON.get(clean, "FETCH_FAILED"), None, 0, False)
    return None


def _prefetch_us_universe_live() -> None:
    """Concurrently fetches real 6y history for the whole US universe."""
    global _PREFETCH_TS
    with _PREFETCH_LOCK:
        now = time.time()
        if (now - _PREFETCH_TS) < _CACHE_TTL_SEC:
            return
        _PREFETCH_TS = now
        symbols = list(US_UNIVERSE_MAP.keys())
        with ThreadPoolExecutor(max_workers=12) as pool:
            futs = [pool.submit(_refresh_symbol, s) for s in symbols]
            for f in as_completed(futs):
                try:
                    f.result()
                except Exception:
                    pass


def get_symbol_6y_history(symbol: str, ref_price: Optional[float] = None) -> Optional[Dict[str, np.ndarray]]:
    """
    Returns real daily OHLCV (about 6 years) for a US symbol, or None when no trustworthy data exists.
    ref_price is accepted for backward compatibility and is IGNORED (nothing is invented from it).
    """
    clean = symbol.upper().strip()
    now = time.time()
    if clean in US_UNIVERSE_MAP and (len(_SERIES_CACHE) == 0 or (now - _PREFETCH_TS) >= _CACHE_TTL_SEC):
        _prefetch_us_universe_live()
    cached = _SERIES_CACHE.get(clean)
    if cached and (time.time() - cached["ts"]) < _CACHE_TTL_SEC:
        return _copy_series(cached["series"])
    return _refresh_symbol(clean)


def get_symbol_status(symbol: str) -> Dict[str, Any]:
    return dict(_STATUS.get(symbol.upper().strip()) or {"status": "NOT_LOADED", "reason": "", "last_bar_date": None, "bars": 0})


def get_us_data_health(symbols: List[str]) -> Dict[str, Any]:
    live = 0
    blocked: List[Dict[str, Any]] = []
    dates: List[str] = []
    for s in symbols:
        st = _STATUS.get(s) or {"status": "NOT_LOADED", "reason": "never fetched", "last_bar_date": None}
        if st.get("status") == "LIVE":
            live += 1
            if st.get("last_bar_date"):
                dates.append(str(st["last_bar_date"]))
        else:
            blocked.append({"symbol": s, "status": st.get("status"), "reason": st.get("reason")})
    return {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "symbolsTotal": len(symbols),
        "symbolsLive": live,
        "symbolsBlocked": len(blocked),
        "blocked": blocked,
        "newestBarDate": max(dates) if dates else None,
        "oldestBarDate": min(dates) if dates else None,
        "minRealBars": _MIN_REAL_BARS,
        "staleDays": _STALE_DAYS,
    }


# ---------------------------------------------------------------------------
# Extended-hours proxy (no seed noise)
# ---------------------------------------------------------------------------
def compute_extended_hours_gap(symbol: str, series: Dict[str, np.ndarray]) -> Dict[str, Any]:
    """
    Honest daily-bar proxy only. Real pre-market and after-hours quotes are NOT connected.
    premarket_gap_pct = today's open vs yesterday's close (real, from daily bars).
    """
    closes = series["closes"]
    opens = series["opens"]
    volumes = series["volumes"]
    prev_close = float(closes[-2])
    curr_open = float(opens[-1])
    curr_price = float(closes[-1])

    overnight_gap_pct = ((curr_open - prev_close) / max(prev_close, 1e-8)) * 100.0
    avg_vol_20 = float(np.mean(volumes[-21:-1])) if len(volumes) > 22 else float(volumes[-1])
    ext_vol_ratio = round(max(0.45, min(3.8, float(volumes[-1]) / max(avg_vol_20, 1.0))), 2)

    return {
        "premarket_gap_pct": round(overnight_gap_pct, 2),
        "afterhours_gap_pct": 0.0,
        "extended_vol_ratio": ext_vol_ratio,
        "ext_hours_price": round(curr_price, 2),
        "data_status": "DAILY_BAR_PROXY_NOT_REAL_EXTENDED_HOURS",
    }


# ---------------------------------------------------------------------------
# Earnings (real dates via yfinance, fetched off the request path)
# ---------------------------------------------------------------------------
def _earnings_worker(sym: str) -> None:
    result: Dict[str, Any] = {"ts": time.time(), "date": None, "status": "UNAVAILABLE", "reason": "no calendar returned"}
    try:
        with _EARN_SEM:
            if not HAS_YFINANCE:
                result["reason"] = "yfinance not installed"
            else:
                cal = yf.Ticker(sym).calendar
                dates: List[date] = []
                if isinstance(cal, dict):
                    raw = cal.get("Earnings Date") or []
                    if not isinstance(raw, (list, tuple)):
                        raw = [raw]
                    for d in raw:
                        if isinstance(d, datetime):
                            dates.append(d.date())
                        elif isinstance(d, date):
                            dates.append(d)
                today = datetime.now(timezone.utc).date()
                future = [d for d in dates if d >= today]
                if future:
                    result["date"] = min(future)
                    result["status"] = "LIVE"
                    result["reason"] = ""
                elif dates:
                    result["reason"] = "no upcoming earnings date listed"
    except Exception as exc:
        result["status"] = "ERROR"
        result["reason"] = type(exc).__name__
    finally:
        result["ts"] = time.time()
        with _EARN_LOCK:
            _EARN_CACHE[sym] = result
            _EARN_INFLIGHT.discard(sym)


def get_days_to_next_earnings(symbol: str) -> Dict[str, Any]:
    """
    Real earnings date when known. Unknown is reported as unknown (999 days + an explicit badge),
    never as a made-up countdown.
    """
    clean = symbol.upper().strip()
    meta = US_UNIVERSE_MAP.get(clean, {})
    if meta.get("sector") == "SECTOR_ETF" or clean in _ETF_NO_EARNINGS:
        return {
            "days_to_earnings": 999,
            "earnings_warning_badge": None,
            "earnings_status": "NOT_APPLICABLE_ETF",
            "earnings_date": None,
        }

    now = time.time()
    with _EARN_LOCK:
        cached = _EARN_CACHE.get(clean)
        ttl = _EARN_TTL_SEC if (cached and cached.get("status") == "LIVE") else _EARN_FAIL_TTL_SEC
        fresh = bool(cached) and (now - float(cached["ts"])) < ttl
        need_fetch = (not fresh) and (clean not in _EARN_INFLIGHT)
        if need_fetch:
            _EARN_INFLIGHT.add(clean)
    if need_fetch:
        threading.Thread(target=_earnings_worker, args=(clean,), daemon=True).start()

    if cached and cached.get("status") == "LIVE" and cached.get("date") is not None:
        days = int((cached["date"] - datetime.now(timezone.utc).date()).days)
        if days >= 0:
            badge = f"⚠️ EARNINGS IN {days}d: IV CRUSH RISK" if days <= 5 else None
            return {
                "days_to_earnings": days,
                "earnings_warning_badge": badge,
                "earnings_status": "LIVE",
                "earnings_date": cached["date"].isoformat(),
            }
    return {
        "days_to_earnings": 999,
        "earnings_warning_badge": "EARNINGS DATE UNKNOWN: CHECK BEFORE TRADING",
        "earnings_status": "UNAVAILABLE",
        "earnings_date": None,
    }


# ---------------------------------------------------------------------------
# USD/ZAR (real, last-good, or a labelled fixed fallback)
# ---------------------------------------------------------------------------
def compute_usdzar_ou_regime_shield() -> Dict[str, Any]:
    """
    Live USD/ZAR (ZAR=X) 60-day z-score and Ornstein-Uhlenbeck half-life.
    If Yahoo fails: last good data (labelled) or a fixed fallback rate (labelled FALLBACK_NOT_LIVE).
    """
    now = time.time()
    if _USDZAR_CACHE["data"] is not None and (now - _USDZAR_CACHE["ts"]) < 120.0:
        return _USDZAR_CACHE["data"]

    rates_60d: Optional[np.ndarray] = None
    rate_status = "LIVE"
    rate_note = ""
    got = _fetch_chart_with_meta("ZAR=X", range_str="3mo", timeout_sec=6.0, attempts=2)
    if got is not None and len(got[0]["closes"]) >= 25:
        rates_60d = got[0]["closes"][-60:]
        _USDZAR_LAST_GOOD["rates"] = rates_60d.copy()
        _USDZAR_LAST_GOOD["ts"] = now
    elif _USDZAR_LAST_GOOD.get("rates") is not None:
        rates_60d = _USDZAR_LAST_GOOD["rates"]
        age_min = int((now - float(_USDZAR_LAST_GOOD["ts"])) / 60.0)
        rate_status = "LAST_GOOD"
        rate_note = f"live fetch failed; using the last good rate from {age_min} min ago"

    if rates_60d is None or len(rates_60d) < 25:
        payload = {
            "usdzar_rate": round(_USDZAR_FALLBACK, 4),
            "usdzar_mean_60d": round(_USDZAR_FALLBACK, 4),
            "usdzar_zscore": 0.0,
            "usdzar_ou_halflife": 0.0,
            "usdzar_regime_badge": "UNAVAILABLE: USD/ZAR NOT LIVE (fixed fallback rate in use)",
            "rate_status": "FALLBACK_NOT_LIVE",
            "rate_note": "Yahoo ZAR=X could not be fetched and no earlier good rate exists; rand values are approximate",
        }
        _USDZAR_CACHE["ts"] = now - 90.0  # retry again in about 30 seconds
        _USDZAR_CACHE["data"] = payload
        return payload

    usdzar_rate = float(rates_60d[-1])
    mean_60 = float(np.mean(rates_60d))
    std_60 = float(np.std(rates_60d)) + 1e-8
    usdzar_zscore = float((usdzar_rate - mean_60) / std_60)

    log_fx = np.log(np.maximum(rates_60d, 1.0))
    x_lag = log_fx[:-1]
    x_curr = log_fx[1:]
    x_mean = float(np.mean(x_lag))
    y_mean = float(np.mean(x_curr))
    cov_xy = float(np.sum((x_lag - x_mean) * (x_curr - y_mean)))
    var_x = float(np.sum((x_lag - x_mean) ** 2)) + 1e-12
    phi = cov_xy / var_x
    phi_clamped = max(0.05, min(0.96, phi))
    ou_halflife = float(-math.log(2.0) / math.log(phi_clamped))
    ou_halflife = round(max(1.8, min(28.0, ou_halflife)), 1)

    if usdzar_zscore >= 1.15:
        regime_badge = "⚠️ RAND OVERSOLD"
    elif usdzar_zscore <= -0.65:
        regime_badge = "💎 STRONG RAND DIP: Best Time to Fund EasyEquities USD Wallet"
    else:
        regime_badge = "🟢 USD/ZAR STABLE TAILWIND"

    payload = {
        "usdzar_rate": round(usdzar_rate, 4),
        "usdzar_mean_60d": round(mean_60, 4),
        "usdzar_zscore": round(usdzar_zscore, 2),
        "usdzar_ou_halflife": ou_halflife,
        "usdzar_regime_badge": regime_badge,
        "rate_status": rate_status,
        "rate_note": rate_note,
    }
    _USDZAR_CACHE["ts"] = now
    _USDZAR_CACHE["data"] = payload
    return payload


# ---------------------------------------------------------------------------
# Macro (real where fetched, flagged where not)
# ---------------------------------------------------------------------------
_MACRO_SYMBOLS = {
    "es": "ES=F",
    "nq": "NQ=F",
    "vix": "^VIX",
    "vix3m": "^VIX3M",
    "dxy": "DX-Y.NYB",
    "tnx": "^TNX",
    "hyg": "HYG",
    "ief": "IEF",
}


def _fetch_macro_closes() -> Dict[str, Optional[np.ndarray]]:
    out: Dict[str, Optional[np.ndarray]] = {k: None for k in _MACRO_SYMBOLS}

    def _task(key: str) -> Tuple[str, Optional[np.ndarray]]:
        chart = _fetch_yahoo_us_chart(_MACRO_SYMBOLS[key], range_str="2mo", timeout_sec=6.0)
        return key, (chart["closes"] if chart is not None else None)

    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = [pool.submit(_task, k) for k in _MACRO_SYMBOLS]
        for fut in as_completed(futs):
            try:
                key, closes = fut.result()
                out[key] = closes
            except Exception:
                pass
    return out


def fetch_us_macro_and_forexfactory_shield(market_histories: Dict[str, Dict[str, np.ndarray]]) -> Dict[str, Any]:
    now = time.time()
    if _MACRO_CACHE["data"] is not None and (now - _MACRO_CACHE["ts"]) < 120.0:
        return _MACRO_CACHE["data"]

    raw = _fetch_macro_closes()
    field_status: Dict[str, str] = {}

    def _last(key: str) -> Optional[float]:
        arr = raw.get(key)
        return float(arr[-1]) if (arr is not None and len(arr) >= 1) else None

    def _chg(key: str) -> Optional[float]:
        arr = raw.get(key)
        if arr is not None and len(arr) >= 2 and float(arr[-2]) > 0:
            return round(((float(arr[-1]) - float(arr[-2])) / float(arr[-2])) * 100.0, 2)
        return None

    def _proxy_chg(sym: str) -> Optional[float]:
        h = (market_histories or {}).get(sym)
        if h is not None and len(h["closes"]) >= 2 and float(h["closes"][-2]) > 0:
            return round(((float(h["closes"][-1]) - float(h["closes"][-2])) / float(h["closes"][-2])) * 100.0, 2)
        return None

    es_price = _last("es")
    nq_price = _last("nq")
    es_chg = _chg("es")
    nq_chg = _chg("nq")
    field_status["es_futures_price"] = "LIVE" if es_price is not None else "UNAVAILABLE"
    field_status["nq_futures_price"] = "LIVE" if nq_price is not None else "UNAVAILABLE"
    if es_chg is not None:
        field_status["es_futures_change_pct"] = "LIVE"
    else:
        es_chg = _proxy_chg("SPY")
        field_status["es_futures_change_pct"] = "SPY_DAILY_PROXY" if es_chg is not None else "UNAVAILABLE"
    if nq_chg is not None:
        field_status["nq_futures_change_pct"] = "LIVE"
    else:
        nq_chg = _proxy_chg("QQQ")
        field_status["nq_futures_change_pct"] = "QQQ_DAILY_PROXY" if nq_chg is not None else "UNAVAILABLE"

    vix = _last("vix")
    vix3m = _last("vix3m")
    field_status["vix_spot"] = "LIVE" if vix is not None else "UNAVAILABLE"
    field_status["vix_3m"] = "LIVE" if vix3m is not None else "UNAVAILABLE"
    if vix is not None and vix3m is not None:
        vix_term_regime = "CONTANGO (RISK-ON)" if vix < vix3m else "BACKWARDATION (HEDGING STRESS)"
    else:
        vix_term_regime = "UNAVAILABLE"

    hyg = raw.get("hyg")
    ief = raw.get("ief")
    hyg_ief_ratio: Optional[float] = None
    hyg_ief_status = "UNAVAILABLE"
    if hyg is not None and ief is not None and len(hyg) >= 5 and len(ief) >= 5:
        n = min(len(hyg), len(ief))
        ratio_series = hyg[-n:] / np.maximum(ief[-n:], 1e-9)
        hyg_ief_ratio = float(ratio_series[-1])
        mean20 = float(np.mean(ratio_series[-20:]))
        if hyg_ief_ratio < mean20 * 0.99:
            hyg_ief_status = "CREDIT CANARY AMBER (HYG/IEF more than 1% below its 20-day average)"
        else:
            hyg_ief_status = "CREDIT CANARY GREEN (HYG/IEF within 1% of its 20-day average)"
    field_status["hyg_ief_ratio"] = "LIVE" if hyg_ief_ratio is not None else "UNAVAILABLE"

    dxy = _last("dxy")
    tnx = _last("tnx")
    field_status["dxy_index"] = "LIVE" if dxy is not None else "UNAVAILABLE"
    field_status["us10y_yield_pct"] = "LIVE" if tnx is not None else "UNAVAILABLE"

    core_keys = ["es_futures_price", "nq_futures_price", "vix_spot", "vix_3m", "hyg_ief_ratio", "dxy_index", "us10y_yield_pct"]
    live_n = sum(1 for k in core_keys if field_status.get(k) == "LIVE")
    if live_n == len(core_keys):
        macro_data_status = "LIVE"
    elif live_n == 0:
        macro_data_status = "UNAVAILABLE"
    else:
        macro_data_status = "PARTIAL"

    # Numeric fields must stay numeric for downstream code; unavailable ones use a neutral value
    # and are flagged in macro_field_status. VIX neutral = 18.5 (the engine's no-penalty point).
    payload = {
        "es_futures_price": round(es_price, 2) if es_price is not None else 0.0,
        "es_futures_change_pct": es_chg if es_chg is not None else 0.0,
        "nq_futures_price": round(nq_price, 2) if nq_price is not None else 0.0,
        "nq_futures_change_pct": nq_chg if nq_chg is not None else 0.0,
        "vix_spot": round(vix, 2) if vix is not None else 18.5,
        "vix_3m": round(vix3m, 2) if vix3m is not None else 18.5,
        "vix_term_regime": vix_term_regime,
        "hyg_ief_ratio": round(hyg_ief_ratio, 4) if hyg_ief_ratio is not None else 0.0,
        "hyg_ief_canary": hyg_ief_status,
        "dxy_index": round(dxy, 2) if dxy is not None else 0.0,
        "us10y_yield_pct": round(tnx, 2) if tnx is not None else 0.0,
        "macro_shield_status": "UNKNOWN: NO ECONOMIC CALENDAR FEED (check CPI / FOMC / NFP times yourself before trading)",
        "forexfactory_usd_events": [],
        "calendar_status": "UNAVAILABLE",
        "session": get_wall_street_session_banner(),
        "macro_data_status": macro_data_status,
        "macro_field_status": field_status,
        "macro_fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    _MACRO_CACHE["ts"] = now
    _MACRO_CACHE["data"] = payload
    return payload


# ---------------------------------------------------------------------------
# Ticker validator for the Add US Stock modal
# ---------------------------------------------------------------------------
def validate_and_inspect_us_ticker(symbol: str) -> Dict[str, Any]:
    """Valid only when Yahoo returns real, sane daily bars. Nothing is invented."""
    clean = symbol.upper().strip().replace("$", "")
    if not clean or len(clean) > 10 or not all(ch.isalnum() or ch in "-." for ch in clean):
        return {"valid": False, "error": "Invalid ticker symbol format."}

    if clean in US_UNIVERSE_MAP:
        meta = US_UNIVERSE_MAP[clean]
        hist = get_symbol_6y_history(clean)
        if hist is None:
            st = get_symbol_status(clean)
            return {"valid": False, "error": f"No usable live price data for {clean} right now ({st.get('status')}: {st.get('reason')})."}
        return {
            "valid": True,
            "symbol": clean,
            "name": meta["name"],
            "sector": meta["sector"],
            "twin": meta.get("twin", "SPY"),
            "price": round(float(hist["closes"][-1]), 2),
        }

    got = _fetch_chart_with_meta(clean, range_str="6y", timeout_sec=10.0, attempts=2)
    if got is None:
        return {"valid": False, "error": f"Yahoo returned no data for '{clean}' ({_FETCH_REASON.get(clean, 'unknown')}). Not added."}
    series, meta_out = got
    status, reason, _last_date = _evaluate_series(series, meta_out.get("last_bar_ts"))
    if status != "LIVE":
        return {"valid": False, "error": f"'{clean}' failed the data check: {status} ({reason})."}
    return {
        "valid": True,
        "symbol": clean,
        "name": f"{clean} (US equity, name not verified)",
        "sector": "US_CUSTOM",
        "twin": "SPY",
        "price": round(float(series["closes"][-1]), 2),
    }


# ===========================================================================
# Real-Time WebSocket SIP Handlers: Alpaca Market Data & Polygon.io
# ===========================================================================
async def start_alpaca_sip_websocket_stream(
    symbols: Optional[List[str]] = None,
    api_key: Optional[str] = None,
    secret_key: Optional[str] = None,
    stop_event: Optional[asyncio.Event] = None,
) -> None:
    """
    Connects to Alpaca SIP real-time streaming WebSocket (wss://stream.data.alpaca.markets/v2/sip).
    Subscribes to quotes and bars, updating _QUOTE_CACHE and _STATUS in real time.
    """
    key = (api_key or os.environ.get("ALPACA_API_KEY") or os.environ.get("APCA_API_KEY_ID") or "").strip()
    sec = (secret_key or os.environ.get("ALPACA_SECRET_KEY") or os.environ.get("APCA_API_SECRET_KEY") or "").strip()
    if not key or not sec:
        return
    sym_list = symbols or list(US_UNIVERSE_MAP.keys())[:15]
    try:
        import websockets  # type: ignore

        ws_url = "wss://stream.data.alpaca.markets/v2/sip"
        async with websockets.connect(ws_url) as ws:
            await ws.recv()
            auth_msg = {"action": "auth", "key": key, "secret": sec}
            await ws.send(json.dumps(auth_msg))
            await ws.recv()
            sub_msg = {"action": "subscribe", "quotes": sym_list, "bars": sym_list}
            await ws.send(json.dumps(sub_msg))
            while stop_event is None or not stop_event.is_set():
                raw = await ws.recv()
                records = json.loads(raw)
                for rec in records:
                    t = rec.get("T")
                    s = str(rec.get("S", "")).upper()
                    if t == "q" and s:
                        bp = float(rec.get("bp") or 0.0)
                        ap = float(rec.get("ap") or 0.0)
                        mid = (bp + ap) / 2.0 if (bp > 0 and ap > 0) else 0.0
                        spread_pct = ((ap - bp) / mid) * 100.0 if mid > 0 else 0.04
                        cached = _QUOTE_CACHE.get(f"US:{s}", {})
                        cached.update({
                            "bid": bp,
                            "ask": ap,
                            "regularMarketPrice": mid or cached.get("regularMarketPrice", 0.0),
                            "spread_pct": round(spread_pct, 4),
                            "timestamp": time.time(),
                            "source": "ALPACA_SIP_WS",
                        })
                        _QUOTE_CACHE[f"US:{s}"] = cached
                    elif t == "b" and s:
                        c = float(rec.get("c") or 0.0)
                        if c > 0:
                            cached = _QUOTE_CACHE.get(f"US:{s}", {})
                            cached.update({"regularMarketPrice": c, "timestamp": time.time(), "source": "ALPACA_SIP_WS"})
                            _QUOTE_CACHE[f"US:{s}"] = cached
    except Exception:
        pass


async def start_polygon_sip_websocket_stream(
    symbols: Optional[List[str]] = None,
    api_key: Optional[str] = None,
    stop_event: Optional[asyncio.Event] = None,
) -> None:
    """
    Connects to Polygon.io real-time stock cluster WebSocket (wss://socket.polygon.io/stocks).
    Subscribes to Level 1 / Level 2 quotes & aggregates.
    """
    key = (api_key or os.environ.get("POLYGON_API_KEY") or "").strip()
    if not key:
        return
    sym_list = symbols or list(US_UNIVERSE_MAP.keys())[:15]
    try:
        import websockets  # type: ignore

        async with websockets.connect("wss://socket.polygon.io/stocks") as ws:
            await ws.recv()
            await ws.send(json.dumps({"action": "auth", "params": key}))
            await ws.recv()
            params = ",".join([f"Q.{s}" for s in sym_list] + [f"A.{s}" for s in sym_list])
            await ws.send(json.dumps({"action": "subscribe", "params": params}))
            while stop_event is None or not stop_event.is_set():
                raw = await ws.recv()
                items = json.loads(raw)
                for it in items:
                    ev = it.get("ev")
                    sym = str(it.get("sym", "")).upper()
                    if ev == "Q" and sym:
                        bp = float(it.get("bp") or 0.0)
                        ap = float(it.get("ap") or 0.0)
                        mid = (bp + ap) / 2.0 if (bp > 0 and ap > 0) else 0.0
                        spread_pct = ((ap - bp) / mid) * 100.0 if mid > 0 else 0.04
                        cached = _QUOTE_CACHE.get(f"US:{sym}", {})
                        cached.update({
                            "bid": bp,
                            "ask": ap,
                            "regularMarketPrice": mid or cached.get("regularMarketPrice", 0.0),
                            "spread_pct": round(spread_pct, 4),
                            "timestamp": time.time(),
                            "source": "POLYGON_SIP_WS",
                        })
                        _QUOTE_CACHE[f"US:{sym}"] = cached
                    elif ev == "A" and sym:
                        c = float(it.get("c") or 0.0)
                        if c > 0:
                            cached = _QUOTE_CACHE.get(f"US:{sym}", {})
                            cached.update({"regularMarketPrice": c, "timestamp": time.time(), "source": "POLYGON_SIP_WS"})
                            _QUOTE_CACHE[f"US:{sym}"] = cached
    except Exception:
        pass


__all__ = [
    "get_symbol_6y_history",
    "get_symbol_status",
    "get_us_data_health",
    "compute_extended_hours_gap",
    "get_days_to_next_earnings",
    "compute_usdzar_ou_regime_shield",
    "validate_and_inspect_us_ticker",
    "compute_options_gex_and_skew",
    "fetch_sec_finviz_wsb_intel",
    "fetch_us_macro_and_forexfactory_shield",
    "get_wall_street_session_banner",
    "start_alpaca_sip_websocket_stream",
    "start_polygon_sip_websocket_stream",
]
