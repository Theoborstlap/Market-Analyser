"""PHASE 3: PAPER LAB — Append-Only Hypothetical R10,000 Core NAV & Real-Price Signal Grader."""

import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Set, Union

import numpy as np
import pandas as pd

from config import (
    CORE_PORTFOLIO_ETFS,
    CORE_RISK_ASSET_PCT,
    JSE_UNIVERSE_MAP,
    PAPER_CASH_RATE_PCT,
    PAPER_MIN_GRADED_FOR_RATE,
    PAPER_SIGNAL_HORIZON_DAYS,
    PAPER_START_CAPITAL_ZAR,
    SLIPPAGE_PER_SIDE_PCT,
    fee_round_trip_pct,
)
from data_fetcher import price_status
from database import (
    activate_paper_signal_entry,
    get_paper_core_meta,
    get_paper_prices,
    get_paper_signals,
    init_db,
    insert_paper_price,
    insert_paper_signal,
    set_paper_core_meta,
    update_paper_signal_grading,
)
import os
import sys
_ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT_DIR not in sys.path:
    sys.path.insert(0, _ROOT_DIR)
from shared_core.microstructure import evaluate_limit_dip_adverse_fill

PAPER_NOTICE_TEXT = (
    "Results over this few trades are mostly luck. A strategy needs well over "
    "100 graded trades AND a long track record before the numbers mean anything."
)


def _default_config_values() -> Dict[str, Any]:
    return {
        "PAPER_START_CAPITAL_ZAR": PAPER_START_CAPITAL_ZAR,
        "PAPER_SIGNAL_HORIZON_DAYS": PAPER_SIGNAL_HORIZON_DAYS,
        "PAPER_MIN_GRADED_FOR_RATE": PAPER_MIN_GRADED_FOR_RATE,
        "PAPER_CASH_RATE_PCT": PAPER_CASH_RATE_PCT,
        "CORE_PORTFOLIO_ETFS": list(CORE_PORTFOLIO_ETFS),
        "CORE_RISK_ASSET_PCT": CORE_RISK_ASSET_PCT,
        "SLIPPAGE_PER_SIDE_PCT": SLIPPAGE_PER_SIDE_PCT,
        "fee_round_trip_pct": fee_round_trip_pct,
    }


def _normalize_symbol(symbol: str) -> str:
    clean = (symbol or "").strip().upper()
    if not clean:
        return ""
    if not clean.endswith(".JO") and f"{clean}.JO" in JSE_UNIVERSE_MAP:
        return f"{clean}.JO"
    return clean


def _safe_float_or_none(val: Any) -> Optional[float]:
    if val is None or isinstance(val, bool):
        return None
    try:
        f = float(val)
        if not math.isfinite(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def _extract_bar_date_from_df(df: pd.DataFrame) -> Optional[str]:
    if df is None or df.empty:
        return None
    last_attr = df.attrs.get("last_real_bar")
    if isinstance(last_attr, str) and len(last_attr) >= 10:
        return last_attr[:10]
    last_idx = df.index[-1]
    if hasattr(last_idx, "strftime"):
        return last_idx.strftime("%Y-%m-%d")
    s = str(last_idx)
    return s[:10] if len(s) >= 10 else None


def _get_col_series(df: pd.DataFrame, col_name: str) -> Optional[pd.Series]:
    if col_name in df.columns:
        return df[col_name]
    lower = col_name.lower()
    for c in df.columns:
        if str(c).lower() == lower:
            return df[c]
    return None


def record_prices(
    frames_dict: Dict[str, Any],
    core_symbols: Optional[Sequence[str]] = None,
    signal_symbols: Optional[Sequence[str]] = None,
) -> Dict[str, Any]:
    """
    For each LIVE frame (price_status == 'LIVE') store the LAST complete bar's
    date/open/high/low/close in paper_prices (INSERT OR IGNORE).
    Skip anything not LIVE. If open/high/low are missing, store None.
    """
    init_db()
    if not frames_dict:
        return {"recorded": 0, "skipped": 0, "latest_bar_date": None}

    if core_symbols is None and signal_symbols is None:
        candidate_symbols: List[str] = list(frames_dict.keys())
    else:
        seen: Set[str] = set()
        candidate_symbols = []
        for s in list(core_symbols or []) + list(signal_symbols or []):
            norm = _normalize_symbol(s)
            if norm and norm not in seen:
                seen.add(norm)
                candidate_symbols.append(norm)

    recorded = 0
    skipped = 0
    latest_bar_date: Optional[str] = None

    for sym in candidate_symbols:
        df = frames_dict.get(sym)
        if df is None and not sym.endswith(".JO"):
            df = frames_dict.get(f"{sym}.JO")
            if df is not None:
                sym = f"{sym}.JO"

        if not isinstance(df, pd.DataFrame) or df.empty or price_status(df) != "LIVE":
            skipped += 1
            continue

        bar_date = _extract_bar_date_from_df(df)
        close_s = _get_col_series(df, "Close")
        if not bar_date or close_s is None or len(close_s) == 0:
            skipped += 1
            continue

        close_val = _safe_float_or_none(close_s.iloc[-1])
        if close_val is None or close_val <= 0:
            skipped += 1
            continue

        open_s = _get_col_series(df, "Open")
        high_s = _get_col_series(df, "High")
        low_s = _get_col_series(df, "Low")

        open_val = _safe_float_or_none(open_s.iloc[-1]) if (open_s is not None and len(open_s) > 0) else None
        high_val = _safe_float_or_none(high_s.iloc[-1]) if (high_s is not None and len(high_s) > 0) else None
        low_val = _safe_float_or_none(low_s.iloc[-1]) if (low_s is not None and len(low_s) > 0) else None

        if open_val is not None and open_val <= 0:
            open_val = None
        if high_val is not None and high_val <= 0:
            high_val = None
        if low_val is not None and low_val <= 0:
            low_val = None

        insert_paper_price(
            bar_date=bar_date,
            symbol=sym,
            open_price=round(open_val, 4) if open_val is not None else None,
            high_price=round(high_val, 4) if high_val is not None else None,
            low_price=round(low_val, 4) if low_val is not None else None,
            close_price=round(close_val, 4),
        )
        recorded += 1
        # P3 FIX 3: fill gaps (for example a missed evening) from the history already downloaded.
        # Only bars AFTER the last completed bar and BEFORE the newest bar; INSERT OR IGNORE.
        try:
            from database import get_paper_core_meta as _gpcm
            _last_done = _gpcm("last_completed_bar_date")
        except Exception:
            _last_done = None
        if _last_done and len(df) > 1:
            _last_done = str(_last_done)[:10]
            _n = len(df)
            for _i in range(max(0, _n - 11), _n - 1):
                try:
                    _idx = df.index[_i]
                    _bd = _idx.strftime("%Y-%m-%d") if hasattr(_idx, "strftime") else str(_idx)[:10]
                    if _bd <= _last_done or _bd >= bar_date:
                        continue
                    _row = df.iloc[_i]
                    _c = _safe_float_or_none(_row.get("Close"))
                    if _c is None or _c <= 0:
                        continue
                    _o = _safe_float_or_none(_row.get("Open"))
                    _h = _safe_float_or_none(_row.get("High"))
                    _l = _safe_float_or_none(_row.get("Low"))
                    if _o is not None and _o <= 0:
                        _o = None
                    if _h is not None and _h <= 0:
                        _h = None
                    if _l is not None and _l <= 0:
                        _l = None
                    insert_paper_price(
                        bar_date=_bd,
                        symbol=sym,
                        open_price=round(_o, 4) if _o is not None else None,
                        high_price=round(_h, 4) if _h is not None else None,
                        low_price=round(_l, 4) if _l is not None else None,
                        close_price=round(_c, 4),
                    )
                except Exception:
                    continue
        if latest_bar_date is None or bar_date > latest_bar_date:
            latest_bar_date = bar_date

    return {
        "recorded": recorded,
        "skipped": skipped,
        "latest_bar_date": latest_bar_date,
    }


def compute_core_nav(
    prices_rows: Optional[Sequence[Dict[str, Any]]] = None,
    inception_date: Optional[str] = None,
    config_values: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Deterministic recomputation of Core NAV & benchmarks from stored paper_prices only.
    - Hypothetical R10,000 held at CORE_RISK_ASSET_PCT split equally across CORE_PORTFOLIO_ETFS
      (rest cash at PAPER_CASH_RATE_PCT).
    - Entry cost per side = fee_round_trip_pct(ETF)/2 + SLIPPAGE_PER_SIDE_PCT applied once at inception.
    - Annual rebalance on the first stored bar of each new calendar year with the same cost on traded value.
    - Benchmarks: '100% equal-weight core ETFs, same costs' and 'STX40.JO only'.
    - Reports only dates for which ALL needed prices exist.
    """
    cfg = {**_default_config_values(), **(config_values or {})}
    if prices_rows is None:
        init_db()
        prices_rows = get_paper_prices()

    core_etfs: List[str] = [_normalize_symbol(s) for s in (cfg.get("CORE_PORTFOLIO_ETFS") or CORE_PORTFOLIO_ETFS)]
    needed_symbols: Set[str] = set(core_etfs) | {"STX40.JO"}

    inc_filter = str(inception_date)[:10] if inception_date else None
    closes_by_date: Dict[str, Dict[str, float]] = {}

    for row in prices_rows or []:
        b_date = str(row.get("bar_date") or "")[:10]
        sym = _normalize_symbol(str(row.get("symbol") or ""))
        if not b_date or not sym or sym not in needed_symbols:
            continue
        if inc_filter and b_date < inc_filter:
            continue
        c_val = _safe_float_or_none(row.get("close"))
        if c_val is None or c_val <= 0:
            continue
        closes_by_date.setdefault(b_date, {})[sym] = c_val

    valid_dates = sorted(
        d for d, sym_map in closes_by_date.items() if all(s in sym_map and sym_map[s] > 0 for s in needed_symbols)
    )
    if not valid_dates:
        return []

    start_capital = float(cfg.get("PAPER_START_CAPITAL_ZAR", PAPER_START_CAPITAL_ZAR))
    risk_pct = float(cfg.get("CORE_RISK_ASSET_PCT", CORE_RISK_ASSET_PCT))
    cash_rate_pct = float(cfg.get("PAPER_CASH_RATE_PCT", PAPER_CASH_RATE_PCT))
    slippage_side_pct = float(cfg.get("SLIPPAGE_PER_SIDE_PCT", SLIPPAGE_PER_SIDE_PCT))
    fee_fn = cfg.get("fee_round_trip_pct", fee_round_trip_pct)

    def _one_side_cost_frac(symbol: str) -> float:
        rt_fee = float(fee_fn(symbol)) if callable(fee_fn) else float(fee_round_trip_pct(symbol))
        return ((rt_fee / 2.0) + slippage_side_pct) / 100.0

    n_etfs = max(1, len(core_etfs))
    risk_frac = max(0.0, min(1.0, risk_pct / 100.0))
    cash_frac = 1.0 - risk_frac
    target_etf_w = risk_frac / n_etfs
    bm_eq_w = 1.0 / n_etfs

    d0 = valid_dates[0]
    d0_prices = closes_by_date[d0]

    # Core portfolio shares & cash at inception
    core_cash = start_capital * cash_frac
    core_shares: Dict[str, float] = {}
    for sym in core_etfs:
        alloc = start_capital * target_etf_w
        net_alloc = alloc * (1.0 - _one_side_cost_frac(sym))
        core_shares[sym] = net_alloc / d0_prices[sym]

    # Benchmark 1: 100% equal-weight core ETFs, same costs
    bm_eq_shares: Dict[str, float] = {}
    for sym in core_etfs:
        alloc = start_capital * bm_eq_w
        net_alloc = alloc * (1.0 - _one_side_cost_frac(sym))
        bm_eq_shares[sym] = net_alloc / d0_prices[sym]

    # Benchmark 2: STX40.JO only
    stx_net_alloc = start_capital * (1.0 - _one_side_cost_frac("STX40.JO"))
    bm_stx_shares = stx_net_alloc / d0_prices["STX40.JO"]

    current_year = d0[:4]
    prev_date_str = d0
    series: List[Dict[str, Any]] = []

    for idx, b_date in enumerate(valid_dates):
        day_prices = closes_by_date[b_date]

        if idx > 0 and cash_rate_pct != 0.0:
            try:
                dt_cur = datetime.strptime(b_date, "%Y-%m-%d").date()
                dt_prev = datetime.strptime(prev_date_str, "%Y-%m-%d").date()
                days_diff = max(0, (dt_cur - dt_prev).days)
                core_cash *= 1.0 + (cash_rate_pct / 100.0) * (days_diff / 365.0)
            except Exception:
                pass
        prev_date_str = b_date

        # Annual rebalance on the first stored bar of each new calendar year
        if idx > 0 and b_date[:4] != current_year:
            # Core portfolio rebalance
            pre_nav = core_cash + sum(core_shares[s] * day_prices[s] for s in core_etfs)
            reb_cost = sum(
                abs((pre_nav * target_etf_w) - (core_shares[s] * day_prices[s])) * _one_side_cost_frac(s)
                for s in core_etfs
            )
            post_nav = max(0.0, pre_nav - reb_cost)
            core_cash = post_nav * cash_frac
            for s in core_etfs:
                core_shares[s] = (post_nav * target_etf_w) / day_prices[s]

            # Benchmark 1 rebalance (100% equal-weight core ETFs, same costs)
            bm_pre_nav = sum(bm_eq_shares[s] * day_prices[s] for s in core_etfs)
            bm_reb_cost = sum(
                abs((bm_pre_nav * bm_eq_w) - (bm_eq_shares[s] * day_prices[s])) * _one_side_cost_frac(s)
                for s in core_etfs
            )
            bm_post_nav = max(0.0, bm_pre_nav - bm_reb_cost)
            for s in core_etfs:
                bm_eq_shares[s] = (bm_post_nav * bm_eq_w) / day_prices[s]

            current_year = b_date[:4]

        etf_vals = {s: core_shares[s] * day_prices[s] for s in core_etfs}
        nav_zar = round(core_cash + sum(etf_vals.values()), 2)
        core_weights: Dict[str, float] = {}
        for s in core_etfs:
            core_weights[s] = round((etf_vals[s] / nav_zar) * 100.0, 2) if nav_zar > 0 else 0.0
        core_weights["CASH"] = round((core_cash / nav_zar) * 100.0, 2) if nav_zar > 0 else 0.0

        bm_eq_nav = round(sum(bm_eq_shares[s] * day_prices[s] for s in core_etfs), 2)
        bm_stx_nav = round(bm_stx_shares * day_prices["STX40.JO"], 2)

        series.append(
            {
                "bar_date": b_date,
                "nav_zar": nav_zar,
                "core_weights": core_weights,
                "benchmarks": {
                    "100% equal-weight core ETFs, same costs": bm_eq_nav,
                    "STX40.JO only": bm_stx_nav,
                },
                "benchmark_equal_weight_zar": bm_eq_nav,
                "benchmark_stx40_zar": bm_stx_nav,
            }
        )

    return series


def compute_historical_base_rate(
    df: pd.DataFrame,
    signal_bar_date: str,
    target_pct: float,
    stop_pct: float,
    horizon_days: int,
) -> Optional[float]:
    """
    Percentage of historical days (strictly before signal_bar_date, using that symbol's
    stored/LIVE frame) on which a long entered at the next open with the SAME target%
    and stop% above/below entry would have hit target before stop within the horizon
    (ties on one bar count as stop). If history is too short return None.
    """
    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return None
    if target_pct <= 0.0 or stop_pct <= 0.0 or horizon_days <= 0:
        return None

    open_s = _get_col_series(df, "Open")
    high_s = _get_col_series(df, "High")
    low_s = _get_col_series(df, "Low")
    if open_s is None or high_s is None or low_s is None:
        return None

    dates: List[str] = []
    for idx_val in df.index:
        if hasattr(idx_val, "strftime"):
            dates.append(idx_val.strftime("%Y-%m-%d"))
        else:
            dates.append(str(idx_val)[:10])

    cutoff = str(signal_bar_date)[:10]
    valid_indices = [i for i, d in enumerate(dates) if d < cutoff]
    # Need at least horizon_days + 20 historical bars strictly before signal_bar_date
    if len(valid_indices) < horizon_days + 20:
        return None

    opens = open_s.iloc[valid_indices].values.astype(float)
    highs = high_s.iloc[valid_indices].values.astype(float)
    lows = low_s.iloc[valid_indices].values.astype(float)

    n_bars = len(valid_indices)
    # Candidate signal day i enters at i+1 open and scans up to i+horizon_days (strictly before signal_bar_date)
    max_sig_idx = n_bars - horizon_days
    if max_sig_idx < 20:
        return None

    trials = 0
    wins = 0

    for i in range(max_sig_idx):
        entry_open = opens[i + 1]
        if not math.isfinite(entry_open) or entry_open <= 0.0:
            continue
        t_level = entry_open * (1.0 + target_pct)
        s_level = entry_open * (1.0 - stop_pct)

        valid_window = True
        hit_win = False
        for k in range(i + 1, i + 1 + horizon_days):
            h_k = highs[k]
            l_k = lows[k]
            o_k = opens[k]
            if not (math.isfinite(h_k) and math.isfinite(l_k)):
                valid_window = False
                break
            stop_touched = (l_k <= s_level) or (math.isfinite(o_k) and o_k <= s_level)
            target_touched = (h_k >= t_level) or (math.isfinite(o_k) and o_k >= t_level)
            # Ties on one bar count as stop
            if stop_touched:
                hit_win = False
                break
            if target_touched:
                hit_win = True
                break

        if not valid_window:
            continue
        trials += 1
        if hit_win:
            wins += 1

    if trials < 20:
        return None
    return round((wins / trials) * 100.0, 2)


def _is_opportunity_actionable(opp: Dict[str, Any], list_has_selection_metadata: bool) -> bool:
    if not isinstance(opp, dict):
        return False
    data_st = opp.get("data_status")
    if data_st is not None and str(data_st).upper() != "LIVE":
        return False
    if opp.get("actionable") is False:
        return False

    verdict = str(opp.get("verdict") or "").strip().upper()
    verdict_tier = str(opp.get("verdict_tier") or opp.get("verdictTier") or "").strip().upper()
    gates = int(opp.get("aplus_gates_passed") or opp.get("aplusGatesPassed") or 0)
    is_winner = bool(
        opp.get("is_tournament_winner")
        or opp.get("isTournamentWinner")
        or opp.get("is_top2_crowned")
        or opp.get("isTop2Crowned")
    )

    if verdict in (
        "A+_SNIPER_BUY",
        "12_12_TOURNAMENT_SNIPER_BUY_NOW",
        "12_12_ARMED_LIMIT_TRAP",
        "ARMED_12_12_LIMIT_TRAP",
    ):
        return True
    if verdict_tier in ("A+_SNIPER_BUY", "A_PLUS_BUY_NOW", "A_PLUS_LIMIT_DIP"):
        return True
    if is_winner or gates >= 12 or opp.get("actionable") is True:
        return True
    if not list_has_selection_metadata and verdict not in ("WAIT", "WAIT_VETO", "11_12_WATCHTOWER"):
        return True
    return False


def log_signals(
    opportunities: Optional[Sequence[Dict[str, Any]]],
    frames: Optional[Dict[str, Any]],
    config_values: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    For each actionable opportunity (top-setups / crowned / A+ alert-worthy):
    insert one paper_signals row with status 'PENDING_ENTRY' keyed by (signal_bar_date, symbol).
    """
    init_db()
    cfg = {**_default_config_values(), **(config_values or {})}
    opps_list = list(opportunities or [])
    frames_map = frames or {}

    selection_keys = {
        "verdict",
        "verdict_tier",
        "verdictTier",
        "is_tournament_winner",
        "isTournamentWinner",
        "is_top2_crowned",
        "isTop2Crowned",
        "aplus_gates_passed",
        "aplusGatesPassed",
        "actionable",
    }
    list_has_selection_metadata = any(
        isinstance(o, dict) and any(k in o for k in selection_keys) for o in opps_list
    )

    default_horizon = int(cfg.get("PAPER_SIGNAL_HORIZON_DAYS", PAPER_SIGNAL_HORIZON_DAYS))
    logged_count = 0
    skipped_no_target_stop = 0
    skipped_not_live = 0
    skipped_not_actionable = 0
    skipped_duplicate = 0

    for opp in opps_list:
        if not _is_opportunity_actionable(opp, list_has_selection_metadata):
            skipped_not_actionable += 1
            continue

        raw_sym = str(opp.get("symbol") or opp.get("ticker") or "").strip().upper()
        sym = _normalize_symbol(raw_sym)
        if not sym:
            skipped_not_actionable += 1
            continue

        df = frames_map.get(sym)  # P3 FIX 2: a DataFrame cannot be used with 'or'
        if df is None:
            df = frames_map.get(raw_sym)
        if not isinstance(df, pd.DataFrame) or df.empty or price_status(df) != "LIVE":
            skipped_not_live += 1
            continue

        signal_bar_date = _extract_bar_date_from_df(df)
        if not signal_bar_date:
            skipped_not_live += 1
            continue

        target_raw = (
            opp.get("target_price")
            if opp.get("target_price") is not None
            else (
                opp.get("target_price_zar")
                if opp.get("target_price_zar") is not None
                else (
                    opp.get("targetPriceZar")
                    if opp.get("targetPriceZar") is not None
                    else (
                        opp.get("tp2_price")
                        if opp.get("tp2_price") is not None
                        else opp.get("tp2_price_zar")
                    )
                )
            )
        )
        stop_raw = (
            opp.get("stop_price")
            if opp.get("stop_price") is not None
            else (
                opp.get("stop_loss")
                if opp.get("stop_loss") is not None
                else (
                    opp.get("stop_loss_zar")
                    if opp.get("stop_loss_zar") is not None
                    else (
                        opp.get("stopLossZar")
                        if opp.get("stopLossZar") is not None
                        else (
                            opp.get("hybrid_structural_stop")
                            if opp.get("hybrid_structural_stop") is not None
                            else opp.get("stop_hunt_protected_sl")
                        )
                    )
                )
            )
        )

        target_price = _safe_float_or_none(target_raw)
        stop_price = _safe_float_or_none(stop_raw)
        if target_price is None or stop_price is None or target_price <= 0.0 or stop_price <= 0.0:
            skipped_no_target_stop += 1
            continue

        stated_prob_raw = (
            opp.get("stated_win_prob_pct")
            if opp.get("stated_win_prob_pct") is not None
            else (
                opp.get("calibrated_win_prob_pct")
                if opp.get("calibrated_win_prob_pct") is not None
                else opp.get("calibratedWinProbPct")
            )
        )
        stated_win_prob_pct = _safe_float_or_none(stated_prob_raw)
        if stated_win_prob_pct is not None:
            stated_win_prob_pct = round(stated_win_prob_pct, 2)

        horizon_raw = (
            opp.get("horizon_days")
            if opp.get("horizon_days") is not None
            else opp.get("horizonDays")
        )
        horizon_days = int(horizon_raw) if (horizon_raw is not None and int(horizon_raw) > 0) else default_horizon

        # Signal-time reference price for base_rate_pct (strictly before signal_bar_date)
        sig_price_raw = (
            opp.get("signal_price")
            or opp.get("entry_price")
            or opp.get("entry_price_zar")
            or opp.get("entryPriceZar")
            or opp.get("price_zar")
            or opp.get("priceZar")
        )
        sig_price = _safe_float_or_none(sig_price_raw)
        if sig_price is None or sig_price <= 0.0:
            close_s = _get_col_series(df, "Close")
            if close_s is not None and len(close_s) > 0:
                sig_price = _safe_float_or_none(close_s.iloc[-1])

        base_rate_pct: Optional[float] = None
        if sig_price is not None and sig_price > 0.0 and stop_price < sig_price < target_price:
            t_pct = (target_price - sig_price) / sig_price
            s_pct = (sig_price - stop_price) / sig_price
            base_rate_pct = compute_historical_base_rate(
                df=df,
                signal_bar_date=signal_bar_date,
                target_pct=t_pct,
                stop_pct=s_pct,
                horizon_days=horizon_days,
            )

        # Store signal-time price in entry_price while entry_bar_date is None if provided on the opportunity,
        # so grade_signals can rescale target/stop by next_open / signal_price if present.
        stored_sig_price = round(sig_price, 4) if (sig_price_raw is not None and sig_price is not None and sig_price > 0) else None

        inserted = insert_paper_signal(
            signal_bar_date=signal_bar_date,
            symbol=sym,
            target_price=round(target_price, 4),
            stop_price=round(stop_price, 4),
            horizon_days=horizon_days,
            stated_win_prob_pct=stated_win_prob_pct,
            base_rate_pct=base_rate_pct,
            engine_version="v13-unvalidated",
            status="PENDING_ENTRY",
            entry_bar_date=None,
            entry_price=stored_sig_price,
        )
        if inserted:
            logged_count += 1
        else:
            skipped_duplicate += 1

    return {
        "logged": logged_count,
        "skipped: no target/stop": skipped_no_target_stop,
        "skipped_no_target_stop": skipped_no_target_stop,
        "skipped_not_live": skipped_not_live,
        "skipped_not_actionable": skipped_not_actionable,
        "skipped_duplicate": skipped_duplicate,
    }


def _normalize_prices_by_symbol(
    prices_by_symbol: Optional[Union[Dict[str, Any], Sequence[Dict[str, Any]]]]
) -> Dict[str, List[Dict[str, Any]]]:
    if prices_by_symbol is None:
        init_db()
        rows = get_paper_prices()
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for r in rows:
            sym = _normalize_symbol(str(r.get("symbol") or ""))
            if sym:
                grouped.setdefault(sym, []).append(dict(r))
        for sym in grouped:
            grouped[sym].sort(key=lambda x: str(x.get("bar_date") or "")[:10])
        return grouped

    if isinstance(prices_by_symbol, (list, tuple)):
        grouped = {}
        for r in prices_by_symbol:
            if not isinstance(r, dict):
                continue
            sym = _normalize_symbol(str(r.get("symbol") or ""))
            if sym:
                grouped.setdefault(sym, []).append(dict(r))
        for sym in grouped:
            grouped[sym].sort(key=lambda x: str(x.get("bar_date") or "")[:10])
        return grouped

    if isinstance(prices_by_symbol, dict):
        grouped = {}
        for raw_sym, val in prices_by_symbol.items():
            sym = _normalize_symbol(str(raw_sym))
            if isinstance(val, pd.DataFrame):
                bars_list: List[Dict[str, Any]] = []
                open_s = _get_col_series(val, "Open")
                high_s = _get_col_series(val, "High")
                low_s = _get_col_series(val, "Low")
                close_s = _get_col_series(val, "Close")
                for i, idx_v in enumerate(val.index):
                    b_date = idx_v.strftime("%Y-%m-%d") if hasattr(idx_v, "strftime") else str(idx_v)[:10]
                    bars_list.append(
                        {
                            "bar_date": b_date,
                            "symbol": sym,
                            "open": _safe_float_or_none(open_s.iloc[i]) if open_s is not None else None,
                            "high": _safe_float_or_none(high_s.iloc[i]) if high_s is not None else None,
                            "low": _safe_float_or_none(low_s.iloc[i]) if low_s is not None else None,
                            "close": _safe_float_or_none(close_s.iloc[i]) if close_s is not None else None,
                        }
                    )
                bars_list.sort(key=lambda x: str(x.get("bar_date") or "")[:10])
                grouped[sym] = bars_list
            elif isinstance(val, (list, tuple)):
                bars_list = [dict(b) for b in val if isinstance(b, dict)]
                bars_list.sort(key=lambda x: str(x.get("bar_date") or "")[:10])
                grouped[sym] = bars_list
        return grouped

    return {}


def grade_signals(
    prices_by_symbol: Optional[Union[Dict[str, Any], Sequence[Dict[str, Any]]]] = None,
    config_values: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Grade PENDING_ENTRY and OPEN paper_signals against real later bars:
    - PENDING_ENTRY: when a bar after signal_bar_date exists, set entry_bar_date and
      entry_price = that bar's OPEN (None open -> leave pending); rescale target and
      stop prices by entry/signal-price ratio only if the signal stored a signal-time price;
      otherwise keep absolute levels.
    - OPEN: scan bars after entry in order, up to horizon_days:
      if low <= stop -> LOSS at the stop (if the bar OPENS below the stop, exit at the open);
      else if high >= target -> WIN at the target (if the bar OPENS above target, exit at the open);
      if BOTH touched in the same bar -> LOSS.
      After horizon with neither -> EXPIRED at the final close.
      If high/low are None for a needed bar -> status 'UNGRADABLE'.
    - net_return_pct = gross % minus (fee_round_trip_pct(symbol) + 2*SLIPPAGE_PER_SIDE_PCT).
    """
    init_db()
    cfg = {**_default_config_values(), **(config_values or {})}
    slippage_side_pct = float(cfg.get("SLIPPAGE_PER_SIDE_PCT", SLIPPAGE_PER_SIDE_PCT))
    default_horizon = int(cfg.get("PAPER_SIGNAL_HORIZON_DAYS", PAPER_SIGNAL_HORIZON_DAYS))
    fee_fn = cfg.get("fee_round_trip_pct", fee_round_trip_pct)

    by_symbol = _normalize_prices_by_symbol(prices_by_symbol)
    active_signals = get_paper_signals(statuses=["PENDING_ENTRY", "OPEN"])

    opened_count = 0
    graded_count = 0
    wins_count = 0
    losses_count = 0
    expired_count = 0
    ungradable_count = 0

    for sig in active_signals:
        sig_id = int(sig["id"])
        sym = _normalize_symbol(str(sig.get("symbol") or ""))
        bars = by_symbol.get(sym) or by_symbol.get(str(sig.get("symbol") or "")) or []
        if not bars:
            continue

        status = str(sig.get("status") or "PENDING_ENTRY").upper()
        sig_bar_date = str(sig.get("signal_bar_date") or "")[:10]
        entry_bar_date = str(sig.get("entry_bar_date") or "")[:10] if sig.get("entry_bar_date") else None
        entry_price = _safe_float_or_none(sig.get("entry_price"))
        target_price = _safe_float_or_none(sig.get("target_price"))
        stop_price = _safe_float_or_none(sig.get("stop_price"))
        horizon_days = int(sig.get("horizon_days") or default_horizon)

        if target_price is None or stop_price is None:
            continue

        # 1. Transition PENDING_ENTRY -> OPEN when a bar strictly after signal_bar_date exists
        if status == "PENDING_ENTRY":
            bars_after_signal = [b for b in bars if str(b.get("bar_date") or "")[:10] > sig_bar_date]
            if not bars_after_signal:
                continue
            first_bar = bars_after_signal[0]
            next_open = _safe_float_or_none(first_bar.get("open"))
            if next_open is None or next_open <= 0.0:
                # None open -> leave pending
                continue

            # Adverse selection & limit fill check via shared_core.microstructure:
            limit_dip_px = _safe_float_or_none(sig.get("limit_dip_price") or sig.get("limit_dip_entry_price"))
            if limit_dip_px is not None and limit_dip_px > 0.0:
                first_low = _safe_float_or_none(first_bar.get("low")) or 0.0
                first_high = _safe_float_or_none(first_bar.get("high")) or first_low
                first_vol = _safe_float_or_none(first_bar.get("volume")) or 1000.0
                atr_est = _safe_float_or_none(sig.get("atr") or sig.get("atr_14")) or max(first_high - first_low, limit_dip_px * 0.02)
                fill_eval = evaluate_limit_dip_adverse_fill(
                    limit_dip_price=limit_dip_px,
                    bar_low=first_low,
                    bar_high=first_high,
                    bar_open=next_open,
                    atr=atr_est,
                    total_bar_volume=first_vol,
                    penetration_atr_multiplier=0.25,
                )
                if not fill_eval["filled"]:
                    continue
                next_open = float(fill_eval["fill_price"] or limit_dip_px)

            entry_bar_date = str(first_bar.get("bar_date") or "")[:10]
            # Rescale target and stop prices by entry/signal-price ratio ONLY if the signal stored a signal-time price
            if entry_price is not None and entry_price > 0.0:
                ratio = next_open / entry_price
                target_price = round(target_price * ratio, 4)
                stop_price = round(stop_price * ratio, 4)
            entry_price = round(next_open, 4)
            status = "OPEN"
            activate_paper_signal_entry(
                signal_id=sig_id,
                entry_bar_date=entry_bar_date,
                entry_price=entry_price,
                target_price=target_price,
                stop_price=stop_price,
            )
            opened_count += 1

        # 2. Scan bars for OPEN signal up to horizon_days
        if status == "OPEN":
            if not entry_bar_date or entry_price is None or entry_price <= 0.0:
                # Fallback if an OPEN row was inserted without entry_bar_date
                bars_after_signal = [b for b in bars if str(b.get("bar_date") or "")[:10] > sig_bar_date]
                if not bars_after_signal:
                    continue
                first_bar = bars_after_signal[0]
                next_open = _safe_float_or_none(first_bar.get("open"))
                if next_open is None or next_open <= 0.0:
                    continue
                entry_bar_date = str(first_bar.get("bar_date") or "")[:10]
                entry_price = round(next_open, 4)

            # Bars from entry_bar_date onwards (the holding window of up to horizon_days trading bars)
            scan_bars = [b for b in bars if str(b.get("bar_date") or "")[:10] >= entry_bar_date][:horizon_days]
            if not scan_bars:
                continue

            terminal_status: Optional[str] = None
            graded_bar_date: Optional[str] = None
            exit_price: Optional[float] = None

            for bar in scan_bars:
                b_date = str(bar.get("bar_date") or "")[:10]
                b_open = _safe_float_or_none(bar.get("open"))
                b_high = _safe_float_or_none(bar.get("high"))
                b_low = _safe_float_or_none(bar.get("low"))

                if b_high is None or b_low is None:
                    terminal_status = "UNGRADABLE"
                    graded_bar_date = b_date
                    exit_price = None
                    break

                stop_hit = (b_low <= stop_price) or (b_open is not None and b_open <= stop_price)
                target_hit = (b_high >= target_price) or (b_open is not None and b_open >= target_price)

                # If BOTH touched in the same bar -> LOSS; if low <= stop -> LOSS
                if stop_hit:
                    terminal_status = "LOSS"
                    graded_bar_date = b_date
                    exit_price = b_open if (b_open is not None and b_open < stop_price) else stop_price
                    break
                if target_hit:
                    terminal_status = "WIN"
                    graded_bar_date = b_date
                    exit_price = b_open if (b_open is not None and b_open > target_price) else target_price
                    break

            if terminal_status is None and len(scan_bars) >= horizon_days:
                final_bar = scan_bars[horizon_days - 1]
                final_date = str(final_bar.get("bar_date") or "")[:10]
                final_close = _safe_float_or_none(final_bar.get("close"))
                if final_close is None or final_close <= 0.0:
                    terminal_status = "UNGRADABLE"
                    graded_bar_date = final_date
                    exit_price = None
                else:
                    terminal_status = "EXPIRED"
                    graded_bar_date = final_date
                    exit_price = final_close

            if terminal_status is not None:
                net_return_pct: Optional[float] = None
                if terminal_status in ("WIN", "LOSS", "EXPIRED") and exit_price is not None and entry_price > 0.0:
                    gross_pct = ((exit_price - entry_price) / entry_price) * 100.0
                    rt_fee = float(fee_fn(sym)) if callable(fee_fn) else float(fee_round_trip_pct(sym))
                    friction_pct = rt_fee + (2.0 * slippage_side_pct)
                    net_return_pct = round(gross_pct - friction_pct, 4)
                    exit_price = round(exit_price, 4)

                updated = update_paper_signal_grading(
                    signal_id=sig_id,
                    status=terminal_status,
                    graded_bar_date=graded_bar_date,
                    exit_price=exit_price,
                    net_return_pct=net_return_pct,
                )
                if updated:
                    graded_count += 1
                    if terminal_status == "WIN":
                        wins_count += 1
                    elif terminal_status == "LOSS":
                        losses_count += 1
                    elif terminal_status == "EXPIRED":
                        expired_count += 1
                    elif terminal_status == "UNGRADABLE":
                        ungradable_count += 1

    return {
        "opened": opened_count,
        "graded": graded_count,
        "wins": wins_count,
        "losses": losses_count,
        "expired": expired_count,
        "ungradable": ungradable_count,
    }


def build_report(
    prices_rows: Optional[Sequence[Dict[str, Any]]] = None,
    signals_rows: Optional[Sequence[Dict[str, Any]]] = None,
    inception_date: Optional[str] = None,
    config_values: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Build the Paper Lab report from stored paper_prices and paper_signals.
    Never invents numbers; reports None and status 'COLLECTING DATA' / 'NOT ENOUGH DATA'
    when graded < PAPER_MIN_GRADED_FOR_RATE.
    """
    init_db()
    cfg = {**_default_config_values(), **(config_values or {})}

    if prices_rows is None:
        prices_rows = get_paper_prices()
    if signals_rows is None:
        signals_rows = get_paper_signals()
    if inception_date is None:
        inception_date = get_paper_core_meta("inception_date")

    raw_inc_cap = get_paper_core_meta("inception_capital")
    start_capital = (
        float(raw_inc_cap)
        if (raw_inc_cap is not None and raw_inc_cap != "")
        else float(cfg.get("PAPER_START_CAPITAL_ZAR", PAPER_START_CAPITAL_ZAR))
    )

    nav_series = compute_core_nav(
        prices_rows=prices_rows,
        inception_date=inception_date,
        config_values=cfg,
    )
    resolved_inception = inception_date or (nav_series[0]["bar_date"] if nav_series else None)
    days_tracked = len(nav_series)

    if nav_series:
        nav_now = float(nav_series[-1]["nav_zar"])
        return_pct = round(((nav_now - start_capital) / start_capital) * 100.0, 2) if start_capital > 0 else 0.0
        peak = 0.0
        max_dd = 0.0
        for pt in nav_series:
            v = float(pt["nav_zar"])
            if v > peak:
                peak = v
            if peak > 0.0:
                dd = ((peak - v) / peak) * 100.0
                if dd > max_dd:
                    max_dd = dd
        max_drawdown_pct: Optional[float] = round(max_dd, 2)

        bm_eq_now = float(nav_series[-1]["benchmark_equal_weight_zar"])
        bm_eq_ret = round(((bm_eq_now - start_capital) / start_capital) * 100.0, 2) if start_capital > 0 else 0.0
        bm_stx_now = float(nav_series[-1]["benchmark_stx40_zar"])
        bm_stx_ret = round(((bm_stx_now - start_capital) / start_capital) * 100.0, 2) if start_capital > 0 else 0.0
        benchmarks_summary = {
            "100% equal-weight core ETFs, same costs": {
                "nav_now": bm_eq_now,
                "return_pct": bm_eq_ret,
            },
            "STX40.JO only": {
                "nav_now": bm_stx_now,
                "return_pct": bm_stx_ret,
            },
            "equal_weight_core_etfs": {
                "label": "100% equal-weight core ETFs, same costs",
                "nav_now": bm_eq_now,
                "return_pct": bm_eq_ret,
            },
            "stx40_only": {
                "label": "STX40.JO only",
                "nav_now": bm_stx_now,
                "return_pct": bm_stx_ret,
            },
        }
    else:
        nav_now = None
        return_pct = None
        max_drawdown_pct = None
        benchmarks_summary = {
            "100% equal-weight core ETFs, same costs": {
                "nav_now": None,
                "return_pct": None,
            },
            "STX40.JO only": {
                "nav_now": None,
                "return_pct": None,
            },
            "equal_weight_core_etfs": {
                "label": "100% equal-weight core ETFs, same costs",
                "nav_now": None,
                "return_pct": None,
            },
            "stx40_only": {
                "label": "STX40.JO only",
                "nav_now": None,
                "return_pct": None,
            },
        }

    sigs = list(signals_rows or [])
    logged = len(sigs)
    pending = sum(1 for s in sigs if str(s.get("status") or "").upper() == "PENDING_ENTRY")
    open_cnt = sum(1 for s in sigs if str(s.get("status") or "").upper() == "OPEN")
    wins = sum(1 for s in sigs if str(s.get("status") or "").upper() == "WIN")
    losses = sum(1 for s in sigs if str(s.get("status") or "").upper() == "LOSS")
    expired = sum(1 for s in sigs if str(s.get("status") or "").upper() == "EXPIRED")
    ungradable = sum(1 for s in sigs if str(s.get("status") or "").upper() == "UNGRADABLE")

    graded_rows = [s for s in sigs if str(s.get("status") or "").upper() in ("WIN", "LOSS", "EXPIRED")]
    graded = len(graded_rows)
    min_graded = int(cfg.get("PAPER_MIN_GRADED_FOR_RATE", PAPER_MIN_GRADED_FOR_RATE))
    enough_data = graded >= min_graded and graded > 0

    stated_vals = [
        float(s["stated_win_prob_pct"])
        for s in sigs
        if _safe_float_or_none(s.get("stated_win_prob_pct")) is not None
    ]
    avg_stated_win_prob_pct = round(sum(stated_vals) / len(stated_vals), 2) if stated_vals else None

    base_vals = [
        float(s["base_rate_pct"])
        for s in sigs
        if _safe_float_or_none(s.get("base_rate_pct")) is not None
    ]
    avg_base_rate_pct = round(sum(base_vals) / len(base_vals), 2) if base_vals else None

    if enough_data:
        win_rate_pct: Optional[float] = round((wins / graded) * 100.0, 2)
        net_rets = [
            float(s["net_return_pct"])
            for s in graded_rows
            if _safe_float_or_none(s.get("net_return_pct")) is not None
        ]
        avg_net_return_pct: Optional[float] = round(sum(net_rets) / len(net_rets), 2) if net_rets else None

        pos_sum = sum(r for r in net_rets if r > 0.0)
        neg_sum = abs(sum(r for r in net_rets if r < 0.0))
        profit_factor: Optional[float] = round(pos_sum / neg_sum, 2) if neg_sum > 0.0 else None

        brier_terms = [
            ((float(s["stated_win_prob_pct"]) / 100.0) - (1.0 if str(s.get("status")).upper() == "WIN" else 0.0)) ** 2
            for s in graded_rows
            if _safe_float_or_none(s.get("stated_win_prob_pct")) is not None
        ]
        brier_score: Optional[float] = round(sum(brier_terms) / len(brier_terms), 4) if brier_terms else None

        if avg_stated_win_prob_pct is not None:
            gap = round(win_rate_pct - avg_stated_win_prob_pct, 2)
            calibration_note = (
                f"Realized hit rate {win_rate_pct:.2f}% vs stated {avg_stated_win_prob_pct:.2f}% "
                f"({gap:+.2f} pts across {graded} graded trades)."
            )
        else:
            calibration_note = f"Realized hit rate {win_rate_pct:.2f}% across {graded} graded trades."
        lab_status = "READY"
        rate_status = "OK"
    else:
        win_rate_pct = None
        avg_net_return_pct = None
        profit_factor = None
        brier_score = None
        calibration_note = f"NOT ENOUGH DATA ({graded} of {min_graded} graded)"
        lab_status = "COLLECTING DATA"
        rate_status = "NOT ENOUGH DATA"

    return {
        "core": {
            "inception_date": resolved_inception,
            "inception_capital_zar": start_capital,
            "days_tracked": days_tracked,
            "nav_now": nav_now,
            "return_pct": return_pct,
            "benchmarks": benchmarks_summary,
            "max_drawdown_pct": max_drawdown_pct,
            "series": nav_series,
        },
        "signals": {
            "logged": logged,
            "pending": pending,
            "open": open_cnt,
            "graded": graded,
            "wins": wins,
            "losses": losses,
            "expired": expired,
            "ungradable": ungradable,
            "win_rate_pct": win_rate_pct,
            "avg_net_return_pct": avg_net_return_pct,
            "profit_factor": profit_factor,
            "brier_score": brier_score,
            "avg_stated_win_prob_pct": avg_stated_win_prob_pct,
            "avg_base_rate_pct": avg_base_rate_pct,
            "calibration_note": calibration_note,
            "rate_status": rate_status,
            "min_graded_for_rate": min_graded,
        },
        "status": lab_status,
        "notice": PAPER_NOTICE_TEXT,
        "notice_text": PAPER_NOTICE_TEXT,
    }


def _fetched_before_bar_close(df, bar_date):
    """
    P3 FIX 3: True when the frame was downloaded BEFORE the job cutoff (17:30 SAST) of the day
    of its last bar, so that bar may have been a part-day bar. A cached morning frame (for example
    the last-good copy used when a refetch fails) is caught here. If the download time is missing
    the answer is False (unknown) and the date-based rule in _complete_frames_only still applies.
    """
    from datetime import datetime as _dt, timedelta as _td, timezone as _tz
    try:
        raw = df.attrs.get("fetched_at")
    except Exception:
        raw = None
    if not raw:
        return False
    try:
        sast = _tz(_td(hours=2))
        fetched = _dt.fromisoformat(str(raw))
        if fetched.tzinfo is None:
            fetched = fetched.replace(tzinfo=sast)
        d = _dt.fromisoformat(str(bar_date)[:10])
        try:
            from config import PAPER_JOB_HOUR_SAST as _H, PAPER_JOB_MINUTE_SAST as _M
            hh, mm = int(_H), int(_M)
        except Exception:
            hh, mm = 17, 30
        close_dt = _dt(d.year, d.month, d.day, hh, mm, tzinfo=sast)
        return fetched < close_dt
    except Exception:
        return False


def _complete_frames_only(frames_dict):
    """
    P3 FIX 2: a daily bar dated today is still forming until the JSE has closed.
    Before the job cutoff (17:30 SAST) drop that last row so that only finished bars
    are stored or used. Returns (frames, any_trimmed).
    Sandbox testing only: PAPER_LAB_ASSUME_BAR_COMPLETE=1 disables the trimming.
    """
    import os
    from datetime import timedelta, timezone
    if os.environ.get("PAPER_LAB_ASSUME_BAR_COMPLETE") == "1":
        return dict(frames_dict or {}), False
    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo("Africa/Johannesburg"))
    except Exception:
        now = datetime.now(timezone(timedelta(hours=2)))
    try:
        from config import PAPER_JOB_HOUR_SAST as _H, PAPER_JOB_MINUTE_SAST as _M
        cutoff = (int(_H), int(_M))
    except Exception:
        cutoff = (17, 30)
    today = now.strftime("%Y-%m-%d")
    before_cutoff = (now.hour, now.minute) < cutoff
    out = {}
    trimmed = False
    for k, df in (frames_dict or {}).items():
        if isinstance(df, pd.DataFrame) and not df.empty:
            bar = _extract_bar_date_from_df(df)
            if bar is not None and ((before_cutoff and bar >= today) or _fetched_before_bar_close(df, bar)):  # P3 FIX 3
                new_df = df.iloc[:-1].copy()
                trimmed = True
                if new_df.empty:
                    continue
                new_df.attrs = dict(df.attrs)
                new_df.attrs["last_real_bar"] = str(new_df.index[-1])[:10]
                out[k] = new_df
                continue
        out[k] = df
    return out, trimmed


def run_paper_lab_job(
    frames_dict: Dict[str, Any],
    opportunities: Sequence[Dict[str, Any]],
    config_values: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Execute the Paper Lab pipeline once:
    record_prices -> log_signals -> grade_signals, writing ONLY to paper_* tables.
    On first run stores inception_date and inception_capital in paper_core_meta.
    """
    init_db()
    cfg = {**_default_config_values(), **(config_values or {})}
    core_symbols = list(cfg.get("CORE_PORTFOLIO_ETFS") or CORE_PORTFOLIO_ETFS)
    frames_dict, _partial_today = _complete_frames_only(frames_dict)  # P3 FIX 2
    signal_symbols = list((frames_dict or {}).keys())

    rec_res = record_prices(frames_dict=frames_dict, core_symbols=core_symbols, signal_symbols=signal_symbols)

    # On first run store inception_date and inception_capital in paper_core_meta (append-only / if absent)
    latest_bar = rec_res.get("latest_bar_date")
    if latest_bar:
        set_paper_core_meta("inception_date", str(latest_bar)[:10], overwrite=False)
        set_paper_core_meta(
            "inception_capital",
            str(float(cfg.get("PAPER_START_CAPITAL_ZAR", PAPER_START_CAPITAL_ZAR))),
            overwrite=False,
        )

    if _partial_today:  # P3 FIX 2
        log_res = {"logged": 0, "skipped_reason": "TODAYS_BAR_NOT_FINAL_UNTIL_AFTER_CLOSE"}
    else:
        log_res = log_signals(opportunities=opportunities, frames=frames_dict, config_values=cfg)
    grade_res = grade_signals(prices_by_symbol=None, config_values=cfg)

    if latest_bar:
        set_paper_core_meta("last_completed_bar_date", str(latest_bar)[:10], overwrite=True)

    report = build_report(config_values=cfg)
    report["job_run"] = {
        "recorded": rec_res,
        "logged": log_res,
        "graded": grade_res,
    }
    return report
