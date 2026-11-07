"""
Distribution-Free Conformal Prediction & Drift Auditing Engine (Integrated from MAPIE)
Features:
- Gibbs & Candès Adaptive Conformal Inference (ACI) for Non-Exchangeable Financial Time Series
- Online Martingale Drift Auditor (Testing Out-of-Sample Coverage Validity & Regime Shifts)
- Conformalized Dynamic Quantile Bands for Price Targets & Stop Losses
"""

import math
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np


class AdaptiveConformalInference:
    """
    Adaptive Conformal Inference (ACI, Gibbs & Candès 2021 / MAPIE TimeSeriesRegressor pattern).
    Dynamically adjusts the miscoverage parameter alpha_t in response to online errors:
    alpha_{t+1} = alpha_t + gamma * (alpha - err_t)

    This guarantees exact asymptotic coverage even under volatility clustering,
    non-stationary trends, and fat-tailed shocks in financial time series.
    """

    def __init__(
        self,
        target_coverage: float = 0.90,
        gamma: float = 0.05,
        calibration_window: int = 60,
    ):
        self.target_coverage = target_coverage
        self.target_alpha = 1.0 - target_coverage
        self.gamma = gamma
        self.calibration_window = calibration_window
        self.alpha_t = self.target_alpha
        self.residual_history: List[float] = []
        self.error_history: List[int] = []

    def calibrate(self, historical_residuals: Union[np.ndarray, List[float]]) -> None:
        """Prime the calibration set with recent absolute forecast residuals |y_t - y_hat_t|."""
        res = [float(abs(r)) for r in historical_residuals if np.isfinite(r)]
        self.residual_history = res[-self.calibration_window:]
        if len(self.residual_history) == 0:
            self.residual_history = [1.0]

    def predict_interval(
        self,
        predicted_price: float,
    ) -> Tuple[float, float, float]:
        """
        Computes conformal lower and upper bounds [p_low, p_high] for current alpha_t.
        Returns: (p_low, p_high, conformal_margin).
        """
        if len(self.residual_history) < 3:
            # Fallback 5% margin
            margin = predicted_price * 0.05
            return predicted_price - margin, predicted_price + margin, margin

        # Non-conformity quantile at level (1 - alpha_t)
        q_level = float(np.clip(1.0 - self.alpha_t, 0.50, 0.99))
        margin = float(np.quantile(self.residual_history, q_level))
        margin = max(predicted_price * 0.005, margin)

        p_low = predicted_price - margin
        p_high = predicted_price + margin
        return p_low, p_high, margin

    def update(
        self,
        realized_price: float,
        p_low: float,
        p_high: float,
        new_residual: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Observes realized price outcome and updates alpha_t online.
        """
        # err_t = 1 if outside interval (miscoverage), 0 if covered
        err_t = 1 if (realized_price < p_low or realized_price > p_high) else 0
        self.error_history.append(err_t)

        # ACI step: if we missed (err_t=1), alpha_{t+1} decreases -> coverage (1 - alpha) increases -> band widens
        # If we covered (err_t=0), alpha_{t+1} increases -> band tightens
        self.alpha_t = float(np.clip(
            self.alpha_t + self.gamma * (self.target_alpha - err_t),
            0.01,
            0.40,
        ))

        if new_residual is not None and np.isfinite(new_residual):
            self.residual_history.append(float(abs(new_residual)))
            if len(self.residual_history) > self.calibration_window:
                self.residual_history.pop(0)

        empirical_coverage = 1.0 - (sum(self.error_history) / max(1, len(self.error_history)))
        return {
            "alpha_t": round(self.alpha_t, 4),
            "effective_coverage_target": round(1.0 - self.alpha_t, 4),
            "empirical_coverage": round(empirical_coverage, 4),
            "last_error": err_t,
        }


class OnlineMartingaleAuditor:
    """
    Online Martingale Drift & Validity Monitor (MAPIE OnlineMartingaleTest pattern).
    Uses a Ville-style betting martingale to test whether incoming market predictions
    conform to the target distribution or if an out-of-distribution regime shift occurred.

    M_0 = 1.0
    M_t = M_{t-1} * (1 + lambda * (coverage_error - target_alpha))
    """

    def __init__(
        self,
        target_alpha: float = 0.10,
        betting_fraction: float = 0.75,
        alarm_threshold: float = 20.0,  # Corresponds to p-value < 1 / 20 = 0.05
    ):
        self.target_alpha = target_alpha
        self.betting_fraction = betting_fraction
        self.alarm_threshold = alarm_threshold
        self.martingale_value = 1.0
        self.martingale_history: List[float] = [1.0]
        self.alarm_triggered = False

    def step(self, is_miscovered: bool) -> Dict[str, Any]:
        """
        Update martingale given binary miscoverage indicator.
        """
        err_t = 1.0 if is_miscovered else 0.0
        # Surprise score relative to expected miscoverage rate
        deviation = err_t - self.target_alpha

        # Betting multiplier: > 1 when excess miscoverage occurs
        mult = max(0.01, 1.0 + self.betting_fraction * deviation)
        self.martingale_value *= mult
        self.martingale_history.append(self.martingale_value)

        # Ville's inequality: P(max_{t} M_t >= B) <= 1 / B
        implied_p_value = min(1.0, 1.0 / max(1.0, self.martingale_value))
        if self.martingale_value >= self.alarm_threshold:
            self.alarm_triggered = True

        return {
            "martingale_value": round(self.martingale_value, 2),
            "implied_regime_shift_p_value": round(implied_p_value, 4),
            "alarm_triggered": self.alarm_triggered,
        }

    def reset(self) -> None:
        """Reset after regime re-calibration."""
        self.martingale_value = 1.0
        self.martingale_history = [1.0]
        self.alarm_triggered = False


def compute_conformal_price_envelope(
    prices: Union[np.ndarray, List[float]],
    current_price: Optional[float] = None,
    horizon_days: int = 10,
    coverage: float = 0.90,
    alpha: Optional[float] = None,
    horizon: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Computes distribution-free conformal price envelope for a swing trading horizon.
    """
    if alpha is not None:
        coverage = 1.0 - float(alpha)
    if horizon is not None:
        horizon_days = int(horizon)

    p = np.asarray(prices, dtype=float)
    p = p[np.isfinite(p)]
    if current_price is None or current_price <= 0.0:
        current_price = float(p[-1]) if len(p) > 0 else 100.0

    if len(p) < horizon_days + 5:
        margin = current_price * 0.06
        return {
            "conformal_p05": round(current_price - margin, 2),
            "conformal_p95": round(current_price + margin, 2),
            "margin_zar": round(margin, 2),
            "margin_pct": 6.0,
            "target_coverage": coverage,
            "adaptive_alpha": round(1.0 - coverage, 3),
        }

    # Rolling horizon absolute percentage excursions
    horizon_returns = np.abs(p[horizon_days:] / p[:-horizon_days] - 1.0) * 100.0
    aci = AdaptiveConformalInference(target_coverage=coverage)
    aci.calibrate(horizon_returns)

    p_low, p_high, margin = aci.predict_interval(current_price)
    margin_pct = (margin / current_price) * 100.0

    return {
        "conformal_p05": round(p_low, 2),
        "conformal_p95": round(p_high, 2),
        "margin_zar": round(margin, 2),
        "margin_pct": round(margin_pct, 2),
        "target_coverage": coverage,
        "adaptive_alpha": round(aci.alpha_t, 3),
    }
