"""2-Way Interactive Telegram Sniper Bot + Prime-Hours (09:20–16:40 SAST) 12/12-Only Auto-Alert Dispatcher
+ Stale Plan B Limit-Order Regime-Break Cancellation Alert + 08:45 SAST Pre-Open Briefing Engine (V12.0 "The Sovereign Omega 12/12 Finale")."""

import asyncio
import json
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from config import JSE_EQUITY_FRICTION_PCT, JSE_ETF_FRICTION_PCT, get_round_trip_friction_pct, is_stt_exempt_etf
from data_fetcher import SAST_ZONE, get_jse_session_status
from database import (
    fetch_all_dict,
    get_active_plan_b_alerts_for_cancel_check,
    get_connection,
    has_signal_alert_been_sent_today,
    mark_signal_alert_cancelled,
    record_signal_alert_sent,
    sync_portfolio_and_trades,
)


def get_telegram_settings() -> Dict[str, Any]:
    rows = fetch_all_dict("SELECT * FROM alert_settings WHERE id = 1")
    if not rows:
        return {
            "macos_desktop_enabled": True,
            "telegram_enabled": False,
            "telegram_bot_token": "",
            "telegram_chat_id": "",
            "morning_briefing_enabled": True,
            "last_update_id": 0,
            "last_briefing_date": "",
            "discord_enabled": False,
            "discord_webhook_url": "",
            "alert_on_prime_alpha": True,
            "alert_on_offshore_arb": True,
            "alert_on_sens_pead": True,
            "alert_on_coach_stages": True,
        }
    r = rows[0]
    return {
        "macos_desktop_enabled": bool(r.get("macos_desktop_enabled", 1)),
        "telegram_enabled": bool(r.get("telegram_enabled", 0)),
        "telegram_bot_token": str(r.get("telegram_bot_token") or ""),
        "telegram_chat_id": str(r.get("telegram_chat_id") or ""),
        "morning_briefing_enabled": bool(r.get("morning_briefing_enabled", 1)),
        "last_update_id": int(r.get("last_update_id") or 0),
        "last_briefing_date": str(r.get("last_briefing_date") or ""),
        "discord_enabled": bool(r.get("discord_enabled", 0)),
        "discord_webhook_url": str(r.get("discord_webhook_url") or ""),
        "alert_on_prime_alpha": bool(r.get("alert_on_prime_alpha", 1)),
        "alert_on_offshore_arb": bool(r.get("alert_on_offshore_arb", 1)),
        "alert_on_sens_pead": bool(r.get("alert_on_sens_pead", 1)),
        "alert_on_coach_stages": bool(r.get("alert_on_coach_stages", 1)),
    }


def save_telegram_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    current = get_telegram_settings()
    macos_en = 1 if payload.get("macos_desktop_enabled", payload.get("macosDesktopEnabled", current["macos_desktop_enabled"])) else 0
    tg_en = 1 if payload.get("telegram_enabled", payload.get("telegramEnabled", current["telegram_enabled"])) else 0
    bot_token = str(payload.get("telegram_bot_token", payload.get("telegramBotToken", current["telegram_bot_token"])) or "").strip()
    chat_id = str(payload.get("telegram_chat_id", payload.get("telegramChatId", current["telegram_chat_id"])) or "").strip()
    briefing_en = 1 if payload.get("morning_briefing_enabled", payload.get("morningBriefingEnabled", current["morning_briefing_enabled"])) else 0
    disc_en = 1 if payload.get("discord_enabled", payload.get("discordEnabled", current["discord_enabled"])) else 0
    disc_url = str(payload.get("discord_webhook_url", payload.get("discordWebhookUrl", current["discord_webhook_url"])) or "").strip()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE alert_settings SET
            macos_desktop_enabled = ?,
            telegram_enabled = ?,
            telegram_bot_token = ?,
            telegram_chat_id = ?,
            morning_briefing_enabled = ?,
            discord_enabled = ?,
            discord_webhook_url = ?
        WHERE id = 1
        """,
        (macos_en, tg_en, bot_token, chat_id, briefing_en, disc_en, disc_url),
    )
    conn.commit()
    conn.close()
    return get_telegram_settings()


def _telegram_api_post(url: str, payload: Dict[str, Any], timeout: float = 6.0) -> Dict[str, Any]:
    body_str = json.dumps(payload)
    res = subprocess.run(
        ["curl", "-s", "-m", str(int(max(3, timeout))), "-X", "POST", url, "-H", "Content-Type: application/json", "-d", body_str],
        capture_output=True,
        text=True,
        timeout=timeout + 2.0,
    )
    if res.returncode == 0 and res.stdout.strip():
        return json.loads(res.stdout)
    req = urllib.request.Request(url, data=body_str.encode("utf-8"), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _telegram_api_get(url: str, timeout: float = 6.0) -> Dict[str, Any]:
    res = subprocess.run(
        ["curl", "-s", "-m", str(int(max(3, timeout))), url, "-H", "Accept: application/json"],
        capture_output=True,
        text=True,
        timeout=timeout + 2.0,
    )
    if res.returncode == 0 and res.stdout.strip():
        return json.loads(res.stdout)
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def send_telegram_message_sync(bot_token: str, chat_id: str, text: str) -> Dict[str, Any]:
    if not bot_token or not chat_id:
        return {"ok": False, "error": "Missing Bot Token or Chat ID"}
    try:
        url = f"https://api.telegram.org/bot{bot_token.strip()}/sendMessage"
        data = _telegram_api_post(url, {"chat_id": str(chat_id).strip(), "text": text}, timeout=5.0)
        return {"ok": bool(data.get("ok", True)), "result": data}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def auto_detect_telegram_chat_id(bot_token: str) -> Dict[str, Any]:
    """Call Telegram getUpdates to auto-detect the user's Chat ID after they send /start to their bot."""
    token = (bot_token or "").strip()
    if not token:
        return {"ok": False, "error": "Please enter your Telegram Bot Token from @BotFather first."}
    try:
        url = f"https://api.telegram.org/bot{token}/getUpdates?limit=20"
        payload = _telegram_api_get(url, timeout=5.0)
        results = payload.get("result") or []
        for upd in reversed(results):
            msg = upd.get("message") or upd.get("edited_message") or {}
            chat = msg.get("chat") or {}
            if chat.get("id"):
                chat_id = str(chat["id"])
                first_name = chat.get("first_name") or chat.get("title") or "Trader"
                username = chat.get("username") or ""
                save_telegram_settings({
                    "telegram_bot_token": token,
                    "telegram_chat_id": chat_id,
                    "telegram_enabled": True,
                })
                return {
                    "ok": True,
                    "chat_id": chat_id,
                    "first_name": first_name,
                    "username": username,
                    "message": f"Detected Chat ID {chat_id} ({first_name} @{username})",
                }
        return {
            "ok": False,
            "error": "No recent messages found. Open Telegram, send '/start' to your bot, then click Auto-Detect again.",
        }
    except Exception as exc:
        return {"ok": False, "error": f"Telegram API check failed: {exc}"}


def format_12_12_sniper_alert_message(opp: Dict[str, Any], rank_idx: int = 1) -> str:
    """Format a Prime-Hours (09:20–16:40 SAST) Top-3 12/12 A+ Sniper Buy Telegram alert (V12.2)."""
    rec_plan = opp.get("recommended_entry_plan", "PLAN_A_MARKET")
    return (
        f"🚨 TOP-{rank_idx} CROWNED 12/12 JSE A+ SNIPER BUY (PRIME WINDOW 09:20–16:40 SAST)\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🏆 {opp['ticker']} — {opp['name']} (R{opp['entry_price']:.2f})\n"
        f"🌐 Website: JSE Stock Market (http://localhost:5173) • Sector: {opp.get('sector', 'JSE')}\n"
        f"🛡️ Zero-Risk Shield: {opp.get('zero_risk_shield_prob_pct', 95.4):.1f}% | Empirical Win Rate: {opp.get('bayesian_reliability_pct', 94.0):.1f}%\n"
        f"• Recommended Plan: {rec_plan}\n"
        f"• Reason: {opp.get('entry_plan_reason', '')}\n"
        f"• Plan A (Market / Reclaim): R{opp['entry_price']:.2f} (Reclaim Trigger R{opp.get('reclaim_trigger_price', opp['entry_price']):.2f} | Net R:R {opp['net_rr_market']:.2f}x | EV {opp.get('ev_plan_a_pct', 0):+.2f}%)\n"
        f"• Plan B (Limit Dip): R{opp['limit_dip_entry_price']:.2f} (Net R:R {opp['net_rr_limit_dip']:.2f}x | 24h Fill {opp.get('limit_fill_prob_24h_pct', 50):.0f}% | {opp.get('limit_execution_mode', 'PASSIVE_RESTING_LIMIT')} TTL {opp.get('limit_order_ttl_hours', 8)}h)\n"
        f"• Plan C (60/40 Elastic Split): R{opp['blended_entry_price']:.2f} (40% MAE Reserve @ R{opp.get('mae_reserve_price', opp['limit_dip_entry_price']):.2f} | {'Viable' if opp.get('plan_c_viable', True) else 'Disqualified < R1,250/leg'})\n"
        f"• Protected Stop (Stop-Hunt Guard): R{opp.get('stop_hunt_protected_sl', opp['stop_loss']):.2f}\n"
        f"• TP0 (20% Zero-Risk Shield): R{opp.get('tp0_price', opp['target_price']):.2f} -> Lock SL @ R{opp.get('breakeven_lock_price', opp['entry_price']):.2f}\n"
        f"• TP1 (30% De-Risk): R{opp.get('tp1_price', opp['target_price']):.2f}\n"
        f"• TP2 (30% Core Target): R{opp.get('tp2_price', opp['target_price']):.2f} (+{opp['target_net_pct']:.2f}% NET)\n"
        f"• TP3 (20% Conformal Runner): R{opp.get('tp3_price', opp['target_price']):.2f}\n"
        f"• CVaR_97.5%-Safe Kelly: {opp.get('kelly_pct', 5.0):.2f}% (R{opp.get('r10k_allocation_zar', 1500):,.2f}) | Copula λ_L={opp.get('copula_lower_tail_lambda', 0.14):.2f}"
    )


def format_stale_limit_cancel_alert(ticker: str, limit_price_zar: float, bocpd_prob_pct: float) -> str:
    """Format a '⚠️ CANCEL STALE LIMIT ORDER' alert when a previously alerted Plan B setup suffers a BOCPD regime break (> 60%)."""
    return (
        f"⚠️ CANCEL STALE LIMIT ORDER — {ticker}\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🚨 Adams & MacKay BOCPD Regime Break Detected: {bocpd_prob_pct:.1f}% (> 60.0% Hazard Threshold)\n"
        f"• Action Required: Immediately CANCEL resting Plan B / Plan C Limit Order on {ticker} at R{limit_price_zar:.2f} to prevent adverse selection into an institutional distribution wave."
    )


def dispatch_prime_hours_12_12_telegram_alerts(
    dashboard_state: Dict[str, Any],
    session_override: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    V12.2 Section 3.4:
    Prime-Hours `12/12`-Only Telegram Dispatcher:
    - Auto-alerts ONLY fire during `09:20–16:40 SAST` (Mon–Fri, non-SA holiday, `is_prime_execution_window == True`)
      for Top-3 `12/12` `A+_SNIPER_BUY` winners (`tournament_rank in (1, 2, 3)`), with per-day deduplication in `signal_alerts_log`.
    - Also checks previously alerted Plan B setups and dispatches a "⚠️ CANCEL STALE LIMIT ORDER" alert if
      `bocpd_changepoint_prob_pct > 60.0`.
    """
    settings = get_telegram_settings()
    token = settings.get("telegram_bot_token", "").strip()
    chat_id = settings.get("telegram_chat_id", "").strip()
    if not settings.get("telegram_enabled") or not token or not chat_id:
        return {"ok": False, "reason": "TELEGRAM_DISABLED_OR_UNCONFIGURED", "sent_alerts": [], "cancelled_alerts": []}

    sess = session_override or get_jse_session_status()
    today_str = str(sess.get("sast_date_str") or datetime.now(SAST_ZONE).strftime("%Y-%m-%d"))
    is_prime_window = bool(sess.get("is_prime_execution_window", False))

    opps: List[Dict[str, Any]] = dashboard_state.get("opportunities", [])
    opps_by_sym = {o["ticker"]: o for o in opps}

    sent_tickers: List[str] = []
    cancelled_tickers: List[str] = []

    # 1. Check for Stale Plan B Limit-Order Regime Breaks (bocpd_changepoint_prob_pct > 60.0)
    pending_plan_b = get_active_plan_b_alerts_for_cancel_check(today_str)
    for row in pending_plan_b:
        sym = str(row.get("ticker", ""))
        opp = opps_by_sym.get(sym)
        if not opp:
            continue
        bocpd_now = float(opp.get("bocpd_changepoint_prob_pct", 0.0))
        if bocpd_now > 60.0:
            cancel_msg = format_stale_limit_cancel_alert(
                ticker=sym,
                limit_price_zar=float(row.get("limit_dip_price_zar") or opp.get("limit_dip_entry_price", 0.0)),
                bocpd_prob_pct=bocpd_now,
            )
            send_telegram_message_sync(token, chat_id, cancel_msg)
            mark_signal_alert_cancelled(int(row["id"]))
            cancelled_tickers.append(sym)

    # 2. Only fire new 12/12 A+_SNIPER_BUY alerts during 09:20–16:40 SAST Prime Execution Window
    if not is_prime_window:
        return {
            "ok": True,
            "is_prime_execution_window": False,
            "session_phase": sess.get("session_phase"),
            "sent_alerts": sent_tickers,
            "cancelled_alerts": cancelled_tickers,
        }

    top3_winners = [
        o for o in opps
        if int(o.get("aplus_gates_passed", 0)) == 12
        and o.get("verdict") == "A+_SNIPER_BUY"
        and (bool(o.get("is_tournament_winner", False)) or o.get("tournament_rank") in (1, 2, 3))
    ][:3]

    for idx, winner in enumerate(top3_winners, 1):
        sym = winner["ticker"]
        if not has_signal_alert_been_sent_today(today_str, sym, "A+_SNIPER_BUY_12_12"):
            msg = format_12_12_sniper_alert_message(winner, rank_idx=int(winner.get("tournament_rank") or idx))
            res = send_telegram_message_sync(token, chat_id, msg)
            if res.get("ok"):
                record_signal_alert_sent(
                    alert_date=today_str,
                    ticker=sym,
                    alert_type="A+_SNIPER_BUY_12_12",
                    recommended_entry_plan=str(winner.get("recommended_entry_plan", "PLAN_A_MARKET")),
                    entry_price_zar=float(winner.get("entry_price", 0.0)),
                    limit_dip_price_zar=float(winner.get("limit_dip_entry_price", 0.0)),
                    bocpd_at_alert=float(winner.get("bocpd_changepoint_prob_pct", 14.0)),
                )
                sent_tickers.append(sym)

    return {
        "ok": True,
        "is_prime_execution_window": True,
        "session_phase": sess.get("session_phase"),
        "sent_alerts": sent_tickers,
        "cancelled_alerts": cancelled_tickers,
    }


def format_morning_pre_open_briefing(dashboard_state: Dict[str, Any]) -> str:
    """
    Format the 08:45 SAST (Mon-Fri) JSE Morning Pre-Open Briefing:
    Top 2 JSE 12/12 A+ Sniper setups + 11/12 Watchtower Radar + Tencent 0700.HK ZAR Parity + USD/ZAR OU regime.
    """
    macro = dashboard_state.get("macro", {})
    usdzar_rate = dashboard_state.get("usdzar_rate", macro.get("usdzar", 18.14))
    usdzar_z = dashboard_state.get("usdzar_zscore", macro.get("usdzarZscore20d", -0.45))
    usdzar_hl = dashboard_state.get("usdzar_ou_halflife", 6.4)
    usdzar_badge = dashboard_state.get(
        "usdzar_regime_badge",
        "🟢 USD/ZAR STABLE TAILWIND: Optimal JSE Rand-Hedge & Offshore Window",
    )
    opps = dashboard_state.get("opportunities", [])
    top2 = [o for o in opps if o.get("verdict") == "A+_SNIPER_BUY"][:2] or opps[:2]
    watchtower_11 = [o for o in opps if int(o.get("aplus_gates_passed", 0)) == 11][:2]

    npn = next((o for o in opps if o["ticker"] == "NPN.JO"), None)
    tencent_hkd = macro.get("tencentHkdPrice", 496.8)
    tencent_lead = npn.get("tencentLeadGapPct", 2.4) if npn else 2.4
    npn_parity = npn.get("offshoreParityZar", 4260.0) if npn else 4260.0

    lines = [
        "🌅 JSE 08:45 SAST PRE-OPEN SOVEREIGN BRIEFING (V12.0 OMEGA)",
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"💱 USD/ZAR: R{usdzar_rate:.2f} (20d Z={usdzar_z:+.2f}, OU Half-Life {usdzar_hl:.1f}d)",
        f"{usdzar_badge}",
        f"{macro.get('seasonality_tailwind_label', '')}",
        "",
        f"🐉 Tencent (0700.HK) SOTP Lead: HK${tencent_hkd:.1f} | NPN.JO Parity R{npn_parity:.2f} (Lead +{tencent_lead}%)",
        "",
        "🏆 TOP 2 CROWNED 12/12 JSE A+ SNIPER SETUPS TODAY:",
    ]
    for idx, o in enumerate(top2, 1):
        lines.append(
            f"{idx}. {o['ticker']} ({o['name']}) — {o['aplus_gates_passed']}/12 Gates | {o.get('recommended_entry_plan', 'PLAN_A_MARKET')}\n"
            f"   • Plan A Market: R{o['entry_price']:.2f} (Net R:R {o['net_rr_market']:.2f}x | EV {o.get('ev_plan_a_pct', 0):+.2f}%)\n"
            f"   • Plan B Dip: R{o['limit_dip_entry_price']:.2f} (Net R:R {o['net_rr_limit_dip']:.2f}x, 24h Fill {o['limit_fill_prob_pct']:.0f}%)\n"
            f"   • Stop: R{o['stop_loss']:.2f} | TP1: R{o.get('tp1_price', o['target_price']):.2f} | TP2: R{o['target_price']:.2f} | TP3: R{o.get('tp3_price', o['target_price']):.2f}"
        )
    if watchtower_11:
        lines.append("\n🔭 11/12 WATCHTOWER SINGLE-BOTTLENECK RADAR:")
        for w in watchtower_11:
            lines.append(f"• {w['ticker']}: {w.get('watchtower_upgrade_trigger', '')}")
    lines.append("\n📲 Reply /barbell, /top, /ticket NPN.JO, or /portfolio anytime.")
    return "\n".join(lines)


def handle_telegram_command(
    text: str,
    get_dashboard_fn: Callable[[], Dict[str, Any]],
    open_trade_fn: Callable[[Dict[str, Any]], Dict[str, Any]],
    close_trade_fn: Callable[[Any, Optional[float], str], Dict[str, Any]],
) -> str:
    """
    Execute 2-Way Interactive Telegram Bot Commands:
    /start, /top, /barbell, /ticket <SYMBOL>, /check <SYMBOL>, /portfolio,
    /buy <SYMBOL> <PRICE> <SHARES_OR_ZAR> [REAL|PAPER], /close <ID_OR_SYMBOL> [EXIT_PRICE]
    """
    parts = text.strip().split()
    if not parts:
        return "Send /start for JSE V12.0 Sovereign Omega commands."

    cmd = parts[0].lower().split("@")[0]
    state = get_dashboard_fn()
    opps: List[Dict[str, Any]] = state.get("opportunities", [])

    if cmd in ("/start", "/help"):
        return (
            "🇿🇦 JSE-QUANT-COACH-247 V12.0 SOVEREIGN OMEGA BOT\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "Interactive Commands:\n"
            "• /top — Top 2 12/12 A+ Sniper Winners & 11/12 Watchtower\n"
            "• /barbell — #1 R10,000 HRP Barbell Plan (Copula λ_L < 0.45)\n"
            "• /ticket <SYMBOL> — EasyEquities Plan A/B/C & TP1/TP2/TP3 Ticket\n"
            "• /check <SYMBOL> — Strict 12-Gate A+ Sniper Checklist\n"
            "• /portfolio — Active 7-Stage Coach, Free-Cash Ledger & P&L\n"
            "• /buy <SYMBOL> <PRICE> <SHARES_OR_ZAR> [REAL|PAPER]\n"
            "• /close <ID_OR_SYMBOL> [EXIT_PRICE]"
        )

    if cmd == "/top":
        lines = ["🎯 TOP JSE V12.0 SNIPER SETUPS (NORMALIZED R ZAR)", "━━━━━━━━━━━━━━━━━━━━━━"]
        for i, o in enumerate(opps[:4], 1):
            wt = f"\n   {o['watchtower_upgrade_trigger']}" if o.get("watchtower_upgrade_trigger") else ""
            lines.append(
                f"{i}. {o['ticker']} ({o['name']}) — {o['aplus_gates_passed']}/12 Gates ({o.get('verdict')})\n"
                f"   • Recommended Plan: {o.get('recommended_entry_plan')} ({o.get('limit_execution_mode')})\n"
                f"   • Plan A Market: R{o['entry_price']:.2f} ({o['net_rr_market']:.2f}x R:R | EV {o.get('ev_plan_a_pct', 0):+.2f}%)\n"
                f"   • Plan B Dip: R{o['limit_dip_entry_price']:.2f} ({o['net_rr_limit_dip']:.2f}x R:R | Fill {o['limit_fill_prob_pct']:.0f}% | EV {o.get('ev_plan_b_pct', 0):+.2f}%)\n"
                f"   • Stop: R{o['stop_loss']:.2f} | TP1: R{o.get('tp1_price', o['target_price']):.2f} | TP2: R{o['target_price']:.2f} | TP3: R{o.get('tp3_price', o['target_price']):.2f}{wt}"
            )
        return "\n\n".join(lines)

    if cmd == "/barbell":
        bp = state.get("barbell_plan", {})
        s1 = bp.get("slot_1_anchor", {})
        s2 = bp.get("slot_2_catalyst", {})
        s3 = bp.get("slot_3_reserve", {})
        return (
            f"🏆 TODAY'S #1 JSE V12.0 HRP BARBELL PLAN (R{bp.get('account_balance_zar', 10000):,.0f})\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🛡️ {s1.get('role')}:\n"
            f"• {s1.get('ticker')} ({s1.get('name')}) — Invest R{s1.get('allocation_zar', 4500):,.2f} ({s1.get('shares', 0):.4f} sh) [{s1.get('recommended_entry_plan', 'PLAN_A_MARKET')}]\n"
            f"• Entry: R{s1.get('entry_price', 0):.2f} | Dip: R{s1.get('limit_dip_entry_price', 0):.2f} | Stop: R{s1.get('stop_loss', 0):.2f}\n"
            f"• TP1: R{s1.get('tp1_price', s1.get('target_price', 0)):.2f} | TP2: R{s1.get('target_price', 0):.2f} | TP3: R{s1.get('tp3_price', s1.get('target_price', 0)):.2f}\n\n"
            f"🚀 {s2.get('role')}:\n"
            f"• {s2.get('ticker')} ({s2.get('name')}) — Invest R{s2.get('allocation_zar', 3500):,.2f} ({s2.get('shares', 0):.4f} sh) [{s2.get('recommended_entry_plan', 'PLAN_C_50_50_SPLIT')}]\n"
            f"• Entry: R{s2.get('entry_price', 0):.2f} | Dip: R{s2.get('limit_dip_entry_price', 0):.2f} | Stop: R{s2.get('stop_loss', 0):.2f}\n"
            f"• TP1: R{s2.get('tp1_price', s2.get('target_price', 0)):.2f} | TP2: R{s2.get('target_price', 0):.2f} | TP3: R{s2.get('tp3_price', s2.get('target_price', 0)):.2f}\n\n"
            f"💰 {s3.get('role')}: R{s3.get('allocation_zar', 2000):,.2f} Cash Reserve\n"
            f"📊 Pair ρ = {bp.get('pair_correlation_rho', 0.18):.2f} | Copula Lower-Tail λ_L = {bp.get('copula_lower_tail_lambda', 0.16):.2f} (< 0.45) | Total Expected Net Win: +R{bp.get('total_expected_net_win_zar', 0):.2f}"
        )

    if cmd in ("/ticket", "/check"):
        if len(parts) < 2:
            return f"Usage: {cmd} <SYMBOL> (e.g. {cmd} NPN.JO)"
        sym = parts[1].strip().upper()
        if not sym.endswith(".JO"):
            sym = f"{sym}.JO"
        opp = next((o for o in opps if o["ticker"] == sym), None)
        if not opp:
            return f"Ticker {sym} not found in active JSE scanner. Use /top to view available tickers."

        if cmd == "/ticket":
            entry = float(opp["entry_price"])
            stop = float(opp["stop_loss"])
            target = float(opp["target_price"])
            tp1 = float(opp.get("tp1_price", target))
            tp2 = float(opp.get("tp2_price", target))
            tp3 = float(opp.get("tp3_price", target))
            fric = float(opp["round_trip_friction_pct"])
            be = entry * (1.0 + fric / 100.0)
            sl_pct = ((entry - stop) / entry) * 100.0
            tp_pct = ((target - entry) / entry) * 100.0
            alloc_zar = float(opp.get("r10k_allocation_zar", round(10000.0 * (float(opp["kelly_pct"]) / 100.0), 2)))
            shares = round(alloc_zar / entry, 4)
            return (
                f"📋 EASYEQUITIES V12.0 ORDER TICKET — {opp['ticker']} ({opp['name']})\n"
                "━━━━━━━━━━━━━━━━━━━━━━\n"
                f"Verdict: {opp['traffic_light_verdict']}\n"
                f"• Recommended Entry Plan: {opp.get('recommended_entry_plan')} ({opp.get('entry_plan_reason')})\n"
                f"• Cash to Invest (CVaR-Safe Kelly {opp['kelly_pct']:.2f}%): R{alloc_zar:,.2f} ({shares:.4f} shares)\n"
                f"• Plan A (Market Now): R{entry:.2f} (Net R:R {opp['net_rr_market']:.2f}x | EV {opp.get('ev_plan_a_pct', 0):+.2f}%)\n"
                f"• Plan B (Limit Dip): R{opp['limit_dip_entry_price']:.2f} (Net R:R {opp['net_rr_limit_dip']:.2f}x | 24h Fill {opp['limit_fill_prob_pct']:.0f}% | {opp.get('limit_execution_mode')})\n"
                f"• Plan C (50/50 Scale-In): R{opp['blended_entry_price']:.2f} (Net R:R {opp['blended_net_rr']:.2f}x | Viable: {opp.get('plan_c_viable')})\n"
                f"• Protected Stop: R{stop:.2f} (EasyEquities SL Slider: -{sl_pct:.2f}% | Breakeven R{be:.2f})\n"
                f"• TP1 (Bank 33% De-Risk): R{tp1:.2f}\n"
                f"• TP2 (Bank 33% Structural): R{tp2:.2f} (+{opp['target_net_pct']:.2f}% NET | TP Slider +{tp_pct:.2f}%)\n"
                f"• TP3 (Final 34% Tail Runner): R{tp3:.2f}"
            )
        else:
            gate_lines = [
                f"{'✅' if g['passed'] else '❌'} G{g['gate_num']} {g['name']}: {g['actual_value']}"
                for g in opp.get("aplus_checklist_items", [])
            ]
            wt_line = f"\n\n{opp['watchtower_upgrade_trigger']}" if opp.get("watchtower_upgrade_trigger") else ""
            return (
                f"🔬 STRICT 12-GATE A+ SNIPER CHECKLIST — {opp['ticker']} ({opp['aplus_gates_passed']}/12 Passed)\n"
                f"{opp['traffic_light_verdict']}\n"
                "━━━━━━━━━━━━━━━━━━━━━━\n"
                + "\n".join(gate_lines)
                + wt_line
            )

    if cmd == "/portfolio":
        active = state.get("activeTrades", [])
        pa = state.get("portfolioAnalytics", {})
        ledger = state.get("capital_ledger", {})
        lines = [
            f"💼 ACTIVE JSE PORTFOLIO ({len(active)} Open) | V12.0 Free-Cash Ledger",
            f"Compounded Equity: R{pa.get('current_compounded_balance_zar', 10000):,.2f} | Free Cash: R{ledger.get('free_cash_available_zar', 2500):,.2f} | Locked: R{ledger.get('locked_in_open_positions_zar', 7500):,.2f}",
            f"Realized Net P&L: R{pa.get('totalNetRealizedPnlZar', 0):+,.2f} | {pa.get('anti_tilt_badge', '')}",
            "━━━━━━━━━━━━━━━━━━━━━━",
        ]
        if not active:
            lines.append("No active open positions.")
        for t in active:
            lines.append(
                f"#{t['id']} {t['ticker']} ({t['tradeMode']}): {t['shares']:.4f} sh @ R{t['entryPriceZar']:.2f} -> Now R{t['currentPriceZar']:.2f}\n"
                f"   Net P&L: R{t['netPnlZar']:+.2f} ({t['netPnlPct']:+.2f}% NET) | {t['coachStageLabel']}\n"
                f"   Stop: R{t['stopLossZar']:.2f} | Chandelier ({t.get('chandelier_multiplier_atr', 1.25):.2f}x ATR): R{t['chandelierTrailingStopZar']:.2f}\n"
                f"   TP1: R{t.get('tp1_price_zar', t['targetPriceZar']):.2f} | TP2: R{t['targetPriceZar']:.2f} | TP3: R{t.get('tp3_price_zar', t['targetPriceZar']):.2f}"
            )
            if t.get("stage_4_5_whale_banner"):
                lines.append(f"   {t['stage_4_5_whale_banner']}")
            if t.get("stage_7_plus_runner_banner"):
                lines.append(f"   {t['stage_7_plus_runner_banner']}")
            if t.get("dead_money_swap_alert"):
                lines.append(f"   {t['dead_money_swap_alert']}")
        return "\n".join(lines)

    if cmd == "/buy":
        if len(parts) < 4:
            return "Usage: /buy <SYMBOL> <PRICE> <SHARES_OR_ZAR> [REAL|PAPER]\nExample: /buy NPN.JO 4185 2000 REAL"
        sym = parts[1].strip().upper()
        if not sym.endswith(".JO"):
            sym = f"{sym}.JO"
        try:
            price = float(parts[2])
            qty_or_zar = float(parts[3])
        except ValueError:
            return "Invalid price or shares/ZAR amount."
        mode_arg = parts[4].upper() if len(parts) >= 5 else "REAL"
        trade_mode = "PAPER_WALLET_TRADE" if "PAPER" in mode_arg else "REAL_BROKER_TRADE"

        shares = round(qty_or_zar / price, 4) if qty_or_zar >= 500.0 else round(qty_or_zar, 4)
        opp = next((o for o in opps if o["ticker"] == sym), None)
        stop = float(opp["stop_loss"]) if opp else round(price * 0.955, 2)
        target = float(opp["target_price"]) if opp else round(price * 1.09, 2)

        open_trade_fn({
            "ticker": sym,
            "entry_price_zar": price,
            "shares": shares,
            "stop_loss_zar": stop,
            "target_price_zar": target,
            "trade_mode": trade_mode,
            "notes": "Opened via 2-Way Telegram Bot /buy command",
        })
        return (
            f"✅ {trade_mode} OPENED VIA TELEGRAM:\n"
            f"• {sym}: {shares:.4f} shares @ R{price:.2f} (Invested R{shares * price:,.2f})\n"
            f"• Protected Stop: R{stop:.2f} | Target: R{target:.2f}"
        )

    if cmd == "/close":
        if len(parts) < 2:
            return "Usage: /close <ID_OR_SYMBOL> [EXIT_PRICE]\nExample: /close NPN.JO 4310"
        id_or_sym = parts[1].strip()
        exit_p = float(parts[2]) if len(parts) >= 3 else None
        res = close_trade_fn(id_or_sym, exit_p, "TELEGRAM_BOT_CLOSE")
        if not res.get("ok"):
            return f"❌ Could not close trade '{id_or_sym}': {res.get('error', 'Not found')}"
        return (
            f"✅ POSITION CLOSED ({res.get('ticker')} #{res.get('id')}):\n"
            f"• Exit Price: R{res.get('exit_price', 0):.2f}\n"
            f"• Realized Net P&L: R{res.get('realized_net_pnl_zar', 0):+.2f} ({res.get('realized_net_pnl_pct', 0):+.2f}% NET after JSE friction)"
        )

    return f"Unrecognized command '{cmd}'. Send /start to view all JSE V12.0 commands."


_SENT_JSE_STAGE_CACHE: Dict[str, str] = {}


def dispatch_active_trades_coach_alerts(dashboard_state: Dict[str, Any]) -> None:
    """Dispatches Telegram alerts whenever an open trade hits TP stages, trailing stop adjustments, or harvest directives."""
    settings = get_telegram_settings()
    token = settings.get("telegram_bot_token", "").strip()
    chat_id = settings.get("telegram_chat_id", "").strip()
    if not settings.get("telegram_enabled") or not token or not chat_id:
        return
    if not settings.get("alert_on_coach_stages", True):
        return

    active_trades = dashboard_state.get("activeTrades") or dashboard_state.get("active_trades") or []
    for t in active_trades:
        tid_key = str(t.get("id"))
        stage_sig = f"{t.get('coachStageLabel') or t.get('stage_label')}:{t.get('coachUrgency') or t.get('urgency') or ''}:{t.get('tp0_hit', 0)}:{t.get('tp1_hit', 0)}:{t.get('tp2_hit', 0)}"
        prev_sig = _SENT_JSE_STAGE_CACHE.get(tid_key)
        if prev_sig is not None and prev_sig != stage_sig:
            sym = t.get("ticker") or t.get("symbol")
            pnl_zar = float(t.get("unrealizedPnlZar") or t.get("realized_partial_pnl_zar") or 0.0)
            pnl_pct = float(t.get("unrealizedPnlPct") or t.get("net_pnl_pct") or 0.0)
            rec_stop = float(t.get("chandelierTrailingStopZar") or t.get("recommended_stop") or t.get("stopLossZar") or 0.0)
            badge = t.get("coachActionBadge") or t.get("action_directive") or t.get("coachInstruction") or "HOLD"
            stage_lbl = t.get("coachStageLabel") or t.get("stage_label") or "Stage Update"
            
            msg = (
                f"🔔 <b>JSE TRADE COACH SELL / HARVEST DIRECTIVE — {sym}</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━\n"
                f"• Directive: <b>{badge}</b>\n"
                f"• Stage: <b>{stage_lbl}</b>\n"
                f"• Net P&L: <b>{pnl_pct:+.2f}% (R{pnl_zar:+,.2f})</b>\n"
                f"• Ratchet Trailing Stop: <b>R{rec_stop:.2f}</b>\n"
                f"• Progress to Target: <b>{float(t.get('progressToTargetPct') or t.get('progress_toward_target_pct') or 0.0):.1f}%</b>"
            )
            send_telegram_message_sync(token, chat_id, msg)
        _SENT_JSE_STAGE_CACHE[tid_key] = stage_sig


async def telegram_background_worker(
    get_dashboard_fn: Callable[[], Dict[str, Any]],
    open_trade_fn: Callable[[Dict[str, Any]], Dict[str, Any]],
    close_trade_fn: Callable[[Any, Optional[float], str], Dict[str, Any]],
) -> None:
    """
    Background asyncio loop for:
    1. Scheduled 08:45 SAST (Mon-Fri) JSE Morning Pre-Open Briefing
    2. Prime-Hours (09:20–16:40 SAST, Mon-Fri, non-SA holiday) Top-2 `12/12` `A+_SNIPER_BUY` Auto-Alert Dispatcher
       with per-day deduplication in `signal_alerts_log` + Stale Plan B Limit-Order Cancellation when BOCPD > 60%
    3. 2-Way Telegram Bot command polling
    """
    while True:
        try:
            settings = get_telegram_settings()
            token = settings.get("telegram_bot_token", "").strip()
            chat_id = settings.get("telegram_chat_id", "").strip()

            if token:
                # 1. Poll incoming 2-way commands
                last_id = int(settings.get("last_update_id", 0))
                url = f"https://api.telegram.org/bot{token}/getUpdates?offset={last_id + 1}&timeout=1"
                try:
                    data = _telegram_api_get(url, timeout=4.0)
                    updates = data.get("result") or []
                    max_uid = last_id
                    for upd in updates:
                        uid = int(upd.get("update_id", 0))
                        if uid > max_uid:
                            max_uid = uid
                        msg = upd.get("message") or {}
                        txt = str(msg.get("text") or "").strip()
                        from_chat_id = str((msg.get("chat") or {}).get("id") or chat_id)
                        if txt.startswith("/") and from_chat_id:
                            reply = handle_telegram_command(txt, get_dashboard_fn, open_trade_fn, close_trade_fn)
                            send_telegram_message_sync(token, from_chat_id, reply)
                    if max_uid > last_id:
                        conn = get_connection()
                        conn.execute("UPDATE alert_settings SET last_update_id = ? WHERE id = 1", (max_uid,))
                        conn.commit()
                        conn.close()
                except Exception:
                    pass

                # 2. Scheduled 08:45 SAST (Mon-Fri, non-SA holiday) JSE Morning Pre-Open Briefing
                sess = get_jse_session_status()
                now_sast = datetime.now(SAST_ZONE)
                today_str = sess["sast_date_str"]
                if (
                    settings.get("telegram_enabled")
                    and chat_id
                    and settings.get("morning_briefing_enabled", True)
                    and now_sast.weekday() < 5
                    and not sess["is_sa_public_holiday"]
                    and now_sast.hour == 8
                    and 45 <= now_sast.minute <= 49
                    and settings.get("last_briefing_date") != today_str
                ):
                    dash = get_dashboard_fn()
                    briefing_txt = format_morning_pre_open_briefing(dash)
                    send_telegram_message_sync(token, chat_id, briefing_txt)
                    conn = get_connection()
                    conn.execute("UPDATE alert_settings SET last_briefing_date = ? WHERE id = 1", (today_str,))
                    conn.commit()
                    conn.close()

                # 3. Prime-Hours (09:20–16:40 SAST) Top-2 12/12 A+_SNIPER_BUY Auto-Alerts & BOCPD > 60% Cancel Dispatcher
                if settings.get("telegram_enabled") and chat_id and settings.get("alert_on_prime_alpha", True):
                    dash = get_dashboard_fn()
                    dispatch_prime_hours_12_12_telegram_alerts(dash, session_override=sess)

                # 4. Active Portfolio Coach Sell / Stage / Chandelier Stop Directives
                if settings.get("telegram_enabled") and chat_id:
                    dash = get_dashboard_fn()
                    dispatch_active_trades_coach_alerts(dash)
        except Exception:
            pass
        await asyncio.sleep(8.0)
