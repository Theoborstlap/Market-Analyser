"""
Unified Cross-Market Optimal Buy Alert Filter, Multi-Stage Take-Profit & Chandelier
Trailing Stop Engine, Real-Time Active Trade Dispatcher, and HMAC-Signed 1-Tap
Telegram Inline Keyboard Execution Webhook (US, Crypto, JSE).
"""

import asyncio
import hashlib
import hmac
import json
import os
import subprocess
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from .oms_engine import (
    execute_crypto_ccxt_bracket_order,
    execute_jse_ibkr_or_webhook_bracket_order,
    get_wal_sqlite_connection,
    validate_pre_trade_risk,
)

SAST_TZ = ZoneInfo("Africa/Johannesburg")
US_EASTERN_TZ = ZoneInfo("America/New_York")

# Persistent in-memory stage & Chandelier ratchet cache keyed by "{market}:{trade_id}"
_ACTIVE_TRADE_ALERT_CACHE: Dict[str, Dict[str, Any]] = {}


# ===========================================================================
# 1. HMAC-SHA256 Callback Signing & Inline Keyboard Builders
# ===========================================================================
def _get_signing_secret(bot_token: Optional[str] = None) -> bytes:
    raw = (
        bot_token
        or os.environ.get("TELEGRAM_BOT_TOKEN")
        or os.environ.get("OMS_WEBHOOK_SECRET")
        or "sovereign-oms-default-secret"
    ).strip()
    return raw.encode("utf-8")


def sign_callback_data(payload_core: str, bot_token: Optional[str] = None) -> str:
    """
    Appends an 8-hex-char HMAC-SHA256 signature to a callback payload string
    so total length stays strictly <= 64 bytes (Telegram Bot API limit).
    Format: <payload_core>:<hmac8>
    """
    secret = _get_signing_secret(bot_token)
    mac = hmac.new(secret, payload_core.encode("utf-8"), hashlib.sha256).hexdigest()[:8]
    signed = f"{payload_core}:{mac}"
    return signed[:64]


def verify_and_parse_callback_data(
    callback_data: str,
    bot_token: Optional[str] = None,
) -> Tuple[bool, List[str]]:
    """
    Verifies the trailing HMAC-SHA256 signature on a callback_data string
    and returns (is_valid, parts_without_sig).
    Also accepts unsigned legacy `cb:...` if signature matches either token or env secret.
    """
    if not callback_data or not callback_data.startswith("cb:"):
        return False, []
    parts = callback_data.split(":")
    if len(parts) < 4:
        return False, []

    provided_mac = parts[-1]
    core = ":".join(parts[:-1])

    for candidate_token in (bot_token, os.environ.get("TELEGRAM_BOT_TOKEN"), None):
        expected_mac = hmac.new(
            _get_signing_secret(candidate_token),
            core.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:8]
        if hmac.compare_digest(provided_mac, expected_mac):
            return True, parts[:-1]

    return False, []


def build_buy_alert_inline_keyboard(
    market: str,
    ticker: str,
    limit_price: float,
    bot_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Builds Telegram InlineKeyboardMarkup for Buy Alerts:
    [🎯 Buy Limit @ Best Bid] (cb:buy_limit:<market>:<ticker>:<price>:<sig>)
    [⚡ Buy Market]            (cb:buy_mkt:<market>:<ticker>:<sig>)
    """
    mkt = market.upper().strip()
    sym = ticker.upper().strip()
    p_str = f"{float(limit_price):.4f}" if float(limit_price) < 10.0 else f"{float(limit_price):.2f}"
    cb_limit = sign_callback_data(f"cb:buy_limit:{mkt}:{sym}:{p_str}", bot_token)
    cb_mkt = sign_callback_data(f"cb:buy_mkt:{mkt}:{sym}", bot_token)
    return {
        "inline_keyboard": [
            [
                {"text": f"🎯 Buy Limit @ {p_str}", "callback_data": cb_limit},
                {"text": "⚡ Buy Market", "callback_data": cb_mkt},
            ]
        ]
    }


def build_active_trade_inline_keyboard(
    market: str,
    trade_id: Any,
    bot_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Builds Telegram InlineKeyboardMarkup for Active Trade Alerts:
    [💰 Harvest 50% TP] (cb:tp50:<market>:<trade_id>:<sig>)
    [🔒 Lock Breakeven] (cb:be:<market>:<trade_id>:<sig>)
    [❌ Close All]      (cb:close:<market>:<trade_id>:<sig>)
    """
    mkt = market.upper().strip()
    tid = str(trade_id).strip()
    cb_tp50 = sign_callback_data(f"cb:tp50:{mkt}:{tid}", bot_token)
    cb_be = sign_callback_data(f"cb:be:{mkt}:{tid}", bot_token)
    cb_close = sign_callback_data(f"cb:close:{mkt}:{tid}", bot_token)
    return {
        "inline_keyboard": [
            [
                {"text": "💰 Harvest 50% TP", "callback_data": cb_tp50},
                {"text": "🔒 Lock Breakeven", "callback_data": cb_be},
                {"text": "❌ Close All", "callback_data": cb_close},
            ]
        ]
    }


# ===========================================================================
# 2. Shared Optimal Buy Alert Filter
# ===========================================================================
def should_dispatch_buy_alert(
    *,
    market: str,
    signal: Dict[str, Any],
    macro_state: Optional[Dict[str, Any]] = None,
    now_utc: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Evaluates institutional timing, pullback, macro, and volume filters before firing a Buy Alert:
    1. Opening Bell Spread Filter: Block equity buy alerts during first 15m of open
       (09:00–09:15 SAST for JSE; 09:30–09:45 EST/EDT for US).
    2. Limit Pullback Calculation (Plan B > Plan A): Compute optimal limit bid at
       min(90%_conformal_lower_band, EMA_20) instead of market chase price.
    3. Macro & Funding Gate: Block equity buys if VIX > 25.0 or USDZAR_ou_zscore > 1.5;
       block crypto buys if funding_apr > 25.0%.
    4. RVOL Pace Filter: Block buy alerts if intraday relative volume pace RVOL < 1.25.
    """
    mkt = market.upper().strip()
    macro = macro_state or {}
    now = now_utc or datetime.now(timezone.utc)
    reasons: List[str] = []

    # 1. Opening Bell Spread Filter (First 15m of equity session)
    if mkt == "JSE":
        now_sast = now.astimezone(SAST_TZ)
        if now_sast.weekday() < 5 and now_sast.hour == 9 and 0 <= now_sast.minute < 15:
            reasons.append("OPENING_BELL_SPREAD_FILTER_JSE: 09:00-09:15 SAST blocked")
    elif mkt == "US":
        now_et = now.astimezone(US_EASTERN_TZ)
        if now_et.weekday() < 5 and now_et.hour == 9 and 30 <= now_et.minute < 45:
            reasons.append("OPENING_BELL_SPREAD_FILTER_US: 09:30-09:45 ET blocked")

    # 2. Limit Pullback Calculation: min(90%_conformal_lower_band, EMA_20)
    spot_price = float(
        signal.get("price")
        or signal.get("entry_price")
        or signal.get("current_price")
        or 0.0
    )
    conformal_low = float(
        signal.get("conformal_lower_90")
        or signal.get("conformal_low")
        or signal.get("limit_dip_entry_price")
        or (spot_price * 0.99)
    )
    ema_20 = float(
        signal.get("ema_20")
        or signal.get("ema20")
        or signal.get("anchored_vwap")
        or (spot_price * 0.992)
    )
    candidates = [p for p in (conformal_low, ema_20) if p > 0]
    optimal_limit_bid = min(candidates) if candidates else spot_price
    if spot_price > 0 and optimal_limit_bid > spot_price:
        optimal_limit_bid = spot_price * 0.995

    # 3. Macro & Funding Gate
    if mkt in ("US", "JSE"):
        vix_val = float(
            macro.get("vix")
            or macro.get("vix_level")
            or signal.get("vix")
            or 16.5
        )
        usdzar_z = float(
            macro.get("usdzar_zscore")
            or macro.get("usdzarZscore20d")
            or signal.get("usdzar_zscore")
            or 0.0
        )
        if vix_val > 25.0:
            reasons.append(f"MACRO_VIX_GATE_BLOCKED: VIX {vix_val:.2f} > 25.0")
        if usdzar_z > 1.5:
            reasons.append(f"MACRO_USDZAR_OU_GATE_BLOCKED: Z-Score {usdzar_z:+.2f} > +1.50")
    elif mkt == "CRYPTO":
        funding_apr = float(
            signal.get("funding_rate_apr_pct")
            or signal.get("funding_apr")
            or macro.get("btc_funding_apr_pct")
            or 8.0
        )
        if funding_apr > 25.0:
            reasons.append(f"CRYPTO_FUNDING_GATE_BLOCKED: Funding APR {funding_apr:.1f}% > 25.0%")

    # 4. RVOL Pace Filter (RVOL >= 1.25)
    rvol = float(
        signal.get("rvol")
        or signal.get("rvol_pace")
        or signal.get("intraday_rvol_pace")
        or signal.get("volume_pace_ratio")
        or 1.35
    )
    if rvol < 1.25:
        reasons.append(f"LOW_RVOL_PACE_BLOCKED: RVOL {rvol:.2f}x < 1.25x minimum")

    allowed = len(reasons) == 0
    return {
        "allowed": allowed,
        "reasons": reasons,
        "recommended_plan": "PLAN_B_LIMIT_PULLBACK",
        "optimal_limit_bid": round(optimal_limit_bid, 6 if optimal_limit_bid < 1.0 else 2),
        "conformal_lower_90": round(conformal_low, 6 if conformal_low < 1.0 else 2),
        "ema_20": round(ema_20, 6 if ema_20 < 1.0 else 2),
        "rvol": round(rvol, 2),
    }


# ===========================================================================
# 3. Multi-Stage Take-Profit, Chandelier Trail & Time-Stop Engine
# ===========================================================================
def evaluate_active_trade_stages(
    trade: Dict[str, Any],
    market: str = "US",
    prior_alert_state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Evaluates an active trade across 5 institutional exit/harvest rules:
    - TP0 (Breakeven Lock): price >= Entry + 1.0 * ATR (or +1.5R) -> 🔒 MOVE STOP TO BREAKEVEN (Entry + Fees)
    - TP1 (33% Harvest): at 1st structural resistance / upper conformal band -> harvest 1/3
    - TP2 (33% Target): at quant model target price -> harvest 1/3
    - TP3 (34% Runner + Chandelier Stop): trailing_stop = max(prior_stop, highest_high - 2.2 * ATR_14).
      Fires ratchet alert ONLY when trailing_stop rises >= 0.5% above prior alerted stop.
    - Time-Stop Decay: trade age >= 7 days and max unrealized excursion < +0.5R -> ⏱ STALE MOMENTUM EXIT.
    """
    prior = prior_alert_state or {}
    entry_price = float(
        trade.get("entry_price")
        or trade.get("entry_price_zar")
        or trade.get("entryPriceZar")
        or 0.0
    )
    current_price = float(
        trade.get("current_price")
        or trade.get("current_price_zar")
        or trade.get("currentPriceZar")
        or entry_price
    )
    highest_high = max(
        current_price,
        entry_price,
        float(
            trade.get("highest_price_seen")
            or trade.get("highest_price_zar")
            or trade.get("highestPriceZar")
            or current_price
        ),
    )
    prior_stop = float(
        trade.get("stop_loss")
        or trade.get("stop_loss_zar")
        or trade.get("stopLossZar")
        or (entry_price * 0.96)
    )
    target_price = float(
        trade.get("target_price")
        or trade.get("target_price_zar")
        or trade.get("targetPriceZar")
        or (entry_price * 1.08)
    )
    atr = float(
        trade.get("atr_at_entry")
        or trade.get("atr_14")
        or max(abs(entry_price - prior_stop) / 1.35, entry_price * 0.02)
    )
    fee_pct = float(trade.get("round_trip_fee_pct") or (0.64 if market.upper() == "JSE" else 0.15))

    risk_1r = max(abs(entry_price - prior_stop), atr * 0.75, 1e-6)
    breakeven_price = entry_price * (1.0 + (fee_pct / 100.0) + 0.001)

    tp0_trigger = float(
        trade.get("tp0_price")
        or trade.get("tp0_price_zar")
        or min(entry_price + 1.0 * atr, entry_price + 1.5 * risk_1r)
    )
    tp1_trigger = float(
        trade.get("tp1_price")
        or trade.get("tp1_price_zar")
        or trade.get("conformal_upper_90")
        or (entry_price + 0.55 * max(target_price - entry_price, 1.5 * atr))
    )
    tp2_trigger = target_price

    # Chandelier 2.2x ATR Trailing Stop
    chandelier_raw = highest_high - 2.2 * atr
    trailing_stop = max(prior_stop, chandelier_raw)
    if current_price >= tp0_trigger:
        trailing_stop = max(trailing_stop, breakeven_price)

    prior_alerted_stop = float(prior.get("alerted_stop") or prior_stop)
    stop_ratchet_pct = (
        ((trailing_stop - prior_alerted_stop) / max(prior_alerted_stop, 1e-6)) * 100.0
        if trailing_stop > prior_alerted_stop
        else 0.0
    )
    ratchet_Should_fire = stop_ratchet_pct >= 0.5

    # Compute trade age in days & max unrealized excursion in R
    days_held = float(trade.get("days_held") or 0.0)
    if days_held <= 0.0 and trade.get("opened_at"):
        try:
            raw_dt = str(trade["opened_at"]).replace("Z", "+00:00")
            dt_obj = datetime.fromisoformat(raw_dt)
            if dt_obj.tzinfo is None:
                dt_obj = dt_obj.replace(tzinfo=timezone.utc)
            days_held = max(0.0, (datetime.now(timezone.utc) - dt_obj).total_seconds() / 86400.0)
        except Exception:
            days_held = 0.0

    max_excursion_r = (highest_high - entry_price) / risk_1r if entry_price > 0 else 0.0
    time_stop_triggered = (days_held >= 7.0) and (max_excursion_r < 0.5)

    tp0_reached = current_price >= tp0_trigger or bool(trade.get("tp0_hit"))
    tp1_reached = current_price >= tp1_trigger or bool(trade.get("tp1_hit"))
    tp2_reached = current_price >= tp2_trigger or bool(trade.get("tp2_hit"))

    directives: List[str] = []
    stage_code = "STAGE_HOLD"
    should_fire_alert = False

    if time_stop_triggered and not prior.get("time_stop_sent"):
        stage_code = "TIME_STOP_EXIT"
        directives.append("⏱ STALE MOMENTUM EXIT (Age >= 7d & Max Excursion < +0.5R — Rotate Capital)")
        should_fire_alert = True

    if tp2_reached and not prior.get("tp2_sent"):
        stage_code = "TP2_TARGET_HARVEST_33"
        directives.append("🎯 TP2 TARGET HIT: HARVEST 33% & LET 34% RUNNER RIDE CHANDELIER TRAIL")
        should_fire_alert = True
    elif tp1_reached and not prior.get("tp1_sent"):
        stage_code = "TP1_RESISTANCE_HARVEST_33"
        directives.append("💰 TP1 STRUCTURAL RESISTANCE / CONFORMAL UPPER BAND: HARVEST 33% (1/3 Position)")
        should_fire_alert = True
    elif tp0_reached and not prior.get("tp0_sent"):
        stage_code = "TP0_BREAKEVEN_LOCK"
        directives.append(f"🔒 MOVE STOP TO BREAKEVEN (Entry + Fees = {breakeven_price:.4f})")
        should_fire_alert = True

    if tp0_reached and ratchet_Should_fire:
        if stage_code == "STAGE_HOLD":
            stage_code = "TP3_CHANDELIER_RATCHET"
        directives.append(
            f"📈 TP3 CHANDELIER RATCHET (+{stop_ratchet_pct:.2f}%): Raise Stop to {trailing_stop:.4f} (Highest High - 2.2x ATR)"
        )
        should_fire_alert = True

    updated_state = {
        "tp0_sent": bool(prior.get("tp0_sent") or tp0_reached),
        "tp1_sent": bool(prior.get("tp1_sent") or tp1_reached),
        "tp2_sent": bool(prior.get("tp2_sent") or tp2_reached),
        "time_stop_sent": bool(prior.get("time_stop_sent") or time_stop_triggered),
        "alerted_stop": trailing_stop if (should_fire_alert or ratchet_Should_fire) else prior_alerted_stop,
        "last_stage_code": stage_code,
    }

    return {
        "should_fire_alert": should_fire_alert,
        "stage_code": stage_code,
        "directives": directives,
        "breakeven_price": round(breakeven_price, 6),
        "tp0_price": round(tp0_trigger, 6),
        "tp1_price": round(tp1_trigger, 6),
        "tp2_price": round(tp2_trigger, 6),
        "trailing_stop": round(trailing_stop, 6),
        "stop_ratchet_pct": round(stop_ratchet_pct, 3),
        "days_held": round(days_held, 2),
        "max_excursion_r": round(max_excursion_r, 2),
        "time_stop_triggered": time_stop_triggered,
        "updated_alert_state": updated_state,
    }


# ===========================================================================
# 4. Unified Telegram HTTP Sender & Real-Time Coach Dispatcher (All 3 Markets)
# ===========================================================================
def send_telegram_with_markup_sync(
    bot_token: str,
    chat_id: str,
    text: str,
    reply_markup: Optional[Dict[str, Any]] = None,
    parse_mode: Optional[str] = "HTML",
    timeout: float = 6.0,
) -> Dict[str, Any]:
    token = (bot_token or "").strip()
    cid = str(chat_id or "").strip()
    if not token or not cid:
        return {"ok": False, "error": "Missing Bot Token or Chat ID"}
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload: Dict[str, Any] = {
        "chat_id": cid,
        "text": text,
        "disable_web_page_preview": True,
    }
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = reply_markup

    body_str = json.dumps(payload)
    try:
        res = subprocess.run(
            [
                "curl",
                "-s",
                "-m",
                str(int(max(3, timeout))),
                "-X",
                "POST",
                url,
                "-H",
                "Content-Type: application/json",
                "-d",
                body_str,
            ],
            capture_output=True,
            text=True,
            timeout=timeout + 2.0,
        )
        if res.returncode == 0 and res.stdout.strip():
            data = json.loads(res.stdout)
            return {"ok": bool(data.get("ok", False)), "result": data}
    except Exception:
        pass

    try:
        req = urllib.request.Request(
            url,
            data=body_str.encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {"ok": bool(data.get("ok", False)), "result": data}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def dispatch_active_trades_coach_alerts(
    dashboard_state: Dict[str, Any],
    *,
    market: str = "JSE",
    bot_token: Optional[str] = None,
    chat_id: Optional[str] = None,
    enabled: bool = True,
) -> List[Dict[str, Any]]:
    """
    Unified real-time Active Trade Coach Dispatcher for JSE, US, and Crypto.
    Monitors every open position on each 10s heartbeat for:
    - TP0 Breakeven Lock (Entry + Fees)
    - TP1 (33% Harvest at Conformal Upper / 1st Resistance)
    - TP2 (33% Harvest at Target)
    - TP3 Runner Chandelier Trailing Stop Ratchet (>= +0.5% step)
    - Time-Stop Decay (>= 7d & < +0.5R)
    - Stage transitions from the 7-stage coach engine
    Attaches 1-Tap InlineKeyboardMarkup buttons to every alert.
    """
    mkt = market.upper().strip()
    alert_cfg = dashboard_state.get("alert_settings") or {}
    token = (bot_token or alert_cfg.get("telegram_bot_token") or os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    cid = str(chat_id or alert_cfg.get("telegram_chat_id") or os.environ.get("TELEGRAM_CHAT_ID") or "").strip()
    is_on = enabled and bool(
        alert_cfg.get("enabled", alert_cfg.get("telegram_enabled", True)) if alert_cfg else True
    )
    if not is_on or not token or not cid:
        return []

    active_trades = (
        dashboard_state.get("activeTrades")
        or dashboard_state.get("active_trades")
        or []
    )
    dispatched: List[Dict[str, Any]] = []
    ccy = "R" if mkt == "JSE" else "$"

    for t in active_trades:
        tid = t.get("id")
        if tid is None:
            continue
        cache_key = f"{mkt}:{tid}"
        prior_state = _ACTIVE_TRADE_ALERT_CACHE.get(cache_key, {})

        eval_res = evaluate_active_trade_stages(t, market=mkt, prior_alert_state=prior_state)
        stage_lbl = str(
            t.get("coachStageLabel")
            or t.get("stage_label")
            or eval_res["stage_code"]
        )
        coach_sig = f"{stage_lbl}:{t.get('coachUrgency') or t.get('urgency') or ''}"
        prev_coach_sig = prior_state.get("coach_sig")
        coach_stage_changed = (prev_coach_sig is not None) and (prev_coach_sig != coach_sig)

        if eval_res["should_fire_alert"] or coach_stage_changed:
            sym = str(t.get("ticker") or t.get("symbol") or "ASSET").upper()
            pnl_pct = float(
                t.get("unrealizedPnlPct")
                or t.get("net_pnl_pct")
                or t.get("unrealized_net_pnl_pct")
                or 0.0
            )
            pnl_val = float(
                t.get("unrealizedPnlZar")
                or t.get("unrealized_pnl_usd")
                or t.get("unrealized_pnl_usdt")
                or t.get("realized_partial_pnl_zar")
                or 0.0
            )
            badge = (
                " | ".join(eval_res["directives"])
                if eval_res["directives"]
                else str(t.get("coachActionBadge") or t.get("action_directive") or "STAGE UPDATE")
            )
            trail_stop = eval_res["trailing_stop"]
            prog_pct = float(
                t.get("progressToTargetPct")
                or t.get("progress_toward_target_pct")
                or 0.0
            )

            msg = (
                f"🔔 <b>{mkt} TRADE COACH DIRECTIVE — {sym} (#{tid})</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━\n"
                f"• Directive: <b>{badge}</b>\n"
                f"• Stage: <b>{stage_lbl}</b>\n"
                f"• Net P&L: <b>{pnl_pct:+.2f}% ({ccy}{pnl_val:+,.2f})</b>\n"
                f"• Chandelier Trailing Stop (2.2x ATR): <b>{ccy}{trail_stop:.4f}</b>\n"
                f"• Breakeven Lock Floor: <b>{ccy}{eval_res['breakeven_price']:.4f}</b>\n"
                f"• Progress to Target: <b>{prog_pct:.1f}%</b> (Age: {eval_res['days_held']:.1f}d)"
            )
            markup = build_active_trade_inline_keyboard(mkt, tid, bot_token=token)
            send_res = send_telegram_with_markup_sync(token, cid, msg, reply_markup=markup)
            dispatched.append({"trade_id": tid, "symbol": sym, "stage": eval_res["stage_code"], "sent": send_res.get("ok")})

        new_state = dict(eval_res["updated_alert_state"])
        new_state["coach_sig"] = coach_sig
        _ACTIVE_TRADE_ALERT_CACHE[cache_key] = new_state

    return dispatched


# ===========================================================================
# 5. Unified 1-Tap Callback Query Handler (Webhook & Polling)
# ===========================================================================
async def handle_telegram_callback_query(
    callback_query: Dict[str, Any],
    *,
    market: str,
    bot_token: str,
    db_path: str,
    open_trade_fn: Optional[Callable[[Dict[str, Any]], Any]] = None,
    partial_close_fn: Optional[Callable[[int, float], Any]] = None,
    close_trade_fn: Optional[Callable[[int], Any]] = None,
    lock_breakeven_fn: Optional[Callable[[int], Any]] = None,
) -> Dict[str, Any]:
    """
    Verifies HMAC-SHA256 signature on 1-tap Telegram Inline Keyboard button presses
    and routes execution directly into shared_core/oms_engine.py & local DB handlers.
    """
    cb_id = str(callback_query.get("id") or "")
    cb_data = str(callback_query.get("data") or "")
    msg_obj = callback_query.get("message") or {}
    chat_id = str((msg_obj.get("chat") or {}).get("id") or "")

    is_valid, parts = verify_and_parse_callback_data(cb_data, bot_token=bot_token)
    if not is_valid or len(parts) < 4:
        return {"ok": False, "error": "INVALID_OR_UNSIGNED_CALLBACK_PAYLOAD"}

    action = parts[1].lower()
    cb_market = parts[2].upper()
    target_ref = parts[3]

    reply_text = ""
    exec_result: Dict[str, Any] = {}

    try:
        if action in ("buy_limit", "buy_mkt"):
            ticker = target_ref.upper()
            req_price = float(parts[4]) if (action == "buy_limit" and len(parts) >= 5) else 0.0
            plan_name = "PLAN_B_LIMIT_DIP" if action == "buy_limit" else "PLAN_A_MARKET"
            if open_trade_fn is not None:
                payload = {
                    "symbol": ticker,
                    "ticker": ticker,
                    "entry_price": req_price if req_price > 0 else None,
                    "entry_price_zar": req_price if req_price > 0 else None,
                    "shares": 1.0,
                    "mode": "REAL",
                    "trade_mode": "REAL_BROKER_TRADE",
                    "plan_selected": plan_name,
                    "recommended_entry_plan": plan_name,
                }
                res = open_trade_fn(payload)
                if asyncio.iscoroutine(res):
                    res = await res
                exec_result = res if isinstance(res, dict) else {"result": res}
            reply_text = f"✅ <b>1-TAP {cb_market} {action.upper()} EXECUTED: {ticker}</b> ({plan_name})"

        elif action == "tp50":
            trade_id = int(target_ref)
            if partial_close_fn is not None:
                res = partial_close_fn(trade_id, 50.0)
                if asyncio.iscoroutine(res):
                    res = await res
                exec_result = res if isinstance(res, dict) else {"result": res}
            reply_text = f"💰 <b>1-TAP 50% TAKE-PROFIT HARVESTED: {cb_market} Trade #{trade_id}</b>"

        elif action == "be":
            trade_id = int(target_ref)
            if lock_breakeven_fn is not None:
                res = lock_breakeven_fn(trade_id)
                if asyncio.iscoroutine(res):
                    res = await res
                exec_result = res if isinstance(res, dict) else {"result": res}
            else:
                conn = get_wal_sqlite_connection(db_path)
                try:
                    if cb_market == "JSE":
                        conn.execute(
                            "UPDATE portfolio SET stop_loss_zar = MAX(stop_loss_zar, COALESCE(breakeven_lock_price, entry_price_zar * 1.007)), tp0_hit = 1 WHERE id = ?",
                            (trade_id,),
                        )
                    else:
                        conn.execute(
                            "UPDATE trades SET stop_loss = MAX(stop_loss, entry_price * 1.002) WHERE id = ?",
                            (trade_id,),
                        )
                    conn.commit()
                finally:
                    conn.close()
                exec_result = {"ok": True, "trade_id": trade_id, "locked_breakeven": True}
            reply_text = f"🔒 <b>1-TAP BREAKEVEN STOP LOCKED: {cb_market} Trade #{trade_id}</b>"

        elif action == "close":
            trade_id = int(target_ref)
            if close_trade_fn is not None:
                res = close_trade_fn(trade_id)
                if asyncio.iscoroutine(res):
                    res = await res
                exec_result = res if isinstance(res, dict) else {"result": res}
            reply_text = f"❌ <b>1-TAP FULL POSITION CLOSED: {cb_market} Trade #{trade_id}</b>"
        else:
            return {"ok": False, "error": f"Unsupported callback action: {action}"}

        # Acknowledge callback toast on Telegram UI and post confirmation message
        if bot_token and cb_id:
            ack_url = f"https://api.telegram.org/bot{bot_token.strip()}/answerCallbackQuery"
            await asyncio.to_thread(
                send_telegram_with_markup_sync,
                bot_token,
                chat_id,
                reply_text,
            )
            try:
                req = urllib.request.Request(
                    ack_url,
                    data=json.dumps({"callback_query_id": cb_id, "text": reply_text[:180]}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                urllib.request.urlopen(req, timeout=4.0).close()
            except Exception:
                pass

        return {"ok": True, "action": action, "market": cb_market, "target": target_ref, "execution": exec_result}
    except Exception as exc:
        return {"ok": False, "action": action, "error": str(exc)}
