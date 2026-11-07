"""FastAPI Main Server (Port 8000) — jse-quant-coach-247 V12.0 ("The Sovereign Omega 12/12 Finale")."""

import asyncio
import csv
import io
import math
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import Body, FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

# Ensure backend directory is in sys.path whether invoked from root or backend/
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from coach_engine import (
    build_compounding_roadmap_and_analytics,
    check_anti_tilt_circuit_breaker,
    evaluate_proportional_7_stage_coach,
)
from config import (
    CASH_BUFFER_PCT,
    CORE_DRIFT_BAND_PTS,
    CORE_MAX_LOSS_TOLERANCE_ZAR,
    CORE_MIN_TRADE_ZAR,
    CORE_PORTFOLIO_ETFS,
    CORE_REVIEW_DAYS,
    CORE_RISK_ASSET_PCT,
    DRAWDOWN_PAUSE_PCT,
    DUPLICATE_ORDER_WINDOW_MIN,
    ENGINE_VALIDATED,
    JSE_EQUITY_FRICTION_PCT,
    JSE_ETF_FRICTION_PCT,
    JSE_UNIVERSE_MAP,
    MAX_LOSS_PER_TRADE_PCT,
    MAX_ORDERS_PER_DAY,
    MAX_POSITION_PCT,
    SLIPPAGE_PER_SIDE_PCT,
    TFSA_ELIGIBLE_ETFS,
    TICKER_RENAMES,
    fee_round_trip_pct,
    get_round_trip_friction_pct,
    is_stt_exempt_etf,
)
from core_portfolio import build_core_view
from data_fetcher import (
    SAST_ZONE,
    _CACHE,
    _FETCH_REASON,
    compute_usdzar_ou_regime_shield,
    fetch_custom_jse_ticker,
    fetch_vectorized_jse_batch,
    get_active_universe_map,
    get_jse_session_status,
    price_status,
)
from database import (
    close_trade_by_id,
    count_orders_today,
    fetch_all_dict,
    get_connection,
    get_core_holdings,
    get_core_setting,
    get_free_cash_ledger,
    init_db,
    log_risk_event,
    partial_close_or_scale_out_trade,
    recent_duplicate_exists,
    record_capital_ledger_entry,
    set_core_holdings,
    set_core_setting,
    sync_portfolio_and_trades,
)
from quant_engine import (
    build_barbell_hero_plan,
    compute_clayton_copula_lower_tail_lambda,
    compute_hrp_barbell_weights,
    compute_quant_metrics_for_jse_asset,
    run_cross_sectional_top2_tournament,
)
from risk_guard import check_order
from v12_omega import (
    build_v13_barbell_plan,
    build_v13_cross_market_meta_allocation,
    compute_v13_data_truth_and_accuracy,
    run_v12_cross_sectional_tournament,
)

MARKET_TYPE = "JSE"
from telegram_bot import (
    auto_detect_telegram_chat_id,
    dispatch_prime_hours_12_12_telegram_alerts,
    format_morning_pre_open_briefing,
    get_telegram_settings,
    save_telegram_settings,
    send_telegram_message_sync,
    telegram_background_worker,
)

SCAN_STATE: Dict[str, Any] = {"progress": 100, "status": "COMPLETE", "cached_dashboard": None, "cached_ts": 0.0}


def _get_sast_clock() -> Dict[str, Any]:
    return get_jse_session_status()


def _live_or_none(df: Any) -> Any:
    return df if price_status(df) == "LIVE" else None


def _filter_dashboard_for_alerts(dash: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure no Telegram or desktop alert is ever sent for non-LIVE or PRICE_ANOMALY rows."""
    filtered = dict(dash)
    live_opps = [o for o in (dash.get("opportunities") or []) if o.get("data_status") == "LIVE"]
    live_active = [
        t for t in (dash.get("activeTrades") or [])
        if t.get("data_status") == "LIVE"
        and t.get("status") != "PRICE_ANOMALY"
        and t.get("coachStage") not in ("PRICE UNVERIFIED", "PRICE_ANOMALY")
        and t.get("coachStageLabel") not in ("PRICE UNVERIFIED", "PRICE_ANOMALY")
    ]
    filtered["opportunities"] = live_opps
    filtered["signals"] = live_opps
    filtered["top2_crowned_setups"] = [o for o in live_opps if o.get("verdict") == "A+_SNIPER_BUY"]
    filtered["top2CrownedSetups"] = filtered["top2_crowned_setups"]
    filtered["watchtower_setups"] = [o for o in live_opps if int(o.get("aplus_gates_passed", 0)) == 11]
    filtered["watchtowerSetups"] = filtered["watchtower_setups"]
    filtered["activeTrades"] = live_active
    filtered["portfolio"] = live_active + (dash.get("closedTrades") or [])
    return filtered


def _open_trade_internal(payload: Dict[str, Any]) -> Dict[str, Any]:
    raw_ticker = str(payload.get("ticker") or payload.get("symbol") or "NPN.JO").strip().upper()
    ticker = raw_ticker if raw_ticker.endswith(".JO") else f"{raw_ticker}.JO"
    universe = get_active_universe_map()
    meta = universe.get(ticker, {"name": payload.get("name") or ticker, "sector": payload.get("sector") or "JSE_CUSTOM"})

    entry_raw = payload.get("entry_price_zar") or payload.get("entryPriceZar") or payload.get("entry_price")
    if entry_raw is None or float(entry_raw) <= 0:
        batch = fetch_vectorized_jse_batch(force=False)
        df_live = _live_or_none(batch.get(ticker))
        if df_live is None or df_live.empty:
            return {"ok": False, "error": f"No verified LIVE price for {ticker}; entry_price_zar is required"}
        entry_price = float(df_live["Close"].iloc[-1])
    else:
        entry_price = float(entry_raw)

    shares = float(payload.get("shares") or 1.0)
    stop_loss = float(payload.get("stop_loss_zar") or payload.get("stopLossZar") or payload.get("stop_loss") or round(entry_price * 0.955, 2))
    target_price = float(payload.get("target_price_zar") or payload.get("targetPriceZar") or payload.get("target_price") or round(entry_price * 1.09, 2))
    friction = JSE_ETF_FRICTION_PCT if is_stt_exempt_etf(ticker) else JSE_EQUITY_FRICTION_PCT
    risk_dist = max(0.25, abs(entry_price - stop_loss))
    tp0_price = float(payload.get("tp0_price_zar") or payload.get("tp0_price") or round(entry_price * (1.0 + friction / 100.0) + 0.65 * risk_dist, 2))
    breakeven_lock_price = float(payload.get("breakeven_lock_price") or round(entry_price * (1.0 + friction / 100.0 + 0.0015), 2))
    tp1_price = float(payload.get("tp1_price_zar") or payload.get("tp1PriceZar") or payload.get("tp1_price") or round(entry_price + 1.25 * risk_dist, 2))
    tp2_price = float(payload.get("tp2_price_zar") or payload.get("tp2PriceZar") or payload.get("tp2_price") or target_price)
    tp3_price = float(payload.get("tp3_price_zar") or payload.get("tp3PriceZar") or payload.get("tp3_price") or round(target_price * 1.03, 2))
    rec_plan = str(payload.get("recommended_entry_plan") or payload.get("recommendedEntryPlan") or payload.get("plan_selected") or "PLAN_A_MARKET")

    trade_mode_raw = str(payload.get("trade_mode") or payload.get("tradeMode") or payload.get("mode") or "REAL_BROKER_TRADE")
    trade_mode = "PAPER_WALLET_TRADE" if "PAPER" in trade_mode_raw.upper() else "REAL_BROKER_TRADE"
    fee_profile = str(payload.get("fee_profile") or payload.get("feeProfile") or ("EASYEQUITIES_TFSA" if is_stt_exempt_etf(ticker) else "EASYEQUITIES_ZAR"))
    notes = str(payload.get("notes") or "")

    gross_pct = round(((target_price - entry_price) / max(0.01, entry_price)) * 100.0, 2)
    net_pct = round(max(1.0, gross_pct - friction), 2)
    invested = round(shares * entry_price, 2)
    now_iso = datetime.utcnow().isoformat()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO portfolio (
            ticker, name, sector, trade_mode, fee_profile, status,
            shares, initial_shares, entry_price_zar, current_price_zar, highest_price_zar,
            stop_loss_zar, target_price_zar, target_net_pct, target_gross_pct,
            invested_capital_zar, realized_pnl_zar, realized_net_pnl_zar, realized_net_pnl_pct,
            opened_at, notes, tp0_price, breakeven_lock_price, tp1_price_zar, tp2_price_zar, tp3_price_zar,
            tp1_price, tp2_price, tp3_price, tp0_hit, tp1_hit, tp2_hit, tp3_hit,
            remaining_weight_pct, realized_partial_pnl_zar, recommended_entry_plan, chandelier_multiplier_atr
        ) VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, 0.0, 0.0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 100.0, 0.0, ?, 1.25)
        """,
        (
            ticker,
            payload.get("name") or meta.get("name", ticker),
            payload.get("sector") or meta.get("sector", "JSE_CUSTOM"),
            trade_mode,
            fee_profile,
            shares,
            shares,
            entry_price,
            entry_price,
            entry_price,
            stop_loss,
            target_price,
            net_pct,
            gross_pct,
            invested,
            now_iso,
            notes,
            tp0_price,
            breakeven_lock_price,
            tp1_price,
            tp2_price,
            tp3_price,
            tp1_price,
            tp2_price,
            tp3_price,
            rec_plan,
        ),
    )
    new_id = cur.lastrowid
    if trade_mode == "PAPER_WALLET_TRADE":
        cur.execute(
            "UPDATE paper_wallet SET cash_balance_zar = MAX(0.0, cash_balance_zar - ?) WHERE id = 1",
            (invested,),
        )
    conn.commit()
    conn.close()
    sync_portfolio_and_trades()
    record_capital_ledger_entry(
        event_type="OPEN_POSITION",
        ticker=ticker,
        trade_id=new_id,
        delta_cash_zar=-invested,
        realized_net_pnl_zar=0.0,
        notes=f"Opened {shares:.4f} sh @ R{entry_price:.2f} ({rec_plan})",
    )
    return {"ok": True, "id": new_id, "ticker": ticker}


def _partial_close_trade_internal(trade_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    V12.2 Section 3.4:
    1-Click Partial Take-Profit (`POST /api/positions/{id}/partial-close`).
    Delegates to idempotent database.partial_close_or_scale_out_trade.
    """
    rows = fetch_all_dict("SELECT * FROM portfolio WHERE id = ?", (trade_id,))
    if not rows:
        return {"ok": False, "error": f"Position #{trade_id} not found"}
    trade = rows[0]
    if str(trade.get("status", "")).upper() != "OPEN":
        return {"ok": False, "error": "ALREADY_CLOSED", "code": "ALREADY_CLOSED", "id": trade_id}

    ticker = str(trade["ticker"])
    friction_pct = fee_round_trip_pct(ticker)

    exit_override = payload.get("execution_price") or payload.get("exit_price_zar") or payload.get("exitPriceZar") or payload.get("exit_price")
    if exit_override is not None:
        exec_price = round(float(exit_override), 2)
    else:
        batch = fetch_vectorized_jse_batch(force=False)
        df_live = _live_or_none(batch.get(ticker))
        if df_live is None or df_live.empty:
            return {"ok": False, "error": f"No verified LIVE price for {ticker}; execution_price is required"}
        exec_price = round(float(df_live["Close"].iloc[-1]), 2)

    tier = payload.get("tier")
    pct_override = payload.get("percentage")
    if tier is None and pct_override is not None:
        tier = "TP1" if float(pct_override) <= 25.0 else "TP2"
    qty_override = payload.get("quantity") or payload.get("shares")

    return partial_close_or_scale_out_trade(
        trade_id=trade_id,
        exec_price_zar=exec_price,
        friction_pct=friction_pct,
        tier=str(tier).upper() if tier is not None else None,
        quantity_override=float(qty_override) if qty_override is not None else None,
        percentage_override=float(pct_override) if pct_override is not None else None,
    )


def _close_trade_internal(
    id_or_symbol: Any,
    exit_price_override: Optional[float] = None,
    close_reason: str = "MANUAL_CLOSE",
) -> Dict[str, Any]:
    row = None
    try:
        tid = int(id_or_symbol)
        rows = fetch_all_dict("SELECT * FROM portfolio WHERE id = ?", (tid,))
        row = rows[0] if rows else None
    except (ValueError, TypeError):
        sym = str(id_or_symbol).strip().upper()
        if not sym.endswith(".JO"):
            sym = f"{sym}.JO"
        rows = fetch_all_dict("SELECT * FROM portfolio WHERE ticker = ? ORDER BY id DESC LIMIT 1", (sym,))
        row = rows[0] if rows else None

    if not row:
        return {"ok": False, "error": "Trade not found"}
    if str(row.get("status", "")).upper() != "OPEN":
        return {"ok": False, "error": "ALREADY_CLOSED", "code": "ALREADY_CLOSED", "id": int(row["id"])}

    ticker = str(row["ticker"])
    if exit_price_override is not None:
        exit_price = round(float(exit_price_override), 2)
    else:
        batch = fetch_vectorized_jse_batch(force=False)
        df_live = _live_or_none(batch.get(ticker))
        if df_live is None or df_live.empty:
            return {"ok": False, "error": f"No verified LIVE price for {ticker}; exit_price is required"}
        exit_price = round(float(df_live["Close"].iloc[-1]), 2)

    friction_pct = fee_round_trip_pct(ticker)
    return close_trade_by_id(
        id_or_symbol=int(row["id"]),
        exit_price_zar=exit_price,
        friction_pct=friction_pct,
        close_reason=close_reason,
    )


def _core_config_dict() -> Dict[str, Any]:
    return {
        "CORE_PORTFOLIO_ETFS": CORE_PORTFOLIO_ETFS,
        "CORE_RISK_ASSET_PCT": CORE_RISK_ASSET_PCT,
        "CORE_MAX_LOSS_TOLERANCE_ZAR": CORE_MAX_LOSS_TOLERANCE_ZAR,
        "CORE_MIN_TRADE_ZAR": CORE_MIN_TRADE_ZAR,
        "CORE_DRIFT_BAND_PTS": CORE_DRIFT_BAND_PTS,
        "CORE_REVIEW_DAYS": CORE_REVIEW_DAYS,
        "MAX_POSITION_PCT": MAX_POSITION_PCT,
        "CASH_BUFFER_PCT": CASH_BUFFER_PCT,
        "MAX_ORDERS_PER_DAY": MAX_ORDERS_PER_DAY,
        "DUPLICATE_ORDER_WINDOW_MIN": DUPLICATE_ORDER_WINDOW_MIN,
        "MAX_LOSS_PER_TRADE_PCT": MAX_LOSS_PER_TRADE_PCT,
        "DRAWDOWN_PAUSE_PCT": DRAWDOWN_PAUSE_PCT,
        "SLIPPAGE_PER_SIDE_PCT": SLIPPAGE_PER_SIDE_PCT,
        "fee_round_trip_pct": fee_round_trip_pct,
    }


def _compute_core_portfolio_from_cache(update_hwm: bool = True) -> Dict[str, Any]:
    """
    Reads prices ONLY from the current _CACHE using price_status (no network fetch).
    Optionally updates high_water_mark_zar if total value exceeds it, and sets
    trading_paused=1 if total is >= DRAWDOWN_PAUSE_PCT below the high-water mark (never auto-unpauses).
    """
    init_db()
    cached_data: Dict[str, Any] = _CACHE.get("data") or {}
    prices: Dict[str, Optional[float]] = {}
    statuses: Dict[str, str] = {}
    for sym in CORE_PORTFOLIO_ETFS:
        df_s = cached_data.get(sym)
        st = price_status(df_s)
        statuses[sym] = st
        if st == "LIVE" and df_s is not None and not df_s.empty:
            closes = df_s["Close"].dropna().values.astype(float)
            prices[sym] = round(float(closes[-1]), 2) if (len(closes) > 0 and closes[-1] > 0) else None
        else:
            prices[sym] = None

    holdings_rows = get_core_holdings()
    raw_cash = get_core_setting("cash_zar")
    cash_zar = float(raw_cash) if (raw_cash is not None and raw_cash != "") else 0.0
    last_reb = get_core_setting("last_rebalance_date")
    today_iso = datetime.now(SAST_ZONE).date().isoformat()

    view = build_core_view(
        holdings=holdings_rows,
        cash_zar=cash_zar,
        prices=prices,
        statuses=statuses,
        config_values=_core_config_dict(),
        last_rebalance_date=last_reb,
        today=today_iso,
    )

    raw_hwm = get_core_setting("high_water_mark_zar")
    hwm_val = float(raw_hwm) if (raw_hwm is not None and raw_hwm != "") else 0.0
    raw_paused = get_core_setting("trading_paused")
    paused_flag = str(raw_paused or "0").strip() in ("1", "true", "TRUE", "True")

    total_val = view.get("total_value_zar")
    if update_hwm and view.get("priced_ok") and total_val is not None:
        tot_f = float(total_val)
        if tot_f > hwm_val:
            hwm_val = round(tot_f, 2)
            set_core_setting("high_water_mark_zar", str(hwm_val))
        if hwm_val > 0.0:
            dd_pct = ((hwm_val - tot_f) / hwm_val) * 100.0
            if dd_pct >= DRAWDOWN_PAUSE_PCT and not paused_flag:
                paused_flag = True
                set_core_setting("trading_paused", "1")

    drawdown_pct = (
        round(((hwm_val - float(total_val)) / hwm_val) * 100.0, 2)
        if (hwm_val > 0.0 and total_val is not None)
        else 0.0
    )
    view["high_water_mark_zar"] = round(hwm_val, 2) if hwm_val > 0.0 else None
    view["drawdown_from_hwm_pct"] = max(0.0, drawdown_pct)
    view["drawdown_pct"] = view["drawdown_from_hwm_pct"]
    view["trading_paused"] = paused_flag
    return view


def _evaluate_order_risk_from_cache(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluate check_order using ONLY current _CACHE prices and SQLite account/core state (no network fetch).
    """
    init_db()
    raw_sym = str(payload.get("symbol") or payload.get("ticker") or "").strip().upper()
    sym = raw_sym if raw_sym.endswith(".JO") else (f"{raw_sym}.JO" if raw_sym else "")
    side = str(payload.get("side") or "BUY").strip().upper()

    cached_data: Dict[str, Any] = _CACHE.get("data") or {}
    df_s = cached_data.get(sym)
    st = price_status(df_s)
    live_p: Optional[float] = None
    if st == "LIVE" and df_s is not None and not df_s.empty:
        closes = df_s["Close"].dropna().values.astype(float)
        if len(closes) > 0 and closes[-1] > 0:
            live_p = float(closes[-1])

    entry_raw = payload.get("entry_price") or payload.get("entry_price_zar") or payload.get("entryPriceZar")
    entry_p: Optional[float] = float(entry_raw) if (entry_raw is not None and float(entry_raw) > 0) else live_p

    stop_raw = payload.get("stop_price") or payload.get("stop_loss_zar") or payload.get("stopLossZar") or payload.get("stop_loss")
    stop_p: Optional[float] = float(stop_raw) if (stop_raw is not None and float(stop_raw) > 0) else None

    amt_raw = payload.get("amount_zar") or payload.get("amountZar") or payload.get("invested_capital_zar")
    shares_raw = payload.get("shares")
    if amt_raw is not None:
        amount_zar = float(amt_raw)
    elif shares_raw is not None and entry_p is not None and entry_p > 0:
        amount_zar = float(shares_raw) * float(entry_p)
    else:
        amount_zar = 0.0

    core_view = _compute_core_portfolio_from_cache(update_hwm=False)
    core_total = core_view.get("total_value_zar")
    core_cash = core_view.get("cash_zar")

    ledger = get_free_cash_ledger()
    open_rows = fetch_all_dict("SELECT ticker, shares, entry_price_zar FROM portfolio WHERE UPPER(status) = 'OPEN'")
    pos_map: Dict[str, float] = {}
    for pos in core_view.get("positions", []):
        if pos.get("value_zar") is not None:
            pos_map[str(pos["symbol"]).upper()] = float(pos["value_zar"])
    for r in open_rows:
        t_sym = str(r.get("ticker", "")).strip().upper()
        if not t_sym.endswith(".JO") and t_sym:
            t_sym = f"{t_sym}.JO"
        df_o = cached_data.get(t_sym)
        if price_status(df_o) == "LIVE" and df_o is not None and not df_o.empty:
            p_o = float(df_o["Close"].dropna().iloc[-1])
        else:
            p_o = float(r.get("entry_price_zar") or 0.0)
        pos_map[t_sym] = pos_map.get(t_sym, 0.0) + float(r.get("shares") or 0.0) * p_o

    if core_total is not None and float(core_total) > 0.0:
        acct_total = float(core_total)
        acct_cash = float(core_cash or 0.0)
    else:
        acct_total = float(payload.get("account_total_zar") or ledger.get("total_compounded_equity_zar") or 0.0)
        acct_cash = float(payload.get("account_cash_zar") or ledger.get("free_cash_available_zar") or 0.0)

    account_dict = {
        "total_value_zar": acct_total,
        "cash_zar": acct_cash,
        "positions": pos_map,
        "existing_position_zar": pos_map.get(sym, 0.0),
    }

    orders_today = count_orders_today()
    dup_recent = recent_duplicate_exists(sym, window_min=int(DUPLICATE_ORDER_WINDOW_MIN))
    raw_paused = get_core_setting("trading_paused")
    paused = str(raw_paused or "0").strip() in ("1", "true", "TRUE", "True")

    res = check_order(
        symbol=sym,
        side=side,
        amount_zar=amount_zar,
        price_status_str=st,
        account=account_dict,
        stop_price=stop_p,
        entry_price=entry_p,
        config_values=_core_config_dict(),
        orders_today=orders_today,
        duplicate_recent=dup_recent,
        paused=paused,
    )
    res["symbol"] = sym
    res["side"] = side
    res["amount_zar"] = round(amount_zar, 2)
    res["price_status"] = st
    return res


def _invalidate_jse_cache() -> None:
    SCAN_STATE["cached_dashboard"] = None
    SCAN_STATE["cached_ts"] = 0.0


def build_full_dashboard_state(force_refresh: bool = False, account_balance_override: Optional[float] = None) -> Dict[str, Any]:
    now_ts = time.time()
    if (
        not force_refresh
        and account_balance_override is None
        and SCAN_STATE.get("cached_dashboard") is not None
        and (now_ts - float(SCAN_STATE.get("cached_ts") or 0.0)) < 15.0
    ):
        return SCAN_STATE["cached_dashboard"]

    init_db()
    batch = fetch_vectorized_jse_batch(force=force_refresh)
    universe = get_active_universe_map()

    wallet_rows = fetch_all_dict("SELECT * FROM paper_wallet WHERE id = 1")
    wallet_row = wallet_rows[0] if wallet_rows else {"cash_balance_zar": 10000.0, "initial_capital_zar": 10000.0, "selected_fee_profile": "EASYEQUITIES_ZAR"}
    fee_profile = str(wallet_row.get("selected_fee_profile") or "EASYEQUITIES_ZAR")
    account_capital_zar = float(account_balance_override or wallet_row.get("initial_capital_zar") or 10000.0)

    weight_rows = fetch_all_dict("SELECT * FROM agent_weights WHERE id = 1")
    w_row = weight_rows[0] if weight_rows else {}
    agent_weights = {
        "technical_microstructure": float(w_row.get("technical_microstructure_weight", 0.31)),
        "sens_sentiment": float(w_row.get("sens_sentiment_weight", 0.26)),
        "fundamental_offshore_sotp": float(w_row.get("fundamental_offshore_sotp_weight", 0.25)),
        "macro_commodity_sarb": float(w_row.get("macro_commodity_sarb_weight", 0.18)),
    }

    def _macro_series(sym: str, ndigits: int = 2):
        df_m = _live_or_none(batch.get(sym))
        if df_m is None or df_m.empty:
            return None, None, None, "UNAVAILABLE"
        closes = df_m["Close"].dropna().values.astype(float)
        if len(closes) < 1 or closes[-1] <= 0:
            return None, None, None, "UNAVAILABLE"
        last_v = round(float(closes[-1]), ndigits)
        chg_1d = round(((closes[-1] - closes[-2]) / closes[-2]) * 100.0, 2) if (len(closes) >= 2 and closes[-2] > 0) else None
        chg_5d = round(((closes[-1] - closes[-6]) / closes[-6]) * 100.0, 2) if (len(closes) >= 6 and closes[-6] > 0) else None
        return last_v, chg_1d, chg_5d, "LIVE"

    # Live USD/ZAR Ornstein-Uhlenbeck Currency Regime Shield
    usdzar_df = _live_or_none(batch.get("ZAR=X") if "ZAR=X" in batch else batch.get("USDZAR=X"))
    usdzar_shield = compute_usdzar_ou_regime_shield(usdzar_df)
    usdzar_rate = usdzar_shield["usdzar_rate"]
    usdzar_zscore = usdzar_shield["usdzar_zscore"]
    usdzar_ou_halflife = usdzar_shield["usdzar_ou_halflife"]
    usdzar_regime_badge = usdzar_shield["usdzar_regime_badge"]
    _, usdzar_chg_1d, _, usdzar_status = _macro_series("ZAR=X", 4)
    if usdzar_rate is None:
        usdzar_status = "UNAVAILABLE"

    gbpzar_val, gbpzar_chg_1d, _, gbpzar_status = _macro_series("GBPZAR=X", 2)
    eurzar_val, eurzar_chg_1d, _, eurzar_status = _macro_series("EURZAR=X", 2)
    chfzar_val, chfzar_chg_1d, _, chfzar_status = _macro_series("CHFZAR=X", 2)
    hkd_val, _, _, hkd_status = _macro_series("HKD=X", 4)
    hkdzar_val = round(usdzar_rate / hkd_val, 4) if (usdzar_rate is not None and hkd_val is not None and hkd_val > 0) else None
    hkdzar_status = "LIVE" if hkdzar_val is not None else "UNAVAILABLE"

    fx_rates: Dict[str, Any] = {
        "USDZAR=X": usdzar_rate,
        "GBPZAR=X": gbpzar_val,
        "EURZAR=X": eurzar_val,
        "CHFZAR=X": chfzar_val,
        "HKD=X": hkd_val,
    }

    clock = _get_sast_clock()
    gold_usd, gold_chg_1d, _, gold_status = _macro_series("GC=F", 2)
    plat_usd, plat_chg_1d, _, plat_status = _macro_series("PL=F", 2)
    pall_usd, pall_chg_1d, _, pall_status = _macro_series("PA=F", 2)
    brent_usd, brent_chg_1d, _, brent_status = _macro_series("BZ=F", 2)
    copper_usd, copper_chg_1d, _, copper_status = _macro_series("HG=F", 2)
    es_val, es_chg_1d, _, es_status = _macro_series("ES=F", 2)
    nq_val, nq_chg_1d, _, nq_status = _macro_series("NQ=F", 2)
    tnx_val, tnx_chg_1d, _, tnx_status = _macro_series("^TNX", 2)
    vix_val, vix_chg_1d, _, vix_status = _macro_series("^VIX", 2)
    tencent_hkd, tencent_chg_1d, tencent_chg_5d, tencent_status = _macro_series("0700.HK", 2)

    gold_zar = round(gold_usd * usdzar_rate, 0) if (gold_usd is not None and usdzar_rate is not None) else None
    plat_zar = round(plat_usd * usdzar_rate, 0) if (plat_usd is not None and usdzar_rate is not None) else None
    pall_zar = round(pall_usd * usdzar_rate, 0) if (pall_usd is not None and usdzar_rate is not None) else None
    brent_zar = round(brent_usd * usdzar_rate, 0) if (brent_usd is not None and usdzar_rate is not None) else None

    macro_snapshot = {
        "usdzar": usdzar_rate,
        "usdzar_status": usdzar_status,
        "usdzar_rate": usdzar_rate,
        "usdzar_rate_status": usdzar_status,
        "ZAR=X": usdzar_rate,
        "ZAR=X_status": usdzar_status,
        "USDZAR": usdzar_rate,
        "USDZAR_status": usdzar_status,
        "usdzarChange1dPct": usdzar_chg_1d,
        "usdzarChange1dPct_status": usdzar_status if usdzar_chg_1d is not None else "UNAVAILABLE",
        "usdzarZscore20d": usdzar_zscore,
        "usdzarZscore20d_status": usdzar_status if usdzar_zscore is not None else "UNAVAILABLE",
        "usdzar_zscore": usdzar_zscore,
        "usdzar_zscore_status": usdzar_status if usdzar_zscore is not None else "UNAVAILABLE",
        "usdzar_ou_halflife": usdzar_ou_halflife,
        "usdzar_ou_halflife_status": usdzar_status if usdzar_ou_halflife is not None else "UNAVAILABLE",
        "usdzarOuHalflife": usdzar_ou_halflife,
        "usdzarOuHalflife_status": usdzar_status if usdzar_ou_halflife is not None else "UNAVAILABLE",
        "usdzar_regime_badge": usdzar_regime_badge,
        "usdzarRegimeBadge": usdzar_regime_badge,
        "gbpzar": gbpzar_val,
        "gbpzar_status": gbpzar_status,
        "GBPZAR=X_status": gbpzar_status,
        "gbpzarChange1dPct": gbpzar_chg_1d,
        "eurzar": eurzar_val,
        "eurzar_status": eurzar_status,
        "EURZAR=X_status": eurzar_status,
        "eurzarChange1dPct": eurzar_chg_1d,
        "chfzar": chfzar_val,
        "chfzar_status": chfzar_status,
        "CHFZAR=X_status": chfzar_status,
        "hkdzar": hkdzar_val,
        "hkdzar_status": hkdzar_status,
        "HKD=X_status": hkd_status,
        "gold": gold_usd,
        "gold_status": gold_status,
        "GC=F": gold_usd,
        "GC=F_status": gold_status,
        "goldZarPerOz": gold_zar,
        "goldZarPerOz_status": "LIVE" if gold_zar is not None else "UNAVAILABLE",
        "goldChange1dPct": gold_chg_1d,
        "goldChange1dPct_status": gold_status if gold_chg_1d is not None else "UNAVAILABLE",
        "platinumZarPerOz": plat_zar,
        "platinumZarPerOz_status": "LIVE" if plat_zar is not None else "UNAVAILABLE",
        "PL=F_status": plat_status,
        "platinumChange1dPct": plat_chg_1d,
        "palladiumZarPerOz": pall_zar,
        "palladiumZarPerOz_status": "LIVE" if pall_zar is not None else "UNAVAILABLE",
        "PA=F_status": pall_status,
        "palladiumChange1dPct": pall_chg_1d,
        "brentZarPerBbl": brent_zar,
        "brentZarPerBbl_status": "LIVE" if brent_zar is not None else "UNAVAILABLE",
        "BZ=F_status": brent_status,
        "brentChange1dPct": brent_chg_1d,
        "copperUsd": copper_usd,
        "copperUsd_status": copper_status,
        "HG=F_status": copper_status,
        "copperChange1dPct": copper_chg_1d,
        "ES=F": es_val,
        "ES=F_status": es_status,
        "esFutures": es_val,
        "esFutures_status": es_status,
        "esFuturesChangePct": es_chg_1d,
        "esFuturesChangePct_status": es_status if es_chg_1d is not None else "UNAVAILABLE",
        "NQ=F": nq_val,
        "NQ=F_status": nq_status,
        "nqFutures": nq_val,
        "nqFutures_status": nq_status,
        "nqFuturesChangePct": nq_chg_1d,
        "nqFuturesChangePct_status": nq_status if nq_chg_1d is not None else "UNAVAILABLE",
        "^TNX": tnx_val,
        "^TNX_status": tnx_status,
        "tnx": tnx_val,
        "tnx_status": tnx_status,
        "tnxChange1dPct": tnx_chg_1d,
        "^VIX": vix_val,
        "^VIX_status": vix_status,
        "vix": vix_val,
        "vix_status": vix_status,
        "vixChange1dPct": vix_chg_1d,
        "0700.HK": tencent_hkd,
        "0700.HK_status": tencent_status,
        "tencentHkdPrice": tencent_hkd,
        "tencentHkdPrice_status": tencent_status,
        "tencentChange1dPct": tencent_chg_1d,
        "tencentChange1dPct_status": tencent_status if tencent_chg_1d is not None else "UNAVAILABLE",
        "tencentChange5dPct": tencent_chg_5d,
        "tencentChange5dPct_status": tencent_status if tencent_chg_5d is not None else "UNAVAILABLE",
        "globalFuturesShieldActive": False,
        "macroLockoutWarning": False,
        "nextRedFolderEvent": "SARB MPC Repo Rate Hold (7.75%) — Macro Clear",
        "jseMacroRegime": "STRONG_RAND_SA_INC_BULL" if usdzar_rate is not None else "MACRO_UNAVAILABLE",
        "sarbRepoRatePct": 7.75,
        "saCpiYoYPct": 4.4,
        **clock,
        "calendarEvents": [
            {"title": "SARB MPC Repo Rate Decision", "country": "ZAR", "date": "Thu 15:00 SAST", "impact": "High", "forecast": "7.75%", "previous": "7.75%"},
            {"title": "StatsSA Headline CPI YoY", "country": "ZAR", "date": "Wed 10:00 SAST", "impact": "High", "forecast": "4.4%", "previous": "4.5%"},
            {"title": "US Core PCE & Non-Farm Payrolls", "country": "USD", "date": "Fri 14:30 SAST", "impact": "High", "forecast": "2.7%", "previous": "2.8%"},
        ],
    }

    # Load portfolio rows from SQLite
    all_trade_rows = fetch_all_dict("SELECT * FROM portfolio ORDER BY id DESC")
    open_rows = [r for r in all_trade_rows if str(r.get("status", "OPEN")).upper() == "OPEN"]
    closed_rows = [r for r in all_trade_rows if str(r.get("status", "OPEN")).upper() == "CLOSED"]

    anti_tilt_info = check_anti_tilt_circuit_breaker(closed_rows)
    anti_tilt_active = anti_tilt_info["anti_tilt_active"]

    open_portfolio_dfs: Dict[str, Any] = {}
    open_tickers: List[str] = []
    for orow in open_rows:
        osym = str(orow.get("ticker", "")).strip().upper()
        if osym:
            open_tickers.append(osym)
        df_open = _live_or_none(batch.get(osym))
        if df_open is not None:
            open_portfolio_dfs[osym] = df_open

    stx40_df = _live_or_none(batch.get("STX40.JO"))
    stx40_ret_20d = 0.0
    if stx40_df is not None and len(stx40_df) >= 21:
        c_stx = stx40_df["Close"].values.astype(float)
        stx40_ret_20d = float(((c_stx[-1] - c_stx[-21]) / max(0.01, c_stx[-21])) * 100.0)

    tencent_df = _live_or_none(batch.get("0700.HK"))

    # Compute V12.0 Quant Metrics & 12-Gate A+ Checklist ONLY for verified LIVE assets
    opportunities: List[Dict[str, Any]] = []
    signals_by_ticker: Dict[str, Dict[str, Any]] = {}
    data_blocked: List[Dict[str, Any]] = []
    by_status_counts: Dict[str, int] = {}

    macro_for_engine = {k: v for k, v in macro_snapshot.items() if v is not None}

    for ticker, meta in universe.items():
        df_t = batch.get(ticker)
        st = price_status(df_t)
        by_status_counts[st] = by_status_counts.get(st, 0) + 1
        if st != "LIVE":
            data_blocked.append({
                "symbol": ticker,
                "status": st,
                "reason": _FETCH_REASON.get(ticker),
                "last_real_bar": df_t.attrs.get("last_real_bar") if (df_t is not None and not df_t.empty) else None,
                "n_real_bars": int(df_t.attrs.get("n_real_bars", 0)) if (df_t is not None and not df_t.empty) else 0,
            })
            continue

        twin_sym = meta.get("twin")
        off_sym = meta.get("offshore")
        opp = compute_quant_metrics_for_jse_asset(
            ticker=ticker,
            df=df_t,
            fee_profile=fee_profile,
            meta=meta,
            twin_df=_live_or_none(batch.get(twin_sym)) if twin_sym else None,
            offshore_df=_live_or_none(batch.get(off_sym)) if off_sym else None,
            tencent_df=tencent_df,
            fx_rates=fx_rates,
            macro_state=macro_for_engine,
            agent_weights=agent_weights,
            account_capital_zar=account_capital_zar,
            anti_tilt_active=anti_tilt_active,
            open_portfolio_dfs=open_portfolio_dfs,
            stx40_ret_20d=stx40_ret_20d,
        )
        opp.update(compute_v13_data_truth_and_accuracy(opp, df=df_t, market_type=MARKET_TYPE))
        opp["data_status"] = "LIVE"
        opp["price_source"] = df_t.attrs.get("price_source", "LIVE")
        opp["n_real_bars"] = int(df_t.attrs.get("n_real_bars", len(df_t)))
        opp["last_real_bar"] = df_t.attrs.get("last_real_bar")
        opp["engine_validated"] = ENGINE_VALIDATED
        opportunities.append(opp)
        signals_by_ticker[ticker] = opp

    live_batch_dfs = {k: v for k, v in batch.items() if price_status(v) == "LIVE"}

    # V12.0 Section 3.3 + V13.0 Cross-Sectional Tournament + Clayton Copula Lower-Tail Crash Guard
    opportunities = run_cross_sectional_top2_tournament(
        opportunities=opportunities,
        batch_dfs=live_batch_dfs,
        open_tickers=open_tickers,
    )
    tournament_avg_fee = (
        round(
            sum(fee_round_trip_pct(str(o.get("ticker", ""))) for o in opportunities) / len(opportunities),
            4,
        )
        if opportunities
        else fee_round_trip_pct("")
    )
    opportunities = run_v12_cross_sectional_tournament(
        signals=opportunities,
        open_positions=open_rows,
        round_trip_fee_pct=tournament_avg_fee,
        market_type=MARKET_TYPE,
    )

    top_aplus_signal = opportunities[0] if opportunities else None
    top2_crowned_setups = [o for o in opportunities if o.get("verdict") == "A+_SNIPER_BUY"]
    watchtower_setups = [o for o in opportunities if int(o.get("aplus_gates_passed", 0)) == 11]

    # Evaluate 7-Stage Coach strictly with verified LIVE prices
    active_trades: List[Dict[str, Any]] = []
    closed_trades: List[Dict[str, Any]] = []

    for r in all_trade_rows:
        sym = str(r.get("ticker", "NPN.JO")).strip().upper()
        if not sym.endswith(".JO"):
            sym = f"{sym}.JO"
        sig = signals_by_ticker.get(sym)
        df_pos = batch.get(sym)
        pos_status = price_status(df_pos)

        live_p: Optional[float] = None
        atr_p: Optional[float] = None
        if pos_status == "LIVE" and sig is not None and sig.get("price_zar") is not None:
            live_p = float(sig["price_zar"])
            atr_p = float(sig.get("atr14_zar") or 2.5)
        elif pos_status == "LIVE" and df_pos is not None and not df_pos.empty:
            closes_pos = df_pos["Close"].dropna().values.astype(float)
            if len(closes_pos) > 0:
                live_p = float(closes_pos[-1])
                atr_p = float(r.get("entry_price_zar") or 100.0) * 0.02
        elif sym not in universe:
            custom_info = fetch_custom_jse_ticker(sym)
            pos_status = str(custom_info.get("data_status") or "NO_LIVE_PRICE")
            if pos_status == "LIVE" and custom_info.get("price_zar") is not None:
                live_p = float(custom_info["price_zar"])
                atr_p = float(custom_info.get("atr14_zar") or 2.5)

        coached = evaluate_proportional_7_stage_coach(
            trade=r,
            live_price_zar=live_p,
            atr14_zar=atr_p,
            signal_metrics=sig,
            top_aplus_signal=top_aplus_signal,
            data_status=pos_status,
        )
        coached["tp0_price"] = r.get("tp0_price") or (sig.get("tp0_price") if sig else None)
        coached["breakeven_lock_price"] = r.get("breakeven_lock_price") or (sig.get("breakeven_lock_price") if sig else None)
        coached["tp1_price"] = r.get("tp1_price_zar") or r.get("tp1_price") or (sig.get("tp1_price") if sig else None)
        coached["tp2_price"] = r.get("tp2_price_zar") or r.get("tp2_price") or (sig.get("tp2_price") if sig else None)
        coached["tp3_price"] = r.get("tp3_price_zar") or r.get("tp3_price") or (sig.get("tp3_price") if sig else None)
        coached["tp0_hit"] = int(r.get("tp0_hit") or 0)
        coached["tp1_hit"] = int(r.get("tp1_hit") or 0)
        coached["tp2_hit"] = int(r.get("tp2_hit") or 0)
        coached["remaining_weight_pct"] = float(r.get("remaining_weight_pct") if r.get("remaining_weight_pct") is not None else 100.0)
        coached["realized_partial_pnl_zar"] = float(r.get("realized_partial_pnl_zar") or r.get("realized_net_pnl_zar") or 0.0)
        coached["entry_price"] = coached.get("entryPriceZar")
        coached["current_price"] = coached.get("currentPriceZar")
        coached["stop_loss"] = coached.get("stopLossZar")
        if str(r.get("status", "OPEN")).upper() == "OPEN":
            active_trades.append(coached)
        else:
            closed_trades.append(coached)

    from config import (
        PAPER_CASH_RATE_PCT,
        PAPER_JOB_HOUR_SAST,
        PAPER_JOB_MINUTE_SAST,
        PAPER_MIN_GRADED_FOR_RATE,
        PAPER_SIGNAL_HORIZON_DAYS,
        PAPER_START_CAPITAL_ZAR,
        SLIPPAGE_PER_SIDE_PCT,
    )
    from paper_lab import build_report as build_paper_report

    paper_cfg = {
        "PAPER_START_CAPITAL_ZAR": PAPER_START_CAPITAL_ZAR,
        "PAPER_SIGNAL_HORIZON_DAYS": PAPER_SIGNAL_HORIZON_DAYS,
        "PAPER_MIN_GRADED_FOR_RATE": PAPER_MIN_GRADED_FOR_RATE,
        "PAPER_JOB_HOUR_SAST": PAPER_JOB_HOUR_SAST,
        "PAPER_JOB_MINUTE_SAST": PAPER_JOB_MINUTE_SAST,
        "PAPER_CASH_RATE_PCT": PAPER_CASH_RATE_PCT,
        "CORE_PORTFOLIO_ETFS": CORE_PORTFOLIO_ETFS,
        "CORE_RISK_ASSET_PCT": CORE_RISK_ASSET_PCT,
        "SLIPPAGE_PER_SIDE_PCT": SLIPPAGE_PER_SIDE_PCT,
        "fee_round_trip_pct": fee_round_trip_pct,
    }
    paper_report = build_paper_report(config_values=paper_cfg)
    paper_sig = paper_report.get("signals") or {}
    n_graded_paper = int(paper_sig.get("graded") or 0)
    has_enough_paper = n_graded_paper >= int(PAPER_MIN_GRADED_FOR_RATE)
    paper_win_rate = paper_sig.get("win_rate_pct") if has_enough_paper else None
    paper_avg_ret = paper_sig.get("avg_net_return_pct") if has_enough_paper else None
    paper_pf = paper_sig.get("profit_factor") if has_enough_paper else None
    paper_brier = paper_sig.get("brier_score") if has_enough_paper else None
    perf_status = "OK" if has_enough_paper else "NO DATA YET"

    shadow_stats = {
        "status": perf_status,
        "totalLogged": int(paper_sig.get("logged") or 0),
        "totalGraded": n_graded_paper,
        "winRatePct": paper_win_rate,
        "accuracyPct": paper_win_rate,
        "brierScore": paper_brier,
        "weights": {
            "technicalMicrostructure": agent_weights["technical_microstructure"],
            "sensSentiment": agent_weights["sens_sentiment"],
            "fundamentalOffshoreSotp": agent_weights["fundamental_offshore_sotp"],
            "macroCommoditySarb": agent_weights["macro_commodity_sarb"],
        },
    }

    free_cash_ledger = get_free_cash_ledger(initial_capital_override=account_capital_zar)

    gld_df = _live_or_none(batch.get("GLD.JO"))
    gld_live_price: Optional[float] = (
        float(gld_df["Close"].iloc[-1])
        if (gld_df is not None and not gld_df.empty)
        else None
    )

    portfolio_analytics = build_compounding_roadmap_and_analytics(
        active_trades=active_trades,
        closed_trades=closed_trades,
        account_capital_zar=account_capital_zar,
        opportunities=opportunities,
        shadow_stats=shadow_stats,
        free_cash_ledger=free_cash_ledger,
        gld_price_zar=gld_live_price,
    )
    portfolio_analytics["status"] = perf_status
    portfolio_analytics["performanceStatus"] = perf_status
    portfolio_analytics["closedWinRatePct"] = paper_win_rate
    portfolio_analytics["realized_win_rate_pct"] = paper_win_rate
    portfolio_analytics["winRatePct"] = paper_win_rate
    portfolio_analytics["win_rate_pct"] = paper_win_rate
    portfolio_analytics["closedProfitFactor"] = paper_pf
    portfolio_analytics["realized_profit_factor"] = paper_pf
    portfolio_analytics["profitFactor"] = paper_pf
    portfolio_analytics["profit_factor"] = paper_pf
    portfolio_analytics["expectancyPct"] = paper_avg_ret
    portfolio_analytics["expectancy_pct"] = paper_avg_ret
    portfolio_analytics["brierScore"] = paper_brier
    portfolio_analytics["brier_score"] = paper_brier
    portfolio_analytics["shadowGraderStats"] = shadow_stats
    portfolio_analytics["shadowStats"] = shadow_stats
    if isinstance(portfolio_analytics.get("compoundingRoadmap"), dict):
        portfolio_analytics["compoundingRoadmap"]["status"] = perf_status
        portfolio_analytics["compoundingRoadmap"]["realizedWinRatePct"] = paper_win_rate
        portfolio_analytics["compoundingRoadmap"]["realized_win_rate_pct"] = paper_win_rate
        portfolio_analytics["compoundingRoadmap"]["realizedProfitFactor"] = paper_pf
        portfolio_analytics["compoundingRoadmap"]["realized_profit_factor"] = paper_pf

    for opp in opportunities:
        opp["brier_score"] = paper_brier
        opp["brierScore"] = paper_brier
        opp["brier_skill_score"] = None if not has_enough_paper else opp.get("brier_skill_score")
        opp["brierSkillScore"] = None if not has_enough_paper else opp.get("brierSkillScore")
        opp["paper_win_rate_pct"] = paper_win_rate
        opp["paper_profit_factor"] = paper_pf
        opp["performance_status"] = perf_status

    legacy_barbell = build_barbell_hero_plan(
        opportunities=opportunities,
        batch_dfs=live_batch_dfs,
        account_balance_zar=account_capital_zar,
    )
    v13_barbell: Dict[str, Any] = {}
    if usdzar_rate is not None and usdzar_rate > 0:
        v13_barbell = build_v13_barbell_plan(
            signals=opportunities,
            capital_zar=account_capital_zar,
            usd_zar_rate=usdzar_rate,
            market_type=MARKET_TYPE,
        )
    barbell_plan = {**legacy_barbell, **v13_barbell}

    paper_open_equity = round(
        sum(
            float(t.get("currentValueZar") or t.get("investedCapitalZar") or 0.0)
            for t in active_trades
            if t["tradeMode"] == "PAPER_WALLET_TRADE"
        ),
        2,
    )
    cash_bal = round(float(wallet_row.get("cash_balance_zar") or 10000.0), 2)
    total_val = round(cash_bal + paper_open_equity, 2)

    tg_settings = get_telegram_settings()
    custom_watchlist_rows = fetch_all_dict("SELECT * FROM custom_watchlist ORDER BY id DESC")

    data_health_summary = {
        "live": len(opportunities),
        "blocked": len(data_blocked),
        "by_status": by_status_counts,
    }

    core_view_summary = _compute_core_portfolio_from_cache(update_hwm=False)
    core_summary = {
        "total_value_zar": core_view_summary.get("total_value_zar"),
        "priced_ok": bool(core_view_summary.get("priced_ok")),
        "any_actions": bool(core_view_summary.get("actions")),
        "has_actions": bool(core_view_summary.get("actions")),
        "actions_count": len(core_view_summary.get("actions") or []),
        "trading_paused": bool(core_view_summary.get("trading_paused")),
    }

    paper_status_summary = {
        "status": paper_report.get("status", "COLLECTING DATA"),
        "performanceStatus": perf_status,
        "n_graded": n_graded_paper,
        "min_graded": int(PAPER_MIN_GRADED_FOR_RATE),
        "logged": int(paper_sig.get("logged") or 0),
        "win_rate_pct": paper_win_rate,
        "profit_factor": paper_pf,
        "brier_score": paper_brier,
    }

    dash_payload = {
        "version": "12.0.0",
        "engineValidated": ENGINE_VALIDATED,
        "engine_validated": ENGINE_VALIDATED,
        "paperStatus": paper_status_summary,
        "paper_status": paper_status_summary,
        "shadowGrader": shadow_stats,
        "shadow_grader": shadow_stats,
        "coreSummary": core_summary,
        "core_summary": core_summary,
        "dataBlocked": data_blocked,
        "data_blocked": data_blocked,
        "dataHealthSummary": data_health_summary,
        "data_health_summary": data_health_summary,
        "scanProgressPct": 100,
        "lastScanTimestamp": clock["sastTimeFormatted"],
        "dataSourceStatus": "LIVE JSE V12.0 SOVEREIGN OMEGA ENGINE (09:20–16:40 SAST PRIME • PAVA • BROWNIAN BRIDGE • STRICT 12/12)",
        "jse_session_status": clock,
        "jseSessionStatus": clock["jseSessionStatus"],
        "is_market_open": clock["is_market_open_now"],
        "is_market_open_now": clock["is_market_open_now"],
        "isMarketOpenNow": clock["is_market_open_now"],
        "is_prime_execution_window": clock["is_prime_execution_window"],
        "isPrimeExecutionWindow": clock["is_prime_execution_window"],
        "session_phase": clock["session_phase"],
        "sessionPhase": clock["session_phase"],
        "session_status_label": clock["session_banner"],
        "session_banner": clock["session_banner"],
        "sessionBanner": clock["session_banner"],
        "next_window_sast": clock["next_open_countdown_str"],
        "next_open_countdown_str": clock["next_open_countdown_str"],
        "nextOpenCountdownStr": clock["next_open_countdown_str"],
        "sast_time": clock["sastTimeFormatted"],
        "ny_time": clock.get("ny_time", "03:20 ET"),
        "seasonality_tailwind_label": clock["seasonality_tailwind_label"],
        "seasonalityTailwindLabel": clock["seasonality_tailwind_label"],
        "usdzar_rate": usdzar_rate,
        "usdzar_zscore": usdzar_zscore,
        "usdzar_ou_halflife": usdzar_ou_halflife,
        "usdzar_regime_badge": usdzar_regime_badge,
        "macro": macro_snapshot,
        "barbell_plan": barbell_plan,
        "barbellPlan": barbell_plan,
        "top2_crowned_setups": top2_crowned_setups,
        "top2CrownedSetups": top2_crowned_setups,
        "watchtower_setups": watchtower_setups,
        "watchtowerSetups": watchtower_setups,
        "opportunities": opportunities,
        "signals": opportunities,
        "activeTrades": active_trades,
        "closedTrades": closed_trades,
        "portfolio": active_trades + closed_trades,
        "portfolioAnalytics": portfolio_analytics,
        "compounding": portfolio_analytics,
        "capital_ledger": free_cash_ledger,
        "capitalLedger": free_cash_ledger,
        "watchlist": custom_watchlist_rows,
        "customWatchlist": custom_watchlist_rows,
        "custom_watchlist": custom_watchlist_rows,
        "wallet": {
            "cashBalanceZar": cash_bal,
            "freeCashAvailableZar": free_cash_ledger["free_cash_available_zar"],
            "lockedInOpenPositionsZar": free_cash_ledger["locked_in_open_positions_zar"],
            "openEquityZar": paper_open_equity,
            "totalPortfolioValueZar": total_val,
            "initialCapitalZar": account_capital_zar,
            "selectedFeeProfile": fee_profile,
        },
        "alertSettings": {
            "macosDesktopEnabled": tg_settings["macos_desktop_enabled"],
            "telegramEnabled": tg_settings["telegram_enabled"],
            "telegramBotToken": tg_settings["telegram_bot_token"],
            "telegramChatId": tg_settings["telegram_chat_id"],
            "morningBriefingEnabled": tg_settings["morning_briefing_enabled"],
            "discordEnabled": tg_settings["discord_enabled"],
            "discordWebhookUrl": tg_settings["discord_webhook_url"],
            "alertOnPrimeAlpha": tg_settings["alert_on_prime_alpha"],
            "alertOnOffshoreArb": tg_settings["alert_on_offshore_arb"],
            "alertOnSensPead": tg_settings["alert_on_sens_pead"],
            "alertOnCoachStages": tg_settings["alert_on_coach_stages"],
        },
    }
    SCAN_STATE["cached_batch"] = batch
    if account_balance_override is None:
        SCAN_STATE["cached_dashboard"] = dash_payload
        SCAN_STATE["cached_ts"] = time.time()
    return dash_payload


import logging
import threading
from config import (
    PAPER_CASH_RATE_PCT,
    PAPER_JOB_HOUR_SAST,
    PAPER_JOB_MINUTE_SAST,
    PAPER_MIN_GRADED_FOR_RATE,
    PAPER_SIGNAL_HORIZON_DAYS,
    PAPER_START_CAPITAL_ZAR,
    SLIPPAGE_PER_SIDE_PCT,
    fee_round_trip_pct,
)
from database import get_paper_core_meta
from paper_lab import build_report as build_paper_report, run_paper_lab_job

_paper_logger = logging.getLogger("jse_paper_lab")


def _paper_config_dict() -> Dict[str, Any]:
    return {
        "PAPER_START_CAPITAL_ZAR": PAPER_START_CAPITAL_ZAR,
        "PAPER_SIGNAL_HORIZON_DAYS": PAPER_SIGNAL_HORIZON_DAYS,
        "PAPER_MIN_GRADED_FOR_RATE": PAPER_MIN_GRADED_FOR_RATE,
        "PAPER_JOB_HOUR_SAST": PAPER_JOB_HOUR_SAST,
        "PAPER_JOB_MINUTE_SAST": PAPER_JOB_MINUTE_SAST,
        "PAPER_CASH_RATE_PCT": PAPER_CASH_RATE_PCT,
        "CORE_PORTFOLIO_ETFS": CORE_PORTFOLIO_ETFS,
        "CORE_RISK_ASSET_PCT": CORE_RISK_ASSET_PCT,
        "SLIPPAGE_PER_SIDE_PCT": SLIPPAGE_PER_SIDE_PCT,
        "fee_round_trip_pct": fee_round_trip_pct,
    }


def _score_opportunities_readonly_for_paper(batch: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Pure read-only opportunity evaluation for Paper Lab when cached_dashboard is empty.
    Never writes to trades, positions, wallet, capital_ledger, shadow_signals, alert_settings, or agent_weights.
    """
    universe = get_active_universe_map()
    weight_rows = fetch_all_dict("SELECT * FROM agent_weights WHERE id = 1")
    w_row = weight_rows[0] if weight_rows else {}
    agent_weights = {
        "technical_microstructure": float(w_row.get("technical_microstructure_weight", 0.31)),
        "sens_sentiment": float(w_row.get("sens_sentiment_weight", 0.26)),
        "fundamental_offshore_sotp": float(w_row.get("fundamental_offshore_sotp_weight", 0.25)),
        "macro_commodity_sarb": float(w_row.get("macro_commodity_sarb_weight", 0.18)),
    }

    usdzar_df = _live_or_none(batch.get("ZAR=X") if "ZAR=X" in batch else batch.get("USDZAR=X"))
    usdzar_shield = compute_usdzar_ou_regime_shield(usdzar_df)
    usdzar_rate = usdzar_shield.get("usdzar_rate")

    def _last_close(sym: str) -> Optional[float]:
        df_m = _live_or_none(batch.get(sym))
        if df_m is None or df_m.empty:
            return None
        closes = df_m["Close"].dropna().values.astype(float)
        return float(closes[-1]) if (len(closes) > 0 and closes[-1] > 0) else None

    fx_rates: Dict[str, Any] = {
        "USDZAR=X": usdzar_rate,
        "GBPZAR=X": _last_close("GBPZAR=X"),
        "EURZAR=X": _last_close("EURZAR=X"),
        "CHFZAR=X": _last_close("CHFZAR=X"),
        "HKD=X": _last_close("HKD=X"),
    }
    stx40_df = _live_or_none(batch.get("STX40.JO"))
    stx40_ret_20d = 0.0
    if stx40_df is not None and len(stx40_df) >= 21:
        c_stx = stx40_df["Close"].values.astype(float)
        stx40_ret_20d = float(((c_stx[-1] - c_stx[-21]) / max(0.01, c_stx[-21])) * 100.0)
    tencent_df = _live_or_none(batch.get("0700.HK"))

    opportunities: List[Dict[str, Any]] = []
    for ticker, meta in universe.items():
        df_t = batch.get(ticker)
        if price_status(df_t) != "LIVE":
            continue
        twin_sym = meta.get("twin")
        off_sym = meta.get("offshore")
        try:
            opp = compute_quant_metrics_for_jse_asset(
                ticker=ticker,
                df=df_t,
                fee_profile="EASYEQUITIES_ZAR",
                meta=meta,
                twin_df=_live_or_none(batch.get(twin_sym)) if twin_sym else None,
                offshore_df=_live_or_none(batch.get(off_sym)) if off_sym else None,
                tencent_df=tencent_df,
                fx_rates=fx_rates,
                macro_state={"usdzar_rate": usdzar_rate} if usdzar_rate is not None else {},
                agent_weights=agent_weights,
                account_capital_zar=float(PAPER_START_CAPITAL_ZAR),
                anti_tilt_active=False,
                open_portfolio_dfs={},
                stx40_ret_20d=stx40_ret_20d,
            )
            opp.update(compute_v13_data_truth_and_accuracy(opp, df=df_t, market_type=MARKET_TYPE))
            opp["data_status"] = "LIVE"
            opp["price_source"] = df_t.attrs.get("price_source", "LIVE")
            opp["n_real_bars"] = int(df_t.attrs.get("n_real_bars", len(df_t)))
            opp["last_real_bar"] = df_t.attrs.get("last_real_bar")
            opp["engine_validated"] = ENGINE_VALIDATED
            opportunities.append(opp)
        except Exception:
            continue

    live_batch_dfs = {k: v for k, v in batch.items() if price_status(v) == "LIVE"}
    opportunities = run_cross_sectional_top2_tournament(
        opportunities=opportunities,
        batch_dfs=live_batch_dfs,
        open_tickers=[],
    )
    tournament_avg_fee = (
        round(
            sum(fee_round_trip_pct(str(o.get("ticker", ""))) for o in opportunities) / len(opportunities),
            4,
        )
        if opportunities
        else fee_round_trip_pct("")
    )
    opportunities = run_v12_cross_sectional_tournament(
        signals=opportunities,
        open_positions=[],
        round_trip_fee_pct=tournament_avg_fee,
        market_type=MARKET_TYPE,
    )
    return opportunities


def _latest_live_bar_date_from_frames(frames: Dict[str, Any]) -> Optional[str]:
    latest: Optional[str] = None
    for sym, df in (frames or {}).items():
        if not str(sym).upper().endswith(".JO") or price_status(df) != "LIVE":
            continue
        if df is None or getattr(df, "empty", True):
            continue
        try:
            bar_str = str(df.attrs.get("last_real_bar") or df.index[-1])[:10]
            if len(bar_str) == 10 and (latest is None or bar_str > latest):
                latest = bar_str
        except Exception:
            continue
    return latest


def _run_paper_lab_once(force_fresh: bool = False) -> Dict[str, Any]:
    """
    Runs record_prices -> log_signals -> grade_signals writing ONLY to paper_* tables.
    Never touches trades, positions, wallet, capital_ledger, alerts, or strategy parameters.
    """
    try:
        init_db()
        frames: Dict[str, Any] = dict(SCAN_STATE.get("cached_batch") or _CACHE.get("data") or {})
        if not frames:
            frames = fetch_vectorized_jse_batch(force=False)
            SCAN_STATE["cached_batch"] = frames

        fresh_scored = None  # P3 FIX 2
        if force_fresh:
            frames = fetch_vectorized_jse_batch(force=True)
            SCAN_STATE["cached_batch"] = frames
            fresh_scored = _score_opportunities_readonly_for_paper(frames)
        cached_dash = SCAN_STATE.get("cached_dashboard")
        if fresh_scored is not None:
            actionable_opps = fresh_scored
        elif isinstance(cached_dash, dict) and cached_dash.get("opportunities") is not None:
            actionable_opps = list(
                cached_dash.get("top2_crowned_setups")
                or cached_dash.get("opportunities")
                or []
            )
        else:
            actionable_opps = _score_opportunities_readonly_for_paper(frames)

        return run_paper_lab_job(
            frames_dict=frames,
            opportunities=actionable_opps,
            config_values=_paper_config_dict(),
        )
    except Exception as exc:
        _paper_logger.error("Paper Lab job failed: %s", exc, exc_info=True)
        return build_paper_report(config_values=_paper_config_dict())


_paper_last_attempt = [0.0, "", 0]  # P3 FIX 3: [last attempt time, expected bar date, attempts for that date]


def _paper_lab_daemon_loop(stop_event: threading.Event) -> None:
    """
    Background daemon thread checking every 10 minutes in Africa/Johannesburg time.
    """
    while not stop_event.is_set():
        try:
            now_sast = datetime.now(SAST_ZONE)
            is_weekday = now_sast.weekday() < 5
            past_close_time = (now_sast.hour, now_sast.minute) >= (
                int(PAPER_JOB_HOUR_SAST),
                int(PAPER_JOB_MINUTE_SAST),
            )
            last_done_bar = get_paper_core_meta("last_completed_bar_date")
            inception_meta = get_paper_core_meta("inception_date")

            frames = dict(SCAN_STATE.get("cached_batch") or _CACHE.get("data") or {})
            latest_bar = _latest_live_bar_date_from_frames(frames)

            # P3 FIX 3: decide from the calendar, not from whatever the cache holds.
            import time as _tm
            from datetime import timedelta as _td
            after_close = (not is_weekday) or past_close_time  # a daily bar is final only after the close
            expected_d = now_sast.date()
            while expected_d.weekday() >= 5:
                expected_d = expected_d - _td(days=1)
            expected_bar = expected_d.isoformat()
            last_done_str = str(last_done_bar)[:10] if last_done_bar else ""
            if after_close:
                if last_done_str < expected_bar:
                    _st = _paper_last_attempt
                    if _st[1] != expected_bar:
                        _st[1] = expected_bar
                        _st[2] = 0
                    if _st[2] < 4 and (_tm.time() - _st[0]) > 3000.0:
                        _st[0] = _tm.time()
                        _st[2] += 1
                        _run_paper_lab_once(force_fresh=True)
            elif inception_meta is None and latest_bar is not None:
                _st = _paper_last_attempt
                if (_tm.time() - _st[0]) > 3000.0:
                    _st[0] = _tm.time()
                    _run_paper_lab_once(force_fresh=False)
        except Exception as exc:
            _paper_logger.error("Paper Lab daemon check error: %s", exc, exc_info=True)
        stop_event.wait(600.0)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    paper_stop_event = threading.Event()
    paper_thread = threading.Thread(
        target=_paper_lab_daemon_loop,
        args=(paper_stop_event,),
        name="jse-paper-lab-daemon",
        daemon=True,
    )
    paper_thread.start()
    worker_task = asyncio.create_task(
        telegram_background_worker(
            get_dashboard_fn=lambda: _filter_dashboard_for_alerts(build_full_dashboard_state(force_refresh=False)),
            open_trade_fn=_open_trade_internal,
            close_trade_fn=_close_trade_internal,
        )
    )
    yield
    paper_stop_event.set()
    worker_task.cancel()


app = FastAPI(
    title="jse-quant-coach-247 V12.0 Sovereign Omega 12/12 Finale API",
    version="12.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:5175", "http://127.0.0.1:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/paper/report")
async def api_paper_report():
    init_db()
    return build_paper_report(config_values=_paper_config_dict())


@app.post("/api/paper/run-now")
async def api_paper_run_now():
    report = await asyncio.to_thread(_run_paper_lab_once)
    SCAN_STATE["cached_ts"] = 0.0
    return report


@app.get("/api/health")
async def health():
    sess = get_jse_session_status()
    return {
        "ok": True,
        "service": "jse-quant-coach-247",
        "version": "12.0.0",
        "port": 8000,
        "scan_progress": SCAN_STATE["progress"],
        "session_phase": sess["session_phase"],
        "is_prime_execution_window": sess["is_prime_execution_window"],
    }


@app.get("/api/data-health")
async def data_health_endpoint():
    """
    Non-blocking data health inspection route.
    Reads current _CACHE and _FETCH_REASON without performing network fetches.
    """
    cached_data: Dict[str, Any] = _CACHE.get("data") or {}
    if not cached_data:
        return {
            "status": "WARMING_UP",
            "generated_at": datetime.utcnow().isoformat(),
            "engine_validated": ENGINE_VALIDATED,
            "counts": {"live": 0, "blocked": 0, "total": 0},
            "symbols": [],
            "macro": [],
        }

    universe = get_active_universe_map()
    symbols_report: List[Dict[str, Any]] = []
    live_count = 0
    blocked_count = 0

    for sym in universe.keys():
        df_s = cached_data.get(sym)
        st = price_status(df_s)
        if st == "LIVE":
            live_count += 1
        else:
            blocked_count += 1
        n_bars = int(df_s.attrs.get("n_real_bars", 0)) if (df_s is not None and not df_s.empty) else 0
        last_bar = df_s.attrs.get("last_real_bar") if (df_s is not None and not df_s.empty) else None
        symbols_report.append({
            "symbol": sym,
            "status": st,
            "reason": None if st == "LIVE" else _FETCH_REASON.get(sym),
            "n_real_bars": n_bars,
            "last_real_bar": last_bar,
        })

    macro_keys = [
        "ZAR=X",
        "GBPZAR=X",
        "EURZAR=X",
        "CHFZAR=X",
        "HKD=X",
        "GC=F",
        "PL=F",
        "PA=F",
        "BZ=F",
        "HG=F",
        "ES=F",
        "NQ=F",
        "^TNX",
        "^VIX",
        "0700.HK",
    ]
    macro_report: List[Dict[str, str]] = []
    for m_key in macro_keys:
        df_m = cached_data.get(m_key)
        m_st = "LIVE" if price_status(df_m, market="MACRO") == "LIVE" else "UNAVAILABLE"
        macro_report.append({"key": m_key, "status": m_st})

    return {
        "status": "OK",
        "generated_at": datetime.utcnow().isoformat(),
        "engine_validated": ENGINE_VALIDATED,
        "counts": {
            "live": live_count,
            "blocked": blocked_count,
            "total": len(symbols_report),
        },
        "symbols": symbols_report,
        "macro": macro_report,
    }


@app.get("/api/core-portfolio")
async def get_core_portfolio_endpoint():
    return _compute_core_portfolio_from_cache(update_hwm=True)


@app.put("/api/core-portfolio/holdings")
async def put_core_portfolio_holdings_endpoint(payload: Any = Body(...)):
    init_db()
    items = payload.get("holdings") if isinstance(payload, dict) and "holdings" in payload else payload
    if not isinstance(items, list):
        return JSONResponse(status_code=422, content={"detail": "Body must be a list of {symbol, shares, avg_cost_zar}"})

    valid_symbols = {s.strip().upper() for s in CORE_PORTFOLIO_ETFS}
    cleaned: List[Dict[str, Any]] = []
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            return JSONResponse(status_code=422, content={"detail": f"Item at index {idx} must be an object"})
        raw_sym = str(item.get("symbol") or "").strip().upper()
        sym = raw_sym if raw_sym.endswith(".JO") else (f"{raw_sym}.JO" if raw_sym else "")
        if sym not in valid_symbols:
            return JSONResponse(
                status_code=422,
                content={"detail": f"Invalid symbol '{raw_sym}'. Allowed CORE_PORTFOLIO_ETFS: {sorted(valid_symbols)}"},
            )
        raw_shares = item.get("shares")
        if raw_shares is None or isinstance(raw_shares, bool):
            return JSONResponse(status_code=422, content={"detail": f"Missing shares for {sym}"})
        try:
            sh_val = float(raw_shares)
        except (ValueError, TypeError):
            return JSONResponse(status_code=422, content={"detail": f"Non-numeric shares for {sym}"})
        if not math.isfinite(sh_val) or sh_val < 0.0:
            return JSONResponse(status_code=422, content={"detail": f"Shares for {sym} must be finite and >= 0"})

        raw_avg = item.get("avg_cost_zar")
        avg_val: Optional[float] = None
        if raw_avg is not None and raw_avg != "":
            if isinstance(raw_avg, bool):
                return JSONResponse(status_code=422, content={"detail": f"Invalid avg_cost_zar for {sym}"})
            try:
                avg_val = float(raw_avg)
            except (ValueError, TypeError):
                return JSONResponse(status_code=422, content={"detail": f"Non-numeric avg_cost_zar for {sym}"})
            if not math.isfinite(avg_val) or avg_val < 0.0:
                return JSONResponse(status_code=422, content={"detail": f"avg_cost_zar for {sym} must be finite and >= 0"})

        cleaned.append({"symbol": sym, "shares": sh_val, "avg_cost_zar": avg_val})

    set_core_holdings(cleaned)
    _invalidate_jse_cache()
    return _compute_core_portfolio_from_cache(update_hwm=True)


@app.put("/api/core-portfolio/cash")
async def put_core_portfolio_cash_endpoint(payload: Any = Body(...)):
    init_db()
    if not isinstance(payload, dict) or "cash_zar" not in payload:
        return JSONResponse(status_code=422, content={"detail": "Body must be {cash_zar: number}"})
    raw_cash = payload.get("cash_zar")
    if raw_cash is None or isinstance(raw_cash, bool):
        return JSONResponse(status_code=422, content={"detail": "cash_zar is required"})
    try:
        cash_val = float(raw_cash)
    except (ValueError, TypeError):
        return JSONResponse(status_code=422, content={"detail": "cash_zar must be numeric"})
    if not math.isfinite(cash_val) or cash_val < 0.0:
        return JSONResponse(status_code=422, content={"detail": "cash_zar must be finite and >= 0"})

    set_core_setting("cash_zar", f"{round(cash_val, 2):.2f}")
    _invalidate_jse_cache()
    return _compute_core_portfolio_from_cache(update_hwm=True)


@app.post("/api/core-portfolio/mark-rebalanced")
async def mark_core_portfolio_rebalanced_endpoint():
    init_db()
    today_str = datetime.now(SAST_ZONE).date().isoformat()
    set_core_setting("last_rebalance_date", today_str)
    _invalidate_jse_cache()
    return _compute_core_portfolio_from_cache(update_hwm=True)


@app.post("/api/risk/check")
async def risk_check_endpoint(payload: Dict[str, Any] = Body(default={})):
    res = _evaluate_order_risk_from_cache(payload)
    return {"decision": res["decision"], "reasons": res["reasons"]}


@app.post("/api/risk/ack-pause")
async def risk_ack_pause_endpoint():
    init_db()
    set_core_setting("trading_paused", "0")
    view = _compute_core_portfolio_from_cache(update_hwm=False)
    cur_total = view.get("total_value_zar")
    if cur_total is not None and float(cur_total) >= 0.0:
        set_core_setting("high_water_mark_zar", f"{round(float(cur_total), 2):.2f}")
    else:
        set_core_setting("high_water_mark_zar", "0.00")
    _invalidate_jse_cache()
    return _compute_core_portfolio_from_cache(update_hwm=True)


@app.get("/api/session-status")
async def session_status_endpoint():
    return get_jse_session_status()


@app.get("/api/capital-ledger")
async def capital_ledger_endpoint():
    init_db()
    return get_free_cash_ledger()


@app.get("/api/dashboard")
@app.get("/api/state")
@app.get("/api/signals")
async def get_dashboard(
    refresh: bool = Query(default=False),
    account_balance: Optional[float] = Query(default=None),
):
    return build_full_dashboard_state(force_refresh=refresh, account_balance_override=account_balance)


@app.get("/api/barbell-plan")
async def get_barbell_plan_endpoint(
    capital: float = Query(default=10000.0),
):
    dash = build_full_dashboard_state(force_refresh=False, account_balance_override=capital)
    signals = dash.get("opportunities") or dash.get("signals") or []
    usd_zar_rate = dash.get("usdzar_rate")
    if usd_zar_rate is None or float(usd_zar_rate) <= 0:
        return {
            "status": "UNAVAILABLE",
            "reason": "USDZAR_UNAVAILABLE",
            "total_capital_zar": capital,
            "total_capital_usd": None,
            "usd_zar_rate": None,
        }
    return build_v13_barbell_plan(
        signals=signals,
        capital_zar=capital,
        usd_zar_rate=float(usd_zar_rate),
        market_type=MARKET_TYPE,
    )


@app.get("/api/cross-market")
async def get_cross_market_endpoint(
    capital_zar: float = Query(default=10000.0),
):
    dash = build_full_dashboard_state(force_refresh=False)
    signals = dash.get("opportunities") or dash.get("signals") or []
    usd_zar_rate = dash.get("usdzar_rate")
    if usd_zar_rate is None or float(usd_zar_rate) <= 0:
        return {
            "status": "UNAVAILABLE",
            "reason": "USDZAR_UNAVAILABLE",
            "local_market": MARKET_TYPE,
            "capital_zar": capital_zar,
            "usd_zar_rate": None,
        }
    return build_v13_cross_market_meta_allocation(
        local_market=MARKET_TYPE,
        local_signals=signals,
        capital_zar=capital_zar,
        usd_zar_rate=float(usd_zar_rate),
    )


@app.patch("/api/state")
async def patch_state(payload: Dict[str, Any] = Body(default={})):
    conn = get_connection()
    cur = conn.cursor()
    if "selectedFeeProfile" in payload:
        cur.execute("UPDATE paper_wallet SET selected_fee_profile = ? WHERE id = 1", (str(payload["selectedFeeProfile"]),))
    if "initialCapitalZar" in payload:
        cap = max(500.0, float(payload["initialCapitalZar"]))
        cur.execute("UPDATE paper_wallet SET initial_capital_zar = ? WHERE id = 1", (cap,))
    conn.commit()
    conn.close()
    _invalidate_jse_cache()
    return build_full_dashboard_state(force_refresh=False)


@app.post("/api/wallet/reset")
async def reset_wallet(payload: Dict[str, Any] = Body(default={})):
    amount = float(payload.get("amount_zar", 10000.0))
    conn = get_connection()
    conn.execute("UPDATE paper_wallet SET cash_balance_zar = ?, initial_capital_zar = ? WHERE id = 1", (amount, amount))
    conn.commit()
    conn.close()
    record_capital_ledger_entry(
        event_type="WALLET_RESET",
        ticker="ZAR_CASH",
        trade_id=None,
        delta_cash_zar=amount,
        realized_net_pnl_zar=0.0,
        notes=f"Reset initial capital to R{amount:,.2f}",
    )
    _invalidate_jse_cache()
    return build_full_dashboard_state(force_refresh=False)


@app.get("/api/custom-ticker/{symbol}")
async def resolve_custom_ticker_path(symbol: str):
    return fetch_custom_jse_ticker(symbol)


@app.get("/api/custom-ticker")
async def resolve_custom_ticker_query(symbol: str = Query(..., description="JSE symbol e.g. TGA or TGA.JO")):
    return fetch_custom_jse_ticker(symbol)


@app.get("/api/trades")
@app.get("/api/portfolio")
@app.get("/api/positions")
async def list_portfolio():
    state = build_full_dashboard_state(force_refresh=False)
    return {
        "activeTrades": state["activeTrades"],
        "closedTrades": state["closedTrades"],
        "portfolioAnalytics": state["portfolioAnalytics"],
        "capital_ledger": state["capital_ledger"],
    }


@app.post("/api/trades")
@app.post("/api/portfolio")
@app.post("/api/positions")
async def create_trade(payload: Dict[str, Any] = Body(...)):
    init_db()
    side = str(payload.get("side") or "BUY").strip().upper()
    risk_res = _evaluate_order_risk_from_cache({**payload, "side": side})
    log_risk_event(
        symbol=risk_res["symbol"],
        side=risk_res["side"],
        amount_zar=risk_res["amount_zar"],
        decision=risk_res["decision"],
        reasons=risk_res["reasons"],
    )
    if side == "BUY" and risk_res["decision"] == "BLOCK":
        return JSONResponse(
            status_code=409,
            content={"decision": "BLOCK", "reasons": risk_res["reasons"]},
        )

    _open_trade_internal(payload)
    _invalidate_jse_cache()
    return build_full_dashboard_state(force_refresh=False)


@app.patch("/api/trades/{trade_id}")
@app.patch("/api/portfolio/{trade_id}")
@app.patch("/api/positions/{trade_id}")
async def patch_trade(trade_id: int, payload: Dict[str, Any] = Body(...)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM portfolio WHERE id = ?", (trade_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return {"error": "Not found"}
    entry = float(payload.get("entry_price_zar") or payload.get("entryPriceZar") or row["entry_price_zar"])
    shares = float(payload.get("shares") or row["shares"])
    stop = float(payload.get("stop_loss_zar") or payload.get("stopLossZar") or row["stop_loss_zar"])
    target = float(payload.get("target_price_zar") or payload.get("targetPriceZar") or row["target_price_zar"])
    mode = str(payload.get("trade_mode") or payload.get("tradeMode") or row["trade_mode"])
    cur.execute(
        "UPDATE portfolio SET entry_price_zar = ?, shares = ?, stop_loss_zar = ?, target_price_zar = ?, trade_mode = ? WHERE id = ?",
        (entry, shares, stop, target, mode, trade_id),
    )
    conn.commit()
    conn.close()
    sync_portfolio_and_trades()
    _invalidate_jse_cache()
    return build_full_dashboard_state(force_refresh=False)


@app.post("/api/positions/{trade_id}/partial-close")
@app.post("/api/trades/{trade_id}/partial-close")
@app.post("/api/portfolio/{trade_id}/partial-close")
@app.post("/api/trades/{trade_id}/scale-out")
@app.post("/api/portfolio/{trade_id}/scale-out")
async def partial_close_trade_endpoint(trade_id: int, payload: Dict[str, Any] = Body(default={})):
    """
    V12.0 Section 3.4: 1-Click Partial Take-Profit (`POST /api/positions/{id}/partial-close`)
    Also supports legacy `/scale-out` routes seamlessly.
    """
    partial_result = _partial_close_trade_internal(trade_id, payload)
    if partial_result.get("code") in ("ALREADY_CLOSED", "QUANTITY_EXCEEDS_REMAINING") or partial_result.get("error") in ("ALREADY_CLOSED", "QUANTITY_EXCEEDS_REMAINING"):
        return JSONResponse(status_code=409, content=partial_result)
    _invalidate_jse_cache()
    state = build_full_dashboard_state(force_refresh=False)
    state["partial_close_result"] = partial_result
    state["partialCloseResult"] = partial_result
    return state


@app.post("/api/positions/{trade_id}/close")
@app.post("/api/trades/{trade_id}/close")
@app.post("/api/portfolio/{trade_id}/close")
async def close_trade_endpoint(trade_id: int, payload: Dict[str, Any] = Body(default={})):
    exit_p = payload.get("exit_price") or payload.get("exitPriceZar") or payload.get("exit_price_zar")
    reason = str(payload.get("close_reason") or payload.get("closeReason") or "USER_1_CLICK_CLOSE")
    close_result = _close_trade_internal(trade_id, float(exit_p) if exit_p is not None else None, reason)
    if close_result.get("code") == "ALREADY_CLOSED" or close_result.get("error") == "ALREADY_CLOSED":
        return JSONResponse(status_code=409, content=close_result)
    _invalidate_jse_cache()
    return build_full_dashboard_state(force_refresh=False)


@app.get("/api/export-sars-csv")
@app.get("/api/portfolio/export-csv")
async def export_portfolio_csv():
    """1-Click .CSV Audit Export of all open and closed trades."""
    rows = fetch_all_dict("SELECT * FROM portfolio ORDER BY id DESC")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID",
        "Ticker",
        "Name",
        "Sector",
        "Trade Mode",
        "Status",
        "Shares",
        "Entry Price (R ZAR)",
        "Current/Exit Price (R ZAR)",
        "Stop Loss (R ZAR)",
        "TP1 Price (R ZAR)",
        "TP2 Target Price (R ZAR)",
        "TP3 Runner Price (R ZAR)",
        "Invested Capital (R ZAR)",
        "Realized Net P&L (R ZAR)",
        "Realized Net P&L (%)",
        "Close Reason",
        "Opened At",
        "Closed At",
        "Notes",
    ])
    for r in rows:
        writer.writerow([
            r.get("id"),
            r.get("ticker"),
            r.get("name"),
            r.get("sector"),
            r.get("trade_mode"),
            r.get("status"),
            r.get("shares"),
            r.get("entry_price_zar"),
            r.get("exit_price") or r.get("current_price_zar"),
            r.get("stop_loss_zar"),
            r.get("tp1_price_zar"),
            r.get("target_price_zar"),
            r.get("tp3_price_zar"),
            r.get("invested_capital_zar"),
            r.get("realized_net_pnl_zar") or r.get("realized_pnl_zar"),
            r.get("realized_net_pnl_pct"),
            r.get("close_reason") or "",
            r.get("opened_at"),
            r.get("closed_at") or "",
            r.get("notes") or "",
        ])
    csv_bytes = output.getvalue().encode("utf-8")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="jse_v12_sars_audit_trades.csv"'},
    )


# ============================================================================
# No-Code "+ Add JSE Stock" Watchlist Endpoints
# ============================================================================
@app.get("/api/watchlist")
async def get_watchlist():
    custom_rows = fetch_all_dict("SELECT * FROM custom_watchlist ORDER BY id DESC")
    return {
        "ok": True,
        "watchlist": custom_rows,
        "custom_watchlist": custom_rows,
        "core_count": len(JSE_UNIVERSE_MAP),
    }


@app.post("/api/watchlist")
async def add_to_watchlist(payload: Dict[str, Any] = Body(...)):
    raw_sym = str(payload.get("symbol") or payload.get("ticker") or "").strip().upper()
    if not raw_sym:
        return {"ok": False, "error": "Please provide a JSE ticker symbol (e.g. TGA or TGA.JO)."}
    clean_sym = raw_sym if raw_sym.endswith(".JO") else f"{raw_sym}.JO"
    clean_sym = TICKER_RENAMES.get(clean_sym, clean_sym)

    validated = fetch_custom_jse_ticker(clean_sym)
    if validated.get("data_status") != "LIVE":
        # Never persist a ticker we cannot price: it would show up as a blocked symbol forever.
        reason = validated.get("reason") or "NO_LIVE_PRICE"
        return JSONResponse(
            status_code=422,
            content={
                "ok": False,
                "data_status": validated.get("data_status", "NO_LIVE_PRICE"),
                "symbol": clean_sym,
                "reason": reason,
                "error": f"{clean_sym} has no verified live Yahoo Finance price ({reason}); not added to the watchlist.",
            },
        )
    name = str(payload.get("name") or validated.get("name") or clean_sym)
    sector = str(payload.get("sector") or validated.get("sector") or "JSE_CUSTOM")
    stt_ex = 1 if (validated.get("stt_exempt") or clean_sym in TFSA_ELIGIBLE_ETFS) else 0
    price_zar = float(validated["price_zar"]) if validated.get("price_zar") is not None else None

    conn = get_connection()
    conn.execute(
        """
        INSERT OR REPLACE INTO custom_watchlist (symbol, name, sector, stt_exempt, ref_price_zar, added_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (clean_sym, name, sector, stt_ex, price_zar, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()
    _invalidate_jse_cache()
    custom_rows = fetch_all_dict("SELECT * FROM custom_watchlist ORDER BY id DESC")
    return {
        "ok": validated.get("data_status") == "LIVE",
        "data_status": validated.get("data_status", "NO_LIVE_PRICE"),
        "symbol": clean_sym,
        "name": name,
        "sector": sector,
        "price_zar": price_zar,
        "added": {
            "symbol": clean_sym,
            "name": name,
            "sector": sector,
            "price_zar": price_zar,
            "data_status": validated.get("data_status", "NO_LIVE_PRICE"),
        },
        "watchlist": custom_rows,
        "custom_watchlist": custom_rows,
        "dashboard": build_full_dashboard_state(force_refresh=False),
    }


@app.delete("/api/watchlist/{symbol}")
async def delete_from_watchlist_path(symbol: str):
    clean = symbol.strip().upper()
    if not clean.endswith(".JO"):
        clean = f"{clean}.JO"
    conn = get_connection()
    conn.execute("DELETE FROM custom_watchlist WHERE symbol = ? OR symbol = ?", (clean, symbol.strip().upper()))
    conn.commit()
    conn.close()
    _invalidate_jse_cache()
    custom_rows = fetch_all_dict("SELECT * FROM custom_watchlist ORDER BY id DESC")
    return {
        "ok": True,
        "removed": clean,
        "watchlist": custom_rows,
        "custom_watchlist": custom_rows,
        "dashboard": build_full_dashboard_state(force_refresh=False),
    }


@app.delete("/api/watchlist")
async def delete_from_watchlist_query(symbol: str = Query(...)):
    return await delete_from_watchlist_path(symbol)


# ============================================================================
# 2-Way Interactive Telegram Sniper Bot Endpoints
# ============================================================================
@app.get("/api/telegram/settings")
async def get_tg_settings_endpoint():
    return get_telegram_settings()


@app.post("/api/telegram/settings")
@app.put("/api/alerts")
async def save_tg_settings_endpoint(payload: Dict[str, Any] = Body(...)):
    save_telegram_settings(payload)
    _invalidate_jse_cache()
    return build_full_dashboard_state(force_refresh=False)


@app.post("/api/telegram/detect-chat-id")
@app.post("/api/telegram/detect-chat")
@app.post("/api/telegram/auto-detect")
async def detect_tg_chat_id_endpoint(payload: Dict[str, Any] = Body(default={})):
    settings = get_telegram_settings()
    token = str(payload.get("bot_token") or payload.get("telegramBotToken") or settings.get("telegram_bot_token") or "")
    return auto_detect_telegram_chat_id(token)


@app.post("/api/telegram/test")
@app.post("/api/alerts")
async def test_tg_alert_endpoint(payload: Dict[str, Any] = Body(default={})):
    if "settings" in payload and isinstance(payload["settings"], dict):
        save_telegram_settings(payload["settings"])
    elif payload:
        save_telegram_settings(payload)

    settings = get_telegram_settings()
    dash = _filter_dashboard_for_alerts(build_full_dashboard_state(force_refresh=False))
    top_opp = dash["opportunities"][0] if dash["opportunities"] else None

    lines = [
        "🚀 JSE-QUANT-COACH-247 V12.0 SOVEREIGN OMEGA TEST ALERT",
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"{dash['session_banner']}",
    ]
    if dash.get("usdzar_rate") is not None:
        lines.append(f"💱 {dash['usdzar_regime_badge']}")
    if top_opp and top_opp.get("data_status") == "LIVE" and top_opp.get("entry_price") is not None:
        lines.append(f"🏆 #1 Crowned 12/12 Setup: {top_opp['ticker']} ({top_opp['name']}) — {top_opp['aplus_gates_passed']}/12 Gates")
        lines.append(f"• Recommended Plan: {top_opp.get('recommended_entry_plan')} ({top_opp.get('entry_plan_reason')})")
        lines.append(f"• Plan A Market: R{top_opp['entry_price']:.2f} ({top_opp['net_rr_market']:.2f}x R:R | EV {top_opp.get('ev_plan_a_pct', 0):+.2f}%)")
        lines.append(f"• Plan B Limit Dip: R{top_opp['limit_dip_entry_price']:.2f} ({top_opp['net_rr_limit_dip']:.2f}x R:R, Fill {top_opp['limit_fill_prob_pct']:.0f}%)")
        lines.append(f"• Smart Stop: R{top_opp['stop_loss']:.2f} | TP1: R{top_opp.get('tp1_price', top_opp['target_price']):.2f} | TP2: R{top_opp['target_price']:.2f} | TP3: R{top_opp.get('tp3_price', top_opp['target_price']):.2f}")
    else:
        lines.append("Scanner Online (No Verified Live Setup)")
    msg = "\n".join(lines)

    tg_res = {"ok": False}
    if settings.get("telegram_bot_token") and settings.get("telegram_chat_id"):
        tg_res = send_telegram_message_sync(settings["telegram_bot_token"], settings["telegram_chat_id"], msg)

    return {
        "ok": True,
        "telegram_sent": tg_res.get("ok", False),
        "details": "Test alert dispatched to Telegram & macOS Native Notification!" if tg_res.get("ok") else "Alert configuration verified (set Bot Token & Chat ID for live Telegram push).",
    }


@app.post("/api/telegram/briefing")
async def trigger_morning_briefing_endpoint():
    settings = get_telegram_settings()
    dash = _filter_dashboard_for_alerts(build_full_dashboard_state(force_refresh=False))
    text = format_morning_pre_open_briefing(dash)
    tg_res = {"ok": False}
    if settings.get("telegram_bot_token") and settings.get("telegram_chat_id"):
        tg_res = send_telegram_message_sync(settings["telegram_bot_token"], settings["telegram_chat_id"], text)
    return {"ok": True, "sent": tg_res.get("ok", False), "telegram_sent": tg_res.get("ok", False), "briefing_text": text}


@app.post("/api/telegram/dispatch-prime")
async def trigger_prime_dispatch_endpoint():
    dash = _filter_dashboard_for_alerts(build_full_dashboard_state(force_refresh=False))
    return dispatch_prime_hours_12_12_telegram_alerts(dash)


@app.get("/api/memory/history")
async def get_trading_memory_history(limit: int = 50):
    from database import get_trading_memory_log
    mem = get_trading_memory_log()
    return {
        "ok": True,
        "history": mem.get_history(limit=limit),
        "unsettled_count": len(mem.get_unsettled_decisions()),
    }


@app.post("/api/memory/settle")
async def settle_trading_memory_decision(decision_id: str, realized_return_pct: float, current_weights: Optional[Dict[str, float]] = None):
    from database import get_trading_memory_log
    from shared_core import Reflector
    mem = get_trading_memory_log()
    res = mem.settle_decision(decision_id=decision_id, realized_return_pct=realized_return_pct)
    if not res:
        return {"ok": False, "error": f"Decision {decision_id} not found or already settled"}
    reflector = Reflector(learning_rate=0.08)
    base_w = current_weights or {"technical_microstructure": 0.31, "sens_sentiment": 0.26, "fundamental_offshore_sotp": 0.25, "macro_commodity_sarb": 0.18}
    new_weights = reflector.update_weights(
        weights=base_w,
        agent_predictions={k: (1.0 if realized_return_pct > 0 else -1.0) for k in base_w},
        realized_return_pct=realized_return_pct,
    )
    return {
        "ok": True,
        "decision": res,
        "updated_hedge_weights": new_weights,
    }


@app.websocket("/ws/live")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    await ws.send_json({"type": "SCAN_PROGRESS", "progress": SCAN_STATE["progress"]})
    await ws.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
# V13 SECURITY PATCH: CORS restricted to localhost, bind 127.0.0.1
