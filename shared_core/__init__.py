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
    compute_vpin_toxicity,
    evaluate_limit_dip_adverse_fill,
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
from .oms_engine import (
    OrderState,
    OrderRecord,
    OMSStateMachine,
    get_wal_sqlite_connection,
    ensure_oms_tables,
    generate_client_order_id,
    validate_pre_trade_risk,
    execute_crypto_ccxt_bracket_order,
    execute_ibkr_bracket_order,
    execute_jse_ibkr_or_webhook_bracket_order,
    run_oms_reconciliation_and_watchdog_loop,
    fetch_live_crypto_l1_l2_and_ohlcv,
    fetch_live_us_alpaca_quote_and_bars,
    get_cached_live_quote,
    is_live_trading_enabled,
    get_postgres_connection,
    acquire_row_level_lock,
    start_ccxt_pro_websocket_stream,
)
from .telegram_coach import (
    should_dispatch_buy_alert,
    evaluate_active_trade_stages,
    dispatch_active_trades_coach_alerts,
    build_buy_alert_inline_keyboard,
    build_active_trade_inline_keyboard,
    sign_callback_data,
    verify_and_parse_callback_data,
    handle_telegram_callback_query,
    send_telegram_with_markup_sync,
)
from .institutional_quant import (
    ledoit_wolf_shrinkage,
    oas_shrinkage,
    compute_cross_asset_cvar_and_beta,
    compute_almgren_chriss_execution_plan,
    evaluate_cpcv_dsr_gatekeeper,
    get_global_kill_switch_state,
)
from .unified_bus import (
    GLOBAL_DB_POOL,
    SHM_BUS,
    BUS,
    publish_ipc_event_nonblocking,
)

__all__ = [
    "gerber_covariance",
    "detone_covariance",
    "hrp_detoned_allocation",
    "deflated_sharpe_ratio",
    "conditional_drawdown_at_risk",
    "ulcer_index",
    "ledoit_wolf_shrinkage",
    "oas_shrinkage",
    "compute_cross_asset_cvar_and_beta",
    "compute_almgren_chriss_execution_plan",
    "evaluate_cpcv_dsr_gatekeeper",
    "get_global_kill_switch_state",
    "GLOBAL_DB_POOL",
    "SHM_BUS",
    "BUS",
    "publish_ipc_event_nonblocking",
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
    "OrderState",
    "OrderRecord",
    "OMSStateMachine",
    "get_wal_sqlite_connection",
    "ensure_oms_tables",
    "generate_client_order_id",
    "validate_pre_trade_risk",
    "execute_crypto_ccxt_bracket_order",
    "execute_jse_ibkr_or_webhook_order" if False else "execute_jse_ibkr_or_webhook_bracket_order",
    "run_oms_reconciliation_and_watchdog_loop",
    "fetch_live_crypto_l1_l2_and_ohlcv",
    "fetch_live_us_alpaca_quote_and_bars",
    "get_cached_live_quote",
    "is_live_trading_enabled",
]
