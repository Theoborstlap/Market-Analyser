import json
import urllib.request
from typing import Dict, Any, Optional

try:
    import httpx
except ImportError:
    httpx = None


async def submit_alpaca_bracket_order(
    symbol: str,
    qty: float,
    take_profit_price: float,
    stop_loss_price: float,
    api_key: str,
    secret_key: str,
    paper_mode: bool = True,
) -> Dict[str, Any]:
    url = (
        "https://paper-api.alpaca.markets/v2/orders"
        if paper_mode
        else "https://api.alpaca.markets/v2/orders"
    )
    payload = {
        "symbol": symbol,
        "qty": str(qty),
        "side": "buy",
        "type": "market",
        "time_in_force": "gtc",
        "order_class": "bracket",
        "take_profit": {"limit_price": str(round(take_profit_price, 2))},
        "stop_loss": {"stop_price": str(round(stop_loss_price, 2))},
    }
    if api_key and secret_key:
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "APCA-API-KEY-ID": api_key,
                    "APCA-API-SECRET-KEY": secret_key,
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8.0) as resp:
                if resp.status in (200, 201):
                    return {"status": "submitted", "order": json.loads(resp.read().decode("utf-8"))}
        except Exception:
            pass
    return {"status": "bridged_locally", "symbol": symbol, "qty": qty}


async def submit_alpaca_paper_order(
    symbol: str,
    qty: float,
    side: str = "buy",
    order_type: str = "market",
    limit_price: Optional[float] = None,
    stop_loss: Optional[float] = None,
    take_profit: Optional[float] = None,
    api_key: Optional[str] = None,
    secret_key: Optional[str] = None,
) -> Dict[str, Any]:
    return await submit_alpaca_bracket_order(
        symbol=symbol,
        qty=qty,
        take_profit_price=take_profit or (limit_price or 100.0) * 1.06,
        stop_loss_price=stop_loss or (limit_price or 100.0) * 0.96,
        api_key=api_key or "",
        secret_key=secret_key or "",
        paper_mode=True,
    )
