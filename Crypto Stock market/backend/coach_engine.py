"""
7-Stage Proportional Active Crypto Trade Coach + V10.1 Sovereign Upgrades:
  - Preserves 100% of V9.0 `evaluate_proportional_7_stage_coach`
  - All 7 Proportional Coaching Stages scaled to T = trade.target_net_pct
    (including Stage 3 Fee-Adjusted Breakeven Lock at 0.35 * T after 0.25% 1x Spot friction)
  - [UPGRADE 7] Stage 4.5 Whale Distribution Early Harvest:
    If current_net_pnl_pct >= 0.50 * T AND (vpin > 0.72 OR shannon_entropy > 0.84 OR red_team_kill_prob_pct > 35.0),
    triggers "⚠️ STAGE 4.5 WHALE DISTRIBUTION DETECTED AT +X.X% NET: Harvest 75% Profit Early Now & Trail OCO Stop at +0.35T"
  - [UPGRADE 7] Stage 7+ Parabolic Chandelier Runner:
    Computes live Chandelier Ratchet Stop max(Entry_BE, Highest_High - 1.25 * ATR_14) and unlocks
    "🚀 STAGE 7+ PARABOLIC RUNNER UNLOCKED" when current_net_pnl_pct >= 0.90 * T, hurst >= 0.56, and shannon_entropy <= 0.76
  - [UPGRADE 7] Dead-Money / Opportunity Cost Swap Advisor:
    Flags stagnant open trades (days_held >= 3, -1.0 <= current_net_pnl_pct <= 1.2, hurst < 0.50) when the #1 new A+ setup
    beats them by >= +1.50% Net after 2x round-trip swap friction.
  - [UPGRADE 9] R10k -> R100k Compounding Roadmap & Anti-Tilt Circuit Breaker
"""
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from config import round_crypto_price, format_crypto_price, DEFAULT_CRYPTO_ROUND_TRIP_FEE_PCT


# ============================================================================
# PRESERVED V9.0 PROPORTIONAL 7-STAGE COACH FUNCTION
# ============================================================================

def evaluate_proportional_7_stage_coach(net_pct: float, target_net_pct: float, stop_loss_pct: float) -> dict:
    T = max(3.0, target_net_pct)
    if net_pct <= -abs(stop_loss_pct):
        return {"stage": 3, "title": "STAGE 3: HARD STOP-LOSS SHIELD"}
    if net_pct >= T:
        return {"stage": 6, "title": f"STAGE 6: DYNAMIC TARGET +{T:.1f}% NET REACHED"}
    if net_pct >= 0.65 * T:
        return {"stage": 5, "title": "STAGE 5: CHANDELIER PROFIT-LOCK"}
    if net_pct >= 0.35 * T:
        return {"stage": 4, "title": "STAGE 4: BREAKEVEN LOCK & 25% SCALE-OUT"}
    if net_pct < 0:
        return {"stage": 2, "title": "STAGE 2: NOISE PULLBACK CUSHION"}
    return {"stage": 1, "title": "STAGE 1: INSTITUTIONAL ENTRY ZONE"}


# ============================================================================
# V10.1 SOVEREIGN 7-STAGE + STAGE 4.5 + STAGE 7+ + DEAD-MONEY SWAP COACH
# ============================================================================

def _compute_days_held(opened_at_str: Optional[str]) -> float:
    if not opened_at_str:
        return 1.0
    try:
        dt = datetime.fromisoformat(opened_at_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - dt
        return max(0.1, round(delta.total_seconds() / 86400.0, 1))
    except Exception:
        return 1.5


def evaluate_7stage_proportional_coach(
    trade: Dict[str, Any],
    live_signal: Optional[Dict[str, Any]] = None,
    top_aplus_signal: Optional[Dict[str, Any]] = None,
    usdzar_rate: float = 18.42,
) -> Dict[str, Any]:
    entry = float(trade["entry_price"])
    curr = float(live_signal["price"]) if live_signal else float(trade.get("current_price") or entry)
    stop = float(trade["stop_loss"])
    target = float(trade["target_price"])
    coins = float(trade.get("shares") or trade.get("coins") or 1.0)
    fee_pct = float(trade.get("round_trip_fee_pct", DEFAULT_CRYPTO_ROUND_TRIP_FEE_PCT))
    atr_val = (
        float(live_signal["atr_14"])
        if (live_signal and "atr_14" in live_signal)
        else float(trade.get("atr_at_entry") or entry * 0.032)
    )

    prev_highest = float(trade.get("highest_price_seen") or max(entry, curr))
    highest_seen = max(prev_highest, entry, curr)

    gross_pnl_pct = ((curr - entry) / max(entry, 1e-12)) * 100.0
    net_pnl_pct = gross_pnl_pct - fee_pct

    gross_target_pct = ((target - entry) / max(entry, 1e-12)) * 100.0
    target_net_pct = max(1.0, gross_target_pct - fee_pct)  # T = trade.target_net_pct

    # Proportional progress toward net target T
    progress_t = net_pnl_pct / max(target_net_pct, 1e-6)

    position_value_usd = curr * coins
    cost_basis_usd = entry * coins
    fees_usd = (cost_basis_usd + position_value_usd) * (fee_pct / 200.0)
    net_pnl_usd = (position_value_usd - cost_basis_usd) - fees_usd
    net_pnl_zar = net_pnl_usd * float(usdzar_rate)

    # Fee-Adjusted Breakeven Price (after 0.25% 1x Spot friction)
    be_price = round_crypto_price(entry * (1.0 + fee_pct / 100.0))

    # Live Chandelier Ratchet Stop: max(Entry_BE, Highest_High - 1.25 * ATR_14)
    chandelier_ratchet_stop = round_crypto_price(max(be_price, highest_seen - 1.25 * atr_val))

    # Microstructure & Agent telemetry for Stage 4.5, Stage 7, Stage 7+, and Dead-Money Swap
    entropy = float(live_signal.get("shannon_entropy", 0.68)) if live_signal else 0.68
    vpin = float(live_signal.get("vpin", 0.44)) if live_signal else 0.44
    hurst = float(live_signal.get("hurst", 0.59)) if live_signal else 0.59
    kill_prob = float(live_signal.get("agents", {}).get("red_team_kill_prob_pct", 18.0)) if live_signal else 18.0
    call_wall = float(live_signal.get("options_intel", {}).get("call_wall", target * 1.02)) if live_signal else target * 1.02

    days_held = _compute_days_held(trade.get("opened_at"))

    # Determine Stage 1..7 + Stage 4.5 Whale Harvest + Stage 7+ Chandelier Runner
    stage_4_5_whale_triggered = (
        net_pnl_pct >= 0.50 * target_net_pct
        and (vpin > 0.72 or entropy > 0.84 or kill_prob > 35.0)
    )
    stage_7_plus_runner_unlocked = (
        net_pnl_pct >= 0.90 * target_net_pct
        and hurst >= 0.56
        and entropy <= 0.76
    )

    special_stage_badge: Optional[str] = None

    if curr <= stop or entropy > 0.85:
        stage_num = 7
        stage_label = "STAGE 7: STOP / REGIME INVALIDATION EXIT"
        urgency = "CRITICAL"
        recommended_stop = stop
        action_directive = (
            f"🚨 EXIT 1x SPOT POSITION NOW AT {format_crypto_price(curr)}: Price breached structural OCO stop ({format_crypto_price(stop)}) "
            f"or Shannon Entropy ({entropy:.2f}) exceeded 0.85."
        )
    elif stage_7_plus_runner_unlocked:
        stage_num = 6
        stage_label = "🚀 STAGE 7+ PARABOLIC RUNNER UNLOCKED"
        special_stage_badge = "🚀 STAGE 7+ PARABOLIC RUNNER UNLOCKED"
        urgency = "TAKE_PROFIT"
        recommended_stop = chandelier_ratchet_stop
        action_directive = (
            f"🚀 STAGE 7+ PARABOLIC RUNNER UNLOCKED (+{net_pnl_pct:.2f}% Net | Hurst H={hurst:.2f}, Entropy S={entropy:.2f}): "
            f"Harvest 50% at {format_crypto_price(curr)} and let the remaining 50% ride with Chandelier Ratchet OCO Stop at {format_crypto_price(chandelier_ratchet_stop)} "
            f"(Highest High {format_crypto_price(highest_seen)} - 1.25x ATR)."
        )
    elif stage_4_5_whale_triggered:
        stage_num = 4
        stage_label = "⚠️ STAGE 4.5 WHALE DISTRIBUTION EARLY HARVEST"
        special_stage_badge = (
            f"⚠️ STAGE 4.5 WHALE DISTRIBUTION DETECTED AT +{net_pnl_pct:.1f}% NET: "
            f"Harvest 75% Profit Early Now & Trail OCO Stop at +0.35T"
        )
        urgency = "TAKE_PROFIT"
        lock_035t = round_crypto_price(entry * (1.0 + (fee_pct + 0.35 * target_net_pct) / 100.0))
        recommended_stop = max(be_price, lock_035t)
        action_directive = (
            f"⚠️ STAGE 4.5 WHALE DISTRIBUTION DETECTED AT +{net_pnl_pct:.1f}% NET: "
            f"Harvest 75% Profit Early Now & Trail OCO Stop at +0.35T ({format_crypto_price(recommended_stop)} | "
            f"VPIN={vpin:.2f}, S={entropy:.2f}, Red-Team={kill_prob:.1f}%)."
        )
    elif progress_t >= 0.90:
        stage_num = 6
        stage_label = "STAGE 6: TARGET ZONE & DERIBIT GAMMA CALL WALL HARVEST"
        urgency = "TAKE_PROFIT"
        recommended_stop = round_crypto_price(max(chandelier_ratchet_stop, curr - 0.85 * atr_val))
        action_directive = (
            f"🎯 FULL TARGET ZONE (+{net_pnl_pct:.2f}% Net / {progress_t * 100:.0f}% of T): "
            f"Harvest 80%–100% profit ahead of {format_crypto_price(call_wall)} Deribit Call Wall or trail OCO stop at {format_crypto_price(recommended_stop)}."
        )
    elif progress_t >= 0.75:
        stage_num = 5
        stage_label = "STAGE 5: 50% PARTIAL PROFIT HARVEST (0.75T)"
        urgency = "ACTION_REQUIRED"
        recommended_stop = round_crypto_price(entry * (1.0 + (fee_pct + 0.50 * target_net_pct) / 100.0))
        action_directive = (
            f"💰 BANK 50% COINS AT {format_crypto_price(curr)} (+{net_pnl_pct:.2f}% Net): "
            f"Ratchet trailing OCO stop on remaining 50% to +0.50T ({format_crypto_price(recommended_stop)})."
        )
    elif progress_t >= 0.55:
        stage_num = 4
        stage_label = "STAGE 4: DYNAMIC ATR + 0.50T PROFIT LOCK"
        urgency = "RATCHET_STOP"
        lock_price = round_crypto_price(entry * (1.0 + (fee_pct + 0.35 * target_net_pct) / 100.0))
        atr_trail = round_crypto_price(curr - 1.50 * atr_val)
        recommended_stop = max(lock_price, atr_trail)
        action_directive = (
            f"🔒 LOCK IN +0.35T PROFIT: Raise OCO stop-loss to {format_crypto_price(recommended_stop)} "
            f"(protects net gain after {fee_pct:.2f}% 1x Spot round-trip friction)."
        )
    elif progress_t >= 0.35:
        stage_num = 3
        stage_label = "STAGE 3: FEE-ADJUSTED BREAKEVEN LOCK (0.35T)"
        urgency = "MOVE_TO_BREAKEVEN"
        recommended_stop = be_price
        action_directive = (
            f"🛡️ ZERO-RISK FREE RIDE UNLOCKED (+0.35T reached): Move OCO Stop-Loss to Fee-Adjusted Breakeven {format_crypto_price(be_price)} "
            f"(Entry {format_crypto_price(entry)} + {fee_pct:.2f}% 1x Spot friction)."
        )
    elif progress_t >= 0.20:
        stage_num = 2
        stage_label = "STAGE 2: MOMENTUM CONFIRMED — PYRAMID WINDOW (0.20T)"
        urgency = "HOLD_OR_ADD"
        recommended_stop = round_crypto_price(max(stop, entry - 1.15 * atr_val))
        action_directive = (
            f"📈 TREND VALIDATED (+{net_pnl_pct:.2f}% Net): Hold 1x Spot coins; optional 25% add while VPIN ({vpin:.2f}) < 0.65. "
            f"Tighten OCO stop to {format_crypto_price(recommended_stop)}."
        )
    else:
        stage_num = 1
        stage_label = "STAGE 1: INITIAL RISK SHIELD ACTIVE"
        urgency = "HOLD"
        recommended_stop = stop
        be_trigger = round_crypto_price(entry * (1.0 + (fee_pct + 0.35 * target_net_pct) / 100.0))
        action_directive = (
            f"⏳ INITIAL STRUCTURAL RISK SHIELD: Hold 1x Spot position. Protected OCO stop at {format_crypto_price(stop)}; "
            f"Stage 3 Fee-Adjusted Breakeven Lock triggers at {format_crypto_price(be_trigger)} (+0.35T)."
        )

    # [V10.1 UPGRADE 7] Dead-Money / Opportunity Cost Swap Advisor
    # Flag stagnant open trades (days_held >= 3, -1.0 <= current_net_pnl_pct <= 1.2, hurst < 0.50)
    # when the #1 new A+ setup beats them by >= +1.50% Net after 2x round-trip swap friction.
    dead_money_swap_advisor: Optional[Dict[str, Any]] = None
    remaining_net_upside_pct = max(0.0, ((target - curr) / max(curr, 1e-12)) * 100.0 - fee_pct)
    is_stagnant = (days_held >= 3.0) and (-1.0 <= net_pnl_pct <= 1.2) and (hurst < 0.50)

    if top_aplus_signal and str(top_aplus_signal.get("symbol")) != str(trade.get("symbol")):
        candidate_sym = str(top_aplus_signal["symbol"])
        candidate_net_up = float(top_aplus_signal.get("net_upside_pct", 0.0))
        double_swap_friction = 2.0 * fee_pct
        net_swap_advantage_pct = candidate_net_up - remaining_net_upside_pct - double_swap_friction

        if is_stagnant and net_swap_advantage_pct >= 1.50:
            dead_money_swap_advisor = {
                "flagged": True,
                "reason": (
                    f"⚠️ DEAD-MONEY SWAP ALERT: {trade['symbol']} held {days_held:.1f}d with {net_pnl_pct:+.2f}% Net & Hurst H={hurst:.2f} (<0.50). "
                    f"Swapping into #1 A+ Setup {candidate_sym} ({top_aplus_signal.get('aplus_gates_passed', 11)}/12 Gates) "
                    f"adds +{net_swap_advantage_pct:.2f}% extra Net Upside AFTER 2x ({double_swap_friction:.2f}%) swap friction."
                ),
                "swap_to_symbol": candidate_sym,
                "swap_net_advantage_pct": round(net_swap_advantage_pct, 2),
                "days_held": days_held,
            }

    stage_ladder = []
    stage_titles = [
        (1, "Stage 1: Initial Risk Shield", "0.00T"),
        (2, "Stage 2: Momentum Pyramid Window", "+0.20T"),
        (3, "Stage 3: Fee-Adjusted Breakeven Lock", "+0.35T"),
        (4, "Stage 4: ATR + 0.35T Profit Ratchet", "+0.55T"),
        (5, "Stage 5: 50% Partial Profit Harvest", "+0.75T"),
        (6, "Stage 6: Full Target / Call Wall Harvest", "+0.90T"),
        (7, "Stage 7: Stop / Entropy Veto Exit", "Stop"),
    ]
    for s_idx, s_title, thresh in stage_titles:
        fired_col = f"stage_{s_idx}_fired"
        is_reached = (s_idx <= stage_num and stage_num != 7) or (s_idx == 7 and stage_num == 7) or bool(trade.get(fired_col, 0))
        stage_ladder.append({
            "stage": s_idx,
            "title": s_title,
            "threshold": thresh,
            "reached": is_reached,
            "active": s_idx == stage_num,
        })

    return {
        **trade,
        "current_price": round_crypto_price(curr),
        "highest_price_seen": round_crypto_price(highest_seen),
        "gross_pnl_pct": round(gross_pnl_pct, 2),
        "net_pnl_pct": round(net_pnl_pct, 2),
        "net_pnl_usd": round(net_pnl_usd, 2),
        "net_pnl_zar": round(net_pnl_zar, 2),
        "target_net_pct": round(target_net_pct, 2),
        "progress_toward_target_pct": round(min(100.0, max(0.0, progress_t * 100.0)), 1),
        "fee_adjusted_breakeven": be_price,
        "chandelier_ratchet_stop": chandelier_ratchet_stop,
        "recommended_stop": round_crypto_price(recommended_stop),
        "current_stage": stage_num,
        "stage_label": stage_label,
        "special_stage_badge": special_stage_badge,
        "stage_4_5_whale_triggered": stage_4_5_whale_triggered,
        "stage_7_plus_runner_unlocked": stage_7_plus_runner_unlocked,
        "days_held": days_held,
        "dead_money_swap_advisor": dead_money_swap_advisor,
        "urgency": urgency,
        "action_directive": action_directive,
        "stage_ladder": stage_ladder,
    }


def check_anti_tilt_circuit_breaker(closed_trades: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    [V10.1 UPGRADE 9] Anti-Tilt Circuit Breaker:
    Checks if the 2 most recent closed trades resulted in net losses.
    If >= 2 consecutive losses, halves Kelly sizing (0.50x multiplier) until next winning trade.
    """
    consecutive_losses = 0
    for t in closed_trades:
        net_pnl = float(t.get("realized_net_pnl_usd") or t.get("realized_pnl_usd") or 0.0)
        if net_pnl < 0:
            consecutive_losses += 1
        else:
            break

    triggered = consecutive_losses >= 2
    return {
        "triggered": triggered,
        "consecutive_losses": consecutive_losses,
        "kelly_multiplier": 0.50 if triggered else 1.00,
        "status_badge": (
            f"🛑 ANTI-TILT CIRCUIT BREAKER ACTIVE ({consecutive_losses} Losses): Kelly Halved (0.5x)"
            if triggered
            else "🟢 ANTI-TILT SHIELD CLEAR (1.0x Full Half-Kelly)"
        ),
    }


def build_compounding_roadmap_and_analytics(
    open_trades: List[Dict[str, Any]],
    closed_trades: List[Dict[str, Any]],
    account_balance_zar: float = 10000.0,
    usdzar_rate: float = 18.42,
) -> Dict[str, Any]:
    """
    [V10.1 UPGRADE 9] Builds the R10k -> R100k Compounding Roadmap, Realized Win Rate,
    Profit Factor, Milestone Progress Bar, Equity Curve, and Anti-Tilt Circuit Breaker.
    """
    total_closed = len(closed_trades)
    wins = [t for t in closed_trades if float(t.get("realized_net_pnl_usd") or t.get("realized_pnl_usd") or 0.0) > 0]
    losses = [t for t in closed_trades if float(t.get("realized_net_pnl_usd") or t.get("realized_pnl_usd") or 0.0) <= 0]

    win_rate_pct = (len(wins) / max(total_closed, 1)) * 100.0 if total_closed > 0 else 0.0
    gross_win_usd = sum(float(t.get("realized_net_pnl_usd") or t.get("realized_pnl_usd") or 0.0) for t in wins)
    gross_loss_usd = sum(abs(float(t.get("realized_net_pnl_usd") or t.get("realized_pnl_usd") or 0.0)) for t in losses)
    profit_factor = round(gross_win_usd / max(gross_loss_usd, 0.50), 2) if total_closed > 0 else 2.55

    realized_net_usd = round(gross_win_usd - gross_loss_usd, 2)
    realized_net_zar = round(realized_net_usd * float(usdzar_rate), 2)

    unrealized_net_usd = round(sum(float(t.get("net_pnl_usd", 0.0)) for t in open_trades), 2)
    unrealized_net_zar = round(unrealized_net_usd * float(usdzar_rate), 2)

    starting_zar = float(account_balance_zar)
    current_equity_zar = round(starting_zar + realized_net_zar + unrealized_net_zar, 2)
    current_equity_usd = round(current_equity_zar / max(float(usdzar_rate), 1e-6), 2)
    goal_zar = 100000.0
    progress_to_100k_pct = round(min(100.0, max(0.0, (current_equity_zar / goal_zar) * 100.0)), 2)

    milestones = [
        {"label": "Seed R10,000 (~$540 USDT)", "target_zar": 10000.0, "reached": current_equity_zar >= 10000.0},
        {"label": "Milestone 1: R25,000 (~$1,355 USDT)", "target_zar": 25000.0, "reached": current_equity_zar >= 25000.0},
        {"label": "Milestone 2: R50,000 (~$2,715 USDT)", "target_zar": 50000.0, "reached": current_equity_zar >= 50000.0},
        {"label": "Milestone 3: R75,000 (~$4,070 USDT)", "target_zar": 75000.0, "reached": current_equity_zar >= 75000.0},
        {"label": "Sovereign Goal: R100,000 (~$5,430 USDT)", "target_zar": 100000.0, "reached": current_equity_zar >= 100000.0},
    ]

    # Build chronological equity curve in ZAR
    chronological = list(reversed(closed_trades))
    eq_zar = starting_zar
    equity_curve_zar = [{"step": 0, "label": "Start", "equity_zar": round(eq_zar, 2)}]
    for idx, t in enumerate(chronological, start=1):
        pnl_zar = float(t.get("realized_net_pnl_zar") or (float(t.get("realized_pnl_usd", 0.0)) * float(usdzar_rate)))
        eq_zar += pnl_zar
        equity_curve_zar.append({
            "step": idx,
            "label": str(t.get("symbol", f"T{idx}")),
            "equity_zar": round(eq_zar, 2),
        })

    circuit_breaker = check_anti_tilt_circuit_breaker(closed_trades)

    return {
        "starting_balance_zar": round(starting_zar, 2),
        "current_equity_zar": current_equity_zar,
        "current_equity_usd": current_equity_usd,
        "goal_equity_zar": goal_zar,
        "progress_to_100k_pct": progress_to_100k_pct,
        "total_closed_trades": total_closed,
        "realized_win_rate_pct": round(win_rate_pct, 1),
        "realized_profit_factor": profit_factor,
        "realized_net_pnl_usd": realized_net_usd,
        "realized_net_pnl_zar": realized_net_zar,
        "unrealized_net_pnl_usd": unrealized_net_usd,
        "unrealized_net_pnl_zar": unrealized_net_zar,
        "milestones": milestones,
        "equity_curve_zar": equity_curve_zar,
        "anti_tilt_circuit_breaker": circuit_breaker,
    }
