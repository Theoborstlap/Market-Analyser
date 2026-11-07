export type NarrativeBasketId =
  | "INSTITUTIONAL_CORE"
  | "HIGH_SPEED_L1"
  | "AI_COMPUTE"
  | "DEFI_YIELD"
  | "MEME_BETA"
  | string;

export interface NarrativeBasketRanking {
  id: NarrativeBasketId;
  narrative: string;
  shortName: string;
  rank: number;
  convictionModifierPct: number;
  avg_24h: number;
  return_24h_pct: number;
  return_7d_pct: number;
  vol_surge_ratio: number;
  topCoinSymbol: string;
  topCoinChange24h: number;
  symbols: string[];
  assetSymbols: string[];
}

export interface FeeProfile {
  id: string;
  label: string;
  buy_brokerage_pct: number;
  sell_brokerage_pct: number;
  sec_taf_settlement_pct: number;
  spread_slippage_pct: number;
  round_trip_pct: number;
  fx_funding_spread_pct: number;
  description: string;
}

export interface USDZARShield {
  usdzar_rate: number;
  usdzar_mean_60d: number;
  usdzar_zscore: number;
  usdzar_ou_halflife: number;
  usdzar_regime_badge: string;
  sa_arb_premium_pct: number;
  valr_btc_zar: number;
  luno_btc_zar: number;
}

export interface CryptoIntel {
  funding_rate_8h_pct: number;
  funding_rate_apr_pct: number;
  funding_regime: string;
  open_interest_musd: number;
  oi_change_24h_pct: number;
  coinbase_premium_pct: number;
  dvol_index: number;
  skew_25d_pct: number;
  call_wall: number;
  put_wall: number;
  gamma_front_run_cap: number;
  gamma_front_run_note: string;
  net_gex_musd: number;
  gex_regime: string;
  tvl_musd: number;
  fees_30d_musd: number;
  pf_ratio: number;
  stablecoin_7d_mint_musd: number;
  dex_buy_ratio_pct: number;
  fdv_mcap_ratio: number;
}

export interface BacktestMetrics {
  lookback_years: number;
  trading_days_tested: number;
  sample_size: number;
  effective_unique_samples: number;
  avg_uniqueness: number;
  raw_win_rate_pct: number;
  shrunk_win_rate_pct: number;
  regime_win_rate: number;
  profit_factor: number;
  annualized_sharpe: number;
  psr_pct: number;
  dsr_pct: number;
  max_drawdown_pct: number;
  brier_score: number;
  equity_curve: number[];
}

export interface SpecialistAgent {
  id: string;
  name: string;
  weight_pct: number;
  brier_score: number;
  score: number;
  stance: string;
  thesis: string;
}

export interface DebateRound {
  round: number;
  title: string;
  bull_argument: string;
  bear_argument: string;
  judge_synthesis: string;
}

export interface CrossExamRow {
  topic: string;
  bull_claim: string;
  bear_rebuttal: string;
  ruling: string;
}

export interface RiskPersona {
  persona: string;
  recommended_size_pct: number;
  mandate: string;
}

export interface AgentsReport {
  weighted_conviction_pct: number;
  bull_score: number;
  bear_score: number;
  red_team_kill_prob_pct: number;
  pre_mortem_scenarios: string[];
  specialists: SpecialistAgent[];
  debate_rounds: DebateRound[];
  cross_examination_matrix: CrossExamRow[];
  risk_committee: RiskPersona[];
  verdict: string;
}

export interface APlusGateItem {
  gate: number;
  name: string;
  passed: boolean;
  value: string;
  threshold: string;
}

export interface PlainEnglishBullet {
  title: string;
  text: string;
  tooltip: string;
}

export interface ScaledMoneyBox {
  alloc_pct: number;
  invest_usd: number;
  invest_zar: number;
  max_loss_usd: number;
  max_loss_zar: number;
  net_win_usd: number;
  net_win_zar: number;
}

export interface CryptoAssetSignal {
  symbol: string;
  yf_ticker: string;
  name: string;
  narrative: string;
  sector: string;
  exchange: string;
  twin_symbol: string;
  price: number;
  daily_change_pct: number;
  change_7d_pct: number;
  entry_price: number;
  stop_loss: number;
  hybrid_structural_stop: number;
  stop_type_badge: string;
  structural_anchor_price: number;
  structural_anchor_label: string;
  target_price: number;
  raw_target_price: number;
  atr_14: number;
  round_trip_fee_pct: number;
  gross_upside_pct: number;
  net_upside_pct: number;
  net_downside_pct: number;
  net_rr_ratio: number;
  net_rr_market: number;
  limit_dip_entry_price: number;
  net_rr_limit_dip: number;
  limit_fill_prob_pct: number;
  blended_entry_price: number;
  blended_net_rr: number;
  recommended_plan: "PLAN_A" | "PLAN_B" | "WAIT" | string;
  funding_rate_apr_pct: number;
  funding_warning_badge: string | null;
  coinbase_premium_pct: number;
  dex_buy_ratio_pct: number;
  open_interest_musd: number;
  conviction_pct: number;
  kelly_fraction_pct: number;
  recommended_safe_leverage: number;
  aplus_gates_passed: number;
  aplus_gates_total: number;
  aplus_checklist_items: APlusGateItem[];
  verdict_tier: "A_PLUS_MARKET_NOW" | "A_PLUS_LIMIT_DIP" | "WAIT_DO_NOT_BUY" | string;
  traffic_light_color: "GREEN" | "AMBER" | "RED" | string;
  traffic_light_verdict: string;
  plain_english_bullets: PlainEnglishBullet[];
  max_portfolio_corr: number;
  correlated_with_symbol: string | null;
  correlation_badge: string;
  correlation_status: string;
  money_box: ScaledMoneyBox;
  tf_15m: string;
  tf_1h: string;
  tf_1d: string;
  fractal_aligned_count: number;
  yz_vol_annual_pct: number;
  yz_daily_sigma?: number;
  ou_theta: number;
  ou_kappa: number;
  ou_halflife: number;
  ou_zscore: number;
  vpoc: number;
  vah: number;
  val: number;
  conformal_p05: number;
  conformal_p95: number;
  conformal_width_pct: number;
  mc_p10: number;
  mc_p50: number;
  mc_p90: number;
  barrier_hit_prob_pct: number;
  sample_paths: number[][];
  current_state: string;
  transition_matrix: number[][];
  n_step_probs: number[];
  bull_survival_prob_pct: number;
  markov_bull_survival: number;
  fracdiff_d04_zscore: number;
  hurst: number;
  vr5: number;
  shannon_entropy: number;
  wasserstein_1: number;
  vpin: number;
  hawkes_branching_ratio: number;
  corwin_schultz_spread_bps: number;
  amihud_illiquidity: number;
  almgren_chriss_impact_bps: number;
  twin_zscore: number;
  kalman_beta: number;
  rs_ratio: number;
  rs_momentum: number;
  rrg_quadrant: string;
  crypto_intel: CryptoIntel;
  options_intel: CryptoIntel;
  backtest: BacktestMetrics;
  agents: AgentsReport;
  sparkline_30d: number[];

  // V12.0 + V12.1 + V12.2 Sovereign Apex 95% Finale Fields
  ticker?: string;
  rvol?: number;
  intraday_rvol_pace?: number;
  data_quality_score_pct?: number;
  effective_spread_pct?: number;
  gkyz_daily_vol_pct?: number;
  optimal_entry_plan?: string;
  target_net_pct?: number;
  recommended_entry_plan?: "PLAN_A_MARKET" | "PLAN_B_LIMIT_DIP" | "PLAN_C_50_50_SPLIT" | string;
  entry_plan_reason?: string;
  ev_plan_a_pct?: number;
  ev_plan_b_pct?: number;
  ev_plan_c_pct?: number;
  plan_c_viable?: boolean;
  is_gap_exhausted?: boolean;
  vwap_distance_atr?: number;
  limit_adverse_selection_prob_pct?: number;
  limit_execution_mode?: string;
  limit_order_ttl_hours?: number;
  calibrated_win_prob_pct?: number;
  brier_skill_score?: number;
  mc_barrier_hit_prob_pct?: number;
  expected_first_passage_days?: number;
  cvar_975_pct?: number;
  bocpd_changepoint_prob_pct?: number;
  regime_run_length_days?: number;
  rough_vol_hurst?: number;
  vol_of_vol_pct?: number;
  kyle_lambda?: number;
  microstructure_toxicity_score?: number;
  tp0_price?: number;
  breakeven_lock_price?: number;
  zero_risk_shield_prob_pct?: number;
  mae_70_pct?: number;
  mae_90_pct?: number;
  mae_reserve_price?: number;
  reclaim_trigger_price?: number;
  stop_hunt_protected_sl?: number;
  bayesian_reliability_pct?: number;
  is_quarantined?: boolean;
  time_decay_scratch_hours?: number;
  tp1_price?: number;
  tp2_price?: number;
  tp3_price?: number;
  sovereign_alpha_score?: number;
  tournament_rank?: number | null;
  is_tournament_winner?: boolean;
  hrp_weight_pct?: number;
  clayton_tail_dep?: number;
  data_quality_score?: number;
  healed_ticks_count?: number;
  watchtower_missing_gate?: string | null;
  watchtower_trigger_condition?: string | null;
  is_market_open?: boolean;
  is_prime_execution_window?: boolean;
  session_phase?: string;
  session_status_label?: string;
  next_window_sast?: string;
  sast_time?: string;
  ny_time?: string;
  verdict?:
    | "12_12_TOURNAMENT_SNIPER_BUY_NOW"
    | "12_12_ARMED_LIMIT_TRAP"
    | "11_12_WATCHTOWER"
    | "WAIT"
    | string;
}

export interface BarbellSlot {
  role: string;
  weight_pct: number;
  symbol: string;
  name: string;
  sector: string;
  gates_passed: number;
  conviction_pct: number;
  plan_label: string;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  net_rr: number;
  alloc_usd: number;
  alloc_zar: number;
  shares: number;
  expected_net_win_usd: number;
  expected_net_win_zar: number;
  max_stop_risk_usd: number;
  max_stop_risk_zar: number;
}

export interface BarbellPlan {
  title: string;
  account_balance_zar: number;
  account_balance_usd: number;
  usdzar_rate: number;
  pair_correlation_rho: number;
  slot_1_safe_anchor: BarbellSlot;
  slot_2_tech_leader: BarbellSlot;
  slot_3_dry_powder: {
    role: string;
    weight_pct: number;
    alloc_usd: number;
    alloc_zar: number;
    description: string;
  };
  total_expected_net_win_usd: number;
  total_expected_net_win_zar: number;
  total_max_risk_usd: number;
  total_max_risk_zar: number;
}

export interface StageStep {
  stage: number;
  title: string;
  threshold: string;
  reached: boolean;
  active: boolean;
}

export interface DeadMoneySwapAlert {
  flagged: boolean;
  reason: string;
  swap_to_symbol: string;
  swap_net_advantage_pct: number;
  days_held: number;
}

export interface ActiveCoachedTrade {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  mode: string;
  broker_profile: string;
  entry_price: number;
  current_price: number;
  highest_price_seen?: number;
  shares: number;
  stop_loss: number;
  target_price: number;
  round_trip_fee_pct: number;
  plan_selected?: string;
  gross_pnl_pct: number;
  net_pnl_pct: number;
  net_pnl_usd: number;
  net_pnl_zar?: number;
  target_net_pct: number;
  progress_toward_target_pct: number;
  fee_adjusted_breakeven: number;
  chandelier_ratchet_stop?: number;
  recommended_stop: number;
  current_stage: number;
  stage_label: string;
  special_stage_badge?: string | null;
  stage_4_5_whale_triggered?: boolean;
  stage_7_plus_runner_unlocked?: boolean;
  days_held?: number;
  dead_money_swap_advisor?: DeadMoneySwapAlert | null;
  urgency: string;
  action_directive: string;
  stage_ladder: StageStep[];
  opened_at: string;
  tp0_price?: number;
  breakeven_lock_price?: number;
  tp1_price?: number;
  tp2_price?: number;
  tp3_price?: number;
  tp0_hit?: number;
  tp1_hit?: number;
  tp2_hit?: number;
  tp3_hit?: number;
  remaining_weight_pct?: number;
  realized_partial_pnl_zar?: number;
  selected_entry_plan?: string;
}

export interface ClosedTradeRecord {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  mode: string;
  broker_profile: string;
  entry_price: number;
  exit_price: number;
  shares: number;
  stop_loss: number;
  target_price: number;
  round_trip_fee_pct: number;
  realized_net_pnl_pct: number;
  realized_net_pnl_usd: number;
  realized_net_pnl_zar: number;
  close_reason: string;
  opened_at: string;
  closed_at: string;
}

export interface CompoundingRoadmap {
  starting_balance_zar: number;
  current_equity_zar: number;
  current_equity_usd: number;
  goal_equity_zar: number;
  progress_to_100k_pct: number;
  total_closed_trades: number;
  realized_win_rate_pct: number;
  realized_profit_factor: number;
  realized_net_pnl_usd: number;
  realized_net_pnl_zar: number;
  unrealized_net_pnl_usd: number;
  unrealized_net_pnl_zar: number;
  milestones: {
    label: string;
    target_zar: number;
    reached: boolean;
  }[];
  equity_curve_zar: {
    step: number;
    label: string;
    equity_zar: number;
  }[];
  anti_tilt_circuit_breaker: {
    triggered: boolean;
    consecutive_losses: number;
    kelly_multiplier: number;
    status_badge: string;
  };
}

export interface CustomWatchlistItem {
  symbol: string;
  name: string;
  sector: string;
  twin: string;
  added_at: string;
}

export interface MacroIntel {
  btc_price_usd: number;
  btc_change_24h_pct: number;
  eth_price_usd: number;
  eth_change_24h_pct: number;
  sol_price_usd: number;
  sol_change_24h_pct: number;
  btc_dominance_pct: number;
  altseason_index: number;
  deribit_btc_dvol: number;
  stablecoin_total_mcap_b: number;
  stablecoin_7d_mint_musd: number;
  etf_net_inflow_musd: number;
  hashrate_ribbon_status: string;
  mayer_multiple: number;
  fear_greed_index: number;
  fear_greed_label: string;
  sa_arb_premium_pct: number;
  valr_btc_zar: number;
  luno_btc_zar: number;
  funding_countdown_str: string;
  macro_shield_status: string;
  narrative_rankings?: NarrativeBasketRanking[];
  crypto_onchain_events: {
    time_sast: string;
    currency: string;
    impact: string;
    event: string;
    status: string;
  }[];
  session: {
    phase: string;
    banner_label: string;
    sniper_window_note: string;
    sast_clock: string;
    utc_clock: string;
  };
}

export interface PaperWallet {
  starting_cash_usd: number;
  cash_balance_usd: number;
  open_positions_value_usd: number;
  total_equity_usd: number;
  realized_pnl_usd: number;
  total_trades_closed: number;
  winning_trades: number;
}

export interface AlertSettings {
  telegram_bot_token: string;
  telegram_chat_id: string;
  discord_webhook_url: string;
  enabled: boolean;
}

export interface SessionStatusState {
  is_market_open: boolean;
  is_prime_execution_window: boolean;
  session_phase: string;
  session_status_label: string;
  next_window_sast: string;
  sast_time: string;
  ny_time: string;
}

export interface CapitalLedgerState {
  starting_capital_zar: number;
  realized_pnl_zar: number;
  free_cash_zar: number;
  deployed_capital_zar: number;
  total_equity_zar?: number;
}

export interface TerminalState {
  market_id?: string;
  market_name?: string;
  currency?: string;
  timestamp: string;
  fee_profile: FeeProfile;
  available_fee_profiles: FeeProfile[];
  usdzar: USDZARShield;
  account_balance_zar: number;
  account_balance_usd: number;
  macro: MacroIntel;
  narrative_rankings?: NarrativeBasketRanking[];
  barbell_plan: BarbellPlan;
  signals: CryptoAssetSignal[];
  top_signals?: CryptoAssetSignal[];
  active_trades: ActiveCoachedTrade[];
  closed_trades: ClosedTradeRecord[];
  compounding_roadmap: CompoundingRoadmap;
  custom_watchlist: CustomWatchlistItem[];
  paper_wallet: PaperWallet;
  alert_settings: AlertSettings;
  session_status?: SessionStatusState;
  capital_ledger?: CapitalLedgerState;
}

export function formatCryptoPrice(val: number | undefined | null): string {
  const v = Number(val ?? 0);
  const av = Math.abs(v);
  if (av === 0) return "0.00";
  if (av >= 100) return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (av >= 10) return v.toFixed(2);
  if (av >= 1) return v.toFixed(3);
  if (av >= 0.01) return v.toFixed(4);
  return v.toFixed(7);
}
