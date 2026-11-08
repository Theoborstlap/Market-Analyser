import asyncio
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Dict, Any, List, Optional

_ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if _ROOT_DIR not in sys.path:
    sys.path.insert(0, _ROOT_DIR)

from shared_core.oms_engine import (
    OMSStateMachine,
    OrderState,
    generate_client_order_id,
    is_live_trading_enabled,
)


def _resolve_alpaca_paper_mode(explicit_paper: Optional[bool] = None) -> bool:
    env_paper = os.environ.get("ALPACA_PAPER")
    if env_paper is not None:
        return env_paper.strip().lower() not in ("0", "false", "no", "live")
    if is_live_trading_enabled():
        return False
    return True if explicit_paper is None else bool(explicit_paper)


async def submit_alpaca_bracket_order(
    symbol: str,
    qty: float,
    take_profit_price: float,
    stop_loss_price: float,
    api_key: str,
    secret_key: str,
    paper_mode: Optional[bool] = None,
    side: str = "buy",
    limit_price: Optional[float] = None,
    adv_shares: Optional[float] = None,
    client_order_id: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Submits a native Alpaca OCO Bracket Order using limit/post-only entry
    (or TWAP child slicing when qty > 0.5% ADV). Never swallows exceptions silently.
    """
    resolved_paper = _resolve_alpaca_paper_mode(paper_mode)
    url = (
        "https://paper-api.alpaca.markets/v2/orders"
        if resolved_paper
        else "https://api.alpaca.markets/v2/orders"
    )
    resolved_key = (
        api_key
        or os.environ.get("ALPACA_API_KEY", "")
        or os.environ.get("APCA_API_KEY_ID", "")
    ).strip()
    resolved_secret = (
        secret_key
        or os.environ.get("ALPACA_SECRET_KEY", "")
        or os.environ.get("APCA_API_SECRET_KEY", "")
    ).strip()

    clean_symbol = symbol.upper().strip()
    clean_side = side.lower().strip()
    entry_limit = round(
        float(limit_price)
        if (limit_price is not None and float(limit_price) > 0)
        else round((float(take_profit_price) + float(stop_loss_price)) / 2.0, 2),
        2,
    )

    rec = OMSStateMachine.register_order(
        market="US",
        symbol=clean_symbol,
        side=clean_side.upper(),
        qty=float(qty),
        order_type="LIMIT_BRACKET",
        limit_price=entry_limit,
        stop_loss=float(stop_loss_price),
        take_profit=float(take_profit_price),
        client_order_id=client_order_id,
        db_path=db_path,
    )

    if not resolved_key or not resolved_secret:
        use_ibkr = os.environ.get("USE_IBKR_FOR_US", "").strip().lower() in ("1", "true", "yes") or bool(os.environ.get("IBKR_HOST"))
        if use_ibkr:
            from shared_core.oms_engine import execute_ibkr_bracket_order

            return execute_ibkr_bracket_order(
                market="US",
                ticker=clean_symbol,
                side=clean_side,
                shares=qty,
                limit_price=entry_limit,
                stop_loss=float(stop_loss_price),
                take_profit=float(take_profit_price),
                currency="USD",
                exchange="SMART",
                client_order_id=client_order_id,
                db_path=db_path,
            )

        OMSStateMachine.transition(
            rec.client_order_id,
            OrderState.REJECTED,
            reason="MISSING_ALPACA_API_CREDENTIALS",
            db_path=db_path,
        )
        raise RuntimeError(
            f"Alpaca credentials missing for {clean_symbol} (paper_mode={resolved_paper}). Order rejected."
        )

    # Determine if TWAP slicing is required (order > 0.5% of ADV)
    slices: int = 1
    if adv_shares is not None and float(adv_shares) > 0:
        if float(qty) > 0.005 * float(adv_shares):
            slices = min(5, max(2, int(round(float(qty) / (0.0025 * float(adv_shares))))))

    slice_qty = round(float(qty) / slices, 4) if slices > 1 else float(qty)
    submitted_orders: List[Dict[str, Any]] = []

    try:
        for idx in range(slices):
            child_cid = rec.client_order_id if slices == 1 else f"{rec.client_order_id}-s{idx+1}"
            payload = {
                "symbol": clean_symbol,
                "qty": str(slice_qty),
                "side": clean_side,
                "type": "limit",
                "limit_price": str(entry_limit),
                "time_in_force": "day",
                "order_class": "bracket",
                "client_order_id": child_cid[:48],
                "take_profit": {"limit_price": str(round(float(take_profit_price), 2))},
                "stop_loss": {
                    "stop_price": str(round(float(stop_loss_price), 2)),
                    "limit_price": str(round(float(stop_loss_price) * (0.995 if clean_side == "buy" else 1.005), 2)),
                },
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "APCA-API-KEY-ID": resolved_key,
                    "APCA-API-SECRET-KEY": resolved_secret,
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8.0) as resp:
                if resp.status not in (200, 201):
                    raise RuntimeError(f"Alpaca HTTP {resp.status} on {clean_symbol}")
                order_resp = json.loads(resp.read().decode("utf-8"))
                submitted_orders.append(order_resp)
            if slices > 1 and idx < slices - 1:
                await asyncio.sleep(0.25)

        first_order = submitted_orders[0]
        broker_id = str(first_order.get("id") or rec.client_order_id)
        OMSStateMachine.transition(
            rec.client_order_id,
            OrderState.ACKNOWLEDGED,
            broker_order_id=broker_id,
            db_path=db_path,
        )
        return {
            "status": "submitted",
            "paper_mode": resolved_paper,
            "client_order_id": rec.client_order_id,
            "broker_order_id": broker_id,
            "twap_slices": slices,
            "order": first_order if slices == 1 else submitted_orders,
        }
    except Exception as exc:
        OMSStateMachine.transition(
            rec.client_order_id,
            OrderState.REJECTED,
            reason=f"{type(exc).__name__}:{exc}",
            db_path=db_path,
        )
        raise RuntimeError(f"Alpaca bracket order failed for {clean_symbol}: {exc}") from exc


async def submit_alpaca_paper_order(
    symbol: str,
    qty: float,
    side: str = "buy",
    order_type: str = "limit",
    limit_price: Optional[float] = None,
    stop_loss: Optional[float] = None,
    take_profit: Optional[float] = None,
    api_key: Optional[str] = None,
    secret_key: Optional[str] = None,
    adv_shares: Optional[float] = None,
    client_order_id: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    ref_p = float(limit_price) if (limit_price is not None and float(limit_price) > 0) else 100.0
    return await submit_alpaca_bracket_order(
        symbol=symbol,
        qty=qty,
        take_profit_price=take_profit or round(ref_p * 1.06, 2),
        stop_loss_price=stop_loss or round(ref_p * 0.96, 2),
        api_key=api_key or "",
        secret_key=secret_key or "",
        paper_mode=None,
        side=side,
        limit_price=ref_p,
        adv_shares=adv_shares,
        client_order_id=client_order_id,
        db_path=db_path,
    )
