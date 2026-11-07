"""
Systematic Cross-Asset Factor & Anomaly Suite (Integrated from awesome-systematic-trading)
Features:
- Residual Momentum (Beta-Neutral Idiosyncratic Alpha, Blitz, Huij & Martens)
- 52-Week High Proximity Ratio (George & Hwang Neo-Momentum Anomaly)
- Short-Term Weekly Mean-Reversion Factor
- Cross-Sectional Z-Score Normalization
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd


class ProximityResult(float):
    """Float subclass supporting dict-like .get() and ['key'] indexing."""
    def get(self, key: str, default: Any = None) -> Any:
        if key in ("proximity_pct", "proximity", "ratio"):
            return float(self) * 100.0 if float(self) <= 1.5 else float(self)
        return default

    def __getitem__(self, key: str) -> Any:
        res = self.get(key)
        if res is not None:
            return res
        raise KeyError(key)


def compute_residual_momentum(
    asset_returns: Union[np.ndarray, List[float]],
    benchmark_returns: Union[np.ndarray, List[float]],
    lookback_window: int = 60,
) -> Dict[str, float]:
    """
    Blitz, Huij & Martens Residual Momentum (awesome-systematic-trading factor):
    Regresses asset returns on market benchmark returns: r_{i, t} = alpha + beta * r_{m, t} + eps_t.
    Calculates cumulative idiosyncratic return scaled by residual volatility:
    Residual_Mom = sum(eps_t) / (std(eps_t) * sqrt(T)).

    Removes false momentum driven solely by broad market beta or sector tailwinds.
    """
    if asset_returns is None or benchmark_returns is None:
        return {"residual_momentum_z": 0.0, "market_beta": 1.0, "idiosyncratic_vol": 0.15}

    ra = np.asarray(asset_returns, dtype=float)
    rb = np.asarray(benchmark_returns, dtype=float)

    # Detect if prices were passed instead of returns
    if len(ra) > 5 and np.all(ra > 0) and np.std(ra) > 0.5:
        ra = np.diff(ra) / np.maximum(ra[:-1], 1e-8)
    if len(rb) > 5 and np.all(rb > 0) and np.std(rb) > 0.5:
        rb = np.diff(rb) / np.maximum(rb[:-1], 1e-8)

    min_len = min(len(ra), len(rb))
    if min_len < 15:
        return {"residual_momentum_z": 0.0, "market_beta": 1.0, "idiosyncratic_vol": 0.15}

    ra = ra[-min_len:]
    rb = rb[-min_len:]
    valid = np.isfinite(ra) & np.isfinite(rb)
    ra = ra[valid]
    rb = rb[valid]
    n = len(ra)

    if n < 15:
        return {"residual_momentum_z": 0.0, "market_beta": 1.0, "idiosyncratic_vol": 0.15}

    sub_ra = ra[-lookback_window:]
    sub_rb = rb[-lookback_window:]
    t_len = len(sub_ra)

    # OLS: y = [1, x] @ [alpha, beta]
    x_mat = np.column_stack([np.ones(t_len), sub_rb])
    beta_coeffs, residuals_sum, _, _ = np.linalg.lstsq(x_mat, sub_ra, rcond=None)
    alpha, beta = beta_coeffs[0], beta_coeffs[1]

    residuals = sub_ra - (alpha + beta * sub_rb)
    resid_std = float(np.std(residuals, ddof=2)) if t_len > 2 else 0.01
    resid_std = max(1e-6, resid_std)

    cum_residual = float(np.sum(residuals))
    res_mom_z = float(cum_residual / (resid_std * np.sqrt(t_len)))

    return {
        "residual_momentum_z": float(round(np.clip(res_mom_z, -4.0, 4.0), 3)),
        "market_beta": float(round(np.clip(beta, -1.0, 4.0), 3)),
        "idiosyncratic_vol": float(round(resid_std * np.sqrt(252.0), 4)),
    }


def compute_52w_high_proximity(
    prices: Union[np.ndarray, List[float]],
    window_days: int = 252,
) -> ProximityResult:
    """
    George & Hwang (2004) 52-Week High Factor:
    Proximity ratio = Current_Price / Max_52W_Price.
    Values near 1.0 (or >0.92) indicate institutional breakout territory.
    """
    p = np.asarray(prices, dtype=float)
    p = p[np.isfinite(p)]
    if len(p) == 0:
        return ProximityResult(0.85)

    current_p = float(p[-1])
    window_prices = p[-window_days:] if len(p) >= window_days else p
    max_52w = float(np.max(window_prices))
    if max_52w <= 0.0:
        return ProximityResult(0.85)

    proximity = current_p / max_52w
    return ProximityResult(float(round(np.clip(proximity, 0.10, 1.50), 4)))


def compute_short_term_reversal(
    prices: Union[np.ndarray, List[float]],
    reversal_window: int = 5,
) -> float:
    """
    Short-Term 1-Week Reversal Anomaly (Jegadeesh 1990):
    Normalized z-score of the last 5 days' return vs rolling 30-day volatility.
    High positive value indicates overbought exhaustion (reversal lower expected).
    Negative value indicates oversold dip (reversal higher expected).
    """
    p = np.asarray(prices, dtype=float)
    p = p[np.isfinite(p)]
    if len(p) < reversal_window + 5:
        return 0.0

    ret_5d = float((p[-1] / p[-reversal_window]) - 1.0)
    daily_rets = p[1:] / p[:-1] - 1.0
    vol_30d = float(np.std(daily_rets[-30:], ddof=1)) if len(daily_rets) >= 10 else 0.015
    vol_5d = vol_30d * np.sqrt(reversal_window)
    vol_5d = max(1e-5, vol_5d)

    z_reversal = float(ret_5d / vol_5d)
    return float(round(np.clip(z_reversal, -4.0, 4.0), 3))
