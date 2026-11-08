"""
FastAPI Backend Server for Crypto 24/7/365 Sovereign Terminal — V10.1
Port: 8002
Database: ./Crypto Stock market/backend/data/crypto_quant_coach.db
"""
import asyncio
import csv
import io
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import (
    CRYPTO_UNIVERSE_MAP,
    CRYPTO_FEE_PROFILES,
    DEFAULT_FEE_PROFILE,
    DEFAULT_ROUND_TRIP_FEE_PCT,
    BACKEND_PORT,
    round_crypto_price,
)
from database import (
    init_db,
    get_conn,
    fetch_open_trades,
    fetch_closed_trades,
    fetch_paper_wallet,
    fetch_agent_weights,
    fetch_custom_watchlist,
    add_custom_watchlist_ticker,
    remove_custom_watchlist_ticker,
    fetch_alert_settings,
    save_alert_settings,
    insert_trade,
    close_trade_by_id,
    get_capital_ledger,
    partial_close_position,
    fetch_bot_settings,
    save_bot_settings,
    fetch_bot_audit_logs,
)
from autonomous_bot import GLOBAL_AUTONOMOUS_BOT
from v12_omega import (
    build_v13_barbell_plan,
    build_v13_cross_market_meta_allocation,
    get_crypto_session_status,
    run_v12_cross_sectional_tournament,
)

MARKET_TYPE = "CRYPTO"
from data_fetcher import (
    get_symbol_6y_history,
    compute_usdzar_and_valr_arbitrage_shield,
    compute_narrative_rotation_rankings,
    fetch_crypto_macro_and_onchain_state,
    validate_and_inspect_crypto_ticker,
)
from quant_engine import build_crypto_asset_signal, build_barbell_hero_plan
from coach_engine import (
    evaluate_7stage_proportional_coach,
    build_compounding_roadmap_and_analytics,
)
from telegram_bot import (
    send_telegram_message,
    auto_detect_telegram_chat_id,
    format_crypto_12h_sniper_briefing,
    poll_telegram_updates_and_push_alerts,
)
from shared_core.oms_engine import (
    validate_pre_trade_risk,
    execute_crypto_ccxt_bracket_order,
    run_oms_reconciliation_and_watchdog_loop,
    get_cached_live_quote,
    is_live_trading_enabled,
)
from shared_core.telegram_coach import (
    dispatch_active_trades_coach_alerts,
    handle_telegram_callback_query,
)
from config import DB_PATH

_STATE_CACHE: Dict[str, Any] = {}
scan_progress = {"percent": 100, "status": "READY"}


class TradeLogInput(BaseModel):
    symbol: str
    mode: str = "REAL"
    broker_profile: str = DEFAULT_FEE_PROFILE
    entry_price: float
    shares: float
    stop_loss: Optional[float] = None
    target_price: Optional[float] = None
    plan_selected: str = "PLAN_A"


class TradeCloseInput(BaseModel):
    exit_price: Optional[float] = None
    close_reason: str = "MANUAL_CLOSE"


class PartialCloseInput(BaseModel):
    tier: str = "TP1"
    execution_price: Optional[float] = None


class CustomTradeEvalInput(BaseModel):
    symbol: str
    entry_price: float
    shares: float = 1.0
    stop_loss: Optional[float] = None
    target_price: Optional[float] = None
    broker_profile: str = DEFAULT_FEE_PROFILE


class WatchlistAddInput(BaseModel):
    symbol: str


class AlertSettingsInput(BaseModel):
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    discord_webhook_url: str = ""
    enabled: bool = True


class AutoDetectChatInput(BaseModel):
    telegram_bot_token: str


class BotSettingsInput(BaseModel):
    enabled: Optional[bool] = None
    mode: Optional[str] = None
    max_active_positions: Optional[int] = None
    min_kelly_fraction_pct: Optional[float] = None
    eta_learning_rate: Optional[float] = None
    polling_interval_sec: Optional[int] = None
    auto_manage_coach: Optional[bool] = None
    broker_profile: Optional[str] = None


def build_full_terminal_state(
    fee_profile: str = DEFAULT_FEE_PROFILE,
    account_balance_zar: float = 10000.0,
) -> Dict[str, Any]:
    init_db()
    fee_meta = CRYPTO_FEE_PROFILES.get(fee_profile, CRYPTO_FEE_PROFILES[DEFAULT_FEE_PROFILE])
    round_trip_fee_pct = float(fee_meta["round_trip_pct"])

    # 1. Live USD/ZAR Ornstein-Uhlenbeck Currency Regime + VALR/Luno ZAR Arbitrage Shield
    usdzar_data = compute_usdzar_and_valr_arbitrage_shield()
    usdzar_rate = float(usdzar_data["usdzar_rate"])

    # 2. Merge 26 Core Crypto Universe + Custom Watchlist Coins
    custom_items = fetch_custom_watchlist()
    combined_universe: Dict[str, Dict[str, Any]] = dict(CRYPTO_UNIVERSE_MAP)
    for c_item in custom_items:
        raw_sym = c_item["symbol"].upper().strip().replace("-USD", "")
        if raw_sym not in combined_universe:
            combined_universe[raw_sym] = {
                "name": c_item["name"],
                "yf": c_item.get("yf_ticker") or f"{raw_sym}-USD",
                "cex": f"{raw_sym}USDT",
                "hl": raw_sym,
                "narrative": c_item.get("sector", "HIGH_SPEED_L1"),
                "sector": c_item.get("sector", "HIGH_SPEED_L1"),
                "ref_price": 12.5,
                "twin": c_item.get("twin", "BTC").replace("-USD", ""),
                "exchange": "VALR / BINANCE / BYBIT 1x SPOT",
            }

    # 3. Load 6-year (2,190+ day 24/7/365) histories for all symbols
    market_histories: Dict[str, Dict[str, Any]] = {}
    for sym, meta in combined_universe.items():
        market_histories[sym] = get_symbol_6y_history(sym, meta.get("ref_price", 25.0))

    # 4. Crypto Macro, Perp Funding APR & BTC Hashrate/Mayer Shield
    macro_intel = fetch_crypto_macro_and_onchain_state(market_histories, usdzar_data)
    agent_weights = fetch_agent_weights()
    open_trades_raw = fetch_open_trades()
    closed_trades_raw = fetch_closed_trades()

    # 5. Compute Full V9.0 + V10.1 Signals for All Crypto Assets
    signals: List[Dict[str, Any]] = []
    signal_map: Dict[str, Dict[str, Any]] = {}
    for sym, meta in combined_universe.items():
        sig = build_crypto_asset_signal(
            symbol=sym,
            meta=meta,
            market_histories=market_histories,
            macro_intel=macro_intel,
            agent_weights=agent_weights,
            round_trip_fee_pct=round_trip_fee_pct,
            open_trades=open_trades_raw,
            usdzar_rate=usdzar_rate,
            account_balance_zar=account_balance_zar,
        )
        signals.append(sig)
        signal_map[sym] = sig
        signal_map[f"{sym}-USD"] = sig

    # V12.0 + V13.0 Cross-Sectional Alpha Tournament, HRP & Clayton Copula Tail-Dependence
    signals = run_v12_cross_sectional_tournament(
        signals=signals,
        market_histories=market_histories,
        account_balance_zar=account_balance_zar,
        round_trip_fee_pct=round_trip_fee_pct,
        market_type=MARKET_TYPE,
    )

    narrative_rankings = compute_narrative_rotation_rankings(signals)
    macro_intel["narrative_rankings"] = narrative_rankings

    top_aplus_signal = signals[0] if signals else None

    # 6. Today's #1 Crypto A+ Barbell Plan (1x Spot Only — Scaled to R10,000 / ~$540 USDT)
    legacy_barbell = build_barbell_hero_plan(
        signals=signals,
        market_histories=market_histories,
        account_balance_zar=account_balance_zar,
        usdzar_rate=usdzar_rate,
    )
    v13_barbell = build_v13_barbell_plan(
        signals=signals,
        capital_zar=account_balance_zar,
        usd_zar_rate=usdzar_rate,
        market_type=MARKET_TYPE,
    )
    barbell_plan = {**legacy_barbell, **v13_barbell}

    # 7. Evaluate Open Trades via 7-Stage Proportional Coach + Stage 4.5 + Stage 7+ + Dead-Money Swap
    coached_trades: List[Dict[str, Any]] = []
    conn = get_conn()
    cur = conn.cursor()
    for t in open_trades_raw:
        t_sym = str(t["symbol"]).upper().strip()
        live_sig = signal_map.get(t_sym) or signal_map.get(t_sym.replace("-USD", ""))
        coached = evaluate_7stage_proportional_coach(
            trade=t,
            live_signal=live_sig,
            top_aplus_signal=top_aplus_signal,
            usdzar_rate=usdzar_rate,
        )
        if live_sig:
            coached["tp0_price"] = t.get("tp0_price") or live_sig.get("tp0_price")
            coached["breakeven_lock_price"] = t.get("breakeven_lock_price") or live_sig.get("breakeven_lock_price")
            coached["tp1_price"] = t.get("tp1_price") or live_sig.get("tp1_price")
            coached["tp2_price"] = t.get("tp2_price") or live_sig.get("tp2_price")
            coached["tp3_price"] = t.get("tp3_price") or live_sig.get("tp3_price")
        else:
            coached["tp0_price"] = t.get("tp0_price")
            coached["breakeven_lock_price"] = t.get("breakeven_lock_price")
            coached["tp1_price"] = t.get("tp1_price")
            coached["tp2_price"] = t.get("tp2_price")
            coached["tp3_price"] = t.get("tp3_price")
        coached["tp0_hit"] = int(t.get("tp0_hit") or 0)
        coached["tp1_hit"] = int(t.get("tp1_hit") or 0)
        coached["tp2_hit"] = int(t.get("tp2_hit") or 0)
        coached["remaining_weight_pct"] = float(t.get("remaining_weight_pct") if t.get("remaining_weight_pct") is not None else 100.0)
        coached["realized_partial_pnl_zar"] = float(t.get("realized_partial_pnl_zar") or 0.0)
        coached["ticker"] = coached.get("symbol")
        coached_trades.append(coached)
        cur.execute(
            """
            UPDATE trades
            SET current_price = ?, highest_price_seen = ?, current_stage = ?
            WHERE id = ?
            """,
            (
                coached["current_price"],
                coached["highest_price_seen"],
                coached["current_stage"],
                t["id"],
            ),
        )
    conn.commit()
    conn.close()

    # 8. R10k -> R100k Compounding Roadmap & Anti-Tilt Circuit Breaker
    compounding_roadmap = build_compounding_roadmap_and_analytics(
        open_trades=coached_trades,
        closed_trades=closed_trades_raw,
        account_balance_zar=account_balance_zar,
        usdzar_rate=usdzar_rate,
    )

    wallet = fetch_paper_wallet()
    open_paper_val = sum(
        float(t["current_price"]) * float(t["shares"])
        for t in coached_trades
        if t.get("mode") == "PAPER"
    )
    wallet["open_positions_value_usd"] = round(open_paper_val, 2)
    wallet["total_equity_usd"] = round(float(wallet["cash_balance_usd"]) + open_paper_val, 2)

    session_status = get_crypto_session_status(
        funding_apr_pct=float(macro_intel.get("btc_funding_apr_pct", 10.5)),
        vpin=0.35,
    )
    capital_ledger = get_capital_ledger(account_balance_zar=account_balance_zar, usdzar_rate=usdzar_rate)

    state = {
        "market_id": "CRYPTO_24_7_SPOT",
        "market_name": "Crypto 24/7/365 1x Spot (VALR / Binance / Bybit)",
        "version": "12.0",
        "currency": "USDT",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "fee_profile": fee_meta,
        "available_fee_profiles": list(CRYPTO_FEE_PROFILES.values()),
        "usdzar": usdzar_data,
        "account_balance_zar": round(account_balance_zar, 2),
        "account_balance_usd": round(account_balance_zar / max(usdzar_rate, 1e-6), 2),
        "session_status": session_status,
        **session_status,
        "capital_ledger": capital_ledger,
        **capital_ledger,
        "macro": macro_intel,
        "narrative_rankings": narrative_rankings,
        "barbell_plan": barbell_plan,
        "signals": signals,
        "top_signals": signals[:10],
        "active_trades": coached_trades,
        "closed_trades": closed_trades_raw,
        "compounding_roadmap": compounding_roadmap,
        "custom_watchlist": custom_items,
        "paper_wallet": wallet,
        "alert_settings": fetch_alert_settings(),
    }
    _STATE_CACHE[fee_profile] = state
    _STATE_CACHE[f"{fee_profile}:{int(account_balance_zar)}"] = state
    _STATE_CACHE["LATEST"] = state
    _STATE_CACHE["_TS"] = time.time()
    return state


async def _background_loop() -> None:
    while True:
        try:
            await asyncio.sleep(10.0)
            await asyncio.to_thread(build_full_terminal_state, DEFAULT_FEE_PROFILE, 10000.0)
            await poll_telegram_updates_and_push_alerts(
                state_getter=lambda: _STATE_CACHE.get("LATEST") or build_full_terminal_state(),
                refresh_callback=lambda: build_full_terminal_state(),
            )
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(5.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    build_full_terminal_state(DEFAULT_FEE_PROFILE, 10000.0)
    bg_task = asyncio.create_task(_background_loop())
    oms_task = asyncio.create_task(
        run_oms_reconciliation_and_watchdog_loop(
            market="CRYPTO",
            db_path=DB_PATH,
            active_coach_fn=lambda: asyncio.to_thread(
                dispatch_active_trades_coach_alerts,
                _STATE_CACHE.get("LATEST") or build_full_terminal_state(),
                market="CRYPTO",
            ),
            telegram_alert_fn=lambda msg: send_telegram_message(
                bot_token=fetch_alert_settings().get("telegram_bot_token", ""),
                chat_id=fetch_alert_settings().get("telegram_chat_id", ""),
                text=msg,
            ),
        )
    )

    # Initialize Autonomous Bot
    GLOBAL_AUTONOMOUS_BOT.state_provider_fn = lambda: _STATE_CACHE.get("LATEST") or build_full_terminal_state()
    bot_settings = fetch_bot_settings()
    if bot_settings.get("enabled"):
        GLOBAL_AUTONOMOUS_BOT.start()

    yield
    GLOBAL_AUTONOMOUS_BOT.stop()
    bg_task.cancel()
    oms_task.cancel()


app = FastAPI(
    title="Crypto Quantitative Trading Coach 24/7/365 — V10.1 Sovereign Finale",
    version="10.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:5175", "http://127.0.0.1:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    return {
        "ok": True,
        "status": "ok",
        "service": "crypto-quant-coach-247-v10.1",
        "port": BACKEND_PORT,
        "universe_count": len(CRYPTO_UNIVERSE_MAP),
        "scan": scan_progress,
    }


@app.get("/api/universe")
def get_universe() -> Dict[str, Any]:
    return {"universe": CRYPTO_UNIVERSE_MAP, "fee_profiles": CRYPTO_FEE_PROFILES}


@app.get("/api/state")
@app.get("/api/dashboard")
@app.get("/api/market")
@app.get("/api/signals")
def get_state(
    fee_profile: str = Query(DEFAULT_FEE_PROFILE),
    account_balance_zar: float = Query(10000.0),
    refresh: bool = Query(False),
) -> Dict[str, Any]:
    cache_key = f"{fee_profile}:{int(account_balance_zar)}"
    last_ts = float(_STATE_CACHE.get("_TS") or 0.0)
    if not refresh and (time.time() - last_ts) < 15.0 and cache_key in _STATE_CACHE:
        return _STATE_CACHE[cache_key]
    return build_full_terminal_state(fee_profile=fee_profile, account_balance_zar=account_balance_zar)


@app.get("/api/barbell-plan")
def get_barbell_plan_endpoint(
    capital: float = Query(10000.0),
    fee_profile: str = Query(DEFAULT_FEE_PROFILE),
) -> Dict[str, Any]:
    state = _STATE_CACHE.get(fee_profile) or build_full_terminal_state(fee_profile, capital)
    signals = state.get("signals") or []
    usd_zar_rate = float((state.get("usdzar") or {}).get("usdzar_rate") or 18.50)
    return build_v13_barbell_plan(
        signals=signals,
        capital_zar=capital,
        usd_zar_rate=usd_zar_rate,
        market_type=MARKET_TYPE,
    )


@app.get("/api/cross-market")
def get_cross_market_endpoint(
    capital_zar: float = Query(10000.0),
    fee_profile: str = Query(DEFAULT_FEE_PROFILE),
) -> Dict[str, Any]:
    state = _STATE_CACHE.get(fee_profile) or build_full_terminal_state(fee_profile, capital_zar)
    signals = state.get("signals") or []
    usd_zar_rate = float((state.get("usdzar") or {}).get("usdzar_rate") or 18.50)
    return build_v13_cross_market_meta_allocation(
        local_market=MARKET_TYPE,
        local_signals=signals,
        capital_zar=capital_zar,
        usd_zar_rate=usd_zar_rate,
    )


@app.get("/api/custom-ticker/{symbol}")
def scan_custom_crypto_ticker(
    symbol: str,
    fee_profile: str = Query(DEFAULT_FEE_PROFILE),
    account_balance_zar: float = Query(10000.0),
) -> Dict[str, Any]:
    clean = symbol.upper().strip().replace("-USD", "")
    state = _STATE_CACHE.get(fee_profile) or build_full_terminal_state(fee_profile, account_balance_zar)
    for sig in state["signals"]:
        if sig["symbol"] == clean or sig.get("yf_ticker") == f"{clean}-USD":
            return sig

    meta = CRYPTO_UNIVERSE_MAP.get(clean, {
        "name": f"{clean} (Custom Crypto 1x Spot)",
        "yf": f"{clean}-USD",
        "narrative": "HIGH_SPEED_L1",
        "sector": "HIGH_SPEED_L1",
        "ref_price": 12.5,
        "twin": "BTC",
        "exchange": "VALR / BINANCE / BYBIT 1x SPOT",
    })
    market_histories = {
        s: get_symbol_6y_history(s, m["ref_price"])
        for s, m in CRYPTO_UNIVERSE_MAP.items()
    }
    market_histories[clean] = get_symbol_6y_history(clean, meta["ref_price"])
    fee_meta = CRYPTO_FEE_PROFILES.get(fee_profile, CRYPTO_FEE_PROFILES[DEFAULT_FEE_PROFILE])
    usdzar_rate = float(state.get("usdzar", {}).get("usdzar_rate", 18.42))
    return build_crypto_asset_signal(
        symbol=clean,
        meta=meta,
        market_histories=market_histories,
        macro_intel=state["macro"],
        agent_weights=fetch_agent_weights(),
        round_trip_fee_pct=float(fee_meta["round_trip_pct"]),
        open_trades=fetch_open_trades(),
        usdzar_rate=usdzar_rate,
        account_balance_zar=account_balance_zar,
    )


# ---------------------------------------------------------------------------
# Portfolio & Trade Lifecycle Endpoints (Upgrades 7 & 9)
# ---------------------------------------------------------------------------
@app.get("/api/portfolio")
def get_portfolio_summary(account_balance_zar: float = Query(10000.0)) -> Dict[str, Any]:
    state = _STATE_CACHE.get("LATEST") or build_full_terminal_state(DEFAULT_FEE_PROFILE, account_balance_zar)
    return {
        "active_trades": state["active_trades"],
        "closed_trades": state["closed_trades"],
        "compounding_roadmap": state["compounding_roadmap"],
        "usdzar": state["usdzar"],
    }


@app.post("/api/trades")
def log_new_trade(payload: TradeLogInput) -> Dict[str, Any]:
    clean = payload.symbol.upper().strip().replace("-USD", "")
    meta = CRYPTO_UNIVERSE_MAP.get(clean, {
        "name": f"{clean} (1x Spot)",
        "sector": "HIGH_SPEED_L1",
        "ref_price": payload.entry_price,
    })
    fee_meta = CRYPTO_FEE_PROFILES.get(payload.broker_profile, CRYPTO_FEE_PROFILES[DEFAULT_FEE_PROFILE])
    fee_pct = float(fee_meta["round_trip_pct"])

    state = _STATE_CACHE.get(payload.broker_profile) or build_full_terminal_state(payload.broker_profile)
    sig = next((s for s in state["signals"] if s["symbol"] == clean), None)

    atr_val = float(sig["atr_14"]) if sig else round_crypto_price(payload.entry_price * 0.035)
    stop_val = (
        float(payload.stop_loss)
        if payload.stop_loss
        else (float(sig["stop_loss"]) if sig else round_crypto_price(payload.entry_price - 1.35 * atr_val))
    )
    target_val = (
        float(payload.target_price)
        if payload.target_price
        else (float(sig["target_price"]) if sig else round_crypto_price(payload.entry_price + 3.0 * atr_val))
    )

    live_q = get_cached_live_quote("CRYPTO", clean)
    live_mid = float(live_q.get("mid") or (sig["price"] if sig else payload.entry_price))
    spread_pct = float(live_q.get("spread_pct") or 0.06)
    data_ts = float(live_q.get("timestamp") or _STATE_CACHE.get("_TS") or time.time())
    equity_usdt = float(state.get("account_balance_usdt") or 10000.0)
    dd_pct = abs(min(0.0, float(state.get("compounding_roadmap", {}).get("current_drawdown_pct", 0.0))))

    risk_gate = validate_pre_trade_risk(
        market="CRYPTO",
        symbol=clean,
        side="BUY",
        qty=payload.shares,
        requested_price=payload.entry_price,
        stop_loss_price=stop_val,
        total_equity=max(equity_usdt, payload.entry_price * payload.shares * 10.0 if payload.mode.upper() != "REAL" else equity_usdt),
        daily_drawdown_pct=dd_pct,
        live_mid_price=live_mid,
        bid_ask_spread_pct=spread_pct,
        estimated_slippage_pct=spread_pct * 0.5,
        data_timestamp_epoch=data_ts,
        db_path=DB_PATH,
    )
    if not risk_gate["allowed"]:
        raise HTTPException(status_code=409, detail={"decision": "BLOCK", "reasons": risk_gate["reasons"]})

    oms_exec = None
    if payload.mode.upper() == "REAL" or is_live_trading_enabled():
        try:
            oms_exec = execute_crypto_ccxt_bracket_order(
                symbol=clean,
                side="BUY",
                qty=payload.shares,
                limit_price=payload.entry_price,
                stop_loss=stop_val,
                take_profit=target_val,
                exchange_id=payload.broker_profile,
                client_order_id=risk_gate["client_order_id"],
                db_path=DB_PATH,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"CCXT live execution failed: {exc}") from exc

    tid = insert_trade(
        symbol=clean,
        name=meta["name"],
        sector=meta.get("sector", meta.get("narrative", "HIGH_SPEED_L1")),
        mode=payload.mode.upper(),
        broker_profile=payload.broker_profile,
        entry_price=payload.entry_price,
        shares=payload.shares,
        stop_loss=stop_val,
        target_price=target_val,
        round_trip_fee_pct=fee_pct,
        atr_at_entry=atr_val,
        plan_selected=payload.plan_selected,
    )
    return {
        "ok": True,
        "trade_id": tid,
        "client_order_id": risk_gate["client_order_id"],
        "oms_execution": oms_exec,
        "almgren_chriss_plan": risk_gate.get("almgren_chriss_plan"),
        "cross_asset_cvar": risk_gate.get("cross_asset_cvar"),
        "state": build_full_terminal_state(payload.broker_profile),
    }


@app.post("/api/trades/{trade_id}/close")
def close_open_trade(trade_id: int, payload: Optional[TradeCloseInput] = None) -> Dict[str, Any]:
    state = _STATE_CACHE.get("LATEST") or build_full_terminal_state()
    usdzar_rate = float(state.get("usdzar", {}).get("usdzar_rate", 18.42))
    exit_p = payload.exit_price if payload else None
    reason = payload.close_reason if payload else "MANUAL_CLOSE"

    closed = close_trade_by_id(
        trade_id=trade_id,
        exit_price=exit_p,
        usdzar_rate=usdzar_rate,
        close_reason=reason,
    )
    if not closed:
        raise HTTPException(status_code=404, detail="Open trade not found")
    return {"ok": True, "closed_trade": closed, "state": build_full_terminal_state()}


@app.get("/api/session-status")
def get_session_status_endpoint() -> Dict[str, Any]:
    return get_crypto_session_status()


@app.get("/api/capital-ledger")
def get_capital_ledger_endpoint(account_balance_zar: float = Query(10000.0)) -> Dict[str, Any]:
    state = _STATE_CACHE.get("LATEST") or build_full_terminal_state(DEFAULT_FEE_PROFILE, account_balance_zar)
    usdzar_rate = float(state.get("usdzar", {}).get("usdzar_rate", 18.42))
    return get_capital_ledger(account_balance_zar=account_balance_zar, usdzar_rate=usdzar_rate)


@app.post("/api/positions/{position_id}/partial-close")
@app.post("/api/trades/{position_id}/partial-close")
def partial_close_open_position(position_id: int, payload: Optional[PartialCloseInput] = None) -> Dict[str, Any]:
    state = _STATE_CACHE.get("LATEST") or build_full_terminal_state()
    usdzar_rate = float(state.get("usdzar", {}).get("usdzar_rate", 18.42))
    tier = payload.tier if payload else "TP1"
    exec_p = payload.execution_price if payload else None
    updated = partial_close_position(
        position_id=position_id,
        tier=tier,
        execution_price=exec_p,
        usdzar_rate=usdzar_rate,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Open position not found")
    new_state = build_full_terminal_state()
    return {
        "ok": True,
        "tier": tier,
        "position": updated,
        "capital_ledger": new_state["capital_ledger"],
        "state": new_state,
    }


@app.get("/api/portfolio/export-csv")
def export_portfolio_audit_csv() -> StreamingResponse:
    open_rows = fetch_open_trades()
    closed_rows = fetch_closed_trades(limit=500)
    all_rows = open_rows + closed_rows

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Symbol", "Name", "Sector", "Mode", "Exchange_Profile", "Plan",
        "Status", "Entry_Price_USDT", "Exit_or_Current_Price_USDT", "Coins_1x_Spot",
        "Stop_Loss_USDT", "Target_Price_USDT", "Fee_Pct",
        "Realized_Net_PnL_Pct", "Realized_Net_PnL_USDT", "Realized_Net_PnL_ZAR",
        "Close_Reason", "Opened_At", "Closed_At"
    ])
    for r in all_rows:
        writer.writerow([
            r.get("id"),
            r.get("symbol"),
            r.get("name"),
            r.get("sector"),
            r.get("mode"),
            r.get("broker_profile"),
            r.get("plan_selected", "PLAN_A"),
            r.get("status"),
            r.get("entry_price"),
            r.get("exit_price") or r.get("current_price"),
            r.get("shares"),
            r.get("stop_loss"),
            r.get("target_price"),
            r.get("round_trip_fee_pct"),
            r.get("realized_net_pnl_pct", ""),
            r.get("realized_net_pnl_usd") or r.get("realized_pnl_usd", ""),
            r.get("realized_net_pnl_zar", ""),
            r.get("close_reason", ""),
            r.get("opened_at", ""),
            r.get("closed_at", ""),
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=crypto_sovereign_v10_trades_audit.csv"},
    )


@app.post("/api/trades/evaluate-custom")
def evaluate_custom_active_position(payload: CustomTradeEvalInput) -> Dict[str, Any]:
    sig = scan_custom_crypto_ticker(payload.symbol, payload.broker_profile)
    fee_meta = CRYPTO_FEE_PROFILES.get(payload.broker_profile, CRYPTO_FEE_PROFILES[DEFAULT_FEE_PROFILE])
    atr_val = float(sig["atr_14"])
    stop_val = float(payload.stop_loss) if payload.stop_loss else float(sig["stop_loss"])
    target_val = float(payload.target_price) if payload.target_price else float(sig["target_price"])

    synthetic_trade = {
        "id": 9999,
        "symbol": sig["symbol"],
        "name": sig["name"],
        "sector": sig["sector"],
        "mode": "CUSTOM_AUDIT",
        "broker_profile": payload.broker_profile,
        "entry_price": payload.entry_price,
        "current_price": sig["price"],
        "highest_price_seen": max(payload.entry_price, sig["price"]),
        "shares": payload.shares,
        "stop_loss": stop_val,
        "target_price": target_val,
        "round_trip_fee_pct": float(fee_meta["round_trip_pct"]),
        "atr_at_entry": atr_val,
        "opened_at": datetime.now(timezone.utc).isoformat(),
    }
    state = _STATE_CACHE.get("LATEST") or build_full_terminal_state()
    usdzar_rate = float(state.get("usdzar", {}).get("usdzar_rate", 18.42))
    coached = evaluate_7stage_proportional_coach(
        synthetic_trade,
        sig,
        top_aplus_signal=state["signals"][0] if state.get("signals") else None,
        usdzar_rate=usdzar_rate,
    )
    return {"coached_position": coached, "signal": sig}


# ---------------------------------------------------------------------------
# [V10.1 UPGRADE 10] No-Code "+ Add Crypto Coin" Watchlist Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/watchlist")
def get_watchlist() -> Dict[str, Any]:
    return {
        "custom_watchlist": fetch_custom_watchlist(),
        "core_count": len(CRYPTO_UNIVERSE_MAP),
    }


@app.post("/api/watchlist")
def add_to_watchlist(payload: WatchlistAddInput) -> Dict[str, Any]:
    info = validate_and_inspect_crypto_ticker(payload.symbol)
    if not info.get("valid"):
        raise HTTPException(status_code=400, detail=info.get("error", "Invalid Crypto ticker symbol."))
    added = add_custom_watchlist_ticker(
        symbol=info["symbol"],
        name=info["name"],
        sector=info.get("sector", "HIGH_SPEED_L1"),
        twin=info.get("twin", "BTC"),
    )
    state = build_full_terminal_state()
    return {"ok": True, "item": added, "price": info.get("price"), "state": state}


@app.delete("/api/watchlist/{symbol}")
def delete_from_watchlist(symbol: str) -> Dict[str, Any]:
    removed = remove_custom_watchlist_ticker(symbol.replace("-USD", ""))
    state = build_full_terminal_state()
    return {"ok": removed, "state": state}


# ---------------------------------------------------------------------------
# [V10.1 UPGRADE 11] Telegram Sniper Bot & Alert Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/telegram/settings")
def get_telegram_settings() -> Dict[str, Any]:
    return fetch_alert_settings()


@app.post("/api/telegram/settings")
@app.post("/api/alerts/settings")
def update_alert_settings_endpoint(payload: AlertSettingsInput) -> Dict[str, Any]:
    saved = save_alert_settings(
        telegram_bot_token=payload.telegram_bot_token,
        telegram_chat_id=payload.telegram_chat_id,
        discord_webhook_url=payload.discord_webhook_url,
        enabled=payload.enabled,
    )
    return {"ok": True, "settings": saved}


@app.post("/api/telegram/auto-detect")
async def auto_detect_chat_id_endpoint(payload: AutoDetectChatInput) -> Dict[str, Any]:
    return await auto_detect_telegram_chat_id(payload.telegram_bot_token)


@app.post("/api/telegram/webhook")
async def telegram_webhook_endpoint(payload: Dict[str, Any]) -> Dict[str, Any]:
    settings = fetch_alert_settings()
    token = (settings.get("telegram_bot_token") or os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    cb = payload.get("callback_query") or payload
    return await handle_telegram_callback_query(
        cb,
        market="CRYPTO",
        bot_token=token,
        db_path=DB_PATH,
        open_trade_fn=lambda p: log_new_trade(
            TradeLogInput(
                symbol=str(p["symbol"]),
                mode="REAL",
                entry_price=float(p.get("entry_price") or 100.0),
                shares=float(p.get("shares") or 1.0),
                plan_selected=str(p.get("plan_selected") or "PLAN_B_LIMIT_DIP"),
            )
        ),
        partial_close_fn=lambda tid, pct: partial_close_open_position(tid, PartialCloseInput(close_pct=pct)),
        close_trade_fn=lambda tid: close_open_trade(tid, TradeCloseInput(close_reason="TELEGRAM_1TAP_CLOSE")),
    )


@app.post("/api/telegram/test")
@app.post("/api/alerts/test")
async def test_alert_dispatch() -> Dict[str, Any]:
    settings = fetch_alert_settings()
    state = _STATE_CACHE.get("LATEST") or build_full_terminal_state()
    brief = format_crypto_12h_sniper_briefing(state, "TEST ALERT")
    res = await send_telegram_message(
        bot_token=settings.get("telegram_bot_token", ""),
        chat_id=settings.get("telegram_chat_id", ""),
        text="🚀 <b>CRYPTO V10.1 SOVEREIGN 1x SPOT SNIPER BOT CONNECTED!</b>\n\n" + brief,
    )
    return res


@app.post("/api/telegram/briefing")
async def trigger_crypto_briefing_now() -> Dict[str, Any]:
    settings = fetch_alert_settings()
    state = _STATE_CACHE.get("LATEST") or build_full_terminal_state()
    brief = format_crypto_12h_sniper_briefing(state, "07:30 / 19:30 SAST BRIEFING")
    return await send_telegram_message(
        bot_token=settings.get("telegram_bot_token", ""),
        chat_id=settings.get("telegram_chat_id", ""),
        text=brief,
    )


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
    base_w = current_weights or {"quant_microstructure": 0.30, "perp_funding_options": 0.27, "onchain_defillama_dex": 0.23, "macro_narrative_zar": 0.20}
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


# =========================================================================
# Autonomous Self-Improving Trading Bot Endpoints
# =========================================================================

@app.get("/api/bot/status")
def get_autonomous_bot_status() -> Dict[str, Any]:
    return {"ok": True, "status": GLOBAL_AUTONOMOUS_BOT.get_status()}


@app.post("/api/bot/start")
def start_autonomous_bot() -> Dict[str, Any]:
    return GLOBAL_AUTONOMOUS_BOT.start()


@app.post("/api/bot/stop")
def stop_autonomous_bot() -> Dict[str, Any]:
    return GLOBAL_AUTONOMOUS_BOT.stop()


@app.post("/api/bot/step")
def run_autonomous_bot_step() -> Dict[str, Any]:
    return GLOBAL_AUTONOMOUS_BOT.run_single_step()


@app.post("/api/bot/settings")
def update_autonomous_bot_settings(payload: BotSettingsInput) -> Dict[str, Any]:
    updated = save_bot_settings(
        enabled=payload.enabled,
        mode=payload.mode,
        max_active_positions=payload.max_active_positions,
        min_kelly_fraction_pct=payload.min_kelly_fraction_pct,
        eta_learning_rate=payload.eta_learning_rate,
        polling_interval_sec=payload.polling_interval_sec,
        auto_manage_coach=payload.auto_manage_coach,
        broker_profile=payload.broker_profile,
    )
    if payload.enabled is not None:
        if payload.enabled:
            GLOBAL_AUTONOMOUS_BOT.start()
        else:
            GLOBAL_AUTONOMOUS_BOT.stop()
    return {"ok": True, "settings": updated, "status": GLOBAL_AUTONOMOUS_BOT.get_status()}


@app.get("/api/bot/logs")
def get_autonomous_bot_logs(limit: int = Query(50)) -> Dict[str, Any]:
    return {"ok": True, "logs": fetch_bot_audit_logs(limit=limit)}


@app.websocket("/ws/live")
async def websocket_live_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            state = _STATE_CACHE.get("LATEST") or build_full_terminal_state(DEFAULT_FEE_PROFILE)
            await websocket.send_json({
                "type": "CRYPTO_LIVE_TICK",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "macro": state["macro"],
                "usdzar": state["usdzar"],
                "barbell_plan": state["barbell_plan"],
                "top_signals": state["signals"][:8],
                "active_trades": state["active_trades"],
            })
            await asyncio.sleep(5.0)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=BACKEND_PORT, reload=False)
# V13 SECURITY PATCH: CORS restricted to localhost, bind 127.0.0.1
