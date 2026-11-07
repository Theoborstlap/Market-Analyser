"""
Options levels — V13 P4 DATA TRUTH edition  (marker: P4_US_DATA_TRUTH)

No options chain is connected. What this returns:
  * call_wall / put_wall: PRICE-BASED LEVELS (spot + 3.45 ATR, spot - 2.15 ATR, rounded to a strike step).
    They are NOT real option open-interest walls. They stay because the target-cap logic needs numbers.
  * front_iv_pct: an ATR-based realised-volatility estimate (not implied volatility).
  * Gamma exposure, skew, put/call ratio, unusual volume: UNAVAILABLE (neutral values, flagged).
Earlier versions invented gamma, skew and put/call from the letters of the ticker; that is removed.
"""
import math
from typing import Dict, Any, Optional
import numpy as np


def compute_options_gex_and_skew(
    symbol: str,
    spot_price: float,
    closes_or_atr: Any = None,
    highs: Optional[np.ndarray] = None,
    lows: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    if isinstance(closes_or_atr, (int, float)):
        atr_14 = float(closes_or_atr)
    elif closes_or_atr is not None and highs is not None and lows is not None:
        closes = np.asarray(closes_or_atr, dtype=float)
        tr = np.maximum(
            highs[-15:] - lows[-15:],
            np.maximum(np.abs(highs[-15:] - closes[-16:-1]), np.abs(lows[-15:] - closes[-16:-1]))
        )
        atr_14 = float(np.mean(tr))
    else:
        atr_14 = spot_price * 0.022

    strike_step = 5.0 if spot_price >= 100.0 else (2.5 if spot_price >= 40.0 else 1.0)
    raw_call_wall = spot_price + 3.45 * atr_14
    call_wall = round(math.ceil(raw_call_wall / strike_step) * strike_step, 2)
    if call_wall <= spot_price * 1.035:
        call_wall = round(call_wall + strike_step, 2)

    raw_put_wall = spot_price - 2.15 * atr_14
    put_wall = round(math.floor(raw_put_wall / strike_step) * strike_step, 2)

    front_iv_pct = round(max(14.5, min(68.0, (atr_14 / max(spot_price, 1e-8)) * math.sqrt(252.0) * 100.0 * 1.06)), 1)
    gamma_frontrun = round(call_wall * 0.995, 2)

    return {
        "data_status": "UNAVAILABLE",
        "source": "NONE (no options chain connected)",
        "wall_source": "ATR_ESTIMATE_NOT_OPTIONS_DATA",
        "net_gex_musd": 0.0,
        "gex_regime": "UNAVAILABLE (no options feed)",
        "gamma_regime": "UNAVAILABLE (no options feed)",
        "call_wall": call_wall,
        "call_wall_strike": call_wall,
        "put_wall": put_wall,
        "put_wall_strike": put_wall,
        "gamma_front_run_cap": gamma_frontrun,
        "gamma_frontrun_price": gamma_frontrun,
        "gamma_front_run_note": (
            f"TARGET CAP (ATR-based price level, NOT real options data): ${gamma_frontrun:.2f} "
            f"(0.995x ${call_wall:.2f} ATR level)"
        ),
        "skew_25d_pct": 0.0,
        "options_25d_skew_pct": 0.0,
        "front_iv_pct": front_iv_pct,
        "iv_60d_pct": front_iv_pct,
        "iv_term_ratio": 1.0,
        "iv_term_structure_ratio": 1.0,
        "iv_term_structure": "UNAVAILABLE (no options feed)",
        "unusual_options_vol_ratio": 1.0,
        "options_pcr": 1.0,
    }
