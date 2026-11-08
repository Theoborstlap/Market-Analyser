"""
2-Way Interactive Telegram Crypto Sniper Bot + 07:30 & 19:30 SAST 12h Briefings — V10.1
Features:
  1. Auto-Detect Chat ID (`getUpdates`) & 1-Click Test Alert
  2. Automatic Push Alerts on:
     - >= 10/12 A+ Crypto 1x Spot Sniper Setups
     - Stage 1-7 / Stage 4.5 Whale Harvest / Stage 7+ Chandelier Runner Transitions
     - Scheduled 07:30 SAST & 19:30 SAST (Daily 24/7) Crypto 12h Sniper Briefings:
       Top 2 Crypto A+ setups + Perp Funding APR heat + VALR/Luno ZAR Arbitrage spread
  3. 2-Way Interactive Commands:
     - /start
     - /top
     - /barbell
     - /ticket <SYMBOL>
     - /check <SYMBOL>
     - /portfolio
     - /buy <SYMBOL> <PRICE> <COINS_OR_USDT> [REAL|PAPER]
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

import os
import sys
from config import (
    DB_PATH,
    CRYPTO_UNIVERSE_MAP,
    DEFAULT_CRYPTO_FEE_PROFILE,
    DEFAULT_CRYPTO_ROUND_TRIP_FEE_PCT,
    format_crypto_price,
    round_crypto_price,
)
from database import (
    fetch_alert_settings,
    save_alert_settings,
    update_telegram_cursor,
    fetch_open_trades,
    insert_trade,
    close_trade_by_id,
    partial_close_position,
    has_signal_alert_been_sent_today,
    record_signal_alert_sent,
)
from v12_omega import get_crypto_session_status

_ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT_DIR not in sys.path:
    sys.path.insert(0, _ROOT_DIR)
from shared_core.telegram_coach import (
    build_buy_alert_inline_keyboard,
    dispatch_active_trades_coach_alerts,
    handle_telegram_callback_query,
    should_dispatch_buy_alert,
)

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


async def send_telegram_message(
    bot_token: str,
    chat_id: str,
    text: str,
    reply_markup: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    token = (bot_token or "").strip()
    cid = (chat_id or "").strip()
    if not token or not cid:
        return {"ok": False, "error": "Missing Telegram Bot Token or Chat ID."}
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload: Dict[str, Any] = {"chat_id": cid, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    if reply_markup:
        payload["reply_markup"] = reply_markup
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
                username = chat.get("username") or chat.get("first_name") or "CryptoSniper"
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


def format_crypto_12h_sniper_briefing(state: Dict[str, Any], session_label: str = "07:30 / 19:30 SAST") -> str:
    macro = state.get("macro") or {}
    fx = state.get("usdzar") or {}
    signals: List[Dict[str, Any]] = state.get("signals") or []
    top2 = signals[:2]

    lines = [
        f"⚡ <b>CRYPTO 12H SNIPER BRIEFING ({session_label} — V10.1 1x SPOT)</b>",
        f"🔥 <b>Perp Funding Heat:</b> BTC {macro.get('btc_funding_apr_pct', 10.95):+.2f}% APR | ETH {macro.get('eth_funding_apr_pct', 9.20):+.2f}% APR",
        f"🇿🇦 <b>VALR/Luno ZAR Arb Spread:</b> {fx.get('sa_arb_premium_pct', 1.42):+.2f}% ({fx.get('valr_arb_badge', 'NEUTRAL')})",
        f"💱 <b>USD/ZAR OU Shield:</b> R{fx.get('usdzar_rate', 18.42):.2f} ({fx.get('usdzar_regime_badge', 'STABLE')})",
        "",
        "🏆 <b>TOP 2 CRYPTO 1x SPOT A+ SNIPER SETUPS:</b>",
    ]
    for idx, sig in enumerate(top2, start=1):
        lines.append(
            f"{idx}. <b>{sig['symbol']}</b> ({format_crypto_price(sig['price'])}) — <b>{sig['aplus_gates_passed']}/12 Gates</b> | Conv {sig['conviction_pct']:.1f}%\n"
            f"   • Plan A Market: {format_crypto_price(sig['entry_price'])} (Net R:R {sig['net_rr_market']:.2f}x)\n"
            f"   • Plan B Dip: {format_crypto_price(sig['limit_dip_entry_price'])} (Net R:R {sig['net_rr_limit_dip']:.2f}x | Fill {sig['limit_fill_prob_pct']:.0f}%)\n"
            f"   • Smart Stop: {format_crypto_price(sig['stop_loss'])} | Target: {format_crypto_price(sig['target_price'])}\n"
            f"   • Funding APR: {sig.get('funding_rate_apr_pct', 10.5):+.1f}% | Coinbase Prem: {sig.get('coinbase_premium_pct', 0.08):+.2f}%"
        )
    lines.append("")
    lines.append("💡 <i>Execution Rule: Strictly 1x Spot (Zero Leverage) on VALR / Binance / Bybit with OCO Stop-Limit (0.9985x anti-slippage buffer).</i>")
    return "\n".join(lines)


async def handle_telegram_command(
    command_text: str,
    state_getter: Callable[[], Dict[str, Any]],
    refresh_callback: Optional[Callable[[], Any]] = None,
) -> str:
    parts = command_text.strip().split()
    if not parts:
        return "Send /start for Crypto 1x Spot Sniper Bot commands."
    cmd = parts[0].lower().split("@")[0]
    state = state_getter()
    signals: List[Dict[str, Any]] = state.get("signals") or []
    sig_map = {}
    for s in signals:
        sym_up = str(s["symbol"]).upper()
        sig_map[sym_up] = s
        sig_map[sym_up.replace("-USD", "")] = s

    usdzar_rate = float((state.get("usdzar") or {}).get("usdzar_rate", 18.42))

    if cmd in ("/start", "/help"):
        return (
            "⚡ <b>CRYPTO 24/7/365 V10.1 SOVEREIGN 1x SPOT SNIPER BOT</b>\n\n"
            "Available 2-Way Commands:\n"
            "• <code>/top</code> — Top 5 Crypto A+ Setups (12-Gate Score & Plan A/B/C)\n"
            "• <code>/barbell</code> — Today's #1 R10,000 (~$540 USDT) Crypto Barbell Plan\n"
            "• <code>/ticket SOL</code> — Exact VALR / Binance / Bybit 1x Spot OCO Order Ticket\n"
            "• <code>/check BTC</code> — Deep 12-Gate A+, Perp Funding & Deribit Audit\n"
            "• <code>/portfolio</code> — Live 7-Stage Active Trade Coach & P&L\n"
            "• <code>/buy SOL 186.40 200 REAL</code> — Log 1x Spot Crypto Trade (Coins or $ USDT)\n"
            "• <code>/close SOL 202.80</code> — Close Open Trade & Record Audit P&L\n"
            "• <code>/briefing</code> — On-Demand 07:30 & 19:30 SAST Crypto 12h Sniper Briefing"
        )

    if cmd == "/briefing":
        return format_crypto_12h_sniper_briefing(state, "ON-DEMAND")

    if cmd == "/top":
        top5 = signals[:5]
        lines = ["🔥 <b>TOP 5 CRYPTO 1x SPOT A+ SETUPS (24/7 LIVE)</b>\n"]
        for i, s in enumerate(top5, start=1):
            lines.append(
                f"{i}. <b>{s['symbol']}</b> ({format_crypto_price(s['price'])}) — <b>{s['aplus_gates_passed']}/12 Gates</b>\n"
                f"   {s['traffic_light_verdict']}\n"
                f"   Plan A: {format_crypto_price(s['entry_price'])} ({s['net_rr_market']:.2f}x) | "
                f"Plan B Dip: {format_crypto_price(s['limit_dip_entry_price'])} ({s['net_rr_limit_dip']:.2f}x, {s['limit_fill_prob_pct']:.0f}% Fill)\n"
                f"   Stop: {format_crypto_price(s['stop_loss'])} | Target: {format_crypto_price(s['target_price'])}\n"
            )
        return "\n".join(lines)

    if cmd == "/barbell":
        bp = state.get("barbell_plan") or {}
        s1 = bp.get("slot_1_major_l1_anchor") or bp.get("slot_1_safe_anchor") or {}
        s2 = bp.get("slot_2_ai_defi_leader") or bp.get("slot_2_tech_leader") or {}
        s3 = bp.get("slot_3_dry_powder") or {}
        return (
            f"🏆 <b>TODAY'S #1 CRYPTO A+ BARBELL PLAN (R{bp.get('account_balance_zar', 10000):,.0f} / ~${bp.get('account_balance_usd', 542):,.0f} USDT)</b>\n"
            f"Pair Correlation: <b>ρ = {bp.get('pair_correlation_rho', 0.24):.2f}</b>\n\n"
            f"🛡️ <b>{s1.get('role', 'Slot 1 (45% Major L1 Anchor)')}: {s1.get('symbol')}</b>\n"
            f"• Invest: <b>${s1.get('alloc_usd', 0):.2f} USDT (R{s1.get('alloc_zar', 0):,.0f})</b> | {s1.get('plan_label')}\n"
            f"• Stop: {format_crypto_price(s1.get('stop_loss', 0))} | Target: {format_crypto_price(s1.get('target_price', 0))} | "
            f"Net Win: +${s1.get('expected_net_win_usd', 0):.2f} (+R{s1.get('expected_net_win_zar', 0):,.0f})\n\n"
            f"🚀 <b>{s2.get('role', 'Slot 2 (35% High-Velocity AI/DeFi Leader)')}: {s2.get('symbol')}</b>\n"
            f"• Invest: <b>${s2.get('alloc_usd', 0):.2f} USDT (R{s2.get('alloc_zar', 0):,.0f})</b> | {s2.get('plan_label')}\n"
            f"• Stop: {format_crypto_price(s2.get('stop_loss', 0))} | Target: {format_crypto_price(s2.get('target_price', 0))} | "
            f"Net Win: +${s2.get('expected_net_win_usd', 0):.2f} (+R{s2.get('expected_net_win_zar', 0):,.0f})\n\n"
            f"💧 <b>{s3.get('role', 'Slot 3 (20% USDT Dry Powder Reserve)')}:</b> ${s3.get('alloc_usd', 0):.2f} USDT (R{s3.get('alloc_zar', 0):,.0f})"
        )

    if cmd in ("/ticket", "/check"):
        if len(parts) < 2:
            return f"Usage: <code>{cmd} SOL</code> or <code>{cmd} BTC-USD</code>"
        raw_sym = parts[1].upper().strip()
        sig = sig_map.get(raw_sym) or sig_map.get(f"{raw_sym}-USD")
        if not sig:
            return f"Symbol <b>{raw_sym}</b> not found in active Crypto scanner. Add it via '+ Add Coin' or try BTC, ETH, SOL, TAO, SUI, ONDO."
        mb = sig.get("money_box") or {}
        opt = sig.get("options_intel") or {}
        stop_exec_limit = round_crypto_price(float(sig["stop_loss"]) * 0.9985)
        if cmd == "/ticket":
            return (
                f"📋 <b>VALR / BINANCE / BYBIT 1x SPOT OCO TICKET — {sig['symbol']} ({sig['name']})</b>\n"
                f"{sig['traffic_light_verdict']}\n\n"
                f"• <b>Plan A (100% Market Now):</b> {format_crypto_price(sig['entry_price'])} | Net R:R {sig['net_rr_market']:.2f}x\n"
                f"• <b>Plan B (Sniper Limit Dip):</b> {format_crypto_price(sig['limit_dip_entry_price'])} | Net R:R {sig['net_rr_limit_dip']:.2f}x (24h Fill: {sig['limit_fill_prob_pct']:.0f}%)\n"
                f"• <b>Plan C (50/50 Scale-In):</b> {format_crypto_price(sig['blended_entry_price'])} | Net R:R {sig['blended_net_rr']:.2f}x\n\n"
                f"🎯 <b>OCO Take-Profit Limit:</b> {format_crypto_price(sig['target_price'])}\n"
                f"🛡️ <b>OCO Stop-Loss Trigger:</b> {format_crypto_price(sig['stop_loss'])}\n"
                f"⚡ <b>OCO Stop-Loss Execution Limit (0.9985x):</b> {format_crypto_price(stop_exec_limit)}\n"
                f"💵 <b>R10k Scaled Size:</b> ${mb.get('invest_usd', 110):.2f} USDT (R{mb.get('invest_zar', 2000):,.0f})\n"
                f"• Max Risk: -${mb.get('max_loss_usd', 6):.2f} (-R{mb.get('max_loss_zar', 110):,.0f})\n"
                f"• Expected Net Win: +${mb.get('net_win_usd', 15):.2f} (+R{mb.get('net_win_zar', 275):,.0f} after 0.25% fee)"
            )
        else:
            passed_list = [f"{'✅' if g['passed'] else '❌'} G{g['gate']} {g['name']}: {g['value']}" for g in sig.get("aplus_checklist_items", [])]
            return (
                f"🔬 <b>12-GATE A+ CRYPTO AUDIT — {sig['symbol']} ({format_crypto_price(sig['price'])})</b>\n"
                f"Score: <b>{sig['aplus_gates_passed']}/12 Gates</b> | Conviction: <b>{sig['conviction_pct']:.1f}%</b>\n"
                f"Funding: {sig.get('funding_rate_apr_pct', 10.5):+.2f}% APR | Deribit DVOL: {opt.get('dvol_index', 52.0)} | Call Wall {format_crypto_price(opt.get('call_wall', sig['target_price']))}\n\n"
                + "\n".join(passed_list)
            )

    if cmd == "/portfolio":
        trades = state.get("active_trades") or []
        if not trades:
            return "📭 No open 1x Spot Crypto positions right now. Use <code>/buy SOL 186.40 200 REAL</code> to log one."
        lines = [f"💼 <b>ACTIVE CRYPTO 1x SPOT COACH ({len(trades)} OPEN)</b>\n"]
        for t in trades:
            lines.append(
                f"• <b>#{t['id']} {t['symbol']}</b> ({t['mode']}) — Entry {format_crypto_price(t['entry_price'])} → Now {format_crypto_price(t['current_price'])}\n"
                f"  Net P&L: <b>{t['net_pnl_pct']:+.2f}% (${t['net_pnl_usd']:+.2f} USDT / R{t.get('net_pnl_zar', 0):+,.0f})</b>\n"
                f"  Stage: <b>{t['stage_label']}</b>\n"
                f"  OCO Stop: {format_crypto_price(t['recommended_stop'])} | Chandelier: {format_crypto_price(t.get('chandelier_ratchet_stop', t['recommended_stop']))}\n"
                f"  Action: <i>{t['action_directive']}</i>\n"
            )
        return "\n".join(lines)

    if cmd == "/buy":
        # /buy <SYMBOL> <PRICE> <COINS_OR_USDT> [REAL|PAPER]
        if len(parts) < 4:
            return "Usage: <code>/buy SOL 186.40 200 REAL</code> (where 200 is $ USDT or coin quantity)"
        raw_sym = parts[1].upper().strip()
        sym = raw_sym if raw_sym.endswith("-USD") else f"{raw_sym}-USD"
        try:
            entry_p = float(parts[2])
            qty_or_usdt = float(parts[3])
        except ValueError:
            return "Invalid price or quantity number."
        mode = parts[4].upper().strip() if len(parts) >= 5 else "REAL"
        if mode not in ("REAL", "PAPER"):
            mode = "REAL"

        sig = sig_map.get(sym) or sig_map.get(raw_sym)
        meta = CRYPTO_UNIVERSE_MAP.get(sym, {"name": sym.replace("-USD", ""), "sector": "MAJOR_L1"})
        stop_p = float(sig["stop_loss"]) if sig else round_crypto_price(entry_p * 0.945)
        target_p = float(sig["target_price"]) if sig else round_crypto_price(entry_p * 1.115)
        atr_val = float(sig["atr_14"]) if sig else round_crypto_price(entry_p * 0.035)

        # Interpret > 25 as USDT cash amount if entry_p > 10, else coin quantity
        coins = round(qty_or_usdt / max(entry_p, 1e-12), 6) if (qty_or_usdt >= 25.0 and entry_p >= 10.0) else round(qty_or_usdt, 6)
        tid = insert_trade(
            symbol=sym,
            name=meta.get("name", sym),
            sector=meta.get("sector", "MAJOR_L1"),
            mode=mode,
            broker_profile=DEFAULT_CRYPTO_FEE_PROFILE,
            entry_price=entry_p,
            shares=coins,
            stop_loss=stop_p,
            target_price=target_p,
            round_trip_fee_pct=DEFAULT_CRYPTO_ROUND_TRIP_FEE_PCT,
            atr_at_entry=atr_val,
            plan_selected="TELEGRAM_BOT",
        )
        if refresh_callback:
            refresh_callback()
        return (
            f"✅ <b>LOGGED {mode} 1x SPOT CRYPTO TRADE #{tid}: {sym}</b>\n"
            f"• Entry: <b>{format_crypto_price(entry_p)}</b> ({coins:.4f} coins ≈ ${coins * entry_p:.2f} USDT)\n"
            f"• Protected OCO Stop: <b>{format_crypto_price(stop_p)}</b> | Target: <b>{format_crypto_price(target_p)}</b>\n"
            f"• 7-Stage Coach is now monitoring {sym} 24/7/365."
        )

    if cmd == "/close":
        if len(parts) < 2:
            return "Usage: <code>/close SOL 202.80</code> or <code>/close 1 202.80</code>"
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
            t_sym = str(t["symbol"]).upper()
            if (
                str(t["id"]) == target_id_or_sym
                or t_sym == target_id_or_sym
                or t_sym.replace("-USD", "") == target_id_or_sym.replace("-USD", "")
            ):
                matched_trade = t
                break
        if not matched_trade:
            return f"No open Crypto trade found matching <b>{target_id_or_sym}</b>."

        if exit_p is None:
            sig = sig_map.get(str(matched_trade["symbol"]).upper())
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
            f"🏁 <b>CLOSED CRYPTO 1x SPOT TRADE #{closed['id']} ({closed['symbol']})</b>\n"
            f"• Entry: {format_crypto_price(closed['entry_price'])} → Exit: <b>{format_crypto_price(closed['exit_price'])}</b>\n"
            f"• Realized Net P&L: <b>{closed['realized_net_pnl_pct']:+.2f}% (${closed['realized_net_pnl_usd']:+.2f} USDT / R{closed['realized_net_pnl_zar']:+,.0f})</b>"
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
            if upd.get("callback_query"):
                await handle_telegram_callback_query(
                    upd["callback_query"],
                    market="CRYPTO",
                    bot_token=token,
                    db_path=DB_PATH,
                    partial_close_fn=lambda tid, pct: partial_close_position(tid, pct, None, 18.42),
                    close_trade_fn=lambda tid: close_trade_by_id(tid, None, 18.42, "TELEGRAM_1TAP_CLOSE"),
                )
                continue
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

    # 1. Check Scheduled 07:30 SAST & 19:30 SAST (Daily) Crypto 12h Sniper Briefings
    sast_now = datetime.now(timezone(timedelta(hours=2)))
    today_str = sast_now.strftime("%Y-%m-%d")
    if (
        sast_now.hour == 7
        and 30 <= sast_now.minute <= 40
        and settings.get("last_morning_brief_date") != today_str
    ):
        brief_text = format_crypto_12h_sniper_briefing(state, "07:30 SAST MORNING")
        res = await send_telegram_message(token, chat_id, brief_text)
        if res.get("ok"):
            update_telegram_cursor(last_update_id, last_morning_brief_date=today_str)

    if (
        sast_now.hour == 19
        and 30 <= sast_now.minute <= 40
        and settings.get("last_evening_brief_date") != today_str
    ):
        brief_text = format_crypto_12h_sniper_briefing(state, "19:30 SAST EVENING")
        res = await send_telegram_message(token, chat_id, brief_text)
        if res.get("ok"):
            update_telegram_cursor(last_update_id, last_evening_brief_date=today_str)

    # 2. V12.2 Anti-Spam 12/12-Only Prime-Window Telegram Dispatcher (Top-3 Winners Only)
    session_info = get_crypto_session_status()
    if session_info.get("is_prime_execution_window"):
        winners_12 = [
            s for s in (state.get("signals") or [])
            if s.get("verdict") == "A+_SNIPER_BUY"
            and int(s.get("aplus_gates_passed", 0)) == 12
            and (bool(s.get("is_tournament_winner", False)) or s.get("tournament_rank") in (1, 2, 3))
        ][:3]
        for sig in winners_12:
            sym = sig["symbol"]
            buy_gate = should_dispatch_buy_alert(
                market="CRYPTO",
                signal=sig,
                macro_state=state.get("macro"),
            )
            if not buy_gate["allowed"]:
                continue
            if not has_signal_alert_been_sent_today(sym, today_str):
                opt_bid = float(buy_gate["optimal_limit_bid"])
                record_signal_alert_sent(
                    ticker=sym,
                    alert_date=today_str,
                    verdict=str(sig.get("verdict", "A+_SNIPER_BUY")),
                    recommended_plan="PLAN_B_LIMIT_PULLBACK",
                )
                markup = build_buy_alert_inline_keyboard("CRYPTO", sym, opt_bid, bot_token=token)
                await send_telegram_message(
                    token,
                    chat_id,
                    (
                        f"🏆 <b>V12.2 12/12 CRYPTO TOURNAMENT WINNER (#{sig.get('tournament_rank', 1)}): {sym} — {sig.get('name', sym)} ({format_crypto_price(sig['price'])})</b>\n"
                        f"🌐 <b>Website:</b> Crypto 24/7 1x Spot (http://localhost:5175) • <b>Sector:</b> {sig.get('sector', 'CRYPTO')}\n"
                        f"{sig['traffic_light_verdict']}\n"
                        f"🛡️ <b>Zero-Risk Shield:</b> {sig.get('zero_risk_shield_prob_pct', 95.4):.1f}% | Empirical Win Rate: {sig.get('bayesian_reliability_pct', 94.0):.1f}%\n"
                        f"• AI Pick: <b>PLAN_B_LIMIT_PULLBACK</b> (min Conformal90, EMA20 = <b>{format_crypto_price(opt_bid)}</b> | RVOL {buy_gate['rvol']:.2f}x)\n"
                        f"• Plan A 1x Spot Market: {format_crypto_price(sig['entry_price'])} (Reclaim {format_crypto_price(sig.get('reclaim_trigger_price', sig['entry_price']))} | {sig['net_rr_market']:.2f}x Net R:R | EV +{sig.get('ev_plan_a_pct', 0):.2f}%)\n"
                        f"• Plan B Limit Dip: {format_crypto_price(opt_bid)} ({sig['net_rr_limit_dip']:.2f}x | {sig['limit_fill_prob_pct']:.0f}% Fill | EV +{sig.get('ev_plan_b_pct', 0):.2f}%)\n"
                        f"• Plan C 60/40 Elastic: {format_crypto_price(sig['blended_entry_price'])} (40% MAE Reserve @ {format_crypto_price(sig.get('mae_reserve_price', sig['limit_dip_entry_price']))})\n"
                        f"• Smart OCO Stop: {format_crypto_price(sig.get('stop_hunt_protected_sl', sig['stop_loss']))} | Ladder: TP0 {format_crypto_price(sig.get('tp0_price', sig['target_price']))} (Lock SL {format_crypto_price(sig.get('breakeven_lock_price', sig['entry_price']))}) / TP1 {format_crypto_price(sig.get('tp1_price', sig['target_price']))} / TP2 {format_crypto_price(sig.get('tp2_price', sig['target_price']))} / TP3 {format_crypto_price(sig.get('tp3_price', sig['target_price']))}"
                    ),
                    reply_markup=markup,
                )

    # 3. Unified Real-Time Active Trade Coach Dispatcher (TP0/TP1/TP2/TP3 Chandelier/Time-Stop + 1-Tap Inline Buttons)
    await asyncio.to_thread(
        dispatch_active_trades_coach_alerts,
        state,
        market="CRYPTO",
        bot_token=token,
        chat_id=chat_id,
        enabled=bool(settings.get("enabled")),
    )
