export type JseSector =
  | "TECH_TENCENT"
  | "RAND_HEDGE"
  | "PRECIOUS_MINER"
  | "COMMODITY_MINER"
  | "SA_INC_FIN"
  | "SA_INC_RETAIL"
  | "JSE_ETF_TFSA"
  | "JSE_CUSTOM";

export type FeeProfileKey =
  | "EASYEQUITIES_ZAR"
  | "EASYEQUITIES_TFSA"
  | "INSTITUTIONAL_DMA_ZAR";

export type SignalTier =
  | "PRIME_ALPHA"
  | "OFFSHORE_ARB_ALPHA"
  | "PEAD_SENS_ALPHA"
  | "SECONDARY_QUANT"
  | "WATCHLIST_WAIT";

export type OffshoreArbSignal =
  | "OFFSHORE_DISCOUNT_BUY"
  | "TENCENT_CATCHUP_BUY"
  | "OFFSHORE_PREMIUM_CAUTION"
  | "PARITY_NEUTRAL";

export type SensCatalystBadge =
  | "POSITIVE_TRADING_STATEMENT"
  | "DIVIDEND_BUYBACK_CATALYST"
  | "NEGATIVE_SENS_WARNING"
  | "EARNINGS_LOCKOUT_72H"
  | "NEUTRAL_SENS";

export type PeadSensStatus = "PEAD_SENS_IGNITION" | "NONE";

export type MtfStatusBadge =
  | "3/3 FULL FRACTAL ALIGNMENT"
  | "2/3 PARTIAL ALIGNMENT"
  | "TIMEFRAME CONFLICT — WAIT";

export type IntradayTimingStatus =
  | "BUY_NOW_ORB_IGNITION"
  | "BUY_AT_VWAP_SUPPORT"
  | "WAIT_INTRADAY_PULLBACK"
  | "HOLD_OFF_FALLING_KNIFE"
  | "CLOSING_AUCTION_GUARD";

export type RrgQuadrant = "LEADING" | "IMPROVING" | "WEAKENING" | "LAGGING";

export type MarkovRegimeState =
  | "BULL_LOW_VOL"
  | "BULL_HIGH_VOL"
  | "MEAN_REVERTING_RANGE"
  | "BEAR_LIQUIDITY_STRESS";

export interface SensHeadlineItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  isHepsStatement: boolean;
}

export interface OhlcvCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  avwap52wHigh: number;
  avwap60dLow: number;
  avwapVolShock: number;
}

export interface MonteCarloFanPoint {
  day: number;
  p05: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface AnalystAgentVote {
  agentId:
    | "technical_microstructure_analyst"
    | "sens_sentiment_analyst"
    | "fundamental_offshore_sotp_analyst"
    | "macro_commodity_sarb_analyst";
  agentName: string;
  score: number;
  weight: number;
  stance: "BULLISH" | "NEUTRAL" | "BEARISH";
  rationale: string;
  keyMetrics: string[];
}

export interface DebateRound {
  round: number;
  bullArgument: string;
  bearCounter: string;
  crossExamVerdict: string;
}

export interface RiskCommitteeVote {
  persona: "Risky" | "Neutral" | "Safe";
  recommendedKellyFraction: number;
  recommendedCapitalZar: number;
  verdict: string;
}

export interface AplusChecklistItem {
  gate_num: number;
  name: string;
  passed: boolean;
  actual_value: string;
  threshold_text: string;
  plain_english: string;
}

export interface JseOpportunity {
  ticker: string;
  name: string;
  sector: JseSector;
  twinTicker: string | null;
  offshoreTicker: string | null;
  offshoreCurrency: string | null;
  sttExempt: boolean;
  isTop40: boolean;

  // Live Normalized R ZAR Price & Intraday
  priceZar: number;
  price_zar?: number;
  entry_price?: number;
  change1dPct: number;
  change5dPct: number;
  change20dPct: number;
  atr14Zar: number;
  atr_14?: number;
  atrPct: number;
  volumeToday: number;
  avgVolume20d: number;
  rvol: number;

  // V10.1 Smart Hybrid Structural Stop & 3-Plan Entry Calculator (Plan A, B, C)
  entryPriceZar: number;
  stopLossZar: number;
  stop_loss?: number;
  hybrid_structural_stop?: number;
  hybridStructuralStop?: number;
  stop_type_badge?: string;
  stopTypeBadge?: string;
  targetPriceZar: number;
  target_price?: number;
  targetGrossPct: number;
  targetNetPct: number;
  target_net_pct?: number;
  roundTripFrictionPct: number;
  round_trip_friction_pct?: number;
  netRrRatio: number;
  net_rr_market?: number;
  netRrMarket?: number;
  limit_dip_entry_price?: number;
  limitDipEntryPrice?: number;
  net_rr_limit_dip?: number;
  netRrLimitDip?: number;
  limit_fill_prob_pct?: number;
  limitFillProbPct?: number;
  blended_entry_price?: number;
  blendedEntryPrice?: number;
  blended_net_rr?: number;
  blendedNetRr?: number;
  days_to_earnings?: number | null;
  earnings_warning_badge?: string | null;
  earningsWarningBadge?: string | null;
  tfsa_badge?: string | null;
  tfsaBadge?: string | null;

  conformalP05Zar: number;
  conformalP95Zar: number;

  // Multi-Timeframe (1D + 1H + 15m) Fractal Confluence
  mtfAlignmentScore: number;
  mtfStatusBadge: MtfStatusBadge;
  tf1dBullish: boolean;
  tf1hBullish: boolean;
  tf15mBullish: boolean;

  // 3 Anchored VWAPs & 60d Volume Profile
  avwap52wHighZar: number;
  avwapSwingLow60dZar: number;
  avwapVolShock60dZar: number;
  vpocPriceZar: number;
  vahPriceZar: number;
  valPriceZar: number;
  inLowVolumeAirPocket: boolean;

  // Intraday 15m Timing & 09:00-09:30 SAST ORB
  intradayTimingStatus: IntradayTimingStatus;
  sessionVwap15mZar: number;
  orbHighZar: number;
  orbLowZar: number;
  suggestedIntradayLimitZar: number;
  rrgQuadrant: RrgQuadrant;
  rsRating1to99: number;

  // Dual-Listed Offshore Arbitrage & Tencent SOTP
  offshorePriceNative: number | null;
  offshoreParityZar: number | null;
  impliedRatio20d: number | null;
  offshoreArbSpreadPct: number;
  offshoreArbZscore: number;
  offshoreArbSignal: OffshoreArbSignal;
  tencentLeadGapPct: number | null;
  sotpDiscountZscore: number | null;

  // JSE SENS & PEAD Ignition
  sensSentimentScore: number;
  sensCatalystBadge: SensCatalystBadge;
  peadSensStatus: PeadSensStatus;
  peadShockDaysAgo: number | null;
  peadShockReturnPct: number | null;
  sensHeadlines: SensHeadlineItem[];

  // QuantGuild & Marcos López de Prado Stack
  ouTheta: number;
  ouMuZar: number;
  ouHalfLifeDays: number;
  ouZscore: number;
  harRvDailyVolPct: number;
  garchCondVolPct: number;
  mertonJumpIntensity: number;
  markovState: MarkovRegimeState;
  markovTransitionMatrix: number[][];
  markov5dSurvivalProb: number;
  fracDiffStationaryScore: number;
  cusumSignal: "BULL_BREAK" | "BEAR_BREAK" | "NEUTRAL";
  wassersteinRegimeDist: number;
  varianceRatioVr5: number;
  hurstExponent: number;
  shannonEntropyNorm: number;
  vpinToxicity: number;
  hawkesIntensity: number;
  corwinSchultzSpreadPct: number;
  amihudIlliquidity: number;
  almgrenChrissImpactPct: number;
  yangZhangVolAnnualPct: number;

  // 2D Kalman Filter Twin Pair
  kalmanHedgeRatio: number;
  kalmanSpreadZscore: number;
  adfPValue: number;
  pairArbitrageSignal: string;

  // 5-Year Causal Walk-Forward Backtester
  backtestSampleSize: number;
  sampleUniquenessWeight: number;
  backtestWinRate: number;
  regimeConditionedWinRate: number;
  regimeConditionedExpectancyPct: number;
  profitFactor: number;
  sharpeRatio: number;
  probabilisticSharpePsr: number;
  deflatedSharpeDsr: number;
  brierCalibrationScore: number;
  empiricalBayesWinProb: number;
  equityCurvePoints: { day: string; equity: number }[];
  mc_p50?: number;
  barrier_hit_prob_pct?: number;

  // TradingAgents Multi-Agent Consensus
  signalTier: SignalTier;
  finalConvictionScore: number;
  bull_score?: number;
  bear_score?: number;
  redTeamKillProb: number;
  red_team_kill_prob_pct?: number;
  redTeamPreMortem: string;
  executiveSummary: string;
  analystVotes: AnalystAgentVote[];
  debateRounds: DebateRound[];
  riskCommittee: RiskCommitteeVote[];
  kelly_pct?: number;
  kellyPct?: number;
  halfKellyWeightPct?: number;
  recommendedShares: number;
  recommendedCapitalZar: number;

  // Upgrade 3, 4 & 8: 12-Gate A+ Sniper Checklist, Simple Verdict & Portfolio Correlation Guard
  aplus_gates_passed?: number;
  aplusGatesPassed?: number;
  aplus_checklist_items?: AplusChecklistItem[];
  aplusChecklistItems?: AplusChecklistItem[];
  verdict_tier?: string;
  verdictTier?: string;
  verdict_label?: string;
  verdictLabel?: string;
  traffic_light_verdict?: string;
  trafficLightVerdict?: string;
  verdict_color?: "GREEN" | "YELLOW" | "RED";
  verdictColor?: "GREEN" | "YELLOW" | "RED";
  why_ai_loves_bullets?: string[];
  whyAiLovesBullets?: string[];
  max_portfolio_corr?: number | null;
  portfolio_corr_rho?: number | null;
  portfolioCorrRho?: number | null;
  portfolio_corr_ticker?: string | null;
  portfolio_corr_badge?: string | null;
  portfolioCorrBadge?: string | null;

  // Chart Series
  candles90d: OhlcvCandle[];
  monteCarloFan: MonteCarloFanPoint[];

  // V12.0 + V12.1 + V12.2 Sovereign Apex 95% Finale Fields
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
  weight_pct?: number;
  role?: string;
  ticker?: string;
  name?: string;
  sector?: string;
  allocation_zar?: number;
  shares?: number;
  entry_price?: number;
  limit_dip_entry_price?: number;
  blended_entry_price?: number;
  stop_loss?: number;
  target_price?: number;
  target_net_pct?: number;
  net_rr_market?: number;
  net_rr_limit_dip?: number;
  expected_net_win_zar?: number;
  max_risk_zar?: number;
  aplus_gates_passed?: number;
  tfsa_badge?: string | null;
  description?: string;
}

export interface BarbellPlan {
  account_balance_zar?: number;
  pair_correlation_rho?: number;
  total_expected_net_win_zar?: number;
  total_max_risk_zar?: number;
  slot_1_anchor?: BarbellSlot;
  slot_2_catalyst?: BarbellSlot;
  slot_3_reserve?: BarbellSlot;
  slot1_anchor?: BarbellSlot;
  slot2_catalyst?: BarbellSlot;
  slot3_dry_powder?: BarbellSlot;
}

export type BarbellPlanHero = BarbellPlan;

export interface MacroCalendarEvent {
  title: string;
  country: "USD" | "ZAR" | "EUR" | "GBP" | "CNY";
  date: string;
  impact: "High" | "Medium" | "Low";
  forecast: string;
  previous: string;
}

export interface MacroCommoditySnapshot {
  usdzar: number;
  usdzar_rate?: number;
  usdzarChange1dPct: number;
  usdzarZscore20d: number;
  usdzar_zscore?: number;
  usdzar_ou_halflife?: number;
  usdzarOuHalflife?: number;
  usdzar_regime_badge?: string;
  usdzarRegimeBadge?: string;
  gbpzar: number;
  gbpzarChange1dPct: number;
  eurzar: number;
  eurzarChange1dPct: number;
  chfzar: number;
  hkdzar: number;
  goldZarPerOz: number;
  goldChange1dPct: number;
  platinumZarPerOz: number;
  platinumChange1dPct: number;
  palladiumZarPerOz: number;
  palladiumChange1dPct: number;
  brentZarPerBbl: number;
  brentChange1dPct: number;
  copperUsd: number;
  copperChange1dPct: number;
  vix: number;
  esFuturesChangePct: number;
  nqFuturesChangePct: number;
  tencentHkdPrice: number;
  tencentChange1dPct: number;
  tencentChange5dPct: number;
  globalFuturesShieldActive: boolean;
  macroLockoutWarning: boolean;
  nextRedFolderEvent: string;
  jseMacroRegime:
    | "STRONG_RAND_SA_INC_BULL"
    | "RAND_HEDGE_COMMODITY_BULL"
    | "GLOBAL_RISK_OFF_DEFENSIVE";
  sarbRepoRatePct: number;
  saCpiYoYPct: number;
  jseSessionStatus: "OPEN_CONTINUOUS" | "CLOSING_AUCTION_TALX" | "AFTER_HOURS_CLOSED";
  sastTimeFormatted: string;
  minutesToTalxAuction: number;
  calendarEvents: MacroCalendarEvent[];
}

export interface CoachedTrade {
  id: number;
  ticker: string;
  name: string;
  sector: string;
  tradeMode: "REAL_BROKER_TRADE" | "PAPER_WALLET_TRADE";
  feeProfile: FeeProfileKey;
  status: "OPEN" | "CLOSED";
  shares: number;
  initialShares: number;
  entryPriceZar: number;
  entry_be_zar?: number;
  entryBeZar?: number;
  feeAdjustedBreakevenZar?: number;
  currentPriceZar: number;
  highestPriceZar: number;
  stopLossZar: number;
  targetPriceZar: number;
  targetNetPct: number;
  targetGrossPct: number;
  investedCapitalZar: number;
  currentValueZar: number;
  grossPnlZar: number;
  grossPnlPct: number;
  netPnlZar: number;
  netPnlPct: number;
  realizedPnlZar: number;
  realized_net_pnl_zar?: number;
  realized_net_pnl_pct?: number;
  exitPriceZar: number | null;
  exit_price?: number | null;
  close_reason?: string;
  closeReason?: string;
  openedAt: string;
  closedAt: string | null;
  daysHeld: number;
  notes: string;
  scaleOut25Done: boolean;
  scaleOut50Done: boolean;
  // 7-Stage Coach + V10.1 Stage 4.5 & Stage 7+ fields
  coachStage: number;
  coachStageLabel: string;
  coachActionBadge: string;
  coachInstruction: string;
  coachUrgency: "CRITICAL" | "ACTION" | "HOLD" | "TARGET_HIT";
  chandelierTrailingStopZar: number;
  chandelierStopZar?: number;
  progressToTargetPct: number;
  stage_4_5_whale_banner?: string | null;
  stage45WhaleBanner?: string | null;
  whaleEarlyHarvestBanner?: string | null;
  stage_7_plus_runner_banner?: string | null;
  stage7PlusRunnerBanner?: string | null;
  parabolicRunnerBanner?: string | null;
  dead_money_swap_alert?: string | null;
  deadMoneySwapAlert?: string | null;
  opportunityCostSwapBanner?: string | null;
  // V12.0 3-Tier Profit Ladder & Partial Close Tracking
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

export interface MilestoneStep {
  label: string;
  target_zar?: number;
  targetZar?: number;
  reached: boolean;
  progressPct?: number;
}

export interface CompoundingRoadmapState {
  startingCapitalZar: number;
  currentCapitalZar: number;
  targetMilestoneZar: number;
  overallTargetZar: number;
  closedTradeCount: number;
  realizedWinRatePct: number;
  realizedProfitFactor: number;
  netRealizedProfitZar: number;
  antiTiltShieldActive: boolean;
  antiTiltBadge: string;
  milestones: MilestoneStep[];
}

export interface PortfolioAnalytics {
  circuitBreakerStatus: "NORMAL_RISK_MODE" | "HALF_RISK_RECOVERY_MODE";
  circuitBreakerReason: string;
  anti_tilt_active?: boolean;
  antiTiltActive?: boolean;
  anti_tilt_badge?: string;
  antiTiltBadge?: string;
  compoundingRoadmap?: CompoundingRoadmapState;
  rolling7dDrawdownPct: number;
  consecutiveLosses: number;
  closedTradesCount: number;
  closedWinRatePct: number;
  closedProfitFactor: number;
  totalNetRealizedPnlZar: number;
  totalOpenUnrealizedNetPnlZar: number;
  current_compounded_balance_zar?: number;
  currentCompoundedBalanceZar?: number;
  progress_to_100k_pct?: number;
  progressTo100kPct?: number;
  milestones?: MilestoneStep[];
  correlationClusterWarning: boolean;
  correlatedPairDetails: string | null;
  tailHedgeRecommendation: {
    instrument: "GLD.JO" | "STXNDQ.JO";
    hedgeRatioPct: number;
    recommendedHedgeZar: number;
    recommendedShares: number;
    reason: string;
  };
  shadowGraderStats: {
    totalLogged: number;
    totalGraded: number;
    winRatePct: number;
    weights: {
      technicalMicrostructure: number;
      sensSentiment: number;
      fundamentalOffshoreSotp: number;
      macroCommoditySarb: number;
    };
  };
}

export interface PaperWalletState {
  cashBalanceZar: number;
  openEquityZar: number;
  totalPortfolioValueZar: number;
  initialCapitalZar: number;
  selectedFeeProfile: FeeProfileKey;
}

export interface AlertSettingsState {
  macosDesktopEnabled: boolean;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  morningBriefingEnabled?: boolean;
  preopenBriefing0845SastEnabled?: boolean;
  discordEnabled: boolean;
  discordWebhookUrl: string;
  alertOnPrimeAlpha: boolean;
  alertOnOffshoreArb: boolean;
  alertOnSensPead: boolean;
  alertOnCoachStages: boolean;
}

export interface CustomWatchlistItem {
  id?: number;
  ticker?: string;
  symbol?: string;
  name: string;
  sector: string;
  stt_exempt?: number;
  ref_price_zar?: number;
  added_at?: string;
}

export interface FullTerminalState {
  scanProgressPct: number;
  lastScanTimestamp: string;
  dataSourceStatus: string;
  usdzar_rate?: number;
  usdzar_zscore?: number;
  usdzar_ou_halflife?: number;
  usdzar_regime_badge?: string;
  barbell_plan?: BarbellPlan;
  barbellPlan?: BarbellPlan;
  macro: MacroCommoditySnapshot;
  opportunities: JseOpportunity[];
  activeTrades: CoachedTrade[];
  closedTrades: CoachedTrade[];
  portfolioAnalytics: PortfolioAnalytics;
  watchlist?: CustomWatchlistItem[];
  customWatchlist?: CustomWatchlistItem[];
  wallet: PaperWalletState;
  alertSettings: AlertSettingsState;
  session_status?: SessionStatusState;
  capital_ledger?: CapitalLedgerState;
}
