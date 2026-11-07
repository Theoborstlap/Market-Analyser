"""
2-Way Interactive Telegram Sniper Bot + 15:15 SAST Wall Street Pre-Open Briefing — V10.1
Features:
  1. Auto-Detect Chat ID (`getUpdates`) & 1-Click Test Alert
  2. Automatic Push Alerts on:
     - >= 10/12 A+ US Sniper Setups
     - Stage 1-7 / Stage 4.5 Whale Harvest / Stage 7+ Chandelier Runner Transitions
     - Scheduled 15:15 SAST (Mon-Fri) US Wall Street Pre-Open Briefing:
       Top 2 US A+ setups + ES=F/NQ=F Futures + ForexFactory Red-Folder check + exact 15:45 SAST execution plan
  3. 2-Way Interactive Commands:
     - /start
     - /top
     - /barbell
     - /ticket <SYMBOL>
     - /check <SYMBOL>
     - /portfolio
     - /buy <SYMBOL> <PRICE> <SHARES_OR_USD> [REAL|PAPER]
     - /close <ID_OR_SYMBOL> [EXIT_PRICE]
"""
import asyncio
import json
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Callable

try:
    import httpx
except ImportError:
    httpx = None

from config import US_UNIVERSE_MAP, DEFAULT_FEE_PROFILE, DEFAULT_ROUND_TRIP_FEE_PCT
from database import (
    fetch_alert_settings,
    save_alert_settings,
    update_telegram_cursor,
    fetch_open_trades,
    insert_trade,
    close_trade_by_id,
    has_signal_alert_been_sent_today,
    record_signal_alert_sent,
)
from v12_omega import get_us_session_status

_SENT_APLUS_CACHE: Dict[str, float] = {}
_SENT_STAGE_CACHE: Dict[str, str] = {}


def _sync_http_post_json(url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    body_str = json.dumps(payload)
    res = subprocess.run(
        ["curl", "-s", "-m", "8", "-X", "POST", url, "-H", "Content-Type: application/json", "-d", body_str],
        capture_output=True,
        text=True,
        timeout=10.0,
    )
    if res.returncode == 0 and res.stdout.strip():
        return json.loads(res.stdout)
    req = urllib.request.Request(
        url,
        data=body_str.encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=8.0) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _sync_http_get_json(url: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    full_url = url
    if params:
        full_url = f"{url}?{urllib.parse.urlencode(params)}"
    res = subprocess.run(
        ["curl", "-s", "-m", "8", full_url, "-H", "Accept: application/json"],
        capture_output=True,
        text=True,
        timeout=10.0,
    )
    if res.returncode == 0 and res.stdout.strip():
        return json.loads(res.stdout)
    req = urllib.request.Request(full_url, method="GET")
    with urllib.request.urlopen(req, timeout=8.0) as resp:
        return json.loads(resp.read().decode("utf-8"))


async def send_telegram_message(bot_token: str, chat_id: str, text: str) -> Dict[str, Any]:
    token = (bot_token or "").strip()
    cid = (chat_id or "").strip()
    if not token or not cid:
        return {"ok": False, "error": "Missing Telegram Bot Token or Chat ID."}
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": cid, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    try:
        data = await asyncio.to_thread(_sync_http_post_json, url, payload)
        if data.get("ok"):
            return {"ok": True, "result": data.get("result")}
        return {"ok": False, "error": data.get("description", "Telegram API error")}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def auto_detect_telegram_chat_id(bot_token: str) -> Dict[str, Any]:
    token = (bot_token or "").strip()
    if not token:
        return {"ok": False, "error": "Please enter your Telegram Bot Token from @BotFather first."}
    url = f"https://api.telegram.org/bot{token}/getUpdates"
    try:
        data = await asyncio.to_thread(_sync_http_get_json, url, None)
        if not data.get("ok"):
            return {"ok": False, "error": data.get("description", "Failed to query Telegram getUpdates.")}
        results = data.get("result") or []
        for upd in reversed(results):
            msg = upd.get("message") or upd.get("edited_message") or upd.get("channel_post") or {}
            chat = msg.get("chat") or {}
            cid = chat.get("id")
            if cid is not None:
                username = chat.get("username") or chat.get("first_name") or "Trader"
                settings = fetch_alert_settings()
                save_alert_settings(
                    telegram_bot_token=token,
                    telegram_chat_id=str(cid),
                    discord_webhook_url=settings.get("discord_webhook_url", ""),
                    enabled=True,
                )
                return {
                    "ok": True,
                    "chat_id": str(cid),
                    "username": username,
                    "message": f"Auto-detected Chat ID {cid} (@{username})!",
                }
        return {
            "ok": False,
            "error": "No recent messages found. Send '/start' to your bot in Telegram first, then click Auto-Detect.",
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def format_wall_street_1515_briefing(state: Dict[str, Any]) -> str:
    macro = state.get("macro") or {}
    fx = state.get("usdzar") or {}
    signals: List[Dict[str, Any]] = state.get("signals") or []
    top2 = signals[:2]

    lines = [
        "🗽 <b>US WALL STREET 15:15 SAST PRE-OPEN BRIEFING (V10.1)</b>",
        f"⏱ <b>NY Bell:</b> 15:30 SAST | <b>Sniper Window:</b> 15:45 SAST",
        f"📈 <b>Futures:</b> ES=F {macro.get('es_futures_change_pct', 0.35):+.2f}% | NQ=F {macro.get('nq_futures_change_pct', 0.48):+.2f}% | VIX {macro.get('vix_spot', 15.8):.2f}",
        f"🛡️ <b>ForexFactory USD Shield:</b> {macro.get('macro_shield_status', 'CLEAR')}",
        f"💱 <b>USD/ZAR OU Shield:</b> R{fx.get('usdzar_rate', 18.18):.2f} ({fx.get('usdzar_regime_badge', 'STABLE')})",
        "",
        "🏆 <b>TOP 2 US A+ SNIPER SETUPS FOR 15:45 SAST:</b>",
    ]
    for idx, sig in enumerate(top2, start=1):
        lines.append(
            f"{idx}. <b>{sig['symbol']}</b> (${sig['price']:.2f}) — <b>{sig['aplus_gates_passed']}/12 Gates</b> | Conv {sig['conviction_pct']:.1f}%\n"
            f"   • Plan A Market: ${sig['entry_price']:.2f} (Net R:R {sig['net_rr_market']:.2f}x)\n"
            f"   • Plan B Dip: ${sig['limit_dip_entry_price']:.2f} (Net R:R {sig['net_rr_limit_dip']:.2f}x | Fill {sig['limit_fill_prob_pct']:.0f}%)\n"
            f"   • Smart Stop: ${sig['stop_loss']:.2f} | Target: ${sig['target_price']:.2f}"
        )
    lines.append("")
    lines.append("💡 <i>Execution Rule: Wait until 15:45 SAST (15 mins after NY open) so opening auction spreads settle, or stage Plan C (50% Market + 50% Limit Dip).</i>")
    return "\n".join(lines)


async def handle_telegram_command(
    command_text: str,
    state_getter: Callable[[], Dict[str, Any]],
    refresh_callback: Optional[Callable[[], Any]] = None,
) -> str:
    parts = command_text.strip().split()
    if not parts:
        return "Send /start for US Sniper Bot commands."
    cmd = parts[0].lower().split("@")[0]
    state = state_getter()
    signals: List[Dict[str, Any]] = state.get("signals") or []
    sig_map = {s["symbol"].upper(): s for s in signals}
    usdzar_rate = float((state.get("usdzar") or {}).get("usdzar_rate", 18.18))

    if cmd in ("/start", "/help"):
        return (
            "🇺🇸 <b>US WALL STREET V10.1 SOVEREIGN SNIPER BOT</b>\n\n"
            "Available 2-Way Commands:\n"
            "• <code>/top</code> — Top 5 US A+ Setups (12-Gate Score & Plan A/B/C)\n"
            "• <code>/barbell</code> — Today's #1 R10,000 (~$540) US Barbell Plan\n"
            "• <code>/ticket NVDA</code> — Exact EasyEquities USD / IBKR Order Ticket\n"
            "• <code>/check CRWD</code> — Deep 12-Gate A+ & Options GEX Audit\n"
            "• <code>/portfolio</code> — Live 7-Stage Active Trade Coach & P&L\n"
            "• <code>/buy NVDA 138.60 250 REAL</code> — Log US Trade (Shares or $ USD)\n"
            "• <code>/close NVDA 145.20</code> — Close Open Trade & Record Audit P&L\n"
            "• <code>/briefing</code> — On-Demand 15:15 SAST Wall Street Pre-Open Briefing"
        )

    if cmd == "/briefing":
        return format_wall_street_1515_briefing(state)

    if cmd == "/top":
        top5 = signals[:5]
        lines = ["🔥 <b>TOP 5 US NYSE/NASDAQ A+ SETUPS (LIVE)</b>\n"]
        for i, s in enumerate(top5, start=1):
            lines.append(
                f"{i}. <b>{s['symbol']}</b> (${s['price']:.2f}) — <b>{s['aplus_gates_passed']}/12 Gates</b>\n"
                f"   {s['traffic_light_verdict']}\n"
                f"   Plan A: ${s['entry_price']:.2f} ({s['net_rr_market']:.2f}x) | Plan B Dip: ${s['limit_dip_entry_price']:.2f} ({s['net_rr_limit_dip']:.2f}x, {s['limit_fill_prob_pct']:.0f}% Fill)\n"
                f"   Stop: ${s['stop_loss']:.2f} | Target: ${s['target_price']:.2f}\n"
            )
        return "\n".join(lines)

    if cmd == "/barbell":
        bp = state.get("barbell_plan") or {}
        s1 = bp.get("slot_1_safe_anchor") or {}
        s2 = bp.get("slot_2_tech_leader") or {}
        s3 = bp.get("slot_3_dry_powder") or {}
        return (
            f"🏆 <b>TODAY'S #1 US A+ BARBELL PLAN (R{bp.get('account_balance_zar', 10000):,.0f} / ~${bp.get('account_balance_usd', 550):,.0f} USD)</b>\n"
            f"Pair Correlation: <b>ρ = {bp.get('pair_correlation_rho', 0.14):.2f}</b>\n\n"
            f"🛡️ <b>{s1.get('role', 'Slot 1 (45% Safe Anchor)')}: {s1.get('symbol')}</b>\n"
            f"• Invest: <b>${s1.get('alloc_usd', 0):.2f} (R{s1.get('alloc_zar', 0):,.0f})</b> | {s1.get('plan_label')}\n"
            f"• Stop: ${s1.get('stop_loss', 0):.2f} | Target: ${s1.get('target_price', 0):.2f} | Net Win: +${s1.get('expected_net_win_usd', 0):.2f} (+R{s1.get('expected_net_win_zar', 0):,.0f})\n\n"
            f"🚀 <b>{s2.get('role', 'Slot 2 (35% Tech Leader)')}: {s2.get('symbol')}</b>\n"
            f"• Invest: <b>${s2.get('alloc_usd', 0):.2f} (R{s2.get('alloc_zar', 0):,.0f})</b> | {s2.get('plan_label')}\n"
            f"• Stop: ${s2.get('stop_loss', 0):.2f} | Target: ${s2.get('target_price', 0):.2f} | Net Win: +${s2.get('expected_net_win_usd', 0):.2f} (+R{s2.get('expected_net_win_zar', 0):,.0f})\n\n"
            f"💧 <b>{s3.get('role', 'Slot 3 (20% Dry Powder)')}:</b> ${s3.get('alloc_usd', 0):.2f} (R{s3.get('alloc_zar', 0):,.0f})"
        )

    if cmd in ("/ticket", "/check"):
        if len(parts) < 2:
            return f"Usage: <code>{cmd} NVDA</code>"
        sym = parts[1].upper().strip()
        sig = sig_map.get(sym)
        if not sig:
            return f"Symbol <b>{sym}</b> not found in active US scanner. Add it via '+ Add Stock' or try NVDA, CRWD, META, GLD, SPY."
        mb = sig.get("money_box") or {}
        opt = sig.get("options_intel") or {}
        if cmd == "/ticket":
            stop_pct = abs((sig["entry_price"] - sig["stop_loss"]) / max(sig["entry_price"], 1e-8)) * 100.0
            tp_pct = abs((sig["target_price"] - sig["entry_price"]) / max(sig["entry_price"], 1e-8)) * 100.0
            return (
                f"📋 <b>US BROKER ORDER TICKET — {sig['symbol']} ({sig['name']})</b>\n"
                f"{sig['traffic_light_verdict']}\n\n"
                f"• <b>Plan A (100% Market Now):</b> ${sig['entry_price']:.2f} | Net R:R {sig['net_rr_market']:.2f}x\n"
                f"• <b>Plan B (Sniper Limit Dip):</b> ${sig['limit_dip_entry_price']:.2f} | Net R:R {sig['net_rr_limit_dip']:.2f}x (24h Fill: {sig['limit_fill_prob_pct']:.0f}%)\n"
                f"• <b>Plan C (50/50 Scale-In):</b> ${sig['blended_entry_price']:.2f} | Net R:R {sig['blended_net_rr']:.2f}x\n\n"
                f"🛡️ <b>Protected Stop:</b> ${sig['stop_loss']:.2f} (-{stop_pct:.2f}% EE Slider)\n"
                f"🎯 <b>Capped Target:</b> ${sig['target_price']:.2f} (+{tp_pct:.2f}% EE Slider)\n"
                f"💵 <b>R10k Scaled Size:</b> ${mb.get('invest_usd', 95):.2f} (R{mb.get('invest_zar', 1750):,.0f})\n"
                f"• Max Risk: -${mb.get('max_loss_usd', 5):.2f} (-R{mb.get('max_loss_zar', 90):,.0f})\n"
                f"• Expected Net Win: +${mb.get('net_win_usd', 12):.2f} (+R{mb.get('net_win_zar', 220):,.0f} after 0.62% fee)"
            )
        else:
            passed_list = [f"{'✅' if g['passed'] else '❌'} G{g['gate']} {g['name']}: {g['value']}" for g in sig.get("aplus_checklist_items", [])]
            return (
                f"🔬 <b>12-GATE A+ INSTITUTIONAL AUDIT — {sig['symbol']} (${sig['price']:.2f})</b>\n"
                f"Score: <b>{sig['aplus_gates_passed']}/12 Gates</b> | Conviction: <b>{sig['conviction_pct']:.1f}%</b>\n"
                f"Options GEX: {opt.get('gex_regime')} | Call Wall ${opt.get('call_wall')} | Put Wall ${opt.get('put_wall')}\n\n"
                + "\n".join(passed_list)
            )

    if cmd == "/portfolio":
        trades = state.get("active_trades") or []
        if not trades:
            return "📭 No open US positions right now. Use <code>/buy NVDA 138.60 250 REAL</code> to log one."
        lines = [f"💼 <b>ACTIVE US PORTFOLIO COACH ({len(trades)} OPEN)</b>\n"]
        for t in trades:
            lines.append(
                f"• <b>#{t['id']} {t['symbol']}</b> ({t['mode']}) — Entry ${t['entry_price']:.2f} → Now ${t['current_price']:.2f}\n"
                f"  Net P&L: <b>{t['net_pnl_pct']:+.2f}% (${t['net_pnl_usd']:+.2f} / R{t.get('net_pnl_zar', 0):+,.0f})</b>\n"
                f"  Stage: <b>{t['stage_label']}</b>\n"
                f"  Stop: ${t['recommended_stop']:.2f} | Chandelier: ${t.get('chandelier_ratchet_stop', t['recommended_stop']):.2f}\n"
                f"  Action: <i>{t['action_directive']}</i>\n"
            )
        return "\n".join(lines)

    if cmd == "/buy":
        # /buy <SYMBOL> <PRICE> <SHARES_OR_USD> [REAL|PAPER]
        if len(parts) < 4:
            return "Usage: <code>/buy NVDA 138.60 250 REAL</code> (where 250 is $ USD if > 25, or fractional shares)"
        sym = parts[1].upper().strip()
        try:
            entry_p = float(parts[2])
            qty_or_usd = float(parts[3])
        except ValueError:
            return "Invalid price or quantity number."
        mode = parts[4].upper().strip() if len(parts) >= 5 else "REAL"
        if mode not in ("REAL", "PAPER"):
            mode = "REAL"

        sig = sig_map.get(sym)
        meta = US_UNIVERSE_MAP.get(sym, {"name": f"{sym} Corp.", "sector": "TECH_AI"})
        stop_p = float(sig["stop_loss"]) if sig else round(entry_p * 0.96, 2)
        target_p = float(sig["target_price"]) if sig else round(entry_p * 1.07, 2)
        atr_val = float(sig["atr_14"]) if sig else round(entry_p * 0.022, 2)

        # Interpret > 15 as USD cash amount if entry_p > 20, or direct shares
        shares = round(qty_or_usd / max(entry_p, 1e-8), 4) if qty_or_usd >= 25.0 else round(qty_or_usd, 4)
        tid = insert_trade(
            symbol=sym,
            name=meta.get("name", f"{sym} Corp."),
            sector=meta.get("sector", "TECH_AI"),
            mode=mode,
            broker_profile=DEFAULT_FEE_PROFILE,
            entry_price=entry_p,
            shares=shares,
            stop_loss=stop_p,
            target_price=target_p,
            round_trip_fee_pct=DEFAULT_ROUND_TRIP_FEE_PCT,
            atr_at_entry=atr_val,
            plan_selected="TELEGRAM_BOT",
        )
        if refresh_callback:
            refresh_callback()
        return (
            f"✅ <b>LOGGED {mode} US TRADE #{tid}: {sym}</b>\n"
            f"• Entry: <b>${entry_p:.2f}</b> ({shares:.4f} shares ≈ ${shares * entry_p:.2f})\n"
            f"• Smart Stop: <b>${stop_p:.2f}</b> | Target: <b>${target_p:.2f}</b>\n"
            f"• 7-Stage Coach is now monitoring {sym} 24/7."
        )

    if cmd == "/close":
        if len(parts) < 2:
            return "Usage: <code>/close NVDA 145.20</code> or <code>/close 1 145.20</code>"
        target_id_or_sym = parts[1].upper().strip()
        exit_p = None
        if len(parts) >= 3:
            try:
                exit_p = float(parts[2])
            except ValueError:
                exit_p = None

        open_list = fetch_open_trades()
        matched_trade = None
        for t in open_list:
            if str(t["id"]) == target_id_or_sym or str(t["symbol"]).upper() == target_id_or_sym:
                matched_trade = t
                break
        if not matched_trade:
            return f"No open US trade found matching <b>{target_id_or_sym}</b>."

        if exit_p is None:
            sig = sig_map.get(matched_trade["symbol"])
            exit_p = float(sig["price"]) if sig else float(matched_trade["current_price"])

        closed = close_trade_by_id(
            trade_id=int(matched_trade["id"]),
            exit_price=exit_p,
            usdzar_rate=usdzar_rate,
            close_reason="TELEGRAM_BOT_CLOSE",
        )
        if refresh_callback:
            refresh_callback()
        if not closed:
            return "Could not close trade."
        return (
            f"🏁 <b>CLOSED US TRADE #{closed['id']} ({closed['symbol']})</b>\n"
            f"• Entry: ${closed['entry_price']:.2f} → Exit: <b>${closed['exit_price']:.2f}</b>\n"
            f"• Realized Net P&L: <b>{closed['realized_net_pnl_pct']:+.2f}% (${closed['realized_net_pnl_usd']:+.2f} / R{closed['realized_net_pnl_zar']:+,.0f})</b>"
        )

    return f"Unknown command <code>{cmd}</code>. Send /start for the command list."


async def poll_telegram_updates_and_push_alerts(
    state_getter: Callable[[], Dict[str, Any]],
    refresh_callback: Optional[Callable[[], Any]] = None,
) -> None:
    settings = fetch_alert_settings()
    token = (settings.get("telegram_bot_token") or "").strip()
    chat_id = (settings.get("telegram_chat_id") or "").strip()
    if not token:
        return

    last_update_id = int(settings.get("last_update_id") or 0)
    url = f"https://api.telegram.org/bot{token}/getUpdates"
    try:
        data = await asyncio.to_thread(_sync_http_get_json, url, {"offset": last_update_id + 1, "timeout": 1})
        for upd in data.get("result") or []:
            uid = int(upd.get("update_id", 0))
            if uid > last_update_id:
                last_update_id = uid
                update_telegram_cursor(last_update_id)
            msg = upd.get("message") or {}
            text = (msg.get("text") or "").strip()
            sender_chat_id = str((msg.get("chat") or {}).get("id") or chat_id)
            if text.startswith("/"):
                reply = await handle_telegram_command(text, state_getter, refresh_callback)
                await send_telegram_message(token, sender_chat_id, reply)
    except Exception:
        pass

    if not chat_id or not settings.get("enabled"):
        return

    state = state_getter()
    if not state:
        return

    # 1. Check 15:15 SAST (Mon-Fri) Wall Street Pre-Open Briefing
    sast_now = datetime.now(timezone(timedelta(hours=2)))
    today_str = sast_now.strftime("%Y-%m-%d")
    if (
        sast_now.weekday() < 5
        and sast_now.hour == 15
        and 15 <= sast_now.minute <= 25
        and settings.get("last_morning_brief_date") != today_str
    ):
        brief_text = format_wall_street_1515_briefing(state)
        res = await send_telegram_message(token, chat_id, brief_text)
        if res.get("ok"):
            update_telegram_cursor(last_update_id, last_morning_brief_date=today_str)

    # 2. V12.2 Anti-Spam 12/12-Only Prime-Window Telegram Dispatcher (Top-3 Winners Only)
    session_info = get_us_session_status()
    if session_info.get("is_prime_execution_window"):
        winners_12 = [
            s for s in (state.get("signals") or [])
            if s.get("verdict") == "A+_SNIPER_BUY"
            and int(s.get("aplus_gates_passed", 0)) == 12
            and (bool(s.get("is_tournament_winner", False)) or s.get("tournament_rank") in (1, 2, 3))
        ][:3]
        for sig in winners_12:
            sym = sig["symbol"]
            if not has_signal_alert_been_sent_today(sym, today_str):
                record_signal_alert_sent(
                    ticker=sym,
                    alert_date=today_str,
                    verdict=str(sig.get("verdict", "A+_SNIPER_BUY")),
                    recommended_plan=str(sig.get("recommended_entry_plan", "PLAN_A_MARKET")),
                )
                await send_telegram_message(
                    token,
                    chat_id,
                    (
                        f"🏆 <b>V12.2 12/12 US TOURNAMENT WINNER (#{sig.get('tournament_rank', 1)}): {sym} — {sig.get('name', sym)} (${sig['price']:.2f})</b>\n"
                        f"🌐 <b>Website:</b> US Wall Street (http://localhost:5174) • <b>Sector:</b> {sig.get('sector', 'US')}\n"
                        f"{sig['traffic_light_verdict']}\n"
                        f"🛡️ <b>Zero-Risk Shield:</b> {sig.get('zero_risk_shield_prob_pct', 95.4):.1f}% | Empirical Win Rate: {sig.get('bayesian_reliability_pct', 94.0):.1f}%\n"
                        f"• AI Pick: <b>{sig.get('recommended_entry_plan', 'PLAN_A_MARKET')}</b> ({sig.get('entry_plan_reason', '')})\n"
                        f"• Plan A Market: ${sig['entry_price']:.2f} (Reclaim ${sig.get('reclaim_trigger_price', sig['entry_price']):.2f} | {sig['net_rr_market']:.2f}x Net R:R | EV +{sig.get('ev_plan_a_pct', 0):.2f}%)\n"
                        f"• Plan B Limit Dip: ${sig['limit_dip_entry_price']:.2f} ({sig['net_rr_limit_dip']:.2f}x | {sig['limit_fill_prob_pct']:.0f}% Fill | EV +{sig.get('ev_plan_b_pct', 0):.2f}%)\n"
                        f"• Plan C 60/40 Elastic: ${sig['blended_entry_price']:.2f} (40% MAE Reserve @ ${sig.get('mae_reserve_price', sig['limit_dip_entry_price']):.2f})\n"
                        f"• Smart Stop: ${sig.get('stop_hunt_protected_sl', sig['stop_loss']):.2f} | Ladder: TP0 ${sig.get('tp0_price', sig['target_price']):.2f} (Lock SL ${sig.get('breakeven_lock_price', sig['entry_price']):.2f}) / TP1 ${sig.get('tp1_price', sig['target_price']):.2f} / TP2 ${sig.get('tp2_price', sig['target_price']):.2f} / TP3 ${sig.get('tp3_price', sig['target_price']):.2f}"
                    ),
                )

    # 3. Push Alert on Active Trade Stage / Stage 4.5 / Stage 7+ Transitions
    for t in state.get("active_trades") or []:
        tid_key = f"{t['id']}"
        stage_sig = f"{t['current_stage']}:{t.get('special_stage_badge') or ''}"
        prev_sig = _SENT_STAGE_CACHE.get(tid_key)
        if prev_sig is not None and prev_sig != stage_sig:
            await send_telegram_message(
                token,
                chat_id,
                (
                    f"🔔 <b>US TRADE COACH STAGE TRANSITION — {t['symbol']}</b>\n"
                    f"New Stage: <b>{t['stage_label']}</b>\n"
                    f"Net P&L: <b>{t['net_pnl_pct']:+.2f}% (${t['net_pnl_usd']:+.2f})</b>\n"
                    f"Recommended Stop: <b>${t['recommended_stop']:.2f}</b>\n"
                    f"Directive: <i>{t['action_directive']}</i>"
                ),
            )
        _SENT_STAGE_CACHE[tid_key] = stage_sig
