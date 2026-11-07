"""
Shared Institutional Quantitative, Econometric & Execution Core
(Integrated from skfolio, arch, MAPIE, TradingAgents, nautilus_trader, awesome-systematic-trading, Kronos, PySR)
"""

from .risk_and_portfolio import (
    gerber_covariance,
    detone_covariance,
    hrp_detoned_allocation,
    deflated_sharpe_ratio,
    conditional_drawdown_at_risk,
    ulcer_index,
)
from .econometrics import (
    fit_garch11,
    newey_west_hac,
    model_confidence_set,
)
from .conformal import (
    AdaptiveConformalInference,
    OnlineMartingaleAuditor,
    compute_conformal_price_envelope,
)
from .trading_memory import (
    TradingMemoryLog,
)
from .microstructure import (
    compute_corwin_schultz_spread,
    compute_amihud_illiquidity,
    BookSyncTracker,
)
from .systematic_factors import (
    compute_residual_momentum,
    compute_52w_high_proximity,
    compute_short_term_reversal,
)
from .symbolic_rules import (
    compute_pysr_sovereign_score,
    compute_kronos_trajectory,
)

__all__ = [
    "gerber_covariance",
    "detone_covariance",
    "hrp_detoned_allocation",
    "deflated_sharpe_ratio",
    "conditional_drawdown_at_risk",
    "ulcer_index",
    "fit_garch11",
    "newey_west_hac",
    "model_confidence_set",
    "AdaptiveConformalInference",
    "OnlineMartingaleAuditor",
    "compute_conformal_price_envelope",
    "TradingMemoryLog",
    "compute_corwin_schultz_spread",
    "compute_amihud_illiquidity",
    "BookSyncTracker",
    "compute_residual_momentum",
    "compute_52w_high_proximity",
    "compute_short_term_reversal",
    "compute_pysr_sovereign_score",
    "compute_kronos_trajectory",
]
