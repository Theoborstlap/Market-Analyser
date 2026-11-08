"""
Institutional Portfolio & Risk Management Engine (Integrated from skfolio)
Features:
- Gerber Covariance (Robust to non-synchronous microstructure noise & jump outliers)
- Detoned Covariance (PCA / Random Matrix Theory removal of dominant market mode)
- Hierarchical Risk Parity (HRP) on Detoned Covariance
- Deflated Sharpe Ratio (DSR, Bailey & López de Prado multiple-testing adjustment)
- Conditional Drawdown at Risk (CDaR) & Ulcer Index
"""

import math
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage
from scipy.spatial.distance import squareform
from scipy.stats import norm, skew, kurtosis


def gerber_covariance(
    returns: Union[np.ndarray, pd.DataFrame],
    threshold: float = 0.5,
) -> np.ndarray:
    """
    Computes the Gerber statistic covariance matrix (skfolio pattern).
    Filters out noise by evaluating co-movement only when returns exceed
    a fraction of asset standard deviation (default 0.5 * std).
    """
    if isinstance(returns, pd.DataFrame):
        rets = returns.values.astype(float)
    else:
        rets = np.asarray(returns, dtype=float)

    t, n = rets.shape
    if t < 5 or n == 0:
        return np.eye(n)

    stds = np.std(rets, axis=0, ddof=1)
    stds = np.where(stds < 1e-8, 1e-8, stds)
    thresholds = threshold * stds

    # Discretize returns: +1 (large gain), -1 (large drop), 0 (noise zone)
    u = np.zeros_like(rets)
    u[rets >= thresholds] = 1.0
    u[rets <= -thresholds] = -1.0

    gerber_corr = np.eye(n)
    for i in range(n):
        for j in range(i + 1, n):
            ui = u[:, i]
            uj = u[:, j]
            concordant = np.sum((ui == 1) & (uj == 1)) + np.sum((ui == -1) & (uj == -1))
            discordant = np.sum((ui == 1) & (uj == -1)) + np.sum((ui == -1) & (uj == 1))
            total_active = concordant + discordant
            if total_active > 0:
                corr_val = (concordant - discordant) / total_active
            else:
                # Fallback to Pearson if no joint excursions exceed threshold
                valid_mask = np.isfinite(rets[:, i]) & np.isfinite(rets[:, j])
                if np.sum(valid_mask) > 2:
                    p_corr = np.corrcoef(rets[valid_mask, i], rets[valid_mask, j])[0, 1]
                    corr_val = p_corr if np.isfinite(p_corr) else 0.0
                else:
                    corr_val = 0.0
            gerber_corr[i, j] = np.clip(corr_val, -0.999, 0.999)
            gerber_corr[j, i] = gerber_corr[i, j]

    # Convert correlation to covariance
    cov = np.outer(stds, stds) * gerber_corr

    # Positive semi-definite projection
    eigvals, eigvecs = np.linalg.eigh(cov)
    eigvals = np.maximum(eigvals, 1e-8)
    cov_psd = eigvecs @ np.diag(eigvals) @ eigvecs.T
    return (cov_psd + cov_psd.T) * 0.5


def detone_covariance(
    cov_matrix: np.ndarray,
    market_components: int = 1,
) -> np.ndarray:
    """
    Marchenko-Pastur & skfolio Detoned Covariance:
    Removes the first k dominant market eigenvalues that drive spurious co-movement
    during market stress, isolating idiosyncratic asset-to-asset diversification.
    """
    cov = np.asarray(cov_matrix, dtype=float)
    n = cov.shape[0]
    if n <= 2:
        return cov

    stds = np.sqrt(np.maximum(1e-8, np.diag(cov)))
    inv_stds = 1.0 / stds
    corr = inv_stds[:, None] * cov * inv_stds[None, :]
    corr = np.clip(corr, -1.0, 1.0)
    np.fill_diagonal(corr, 1.0)

    eigvals, eigvecs = np.linalg.eigh(corr)
    # Sort descending
    idx = np.argsort(eigvals)[::-1]
    eigvals = eigvals[idx]
    eigvecs = eigvecs[:, idx]

    # Detone: replace top market component(s) with average residual noise
    k = min(market_components, n - 1)
    if k > 0 and n > k:
        noise_mean = np.mean(eigvals[k:])
        detoned_eigvals = eigvals.copy()
        detoned_eigvals[:k] = noise_mean
    else:
        detoned_eigvals = eigvals.copy()

    detoned_eigvals = np.maximum(detoned_eigvals, 1e-7)
    detoned_corr = eigvecs @ np.diag(detoned_eigvals) @ eigvecs.T

    # Rescale diagonal to 1.0
    diag_corr = np.sqrt(np.maximum(1e-8, np.diag(detoned_corr)))
    inv_diag = 1.0 / diag_corr
    detoned_corr = inv_diag[:, None] * detoned_corr * inv_diag[None, :]
    np.fill_diagonal(detoned_corr, 1.0)

    # Convert back to covariance
    detoned_cov = stds[:, None] * detoned_corr * stds[None, :]
    return (detoned_cov + detoned_cov.T) * 0.5


def _get_quasi_diag(linkage_mat: np.ndarray) -> List[int]:
    """Sort clustered items by hierarchical linkage order."""
    num_leaves = linkage_mat.shape[0] + 1
    sort_order = [int(linkage_mat[-1, 0]), int(linkage_mat[-1, 1])]
    while True:
        expanded = []
        has_cluster = False
        for node in sort_order:
            if node >= num_leaves:
                has_cluster = True
                cluster_idx = node - num_leaves
                expanded.append(int(linkage_mat[cluster_idx, 0]))
                expanded.append(int(linkage_mat[cluster_idx, 1]))
            else:
                expanded.append(node)
        sort_order = expanded
        if not has_cluster:
            break
    return sort_order


def _get_cluster_var(cov: np.ndarray, cluster_indices: List[int]) -> float:
    """Compute variance of an equal-weighted or inverse-variance cluster."""
    sub_cov = cov[np.ix_(cluster_indices, cluster_indices)]
    inv_var = 1.0 / np.maximum(1e-8, np.diag(sub_cov))
    weights = inv_var / np.sum(inv_var)
    return float(weights @ sub_cov @ weights)


def hrp_detoned_allocation(
    cov_matrix: np.ndarray,
    asset_names: Optional[List[str]] = None,
    use_gerber: bool = False,
    returns_matrix: Optional[np.ndarray] = None,
) -> Dict[str, float]:
    """
    Hierarchical Risk Parity (HRP) on Detoned Covariance (skfolio methodology):
    1. Robust Covariance Estimation (optional Gerber + Detoning)
    2. Hierarchical Distance Clustering on Correlation
    3. Quasi-Diagonal Seriation
    4. Recursive Bisection Cluster Risk Allocation
    """
    n = cov_matrix.shape[0]
    if asset_names is None or len(asset_names) != n:
        asset_names = [f"Asset_{i}" for i in range(n)]

    if n == 1:
        return {asset_names[0]: 1.0}

    if use_gerber and returns_matrix is not None and len(returns_matrix) >= 10:
        base_cov = gerber_covariance(returns_matrix)
    else:
        base_cov = cov_matrix

    clean_cov = detone_covariance(base_cov)

    stds = np.sqrt(np.maximum(1e-8, np.diag(clean_cov)))
    inv_stds = 1.0 / stds
    corr = inv_stds[:, None] * clean_cov * inv_stds[None, :]
    corr = np.clip(corr, -1.0, 1.0)
    np.fill_diagonal(corr, 1.0)

    # Angular distance: d_ij = sqrt(0.5 * (1 - rho_ij))
    dist = np.sqrt(np.maximum(0.0, 0.5 * (1.0 - corr)))
    np.fill_diagonal(dist, 0.0)

    # Hierarchical tree
    condensed_dist = squareform(dist, checks=False)
    linkage_mat = linkage(condensed_dist, method="single")
    order = _get_quasi_diag(linkage_mat)

    # Recursive bisection
    weights = pd.Series(1.0, index=order)
    clusters = [order]
    while len(clusters) > 0:
        next_clusters = []
        for cluster in clusters:
            if len(cluster) > 1:
                mid = len(cluster) // 2
                left = cluster[:mid]
                right = cluster[mid:]
                var_left = _get_cluster_var(clean_cov, left)
                var_right = _get_cluster_var(clean_cov, right)
                total_var = var_left + var_right
                if total_var > 1e-12:
                    alpha = 1.0 - (var_left / total_var)
                else:
                    alpha = 0.5
                weights[left] *= alpha
                weights[right] *= (1.0 - alpha)
                next_clusters.append(left)
                next_clusters.append(right)
        clusters = next_clusters

    # Normalize and sort back
    alloc_weights = weights.values / np.sum(weights.values)
    result = {}
    for original_idx, alloc_w in zip(order, alloc_weights):
        result[asset_names[original_idx]] = float(round(alloc_w, 4))

    # Ensure all asset names present
    for name in asset_names:
        if name not in result:
            result[name] = 0.0

    return result


class DSRResult(float):
    """Float subclass supporting dict-like .get() and ['key'] indexing."""
    def get(self, key: str, default: Any = None) -> Any:
        if key in ("deflated_sharpe_ratio", "dsr", "dsr_prob"):
            return float(self)
        if key in ("p_value", "pval"):
            return round(1.0 - float(self), 4)
        return default

    def __getitem__(self, key: str) -> Any:
        res = self.get(key)
        if res is not None:
            return res
        raise KeyError(key)


def deflated_sharpe_ratio(
    observed_sr_or_returns: Union[float, np.ndarray, List[float]],
    returns: Optional[Union[np.ndarray, List[float]]] = None,
    num_trials: int = 10,
    target_sr: float = 0.0,
    annualization_factor: float = 252.0,
) -> DSRResult:
    """
    Deflated Sharpe Ratio (skfolio & Marcos López de Prado 2014):
    Adjusts observed annualized Sharpe ratio for:
    - Multiple hypothesis testing (number of independent trials/strategies tried)
    - Return non-normality (skewness and excess kurtosis)
    - Sample length (sample track record)
    Returns: Probability (0.0 to 1.0) that the strategy's Sharpe is truly non-zero.
    """
    if returns is None:
        rets = np.asarray(observed_sr_or_returns, dtype=float)
        mean_r = float(np.mean(rets)) if len(rets) > 0 else 0.0
        std_r = float(np.std(rets, ddof=1)) if len(rets) > 1 else 1.0
        observed_sr = (mean_r / max(1e-8, std_r)) * math.sqrt(annualization_factor)
    else:
        observed_sr = float(observed_sr_or_returns)
        rets = np.asarray(returns, dtype=float)

    rets = rets[np.isfinite(rets)]
    n = len(rets)
    if n < 10:
        return DSRResult(0.5)

    # Daily Sharpe
    mean_ret = np.mean(rets)
    std_ret = np.std(rets, ddof=1)
    if std_ret < 1e-8:
        return DSRResult(0.5)

    sr_daily = mean_ret / std_ret
    sk = float(skew(rets))
    kt = float(kurtosis(rets, fisher=True)) + 3.0  # Pearson kurtosis

    # Variance of Sharpe estimator (Lo 2002 / Mertens 2002)
    sr_var = (1.0 - sk * sr_daily + ((kt - 1.0) / 4.0) * (sr_daily ** 2)) / max(1.0, float(n - 1))
    sr_std = math.sqrt(max(1e-8, sr_var))

    # Expected maximum Sharpe under null hypothesis across `num_trials`
    # Euler-Mascheroni constant gamma ~ 0.5772156649
    gamma_const = 0.5772156649015329
    trials = max(1, num_trials)
    if trials > 1:
        z1 = norm.ppf(1.0 - (1.0 / trials))
        z2 = norm.ppf(1.0 - (1.0 / (trials * math.e)))
        expected_max_sr_daily = target_sr + sr_std * ((1.0 - gamma_const) * z1 + gamma_const * z2)
    else:
        expected_max_sr_daily = target_sr

    # Test statistic
    z_stat = (sr_daily - expected_max_sr_daily) / sr_std
    dsr = float(norm.cdf(z_stat))
    return DSRResult(float(np.clip(dsr, 0.01, 0.999)))


def conditional_drawdown_at_risk(
    prices_or_cum_returns: Union[np.ndarray, List[float]],
    alpha: float = 0.95,
) -> float:
    """
    Conditional Drawdown-at-Risk (CDaR_alpha, skfolio):
    Mean drawdown in the worst (1 - alpha)% of drawdown scenarios.
    """
    arr = np.asarray(prices_or_cum_returns, dtype=float)
    if len(arr) < 2:
        return 0.0

    # If inputs look like prices
    if np.all(arr > 0):
        peaks = np.maximum.accumulate(arr)
        drawdowns = (peaks - arr) / np.maximum(1e-8, peaks)
    else:
        # Cumulative return series starting at 0
        curve = 1.0 + arr
        peaks = np.maximum.accumulate(curve)
        drawdowns = (peaks - curve) / np.maximum(1e-8, peaks)

    drawdowns = drawdowns[drawdowns >= 0.0]
    if len(drawdowns) == 0:
        return 0.0

    cutoff = float(np.percentile(drawdowns, alpha * 100.0))
    tail_drawdowns = drawdowns[drawdowns >= cutoff]
    if len(tail_drawdowns) == 0:
        return float(cutoff * 100.0)
    return float(np.mean(tail_drawdowns) * 100.0)


def ulcer_index(prices: Union[np.ndarray, List[float]]) -> float:
    """Ulcer Index: Quadratic measure of drawdown depth and duration."""
    arr = np.asarray(prices, dtype=float)
    if len(arr) < 2:
        return 0.0
    peaks = np.maximum.accumulate(arr)
    drawdowns_pct = ((arr - peaks) / np.maximum(1e-8, peaks)) * 100.0
    return float(math.sqrt(np.mean(drawdowns_pct ** 2)))


from .institutional_quant import (
    ledoit_wolf_shrinkage,
    oas_shrinkage,
    compute_cross_asset_cvar_and_beta,
    compute_almgren_chriss_execution_plan,
    evaluate_cpcv_dsr_gatekeeper,
    get_global_kill_switch_state,
)

