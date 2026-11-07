"""Pure Core Portfolio View Builder (Phase 2 — No Network, No DB Access)."""

from datetime import date, datetime
from typing import Any, Callable, Dict, List, Optional

from config import fee_round_trip_pct


REFERENCE_NOTE = (
    "Backtest 2018-2026 of an equal-weight mix of these four ETFs: worst peak-to-trough fall about 16%; "
    "single ETFs 23% to 36%. Historical only, not a limit or a forecast. Source: offline backtest, not live data."
)

DISCLAIMER_NOTE = "Suggestions only. Not financial advice. Verify fees with EasyEquities before trading."


def _parse_iso_date(val: Optional[Any]) -> Optional[date]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    try:
        return date.fromisoformat(str(val)[:10])
    except Exception:
        return None


def build_core_view(
    holdings: Any,
    cash_zar: float,
    prices: Dict[str, Optional[float]],
    statuses: Dict[str, str],
    config_values: Dict[str, Any],
    last_rebalance_date: Optional[str],
    today: Any,
) -> Dict[str, Any]:
    """
    Pure Core Portfolio calculator.
    Inputs:
      - holdings: list of {symbol, shares, avg_cost_zar} or dict {symbol: {shares, avg_cost_zar}}
      - cash_zar: float cash balance in ZAR
      - prices: dict {symbol: float or None} (from LIVE frames only)
      - statuses: dict {symbol: price_status_str}
      - config_values: dict of config constants
      - last_rebalance_date: ISO date string or None
      - today: ISO date string or date
    """
    core_etfs: List[str] = list(
        config_values.get("CORE_PORTFOLIO_ETFS") or ["STX40.JO", "SYG500.JO", "STXNDQ.JO", "GLD.JO"]
    )
    risk_asset_pct = float(config_values.get("CORE_RISK_ASSET_PCT", 50.0))
    tolerance_zar = float(config_values.get("CORE_MAX_LOSS_TOLERANCE_ZAR", 1000.0))
    min_trade_zar = float(config_values.get("CORE_MIN_TRADE_ZAR", 1000.0))
    drift_band_pts = float(config_values.get("CORE_DRIFT_BAND_PTS", 5.0))
    review_days = int(config_values.get("CORE_REVIEW_DAYS", 365))
    slippage_side_pct = float(config_values.get("SLIPPAGE_PER_SIDE_PCT", 0.10))
    fee_fn: Callable[[str], float] = config_values.get("fee_round_trip_pct") or fee_round_trip_pct

    today_dt = _parse_iso_date(today) or date.today()
    as_of_str = today_dt.isoformat()

    holdings_map: Dict[str, Dict[str, Any]] = {}
    if isinstance(holdings, list):
        for h in holdings:
            if isinstance(h, dict) and h.get("symbol"):
                sym = str(h["symbol"]).strip().upper()
                holdings_map[sym] = {
                    "shares": max(0.0, float(h.get("shares") or 0.0)),
                    "avg_cost_zar": float(h["avg_cost_zar"]) if h.get("avg_cost_zar") is not None else None,
                }
    elif isinstance(holdings, dict):
        for k, v in holdings.items():
            sym = str(k).strip().upper()
            if isinstance(v, dict):
                holdings_map[sym] = {
                    "shares": max(0.0, float(v.get("shares") or 0.0)),
                    "avg_cost_zar": float(v["avg_cost_zar"]) if v.get("avg_cost_zar") is not None else None,
                }
            else:
                holdings_map[sym] = {"shares": max(0.0, float(v or 0.0)), "avg_cost_zar": None}

    cash_val = round(max(0.0, float(cash_zar or 0.0)), 2)
    n_etfs = max(1, len(core_etfs))
    target_etf_pct = round(risk_asset_pct / n_etfs, 4)
    target_cash_pct = round(100.0 - risk_asset_pct, 4)

    target_weights: Dict[str, float] = {sym: round(target_etf_pct, 2) for sym in core_etfs}
    target_weights["CASH"] = round(target_cash_pct, 2)

    priced_ok = all(
        statuses.get(sym) == "LIVE" and (prices.get(sym) is not None and float(prices.get(sym) or 0.0) > 0.0)
        for sym in core_etfs
    )

    positions: List[Dict[str, Any]] = []
    etf_values_sum = 0.0

    for sym in core_etfs:
        h_info = holdings_map.get(sym, {"shares": 0.0, "avg_cost_zar": None})
        sh = round(float(h_info.get("shares") or 0.0), 6)
        avg_cost = h_info.get("avg_cost_zar")
        st = str(statuses.get(sym) or "NO_LIVE_PRICE")
        raw_p = prices.get(sym)
        if st == "LIVE" and raw_p is not None and float(raw_p) > 0.0:
            p_zar: Optional[float] = round(float(raw_p), 2)
            val_zar: Optional[float] = round(sh * p_zar, 2)
            etf_values_sum += val_zar
        else:
            p_zar = None
            val_zar = None

        positions.append({
            "symbol": sym,
            "shares": sh,
            "avg_cost_zar": round(float(avg_cost), 2) if avg_cost is not None else None,
            "price_zar": p_zar,
            "status": st,
            "value_zar": val_zar,
            "weight_pct": None,
            "target_weight_pct": round(target_etf_pct, 2),
            "drift_pts": None,
        })

    total_value_zar: Optional[float] = round(etf_values_sum + cash_val, 2) if priced_ok else None
    risk_assets_value_zar: Optional[float] = round(etf_values_sum, 2) if priced_ok else None

    drift_pts_by_line: Dict[str, Optional[float]] = {}
    cash_weight_pct: Optional[float] = None
    cash_drift_pts: Optional[float] = None

    if priced_ok and total_value_zar is not None:
        for pos in positions:
            if total_value_zar > 0.0 and pos["value_zar"] is not None:
                w_pct = round((float(pos["value_zar"]) / total_value_zar) * 100.0, 2)
            else:
                w_pct = 0.0
            d_pts = round(w_pct - target_etf_pct, 2)
            pos["weight_pct"] = w_pct
            pos["drift_pts"] = d_pts
            drift_pts_by_line[pos["symbol"]] = d_pts

        cash_weight_pct = round((cash_val / total_value_zar) * 100.0, 2) if total_value_zar > 0.0 else 0.0
        cash_drift_pts = round(cash_weight_pct - target_cash_pct, 2)
        drift_pts_by_line["CASH"] = cash_drift_pts
    else:
        for pos in positions:
            drift_pts_by_line[pos["symbol"]] = None
        drift_pts_by_line["CASH"] = None

    last_reb_dt = _parse_iso_date(last_rebalance_date)
    days_since_rebalance: Optional[int] = (today_dt - last_reb_dt).days if last_reb_dt is not None else None
    review_due = (days_since_rebalance is None) or (days_since_rebalance > review_days)

    def _est_cost(symbol: str, amount: float) -> float:
        rt_fee = float(fee_fn(symbol))
        return round(amount * (rt_fee / 2.0 / 100.0) + amount * (slippage_side_pct / 100.0), 2)

    actions: List[Dict[str, Any]] = []
    below_minimum_legs: List[Dict[str, Any]] = []
    plan_label = "no_action_needed"
    status_str = "OK"

    if not priced_ok:
        status_str = "PRICES UNAVAILABLE - no suggestions"
        plan_label = "prices_unavailable"
    elif total_value_zar is not None and total_value_zar <= 0.0:
        plan_label = "initial deployment"
        status_str = "initial deployment"
        ref_capital = round(tolerance_zar / (0.30 * max(risk_asset_pct / 100.0, 0.01)), 2)
        for sym in core_etfs:
            target_amt = round(ref_capital * (target_etf_pct / 100.0), 2)
            actions.append({
                "symbol": sym,
                "side": "BUY",
                "amount_zar": target_amt,
                "est_cost_zar": _est_cost(sym, target_amt),
                "label": "initial deployment",
            })
    elif priced_ok and total_value_zar is not None and total_value_zar > 0.0:
        max_abs_drift = max(
            abs(float(d)) for d in drift_pts_by_line.values() if d is not None
        ) if drift_pts_by_line else 0.0
        trigger_rebalance = (max_abs_drift > drift_band_pts) or review_due

        if trigger_rebalance:
            plan_label = "rebalance"
            for pos in positions:
                sym = pos["symbol"]
                cur_v = float(pos["value_zar"] or 0.0)
                tgt_v = total_value_zar * (target_etf_pct / 100.0)
                diff_zar = round(tgt_v - cur_v, 2)
                abs_amt = round(abs(diff_zar), 2)
                if abs_amt <= 0.0:
                    continue
                side = "BUY" if diff_zar > 0 else "SELL"
                leg = {
                    "symbol": sym,
                    "side": side,
                    "amount_zar": abs_amt,
                    "est_cost_zar": _est_cost(sym, abs_amt),
                }
                if abs_amt < min_trade_zar:
                    leg["status"] = "below minimum"
                    leg["reason"] = f"Below minimum trade size (R{min_trade_zar:,.0f}); fees would outweigh the rebalance"
                    below_minimum_legs.append(leg)
                else:
                    actions.append(leg)

    stress_table: List[Dict[str, Any]] = []
    for fall_pct in (10, 20, 30, 40):
        if priced_ok and total_value_zar is not None and risk_assets_value_zar is not None:
            loss_z = round(risk_assets_value_zar * (fall_pct / 100.0), 2)
            loss_pct_tot = round((loss_z / total_value_zar) * 100.0, 2) if total_value_zar > 0.0 else 0.0
            exceeds = bool(loss_z > tolerance_zar)
        else:
            loss_z = None
            loss_pct_tot = None
            exceeds = None
        stress_table.append({
            "fall_pct": fall_pct,
            "loss_zar": loss_z,
            "loss_pct_of_total": loss_pct_tot,
            "exceeds_tolerance": exceeds,
        })

    if priced_ok and total_value_zar is not None and total_value_zar > 0.0:
        max_risk_pct_30 = round(
            min(100.0, (tolerance_zar / (0.30 * total_value_zar)) * 100.0),
            2,
        )
    else:
        max_risk_pct_30 = None

    return {
        "as_of": as_of_str,
        "priced_ok": priced_ok,
        "status": status_str,
        "plan_label": plan_label,
        "positions": positions,
        "cash": {
            "symbol": "CASH",
            "value_zar": cash_val,
            "weight_pct": cash_weight_pct,
            "target_weight_pct": round(target_cash_pct, 2),
            "drift_pts": cash_drift_pts,
        },
        "cash_weight_pct": cash_weight_pct,
        "cash_target_weight_pct": round(target_cash_pct, 2),
        "cash_drift_pts": cash_drift_pts,
        "actions_type": plan_label if plan_label not in ("no_action_needed", "prices_unavailable") else None,
        "target_weights": target_weights,
        "drift_pts": drift_pts_by_line,
        "total_value_zar": total_value_zar,
        "risk_assets_value_zar": risk_assets_value_zar,
        "cash_zar": cash_val,
        "last_rebalance_date": last_reb_dt.isoformat() if last_reb_dt else None,
        "days_since_rebalance": days_since_rebalance,
        "review_due": review_due,
        "actions": actions,
        "below_minimum": below_minimum_legs,
        "stress_table": stress_table,
        "max_loss_tolerance_zar": tolerance_zar,
        "max_risk_asset_pct_for_tolerance_at_30pct_fall": max_risk_pct_30,
        "reference_note": REFERENCE_NOTE,
        "disclaimer": DISCLAIMER_NOTE,
    }
