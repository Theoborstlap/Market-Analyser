"""Pure Pass/Block Risk Guard for Trade Logging (Phase 2 — No Network, No DB Access)."""

from typing import Any, Dict, List, Optional


def check_order(
    symbol: str,
    side: str,
    amount_zar: float,
    price_status_str: str,
    account: Dict[str, Any],
    stop_price: Optional[float] = None,
    entry_price: Optional[float] = None,
    config_values: Optional[Dict[str, Any]] = None,
    orders_today: int = 0,
    duplicate_recent: bool = False,
    paused: bool = False,
) -> Dict[str, Any]:
    """
    Pure pass/block Risk Guard evaluation.
    Sells and closes always PASS.
    For buys, BLOCK with a reason for each failed rule.
    """
    clean_side = str(side or "BUY").strip().upper()
    if clean_side in ("SELL", "CLOSE", "PARTIAL_CLOSE", "SCALE_OUT"):
        return {"decision": "PASS", "reasons": []}

    cfg = config_values or {}
    min_trade_zar = float(cfg.get("CORE_MIN_TRADE_ZAR", 1000.0))
    max_pos_pct = float(cfg.get("MAX_POSITION_PCT", 25.0))
    cash_buf_pct = float(cfg.get("CASH_BUFFER_PCT", 10.0))
    max_orders_day = int(cfg.get("MAX_ORDERS_PER_DAY", 3))
    dup_win_min = int(cfg.get("DUPLICATE_ORDER_WINDOW_MIN", 10))
    max_loss_pct = float(cfg.get("MAX_LOSS_PER_TRADE_PCT", 1.0))

    reasons: List[str] = []

    if str(price_status_str or "").strip().upper() != "LIVE":
        reasons.append(f"PRICE NOT LIVE ({price_status_str or 'NO_LIVE_PRICE'})")

    amt = float(amount_zar or 0.0)
    if amt < min_trade_zar:
        reasons.append(
            f"AMOUNT BELOW MINIMUM (R{amt:,.2f} < R{min_trade_zar:,.2f} CORE_MIN_TRADE_ZAR)"
        )

    acct = account or {}
    total_val = float(
        acct.get("total_value_zar")
        if acct.get("total_value_zar") is not None
        else (acct.get("total_account_zar") or acct.get("total") or 0.0)
    )
    cash_val = float(
        acct.get("cash_zar")
        if acct.get("cash_zar") is not None
        else (acct.get("free_cash_zar") or acct.get("cash") or 0.0)
    )

    clean_sym = (symbol or "").strip().upper()
    sym_jo = clean_sym if clean_sym.endswith(".JO") else (f"{clean_sym}.JO" if clean_sym else "")
    existing_pos_zar = 0.0
    if "existing_position_zar" in acct and acct.get("existing_position_zar") is not None:
        existing_pos_zar = float(acct["existing_position_zar"])
    elif isinstance(acct.get("positions"), dict):
        pos_map = acct["positions"]
        existing_pos_zar = float(pos_map.get(clean_sym) or pos_map.get(sym_jo) or 0.0)

    if total_val <= 0.0:
        reasons.append("ACCOUNT VALUE UNKNOWN")
    else:
        pos_after_pct = ((existing_pos_zar + amt) / total_val) * 100.0
        if pos_after_pct > max_pos_pct:
            reasons.append(
                f"POSITION AFTER TRADE EXCEEDS MAX ({pos_after_pct:.1f}% > {max_pos_pct:.1f}% MAX_POSITION_PCT)"
            )

        cash_after_zar = cash_val - amt
        cash_after_pct = (cash_after_zar / total_val) * 100.0
        if cash_after_pct < cash_buf_pct:
            reasons.append(
                f"CASH AFTER TRADE BELOW BUFFER ({cash_after_pct:.1f}% < {cash_buf_pct:.1f}% CASH_BUFFER_PCT)"
            )

        if (
            stop_price is not None
            and entry_price is not None
            and float(stop_price) > 0.0
            and float(entry_price) > 0.0
        ):
            ep = float(entry_price)
            sp = float(stop_price)
            risk_zar = max(0.0, ((ep - sp) / ep) * amt)
            max_loss_zar = total_val * (max_loss_pct / 100.0)
            if risk_zar > max_loss_zar:
                reasons.append(
                    f"STOP LOSS RISK EXCEEDS {max_loss_pct:.1f}% OF ACCOUNT (R{risk_zar:,.2f} > R{max_loss_zar:,.2f})"
                )

    if int(orders_today or 0) >= max_orders_day:
        reasons.append(
            f"MAX ORDERS PER DAY REACHED ({int(orders_today)} >= {max_orders_day} MAX_ORDERS_PER_DAY)"
        )

    if bool(duplicate_recent):
        reasons.append(
            f"DUPLICATE ORDER WITHIN {dup_win_min} MINUTES FOR {clean_sym or 'SYMBOL'}"
        )

    if bool(paused):
        reasons.append("TRADING PAUSED (DRAWDOWN GUARD ACTIVE)")

    decision = "BLOCK" if len(reasons) > 0 else "PASS"
    return {"decision": decision, "reasons": reasons}
