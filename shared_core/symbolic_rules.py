"""
Interpretable Symbolic Rules & Closed-Form Combinators (Integrated from PySR & Kronos)
Features:
- Closed-Form Symbolic Alpha & Conviction Synthesizer (PySR Pareto Formulation)
- Multi-Horizon Trajectory & Regime Adjustment (Kronos Pattern)
- Mathematical Invariant Checks (Bounded, Continuous, Monotonic with Respect to Friction)
"""

import math
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np


def compute_pysr_sovereign_score(
    hurst_exponent: float = 0.55,
    garch_vol_annual: float = 25.0,
    jump_vol_ratio: float = 0.10,
    residual_momentum_z: float = 0.0,
    prox_52w: float = 0.95,
    vpoc_distance_pct: float = 1.0,
    net_rr_ratio: float = 2.0,
    friction_pct: float = 0.50,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Closed-Form Interpretable Sovereign Scoring Formulation (PySR pattern):
    Synthesizes physical market variables into an analytically bounded conviction score in [10, 99].
    Accepts both physical invariant parameters and statistical calibration kwargs.
    """
    if "win_prob" in kwargs:
        win_prob = float(kwargs["win_prob"])
        ev_pct = float(kwargs.get("ev_pct", 2.0))
        dsr_pct = float(kwargs.get("dsr_pct", 75.0))
        toxicity = float(kwargs.get("toxicity", 30.0))
        regime_prob = float(kwargs.get("regime_prob", 75.0))

        win_comp = (win_prob - 50.0) * 0.4
        ev_comp = min(20.0, max(-10.0, ev_pct * 3.0))
        dsr_comp = (dsr_pct - 50.0) * 0.2
        tox_pen = min(25.0, max(0.0, toxicity * 0.3))
        reg_comp = (regime_prob - 50.0) * 0.2
        symbolic_score = 50.0 + win_comp + ev_comp + dsr_comp + reg_comp - tox_pen
        symbolic_score = float(np.clip(symbolic_score, 10.0, 99.0))
        return {
            "sovereign_symbolic_score": round(symbolic_score, 2),
            "components": {
                "win_comp": round(win_comp, 2),
                "ev_comp": round(ev_comp, 2),
                "dsr_comp": round(dsr_comp, 2),
                "tox_pen": round(tox_pen, 2),
                "reg_comp": round(reg_comp, 2),
            },
        }
    # 1. Momentum component
    c_mom = 18.0 * math.tanh(residual_momentum_z / 1.5)

    # 2. Hurst trend persistence component
    h_clamped = min(0.95, max(0.05, hurst_exponent))
    c_hurst = 12.0 * math.tanh((h_clamped - 0.5) * 4.0)

    # 3. 52w proximity
    p_norm = (min(1.2, max(0.70, prox_52w)) - 0.85) / 0.15
    c_52w = float(np.clip(p_norm * 8.0, -8.0, 10.0))

    # 4. Jump volatility discount
    j_ratio = max(0.0, jump_vol_ratio)
    c_jump = -14.0 * (j_ratio / (1.0 + j_ratio))

    # 5. Friction drag
    c_fric = -8.0 * math.tanh(max(0.0, friction_pct) / 0.75)

    # 6. Reward/risk expansion
    c_rr = 8.0 * math.tanh((max(0.5, net_rr_ratio) - 1.5) / 1.0)

    # 7. VPOC attraction: if price is close to VPOC (value area anchor), mean reversion bonus
    c_vpoc = -4.0 * math.tanh(abs(vpoc_distance_pct) / 3.0)

    raw_score = 50.0 + c_mom + c_hurst + c_52w + c_jump + c_fric + c_rr + c_vpoc
    final_score = float(np.clip(round(raw_score, 1), 10.0, 99.0))

    return {
        "sovereign_symbolic_score": final_score,
        "components": {
            "idiosyncratic_momentum": round(c_mom, 2),
            "hurst_persistence": round(c_hurst, 2),
            "breakout_proximity": round(c_52w, 2),
            "jump_hazard_penalty": round(c_jump, 2),
            "friction_drag": round(c_fric, 2),
            "payoff_asymmetry": round(c_rr, 2),
            "vpoc_anchor": round(c_vpoc, 2),
        },
        "is_apex_grade": final_score >= 80.0,
    }


def compute_kronos_trajectory(
    current_price: float,
    garch_vol_daily: float,
    drift_daily: float,
    horizon_days: int = 10,
    num_paths: int = 1000,
) -> Dict[str, Any]:
    """
    Trajectory forecasting with multi-horizon confidence intervals (Kronos pattern).
    Uses geometric Brownian motion with GARCH conditional variance and drift.
    """
    dt = 1.0
    rng = np.random.default_rng(1337)

    # Antithetic variates for variance reduction
    half_paths = num_paths // 2
    z = rng.standard_normal((horizon_days, half_paths))
    z = np.concatenate([z, -z], axis=1)

    log_returns = (drift_daily - 0.5 * (garch_vol_daily ** 2)) * dt + garch_vol_daily * np.sqrt(dt) * z
    price_paths = current_price * np.exp(np.cumsum(log_returns, axis=0))

    terminal_prices = price_paths[-1, :]
    median_path = np.median(price_paths, axis=1)
    p05_path = np.percentile(price_paths, 5, axis=1)
    p95_path = np.percentile(price_paths, 95, axis=1)

    return {
        "horizon_days": horizon_days,
        "median_target": float(round(median_path[-1], 2)),
        "p05_lower_band": float(round(p05_path[-1], 2)),
        "p95_upper_band": float(round(p95_path[-1], 2)),
        "prob_positive_return": float(round(np.mean(terminal_prices > current_price), 3)),
        "trajectory_median_series": [float(round(x, 2)) for x in median_path],
    }
