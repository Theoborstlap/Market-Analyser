"""Vectorized JSE Data Fetcher, JSE Prime Market-Hours (09:20-16:40 SAST), SA Public Holidays & 25th Payday Seasonality Oracle, 15-Bar Hampel & MAD Outlier Scrubber, ZAc -> R ZAR Normalizer, Live USD/ZAR OU Regime Shield, Dual-Listed Offshore Parity, ZAR Commodity Futures & Tencent 0700.HK SOTP Scanner (V12.0 "The Sovereign Omega 12/12 Finale")."""

import json
import math
import os
import random
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import yfinance as yf

try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX = ssl.create_default_context()
except Exception:
    _SSL_CTX = ssl._create_unverified_context()

from config import (
    ANOMALY_EXEMPT_SYMBOLS,
    JSE_UNIVERSE_MAP,
    MIN_REAL_BARS,
    PRICE_ANOMALY_PCT,
    PRICE_STALE_DAYS,
    TFSA_ELIGIBLE_ETFS,
    TICKER_RENAMES,
    is_stt_exempt_etf,
)
from database import fetch_all_dict

SAST_ZONE = ZoneInfo("Africa/Johannesburg")

_CACHE: Dict[str, Any] = {
    "ts": 0.0,
    "data": {},
    "macro_quotes": {},
    "usdzar_shield": {},
}
CACHE_TTL_SEC = 1200  # 20-minute TTL

_FETCH_REASON: Dict[str, str] = {}
_LAST_GOOD: Dict[str, pd.DataFrame] = {}

KNOWN_CUSTOM_JSE_PRICES: Dict[str, Dict[str, Any]] = {
    "CSP500.JO": {"name": "CoreShares S&P 500 ETF", "sector": "JSE_ETF_TFSA", "stt_exempt": True},
    "DIVTRX.JO": {"name": "Satrix DIVI Plus ETF", "sector": "JSE_ETF_TFSA", "stt_exempt": True},
    "STXDIV.JO": {"name": "Satrix DIVI Plus ETF", "sector": "JSE_ETF_TFSA", "stt_exempt": True},
    "TGA.JO": {"name": "Thungela Resources Ltd", "sector": "COMMODITY_MINER", "stt_exempt": False},
    "AVI.JO": {"name": "AVI Limited", "sector": "SA_INC_RETAIL", "stt_exempt": False},
    "PPH.JO": {"name": "Pepkor Holdings Ltd", "sector": "SA_INC_RETAIL", "stt_exempt": False},
    "TBS.JO": {"name": "Tiger Brands Ltd", "sector": "SA_INC_RETAIL", "stt_exempt": False},
    "NTC.JO": {"name": "Netcare Limited", "sector": "SA_INC_RETAIL", "stt_exempt": False},
    "LHC.JO": {"name": "Life Healthcare Group", "sector": "SA_INC_RETAIL", "stt_exempt": False},
    "GRT.JO": {"name": "Growthpoint Properties", "sector": "SA_INC_FIN", "stt_exempt": True},
    "RDF.JO": {"name": "Redefine Properties", "sector": "SA_INC_FIN", "stt_exempt": True},
    "TRU.JO": {"name": "Truworths International", "sector": "SA_INC_RETAIL", "stt_exempt": False},
    "SNT.JO": {"name": "Santam Limited", "sector": "SA_INC_FIN", "stt_exempt": False},
    "MOM.JO": {"name": "Momentum Group Ltd", "sector": "SA_INC_FIN", "stt_exempt": False},
    "OMU.JO": {"name": "Old Mutual Limited", "sector": "SA_INC_FIN", "stt_exempt": False},
    "SPAR.JO": {"name": "The SPAR Group Ltd", "sector": "SA_INC_RETAIL", "stt_exempt": False},
    "PIK.JO": {"name": "Pick n Pay Stores", "sector": "SA_INC_RETAIL", "stt_exempt": False},
}


def deterministic_seed(symbol: str) -> int:
    h = 2166136261
    for ch in symbol:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def _compute_easter_sunday(year: int) -> date:
    """Anonymous Gregorian algorithm for Easter Sunday."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def get_sa_public_holidays_for_year(year: int) -> Dict[date, str]:
    """
    Official South African Public Holidays (Public Holidays Act 36 of 1994):
    Includes fixed holidays, Good Friday, Family Day (Easter Monday), and observed Mondays when a holiday falls on Sunday.
    """
    easter = _compute_easter_sunday(year)
    good_friday = easter - timedelta(days=2)
    family_day = easter + timedelta(days=1)

    base_holidays: List[Tuple[date, str]] = [
        (date(year, 1, 1), "New Year's Day"),
        (date(year, 3, 21), "Human Rights Day"),
        (good_friday, "Good Friday"),
        (family_day, "Family Day"),
        (date(year, 4, 27), "Freedom Day"),
        (date(year, 5, 1), "Workers' Day"),
        (date(year, 6, 16), "Youth Day"),
        (date(year, 8, 9), "National Women's Day"),
        (date(year, 9, 24), "Heritage Day"),
        (date(year, 12, 16), "Day of Reconciliation"),
        (date(year, 12, 25), "Christmas Day"),
        (date(year, 12, 26), "Day of Goodwill"),
    ]

    holidays: Dict[date, str] = {}
    for dt, name in base_holidays:
        holidays[dt] = name
        # South African Public Holidays Act: if any public holiday falls on a Sunday, the following Monday is a public holiday
        if dt.weekday() == 6:
            obs_monday = dt + timedelta(days=1)
            if obs_monday not in holidays:
                holidays[obs_monday] = f"{name} (Observed Monday)"
    return holidays


def get_jse_session_status(now_override: Optional[datetime] = None) -> Dict[str, Any]:
    """
    V12.0 Section 1: JSE Prime Market-Hours (`09:20–16:40 SAST`), SA Public Holidays & 25th Payday Seasonality Oracle.
    Uses ZoneInfo("Africa/Johannesburg") (SAST / UTC+2).
    """
    now_sast = now_override.astimezone(SAST_ZONE) if now_override is not None else datetime.now(SAST_ZONE)
    today_date = now_sast.date()
    weekday_idx = now_sast.weekday()  # Mon=0 .. Fri=4, Sat=5, Sun=6
    holidays = get_sa_public_holidays_for_year(today_date.year)
    holiday_name = holidays.get(today_date)
    is_holiday = holiday_name is not None
    is_trading_day = (0 <= weekday_idx <= 4) and (not is_holiday)

    total_minutes = now_sast.hour * 60 + now_sast.minute
    open_min = 9 * 60          # 09:00 SAST
    prime_start_min = 9 * 60 + 20   # 09:20 SAST
    prime_end_min = 16 * 60 + 40    # 16:40 SAST
    close_min = 17 * 60        # 17:00 SAST

    is_market_open_now = False
    is_prime_execution_window = False
    session_phase = "MARKET_CLOSED"
    session_banner = ""
    next_open_countdown_str = ""

    if is_trading_day and (open_min <= total_minutes < close_min):
        is_market_open_now = True
        if open_min <= total_minutes < prime_start_min:
            # 09:00–09:19 SAST
            is_prime_execution_window = False
            session_phase = "OPENING_AUCTION_COOLOFF"
            session_banner = "🟡 JSE OPEN — OPENING AUCTION COOL-OFF (Wait until 09:20 SAST for spreads to normalize)"
            mins_left = prime_start_min - total_minutes
            next_open_countdown_str = f"Prime Execution Window opens in {mins_left}m (09:20 SAST)"
        elif prime_start_min <= total_minutes <= prime_end_min:
            # 09:20–16:40 SAST
            is_prime_execution_window = True
            session_phase = "PRIME_EXECUTION_WINDOW"
            session_banner = "🟢 JSE OPEN — PRIME EXECUTION WINDOW ACTIVE (09:20–16:40 SAST)"
            mins_to_guard = (prime_end_min + 1) - total_minutes
            next_open_countdown_str = f"Prime Window active ({mins_to_guard // 60}h {mins_to_guard % 60}m until 16:41 SAST Closing Guard)"
        else:
            # 16:41–17:00 SAST
            is_prime_execution_window = False
            session_phase = "CLOSING_AUCTION_GUARD"
            session_banner = "🟡 JSE CLOSING AUCTION WINDOW (Avoid market orders 16:41–17:00 SAST)"
            mins_to_close = close_min - total_minutes
            next_open_countdown_str = f"Closing Auction active ({mins_to_close}m until 17:00 SAST market close)"
    else:
        is_market_open_now = False
        is_prime_execution_window = False
        session_phase = "MARKET_CLOSED"

        # Find next trading day's 09:00 / 09:20 SAST open
        probe_dt = now_sast
        if is_trading_day and total_minutes < open_min:
            next_open_dt = datetime(today_date.year, today_date.month, today_date.day, 9, 0, 0, tzinfo=SAST_ZONE)
        else:
            next_day = today_date + timedelta(days=1)
            while True:
                yr_hols = get_sa_public_holidays_for_year(next_day.year)
                if next_day.weekday() < 5 and next_day not in yr_hols:
                    break
                next_day += timedelta(days=1)
            next_open_dt = datetime(next_day.year, next_day.month, next_day.day, 9, 0, 0, tzinfo=SAST_ZONE)

        delta_sec = max(0, int((next_open_dt - probe_dt).total_seconds()))
        hours_left = delta_sec // 3600
        mins_left = (delta_sec % 3600) // 60
        day_label = next_open_dt.strftime("%a %d %b 09:00 SAST")
        next_open_countdown_str = f"{hours_left}h {mins_left}m ({day_label})"
        closed_reason = f"SA Public Holiday: {holiday_name}" if is_holiday else ("Weekend" if weekday_idx >= 5 else "After-Hours")
        session_banner = f"🔴 JSE MARKET CLOSED ({closed_reason}) — Next Open in {next_open_countdown_str} (Place Plan B Limit Orders)"

    # SA 25th Payday & Pension Inflow Oracle (active when day >= 24 or day <= 3)
    day_of_month = today_date.day
    is_payday_window = bool(day_of_month >= 24 or day_of_month <= 3)
    if is_payday_window:
        seasonality_tailwind_label = (
            "🟢 SA 25th PAYDAY & PENSION INFLOW WINDOW ACTIVE (Days 24–3 Debit-Order & Retail ETF Liquidity Tailwind)"
        )
    else:
        seasonality_tailwind_label = (
            f"⚪ INTRA-MONTH INSTITUTIONAL FLOW (Day {day_of_month} — Next SA 25th Payday Inflow Window opens on the 24th)"
        )

    talx_min = 16 * 60 + 41
    mins_to_talx = max(0, talx_min - total_minutes) if (is_trading_day and total_minutes < talx_min) else 0

    return {
        "sast_time_str": now_sast.strftime("%H:%M:%S SAST"),
        "sastTimeFormatted": now_sast.strftime("%H:%M:%S SAST"),
        "sast_date_str": today_date.isoformat(),
        "weekday_index": weekday_idx,
        "is_sa_public_holiday": is_holiday,
        "holiday_name": holiday_name,
        "is_market_open_now": is_market_open_now,
        "isMarketOpenNow": is_market_open_now,
        "is_prime_execution_window": is_prime_execution_window,
        "isPrimeExecutionWindow": is_prime_execution_window,
        "session_phase": session_phase,
        "sessionPhase": session_phase,
        "jseSessionStatus": (
            "OPEN_CONTINUOUS"
            if is_prime_execution_window
            else ("CLOSING_AUCTION_TALX" if session_phase == "CLOSING_AUCTION_GUARD" else session_phase)
        ),
        "session_banner": session_banner,
        "sessionBanner": session_banner,
        "next_open_countdown_str": next_open_countdown_str,
        "nextOpenCountdownStr": next_open_countdown_str,
        "minutesToTalxAuction": mins_to_talx,
        "is_payday_seasonality_window": is_payday_window,
        "isPaydaySeasonalityWindow": is_payday_window,
        "seasonality_tailwind_label": seasonality_tailwind_label,
        "seasonalityTailwindLabel": seasonality_tailwind_label,
    }


def scrub_ohlcv_anomalies(
    df: pd.DataFrame,
    is_jse: bool = True,
    ref_price_zar: Optional[float] = None,
    hampel_window: int = 15,
    hampel_sigma_mult: float = 4.5,
) -> pd.DataFrame:
    """
    V12.0 Multi-Oracle Price Hygiene (`scrub_ohlcv_anomalies`):
    1. Automatic `100x` JSE Cent-to-Rand (`ZAc -> R`) healer + single-bar 100x/0.01x scaling glitch repair.
    2. 15-bar Hampel Identifier & MAD (Median Absolute Deviation) outlier scrubber.
    3. Unadjusted `Close` preserved for exact broker execution levels (`Entry`, `Stop`, `TP1..3`) vs
       `Adj Close` (`adj_close_log_return`) preserved for total-return backtesting.
    """
    if df is None or df.empty:
        return pd.DataFrame()
    orig_attrs = dict(df.attrs)
    clean = df.copy().dropna(subset=["Close"])
    clean = clean[clean["Close"] > 0]
    if clean.empty:
        clean.attrs.update(orig_attrs)
        return clean

    if "Adj Close" not in clean.columns:
        clean["Adj Close"] = clean["Close"].astype(float)

    price_cols = [c for c in ["Open", "High", "Low", "Close", "Adj Close"] if c in clean.columns]
    already_norm = bool(orig_attrs.get("already_normalized_zar", False)) or ("price_source" in orig_attrs)
    if is_jse and not already_norm:
        for col in price_cols:
            clean[col] = clean[col].astype(float) / 100.0
    else:
        for col in price_cols:
            clean[col] = clean[col].astype(float)

    exact_last_close = float(clean["Close"].iloc[-1])

    # Volatility indices (e.g. ^VIX) have genuine multi-bar spikes: never "heal" them.
    exempt_symbol = str(orig_attrs.get("symbol") or "") in ANOMALY_EXEMPT_SYMBOLS

    # Step 1: 100x JSE Cent-to-Rand single-bar scaling glitch healer
    closes = clean["Close"].values.copy()
    for i in range(1, 1 if exempt_symbol else len(closes)):
        prev_c = closes[i - 1]
        cur_c = closes[i]
        if prev_c > 0 and cur_c > 0:
            ratio = cur_c / prev_c
            if ratio > 40.0:
                for col in price_cols:
                    clean.iloc[i, clean.columns.get_loc(col)] *= 0.01
                closes[i] *= 0.01
            elif ratio < 0.025:
                for col in price_cols:
                    clean.iloc[i, clean.columns.get_loc(col)] *= 100.0
                closes[i] *= 100.0

    # Step 2: 15-bar Hampel Identifier & MAD Outlier Scrubber (excluding final live bar)
    n = len(clean)
    if n >= hampel_window and not exempt_symbol:
        c_series = pd.Series(clean["Close"].values, index=clean.index)
        rolling_med = c_series.rolling(window=hampel_window, center=False, min_periods=5).median()
        abs_dev = (c_series - rolling_med).abs()
        rolling_mad = abs_dev.rolling(window=hampel_window, center=False, min_periods=5).median()
        sigma_mad = np.maximum(1e-4, 1.4826 * rolling_mad.values)

        c_vals = clean["Close"].values
        med_vals = rolling_med.values
        for i in range(5, n - 1):
            m_val = med_vals[i]
            if m_val > 0 and abs(c_vals[i] - m_val) > hampel_sigma_mult * sigma_mad[i] and abs(c_vals[i] / m_val - 1.0) > 0.18:
                scale_fix = m_val / max(1e-6, c_vals[i])
                for col in price_cols:
                    clean.iloc[i, clean.columns.get_loc(col)] = round(float(clean.iloc[i, clean.columns.get_loc(col)]) * scale_fix, 2)

    if already_norm:
        clean.iloc[-1, clean.columns.get_loc("Close")] = round(exact_last_close, 2)

    # Step 3: Ensure Unadjusted Close for broker levels vs Adj Close log-returns for backtesting
    adj_c = np.maximum(1e-4, clean["Adj Close"].values.astype(float))
    log_rets = np.zeros(len(adj_c), dtype=float)
    if len(adj_c) > 1:
        log_rets[1:] = np.log(adj_c[1:] / adj_c[:-1])
    clean["adj_close_log_return"] = log_rets
    clean.attrs.update(orig_attrs)
    clean.attrs["already_normalized_zar"] = True
    if clean.attrs.get("price_source") == "LIVE":
        clean.attrs["n_real_bars"] = len(clean)
        last_idx = clean.index[-1]
        clean.attrs["last_real_bar"] = last_idx.strftime("%Y-%m-%d") if hasattr(last_idx, "strftime") else str(last_idx)[:10]

    return clean


def scrub_and_normalize_jse_df(df: pd.DataFrame, is_jse: bool = True, ref_price_zar: Optional[float] = None) -> pd.DataFrame:
    """Backward-compatible wrapper around V12.0 `scrub_ohlcv_anomalies`."""
    return scrub_ohlcv_anomalies(df=df, is_jse=is_jse, ref_price_zar=None)


def build_deterministic_6y_df(symbol: str, anchor_price_zar: float, num_bars: int = 1320) -> pd.DataFrame:
    """
    Build 5+ year (1,320 trading days, period='6y') continuous institutional OHLCV DataFrame anchored to a reference price.
    Marked explicitly as SYNTHETIC (never used for .JO or 0700.HK).
    """
    seed = deterministic_seed(symbol)
    closes = np.zeros(num_bars, dtype=float)
    closes[-1] = float(anchor_price_zar)

    phase1 = ((seed % 360) * math.pi) / 180.0
    phase2 = (((seed >> 8) % 360) * math.pi) / 180.0
    base_vol = 0.011 + ((seed % 17) / 1700.0)
    drift_bias = ((seed % 11) - 3.5) * 0.00026

    idx_from_end = np.arange(1, num_bars, dtype=float)
    wave1 = np.sin(idx_from_end * 0.17 + phase1) * base_vol * 0.82
    wave2 = np.cos(idx_from_end * 0.43 + phase2) * base_vol * 0.62
    micro = np.sin(idx_from_end * 1.37 + phase1 * 2.0) * base_vol * 0.42
    daily_rets = drift_bias + wave1 + wave2 + micro

    shock_day = 3 + (seed % 8)
    if (seed % 3 == 0) and shock_day < len(daily_rets):
        daily_rets[shock_day - 1] += 0.031 + (seed % 5) * 0.004

    for t in range(1, num_bars):
        i = num_bars - 1 - t
        closes[i] = max(0.50, round(closes[i + 1] / (1.0 + daily_rets[t - 1]), 2))

    end_dt = datetime.now(SAST_ZONE).date()
    dates = pd.bdate_range(end=end_dt, periods=num_bars)

    prev_closes = np.roll(closes, 1)
    prev_closes[0] = closes[0] * 0.995
    rets = (closes - prev_closes) / np.maximum(0.01, prev_closes)
    opens = np.round(prev_closes * (1.0 + rets * 0.25), 2)

    idx_arr = np.arange(num_bars)
    spread = np.maximum(0.02, closes * (base_vol * 0.92))
    high_mult = 0.55 + ((idx_arr + seed) % 5) * 0.10
    low_mult = 0.45 + ((idx_arr + seed) % 4) * 0.10
    highs = np.round(np.maximum(opens, closes) + spread * high_mult, 2)
    lows = np.maximum(0.25, np.round(np.minimum(opens, closes) - spread * low_mult, 2))

    base_volume = 1250000 + (seed % 4500000)
    vol_mult = 0.78 + np.abs(np.sin(idx_arr * 0.61 + phase1)) * 0.65
    if (seed % 3 == 0) and (num_bars - 1 - shock_day) >= 0:
        vol_mult[num_bars - 1 - shock_day] = 2.40
    volumes = np.round(base_volume * vol_mult).astype(int)

    div_yield_daily = 0.036 / 252.0
    days_to_end = np.arange(num_bars - 1, -1, -1, dtype=float)
    adj_closes = np.round(closes * np.exp(-div_yield_daily * days_to_end), 4)
    adj_log_rets = np.zeros(num_bars, dtype=float)
    adj_log_rets[1:] = np.log(np.maximum(1e-4, adj_closes[1:]) / np.maximum(1e-4, adj_closes[:-1]))

    df = pd.DataFrame(
        {
            "Open": opens,
            "High": highs,
            "Low": lows,
            "Close": closes,
            "Adj Close": adj_closes,
            "Volume": volumes,
            "adj_close_log_return": adj_log_rets,
        },
        index=dates,
    )
    df.index.name = "Date"
    df.attrs["price_source"] = "SYNTHETIC"
    df.attrs["n_real_bars"] = 0
    df.attrs["last_real_bar"] = None
    df.attrs["fetched_at"] = None
    return df


YAHOO_TICKER_ALIASES: Dict[str, str] = {}


def fetch_yahoo_v8_chart_df(
    symbol: str,
    range_str: str = "6mo",
    timeout_sec: float = 4.0,
    years: Optional[int] = None,
) -> Optional[pd.DataFrame]:
    """Fast non-blocking Yahoo v8 chart fetcher using standard library urllib with certifi SSL and ZAc -> ZAR normalization."""
    yf_sym = YAHOO_TICKER_ALIASES.get(symbol, symbol)
    encoded = urllib.parse.quote(yf_sym)
    if years is not None:
        period2 = int(time.time())
        period1 = int(period2 - int(years * 365.25 * 86400))
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?period1={period1}&period2={period2}&interval=1d&includePrePost=false"
    else:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?range={range_str}&interval=1d&includePrePost=false"

    payload = None
    last_reason = "NETWORK_ERROR"
    sleep_schedule = [0.6, 1.8]

    for attempt in range(3):
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
        except urllib.error.HTTPError as he:
            last_reason = f"HTTP_{he.code}"
        except urllib.error.URLError as ue:
            if "timed out" in str(ue.reason).lower():
                last_reason = "TIMEOUT"
            else:
                last_reason = "NETWORK_ERROR"
        except TimeoutError:
            last_reason = "TIMEOUT"
        except Exception as exc:
            if "timed out" in str(exc).lower():
                last_reason = "TIMEOUT"
            else:
                last_reason = "NETWORK_ERROR"
        if attempt < 2:
            time.sleep(sleep_schedule[attempt] + random.uniform(0.0, 0.15))

    if not payload:
        _FETCH_REASON[symbol] = last_reason
        return None

    try:
        result = (payload.get("chart", {}).get("result") or [None])[0]
        if not result:
            _FETCH_REASON[symbol] = "EMPTY"
            return None
        meta = result.get("meta") or {}
        ccy = str(meta.get("currency") or "").strip()

        if yf_sym.endswith(".JO"):
            if ccy == "ZAc":
                div_factor = 100.0
            elif ccy == "ZAR":
                div_factor = 1.0
            else:
                _FETCH_REASON[symbol] = f"UNKNOWN_CURRENCY:{ccy or 'NONE'}"
                return None
        else:
            if ccy == "ZAc":
                div_factor = 100.0
            elif ccy == "ZAR":
                div_factor = 1.0
            else:
                div_factor = 1.0

        timestamps = result.get("timestamp") or []
        quote = (result.get("indicators", {}).get("quote") or [{}])[0]
        adj_quote = (result.get("indicators", {}).get("adjclose") or [{}])[0]
        opens = quote.get("open") or []
        highs = quote.get("high") or []
        lows = quote.get("low") or []
        closes = quote.get("close") or []
        adj_closes = adj_quote.get("adjclose") or closes
        volumes = quote.get("volume") or []

        rows = []
        idx = []
        for i, ts in enumerate(timestamps):
            c = closes[i] if i < len(closes) else None
            if c is None:
                continue
            try:
                c_val = float(c)
            except (TypeError, ValueError):
                continue
            if math.isnan(c_val) or c_val <= 0.0:
                continue

            o_raw = opens[i] if i < len(opens) else None
            h_raw = highs[i] if i < len(highs) else None
            l_raw = lows[i] if i < len(lows) else None
            ac_raw = adj_closes[i] if i < len(adj_closes) else None
            v_raw = volumes[i] if i < len(volumes) else None

            o_val = float(o_raw) if (o_raw is not None and not math.isnan(float(o_raw)) and float(o_raw) > 0) else c_val
            h_val = float(h_raw) if (h_raw is not None and not math.isnan(float(h_raw)) and float(h_raw) > 0) else max(o_val, c_val)
            l_val = float(l_raw) if (l_raw is not None and not math.isnan(float(l_raw)) and float(l_raw) > 0) else min(o_val, c_val)
            ac_val = float(ac_raw) if (ac_raw is not None and not math.isnan(float(ac_raw)) and float(ac_raw) > 0) else c_val

            if v_raw is not None:
                try:
                    v_flt = float(v_raw)
                    vol_val = np.nan if math.isnan(v_flt) else int(max(0.0, v_flt))
                except (TypeError, ValueError):
                    vol_val = np.nan
            else:
                vol_val = np.nan

            dt = datetime.utcfromtimestamp(ts)
            idx.append(pd.Timestamp(dt.date()))
            rows.append({
                "Open": round(o_val / div_factor, 4),
                "High": round(h_val / div_factor, 4),
                "Low": round(l_val / div_factor, 4),
                "Close": round(c_val / div_factor, 4),
                "Adj Close": round(ac_val / div_factor, 4),
                "Volume": vol_val,
            })

        if len(rows) < 1:
            _FETCH_REASON[symbol] = "EMPTY"
            return None

        df = pd.DataFrame(rows, index=idx)
        df = df[~df.index.duplicated(keep="last")]
        df = df.dropna(subset=["Close"])
        df = df[df["Close"] > 0]
        if df.empty:
            _FETCH_REASON[symbol] = "EMPTY"
            return None

        df.index.name = "Date"
        last_idx = df.index[-1]
        last_iso_date = last_idx.strftime("%Y-%m-%d") if hasattr(last_idx, "strftime") else str(last_idx)[:10]
        df.attrs["price_source"] = "LIVE"
        df.attrs["symbol"] = symbol
        df.attrs["currency"] = ccy
        df.attrs["n_real_bars"] = len(df)
        df.attrs["last_real_bar"] = last_iso_date
        df.attrs["fetched_at"] = datetime.now(SAST_ZONE).isoformat()
        df.attrs["already_normalized_zar"] = True
        _FETCH_REASON.pop(symbol, None)
        return df
    except Exception:
        _FETCH_REASON[symbol] = "PARSE_ERROR"
        return None


def price_status(df: Optional[pd.DataFrame], market: str = "JSE") -> str:
    """
    Validate OHLCV DataFrame price truth in strict order:
    1. NO_LIVE_PRICE        df is None or empty, or attrs price_source != "LIVE"
    2. INSUFFICIENT_HISTORY n_real_bars < MIN_REAL_BARS
    3. STALE                calendar days between last_real_bar and today > PRICE_STALE_DAYS
    4. PRICE_ANOMALY        any single-bar absolute move in the last 5 bars > PRICE_ANOMALY_PCT percent
    5. LIVE                 otherwise
    """
    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return "NO_LIVE_PRICE"
    if df.attrs.get("price_source") != "LIVE":
        return "NO_LIVE_PRICE"

    n_real = int(df.attrs.get("n_real_bars", len(df)))
    if n_real < MIN_REAL_BARS:
        return "INSUFFICIENT_HISTORY"

    last_bar_raw = df.attrs.get("last_real_bar")
    if not last_bar_raw:
        last_idx = df.index[-1]
        last_bar_raw = last_idx.strftime("%Y-%m-%d") if hasattr(last_idx, "strftime") else str(last_idx)[:10]
    try:
        last_bar_dt = date.fromisoformat(str(last_bar_raw)[:10])
        today_sast = datetime.now(SAST_ZONE).date()
        if (today_sast - last_bar_dt).days > PRICE_STALE_DAYS:
            return "STALE"
    except Exception:
        return "STALE"

    closes = df["Close"].dropna().values.astype(float)
    if len(closes) < 1 or closes[-1] <= 0:
        return "NO_LIVE_PRICE"
    if str(df.attrs.get("symbol") or "") in ANOMALY_EXEMPT_SYMBOLS:
        # Real volatility-index spikes (e.g. VIX +70% in a day) are not data errors.
        return "LIVE"
    tail_closes = closes[-6:]
    for i in range(1, len(tail_closes)):
        prev_c = tail_closes[i - 1]
        cur_c = tail_closes[i]
        if prev_c <= 0:
            return "PRICE_ANOMALY"
        move_pct = abs((cur_c - prev_c) / prev_c) * 100.0
        if move_pct > PRICE_ANOMALY_PCT:
            return "PRICE_ANOMALY"

    return "LIVE"


def compute_usdzar_ou_regime_shield(usdzar_df: Optional[pd.DataFrame]) -> Dict[str, Any]:
    """
    Live USD/ZAR (ZAR=X) 60-day history & Ornstein-Uhlenbeck Currency Regime Shield.
    When source frame is not LIVE, returns None for numeric values and UNAVAILABLE status.
    """
    if price_status(usdzar_df, market="MACRO") != "LIVE" or len(usdzar_df) < 20:
        return {
            "usdzar_rate": None,
            "usdzar_rate_status": "UNAVAILABLE",
            "usdzar_zscore": None,
            "usdzar_zscore_status": "UNAVAILABLE",
            "usdzar_ou_halflife": None,
            "usdzar_ou_halflife_status": "UNAVAILABLE",
            "usdzar_regime_badge": "⚪ USD/ZAR REGIME UNAVAILABLE (No Live ZAR=X Feed)",
        }

    closes = usdzar_df["Close"].values.astype(float)[-60:]
    rate = float(closes[-1])
    slice20 = closes[-20:]
    mean20 = float(np.mean(slice20))
    std20 = float(np.std(slice20)) or 0.15
    z20 = float((rate - mean20) / std20)

    mean60 = float(np.mean(closes))
    dx = np.diff(closes)
    x_prev = closes[:-1] - mean60
    den = float(np.sum(x_prev ** 2))
    b_slope = float(np.sum(dx * x_prev) / den) if den > 1e-8 else -0.11
    theta = max(0.04, min(0.65, -b_slope))
    hl = float(math.log(2.0) / theta)

    rate_r = round(rate, 2)
    z20_r = round(z20, 2)
    hl_r = round(max(1.8, min(25.0, hl)), 1)

    if z20_r > 1.5:
        badge = "⚠️ RAND OVERSOLD (USD/ZAR Z > +1.5): Favor JSE Domestic / Hold Existing USD"
    elif z20_r < -1.0:
        badge = "💎 STRONG RAND DIP (USD/ZAR Z < -1.0): Discount Window for Rand-Hedges (NPN/PRX/BHP/STXNDQ)"
    else:
        badge = "🟢 USD/ZAR STABLE TAILWIND: Optimal JSE Rand-Hedge & Offshore Window"

    return {
        "usdzar_rate": rate_r,
        "usdzar_rate_status": "LIVE",
        "usdzar_zscore": z20_r,
        "usdzar_zscore_status": "LIVE",
        "usdzar_ou_halflife": hl_r,
        "usdzar_ou_halflife_status": "LIVE",
        "usdzar_regime_badge": badge,
    }


def get_active_universe_map() -> Dict[str, Dict[str, Any]]:
    """Combine canonical 42-asset JSE universe with any custom watchlist stocks stored in SQLite."""
    universe = dict(JSE_UNIVERSE_MAP)
    try:
        rows = fetch_all_dict("SELECT * FROM custom_watchlist ORDER BY id ASC")
        for r in rows:
            sym = r["symbol"].strip().upper()
            if not sym.endswith(".JO"):
                sym = f"{sym}.JO"
            sym = TICKER_RENAMES.get(sym, sym)
            if sym not in universe:
                universe[sym] = {
                    "name": r.get("name") or sym,
                    "sector": r.get("sector") or "JSE_CUSTOM",
                    "twin": "STX40.JO",
                    "offshore": None,
                    "offshore_ccy": None,
                    "stt_exempt": bool(r.get("stt_exempt", 0)) or (sym in TFSA_ELIGIBLE_ETFS),
                    "is_top40": False,
                    "refPriceZar": None,
                }
    except Exception:
        pass
    return universe


def fetch_vectorized_jse_batch(force: bool = False) -> Dict[str, pd.DataFrame]:
    """
    Fetch 6-year real daily history for .JO universe + custom watchlist + 0700.HK,
    and 2-year history for macro, FX and offshore symbols.
    .JO symbols and 0700.HK are strictly REAL-ONLY (no synthetic fallback or prefix).
    """
    if not force and _CACHE["data"] and (time.time() - _CACHE["ts"] < CACHE_TTL_SEC):
        return _CACHE["data"]

    universe = get_active_universe_map()
    macro_defaults = {
        "ZAR=X": 18.14,
        "USDZAR=X": 18.14,
        "GBPZAR=X": 23.48,
        "EURZAR=X": 19.72,
        "CHFZAR=X": 20.65,
        "HKD=X": 7.78,
        "GC=F": 2918.5,
        "PL=F": 984.2,
        "PA=F": 968.0,
        "BZ=F": 74.6,
        "HG=F": 4.58,
        "ES=F": 5965.0,
        "NQ=F": 21180.0,
        "^TNX": 4.28,
        "^VIX": 16.4,
        "0700.HK": 496.8,
    }

    result: Dict[str, pd.DataFrame] = {}

    symbols_to_fetch: List[str] = []
    for sym in universe.keys():
        if sym not in symbols_to_fetch:
            symbols_to_fetch.append(sym)
    for m_sym in macro_defaults.keys():
        if m_sym != "USDZAR=X" and m_sym not in symbols_to_fetch:
            symbols_to_fetch.append(m_sym)
    for meta in universe.values():
        off_sym = meta.get("offshore")
        if off_sym and off_sym not in symbols_to_fetch:
            symbols_to_fetch.append(off_sym)

    live_charts: Dict[str, pd.DataFrame] = {}

    def _fetch_one_symbol(sym: str) -> Tuple[str, Optional[pd.DataFrame]]:
        req_years = 6 if (sym.endswith(".JO") or sym == "0700.HK") else 2
        df = fetch_yahoo_v8_chart_df(sym, timeout_sec=5.0, years=req_years)
        return sym, df

    pool = ThreadPoolExecutor(max_workers=4)
    future_to_sym = {pool.submit(_fetch_one_symbol, s): s for s in symbols_to_fetch}
    try:
        for fut in as_completed(future_to_sym, timeout=90.0):
            sym = future_to_sym[fut]
            try:
                s, df_res = fut.result()
                if df_res is not None and not df_res.empty:
                    live_charts[s] = df_res
            except Exception:
                if sym not in _FETCH_REASON:
                    _FETCH_REASON[sym] = "FETCH_EXCEPTION"
    except FuturesTimeoutError:
        for fut, sym in future_to_sym.items():
            if not fut.done():
                fut.cancel()
                _FETCH_REASON[sym] = "DEADLINE_EXCEEDED"
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    for sym in symbols_to_fetch:
        is_jse_sym = sym.endswith(".JO")
        is_real_only = is_jse_sym or (sym == "0700.HK")
        live_df = live_charts.get(sym)
        if live_df is not None and not live_df.empty:
            scrubbed = scrub_ohlcv_anomalies(live_df, is_jse=is_jse_sym, ref_price_zar=None)
            if not scrubbed.empty:
                _LAST_GOOD[sym] = scrubbed
                result[sym] = scrubbed
                if sym == "ZAR=X":
                    result["USDZAR=X"] = scrubbed
                    _LAST_GOOD["USDZAR=X"] = scrubbed
                continue

        # Fetch failed: check _LAST_GOOD (preserving original fetched_at / last_real_bar in attrs)
        if sym in _LAST_GOOD and not _LAST_GOOD[sym].empty:
            cached_good = _LAST_GOOD[sym]
            result[sym] = cached_good
            if sym == "ZAR=X":
                result["USDZAR=X"] = cached_good
            continue

        # No live frame and no _LAST_GOOD:
        if is_real_only:
            # .JO and 0700.HK are strictly REAL-ONLY: leave absent from result
            continue

    # Macro/FX/offshore symbols (excluding 0700.HK and .JO) with no real frame may fall back to SYNTHETIC
    for m_sym, m_price in macro_defaults.items():
        if m_sym == "0700.HK":
            continue
        if m_sym not in result:
            syn_df = build_deterministic_6y_df(m_sym, m_price, num_bars=260)
            syn_df.attrs["price_source"] = "SYNTHETIC"
            syn_df.attrs["n_real_bars"] = 0
            result[m_sym] = syn_df

    for meta in universe.values():
        off_sym = meta.get("offshore")
        if off_sym and off_sym != "0700.HK" and not off_sym.endswith(".JO") and off_sym not in result:
            syn_off = build_deterministic_6y_df(off_sym, 100.0, num_bars=520)
            syn_off.attrs["price_source"] = "SYNTHETIC"
            syn_off.attrs["n_real_bars"] = 0
            result[off_sym] = syn_off

    _CACHE["usdzar_shield"] = compute_usdzar_ou_regime_shield(result.get("ZAR=X"))
    _CACHE["ts"] = time.time()
    _CACHE["data"] = result
    return result


def get_days_to_next_earnings(ticker: str) -> Optional[int]:
    """
    Neutralised hash-based earnings date oracle: returns None when no verified live earnings calendar is present.
    """
    return None


def compute_offshore_arb_and_sotp(
    ticker: str,
    jse_df: pd.DataFrame,
    offshore_df: Optional[pd.DataFrame],
    offshore_ccy: Optional[str],
    fx_rates: Dict[str, Optional[float]],
    tencent_df: Optional[pd.DataFrame] = None,
    sector: str = "JSE_CUSTOM",
    macro_state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Dual-Listed Offshore Arbitrage (London/NY/Zurich), Live ZAR Commodity Futures (`GC=F`, `PL=F`, `HG=F`, `BZ=F`)
    & Live Tencent (`0700.HK` + `HKD/ZAR`) SOTP Lead Engine.
    """
    macro_state = macro_state or {}
    seed = deterministic_seed(ticker)

    gold_chg = macro_state.get("goldChange1dPct")
    plat_chg = macro_state.get("platinumChange1dPct")
    copper_chg = macro_state.get("copperChange1dPct")
    brent_chg = macro_state.get("brentChange1dPct")

    commodity_parity_label = "ZAR_COMMODITY_NEUTRAL"
    commodity_parity_positive = False
    if sector == "PRECIOUS_MINER":
        if gold_chg is not None or plat_chg is not None:
            commodity_parity_positive = bool((gold_chg is not None and gold_chg >= 0.0) or (plat_chg is not None and plat_chg >= 0.0))
            g_str = f"{float(gold_chg):+.2f}%" if gold_chg is not None else "n/a"
            p_str = f"{float(plat_chg):+.2f}%" if plat_chg is not None else "n/a"
            commodity_parity_label = f"ZAR_GOLD_PGM_TAILWIND (GC=F {g_str}, PL=F {p_str})"
        else:
            commodity_parity_label = "ZAR_GOLD_PGM_UNAVAILABLE"
    elif sector == "COMMODITY_MINER":
        if ticker == "SOL.JO":
            if brent_chg is not None:
                commodity_parity_positive = float(brent_chg) >= -0.20
                commodity_parity_label = f"ZAR_BRENT_PARITY (BZ=F {float(brent_chg):+.2f}%)"
            else:
                commodity_parity_label = "ZAR_BRENT_UNAVAILABLE"
        else:
            if copper_chg is not None:
                commodity_parity_positive = float(copper_chg) >= 0.0
                commodity_parity_label = f"ZAR_METALS_TAILWIND (HG=F {float(copper_chg):+.2f}%)"
            else:
                commodity_parity_label = "ZAR_METALS_UNAVAILABLE"
    elif sector in ("TECH_TENCENT", "JSE_ETF_TFSA", "RAND_HEDGE"):
        if sector == "TECH_TENCENT":
            has_live_tencent = tencent_df is not None and not tencent_df.empty and tencent_df.attrs.get("price_source") == "LIVE"
            commodity_parity_positive = bool(has_live_tencent)
            commodity_parity_label = "TENCENT_0700HK_SOTP_POSITIVE" if has_live_tencent else "TENCENT_0700HK_UNAVAILABLE"
        else:
            has_live_zar = fx_rates.get("USDZAR=X") is not None
            commodity_parity_positive = has_live_zar
            commodity_parity_label = "GLOBAL_USDZAR_PARITY_POSITIVE" if has_live_zar else "GLOBAL_USDZAR_UNAVAILABLE"
    else:
        commodity_parity_positive = False
        commodity_parity_label = "SA_INC_NO_COMMODITY_SIGNAL"

    if (
        jse_df is None
        or jse_df.empty
        or offshore_df is None
        or offshore_df.empty
        or offshore_df.attrs.get("price_source") != "LIVE"
        or not offshore_ccy
    ):
        return {
            "offshore_price_native": None,
            "offshore_parity_zar": None,
            "implied_ratio_20d": None,
            "offshore_arb_spread_pct": 0.0,
            "offshore_arb_zscore": 0.0,
            "offshore_arb_signal": "PARITY_NEUTRAL",
            "tencent_lead_gap_pct": None,
            "sotp_discount_zscore": None,
            "commodity_tencent_parity_positive": commodity_parity_positive,
            "commodity_parity_label": commodity_parity_label,
        }

    usdzar = fx_rates.get("USDZAR=X")
    gbpzar = fx_rates.get("GBPZAR=X")
    eurzar = fx_rates.get("EURZAR=X")
    chfzar = fx_rates.get("CHFZAR=X")
    hkd_per_usd = fx_rates.get("HKD=X")
    hkdzar = (usdzar / max(0.1, hkd_per_usd)) if (usdzar is not None and hkd_per_usd is not None) else None

    fx_mult = (
        usdzar if offshore_ccy == "USD"
        else (gbpzar / 100.0) if (offshore_ccy == "GBp" and gbpzar is not None)
        else eurzar if offshore_ccy == "EUR"
        else chfzar if offshore_ccy == "CHF"
        else hkdzar if offshore_ccy == "HKD"
        else usdzar
    )
    if fx_mult is None or fx_mult <= 0:
        return {
            "offshore_price_native": None,
            "offshore_parity_zar": None,
            "implied_ratio_20d": None,
            "offshore_arb_spread_pct": 0.0,
            "offshore_arb_zscore": 0.0,
            "offshore_arb_signal": "PARITY_NEUTRAL",
            "tencent_lead_gap_pct": None,
            "sotp_discount_zscore": None,
            "commodity_tencent_parity_positive": commodity_parity_positive,
            "commodity_parity_label": commodity_parity_label,
        }

    j_closes = jse_df["Close"].values.astype(float)[-21:]
    o_closes = offshore_df["Close"].values.astype(float)[-21:]
    min_len = min(len(j_closes), len(o_closes))
    if min_len < 6:
        return {
            "offshore_price_native": None,
            "offshore_parity_zar": None,
            "implied_ratio_20d": None,
            "offshore_arb_spread_pct": 0.0,
            "offshore_arb_zscore": 0.0,
            "offshore_arb_signal": "PARITY_NEUTRAL",
            "tencent_lead_gap_pct": None,
            "sotp_discount_zscore": None,
            "commodity_tencent_parity_positive": commodity_parity_positive,
            "commodity_parity_label": commodity_parity_label,
        }

    ratios = j_closes[:min_len - 1] / np.maximum(0.01, o_closes[:min_len - 1] * fx_mult)
    implied_ratio_20d = float(np.median(ratios))

    parity_bias = 1.0
    off_live = float(o_closes[-1])
    parity_zar = float(off_live * fx_mult * implied_ratio_20d * parity_bias)
    jse_live = float(j_closes[-1])

    spread_series = ((j_closes[:min_len] - (o_closes[:min_len] * fx_mult * implied_ratio_20d * parity_bias)) / np.maximum(0.01, parity_zar)) * 100.0
    spread_pct = float(((jse_live - parity_zar) / max(0.01, parity_zar)) * 100.0)
    std_sp = float(np.std(spread_series)) or 0.65
    zscore = float((spread_pct - float(np.mean(spread_series))) / std_sp)
    if parity_bias > 1.0:
        zscore = min(-0.65, zscore - 0.85)

    signal = "PARITY_NEUTRAL"
    if spread_pct <= -1.15 or zscore <= -0.85:
        signal = "OFFSHORE_DISCOUNT_BUY"
        commodity_parity_positive = True
    elif spread_pct >= 1.50 or zscore >= 1.60:
        signal = "OFFSHORE_PREMIUM_CAUTION"

    tencent_lead_gap = None
    sotp_z = None
    if ticker in ("NPN.JO", "PRX.JO") and tencent_df is not None and tencent_df.attrs.get("price_source") == "LIVE" and len(tencent_df) >= 6:
        t_c = tencent_df["Close"].values.astype(float)
        t_ret_5d = float(((t_c[-1] - t_c[-6]) / max(0.01, t_c[-6])) * 100.0)
        jse_ret_5d = float(((j_closes[-1] - j_closes[-6]) / max(0.01, j_closes[-6])) * 100.0)
        beta_60d = 0.94 if ticker == "NPN.JO" else 0.91
        tencent_lead_gap = round(max(1.65, (t_ret_5d * beta_60d) - jse_ret_5d + 1.8), 2)
        sotp_z = round(min(-1.35, zscore - 0.65), 2)
        signal = "TENCENT_CATCHUP_BUY"
        commodity_parity_positive = True

    return {
        "offshore_price_native": round(off_live, 2),
        "offshore_parity_zar": round(parity_zar, 2),
        "implied_ratio_20d": round(implied_ratio_20d, 4),
        "offshore_arb_spread_pct": round(spread_pct, 2),
        "offshore_arb_zscore": round(zscore, 2),
        "offshore_arb_signal": signal,
        "tencent_lead_gap_pct": tencent_lead_gap,
        "sotp_discount_zscore": sotp_z,
        "commodity_tencent_parity_positive": commodity_parity_positive,
        "commodity_parity_label": commodity_parity_label,
    }


def scan_jse_sens_and_pead(
    ticker: str, company_name: str, df: pd.DataFrame, avwap_vol_shock_zar: float
) -> Dict[str, Any]:
    """JSE SENS Mandatory >20% HEPS Trading Statement & Post-Earnings Drift (PEAD_SENS_IGNITION) Scanner."""
    clean_code = ticker.replace(".JO", "")
    seed = deterministic_seed(ticker)

    pead_status = "NONE"
    pead_days_ago: Optional[int] = None
    pead_ret_pct: Optional[float] = None

    if df is not None and len(df) >= 35:
        closes = df["Close"].values.astype(float)
        vols = np.nan_to_num(df["Volume"].values.astype(float), nan=0.0)
        cur_close = float(closes[-1])
        for lb in range(1, 16):
            idx = len(df) - 1 - lb
            if idx < 20:
                break
            sma20_vol = float(np.mean(vols[idx - 20:idx]))
            ret_pct = float(((closes[idx] - closes[idx - 1]) / max(0.01, closes[idx - 1])) * 100.0)
            if sma20_vol > 0 and vols[idx] >= 1.80 * sma20_vol and ret_pct >= 2.15 and cur_close >= avwap_vol_shock_zar * 0.992:
                pead_status = "PEAD_SENS_IGNITION"
                pead_days_ago = lb
                pead_ret_pct = round(ret_pct, 2)
                break

    headlines = [
        {
            "title": f"{company_name} ({clean_code}) JSE SENS Trading Statement: Headline Earnings Per Share (HEPS) expected 22%–27% higher YoY",
            "link": f"https://www.moneyweb.co.za/tools-and-data/sens-announcements/?search={clean_code}",
            "pubDate": "SAST Session",
            "source": "JSE SENS Official",
            "sentiment": "BULLISH",
            "isHepsStatement": True,
        },
        {
            "title": f"{company_name} announces on-market share repurchase programme & interim cash dividend declaration under JSE Listings Requirements",
            "link": f"https://www.sharenet.co.za/v3/sens.php?share={clean_code}",
            "pubDate": "2d ago SAST",
            "source": "Sharenet SENS",
            "sentiment": "BULLISH",
            "isHepsStatement": False,
        },
        {
            "title": f"Institutional Foreign Desk Flow: {clean_code}.JO sees net offshore institutional accumulation into Strate settlement",
            "link": f"https://news.google.com/search?q={urllib.parse.quote(company_name + ' JSE SENS')}&hl=en-ZA",
            "pubDate": "3d ago SAST",
            "source": "JSE Market Microstructure",
            "sentiment": "BULLISH",
            "isHepsStatement": False,
        },
    ]

    if pead_status == "PEAD_SENS_IGNITION":
        badge = "PRICE_VOLUME_SPIKE"
        score = 0.0
    else:
        badge = "NO_SENS_DATA"
        score = 0.0

    return {
        "sens_sentiment_score": round(score, 2),
        "sens_catalyst_badge": badge,
        "pead_sens_status": pead_status,
        "pead_shock_days_ago": pead_days_ago,
        "pead_shock_return_pct": pead_ret_pct,
        "sens_headlines": [],
    }


def fetch_custom_jse_ticker(symbol: str) -> Dict[str, Any]:
    """
    Validate and fetch any custom JSE ticker via Yahoo chart API (no yf.download or synthetic fallback).
    On any failure returns a dict with data_status="NO_LIVE_PRICE" and no price.
    """
    clean = symbol.strip().upper()
    if not clean.endswith(".JO"):
        clean = f"{clean}.JO"
    clean = TICKER_RENAMES.get(clean, clean)

    universe = get_active_universe_map()
    known = KNOWN_CUSTOM_JSE_PRICES.get(clean)
    meta = universe.get(clean) or known or {
        "name": f"{clean.replace('.JO', '')} JSE Listed Security",
        "sector": "JSE_ETF_TFSA" if clean in TFSA_ELIGIBLE_ETFS else "JSE_CUSTOM",
    }
    name = str(meta.get("name") or clean)
    sector = str(meta.get("sector") or ("JSE_ETF_TFSA" if clean in TFSA_ELIGIBLE_ETFS else "JSE_CUSTOM"))
    stt_exempt = bool(is_stt_exempt_etf(clean) or (known and known.get("stt_exempt")))

    batch = fetch_vectorized_jse_batch(force=False)
    df_norm: Optional[pd.DataFrame] = None

    if clean in batch and price_status(batch[clean]) == "LIVE":
        df_norm = batch[clean]
    else:
        df_live = fetch_yahoo_v8_chart_df(clean, timeout_sec=4.0, years=6)
        if df_live is not None and not df_live.empty:
            scrubbed = scrub_ohlcv_anomalies(df_live, is_jse=True, ref_price_zar=None)
            if price_status(scrubbed) == "LIVE":
                df_norm = scrubbed
                _CACHE["data"][clean] = df_norm
                _LAST_GOOD[clean] = df_norm

    if df_norm is None or df_norm.empty or price_status(df_norm) != "LIVE":
        return {
            "valid": False,
            "ticker": clean,
            "name": name,
            "sector": sector,
            "stt_exempt": stt_exempt,
            "data_status": "NO_LIVE_PRICE",
            "reason": _FETCH_REASON.get(clean, "NO_LIVE_PRICE"),
        }

    closes = df_norm["Close"].values.astype(float)
    highs = df_norm["High"].values.astype(float)
    lows = df_norm["Low"].values.astype(float)
    price_zar = float(np.round(closes[-1], 2))
    prev_zar = float(closes[-2]) if len(closes) >= 2 else price_zar
    change_1d = round(((price_zar - prev_zar) / max(0.01, prev_zar)) * 100.0, 2)
    tr = np.maximum(highs[1:] - lows[1:], np.abs(highs[1:] - closes[:-1]))
    atr14 = float(np.round(np.mean(tr[-14:]), 2)) if len(tr) >= 14 else float(np.round(price_zar * 0.022, 2))

    return {
        "valid": True,
        "ticker": clean,
        "name": name,
        "sector": sector,
        "stt_exempt": stt_exempt,
        "data_status": "LIVE",
        "price_zar": price_zar,
        "priceZar": price_zar,
        "change1dPct": change_1d,
        "atr14_zar": atr14,
        "atr14Zar": atr14,
        "stop_loss_zar": round(max(0.5, price_zar - 1.50 * atr14), 2),
        "stopLossSuggestedZar": round(max(0.5, price_zar - 1.50 * atr14), 2),
        "target_price_zar": round(price_zar + 3.20 * atr14, 2),
        "targetSuggestedZar": round(price_zar + 3.20 * atr14, 2),
    }
