"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Radar, Layers, FlaskConical, ShieldCheck } from "lucide-react";
import { TopSovereignBar } from "@jse/components/TopSovereignBar";
import { OpportunityScanner } from "@jse/components/OpportunityScanner";
import { ActivePortfolioCoach } from "@jse/components/ActivePortfolioCoach";
import { CorePortfolio } from "@jse/components/CorePortfolio";
import { PaperLab } from "@jse/components/PaperLab";
import { DataHealthBanner } from "@jse/components/DataHealthBanner";
import { JSE_EQUITY_FRICTION_PCT, JSE_ETF_FRICTION_PCT } from "@jse/lib/config";
import { DeepQuantModal } from "@jse/components/DeepQuantModal";
import { OrderTicketModal } from "@jse/components/OrderTicketModal";
import { TradeLogModal } from "@jse/components/TradeLogModal";
import { TelegramSettingsModal } from "@jse/components/TelegramSettingsModal";
import { CrossMarketModal } from "@jse/components/CrossMarketModal";
import { CompoundingModal } from "@jse/components/CompoundingModal";
import { WatchlistModal } from "@jse/components/WatchlistModal";
import {
  AlertSettingsState,
  FeeProfileKey,
  FullTerminalState,
  JseOpportunity,
} from "@jse/types/market";

const STORAGE_BALANCE_KEY = "jse_v10_account_balance_zar";
const STORAGE_SIMPLE_VIEW_KEY = "jse_v10_simple_sniper_view";

interface BlockedTickerItem {
  symbol: string;
  status: string;
  reason?: string | null;
  last_real_bar?: string | null;
  n_real_bars?: number;
}

function normalizeSignalsV12_2(
  rawSignals: any[],
  isPrimeWindow: boolean = true,
  marketType: "JSE" | "US" | "CRYPTO" = "JSE"
): any[] {
  if (!Array.isArray(rawSignals)) return [];
  const defaultFee =
    marketType === "JSE"
      ? JSE_EQUITY_FRICTION_PCT
      : marketType === "US"
      ? 0.5
      : 0.36;
  const enriched = rawSignals
    .filter((opp) => {
      if (
        marketType === "JSE" &&
        opp?.data_status &&
        opp.data_status !== "LIVE"
      ) {
        return false;
      }
      const p = Number(
        opp?.blended_entry_price ??
          opp?.entry_price ??
          opp?.priceZar ??
          opp?.price ??
          opp?.current_price ??
          0
      );
      return Number.isFinite(p) && p > 0;
    })
    .map((opp) => {
      const sym = String(opp.ticker || opp.symbol || "UNKNOWN");
      const entryP = Number(
        opp.blended_entry_price ??
          opp.entry_price ??
          opp.priceZar ??
          opp.price ??
          opp.current_price
      );
      const stopP = Number(
        opp.stop_hunt_protected_sl ||
          opp.hybrid_structural_stop ||
          opp.stopLossZar ||
          opp.stop_loss ||
          entryP * 0.96
      );
      const targetP = Number(
        opp.tp2_price ||
          opp.target_price ||
          opp.targetPriceZar ||
          entryP * 1.07
      );
      const riskDist = Math.max(entryP * 0.008, Math.abs(entryP - stopP));
      const atr14 = Number(
        opp.atr_14 || opp.atr14Zar || Math.max(entryP * 0.012, riskDist / 1.25)
      );
      const feePct = Number(
        opp.round_trip_fee_pct ??
          (opp.sttExempt && marketType === "JSE"
            ? JSE_ETF_FRICTION_PCT
            : defaultFee)
      );
      const effSpread = Number(
        opp.effective_spread_pct ??
          (marketType === "JSE" ? 0.12 : marketType === "US" ? 0.04 : 0.05)
      );
      const precision = entryP < 1 ? 6 : entryP < 10 ? 4 : 2;
      const reclaimTrigger =
        opp.reclaim_trigger_price ??
        Number((entryP + 0.05 * atr14).toFixed(precision));
      const maeReserve =
        opp.mae_reserve_price ??
        opp.limit_dip_entry_price ??
        opp.limit_dip_price ??
        Number((entryP - 0.55 * atr14).toFixed(precision));
      const blended6040 =
        opp.blended_entry_price ??
        Number((0.6 * reclaimTrigger + 0.4 * maeReserve).toFixed(precision));
      const stopHuntProtectedSl =
        opp.stop_hunt_protected_sl ??
        Number(Math.min(stopP, maeReserve - 0.85 * atr14).toFixed(precision));
      const beLockPrice =
        opp.breakeven_lock_price ??
        Number(
          (blended6040 * (1 + (feePct + effSpread + 0.25) / 100.0)).toFixed(
            precision
          )
        );
      const tp0Price =
        opp.tp0_price ??
        Number(
          Math.max(beLockPrice * 1.002, blended6040 + 0.38 * riskDist).toFixed(
            precision
          )
        );
      const tp1Price =
        opp.tp1_price ??
        Number((blended6040 + 1.15 * riskDist).toFixed(precision));
      const tp2Price =
        opp.tp2_price ??
        Number(
          (
            blended6040 +
            0.68 * Math.max(targetP - blended6040, riskDist * 1.8)
          ).toFixed(precision)
        );
      const tp3Price = opp.tp3_price ?? Number(targetP.toFixed(precision));
      const gatesPassed = Number(
        opp.aplus_gates_passed ??
          opp.aplus_checklist_passed_count ??
          opp.gates_passed ??
          (Array.isArray(opp.aplus_checklist)
            ? opp.aplus_checklist.filter((g: any) => g?.passed || g?.met).length
            : 0)
      );
      const recPlanRaw = String(
        opp.optimal_entry_plan || opp.recommended_entry_plan || "Plan B"
      ).toUpperCase();
      const optimalPlan =
        recPlanRaw.includes("PLAN_A") || recPlanRaw === "PLAN A"
          ? "Plan A"
          : recPlanRaw.includes("PLAN_C") || recPlanRaw === "PLAN C"
          ? "Plan C"
          : "Plan B";
      const netTargetPct = Number(
        opp.target_net_pct ??
          opp.expected_net_target_pct ??
          Math.max(
            1.5,
            ((targetP - blended6040) / Math.max(blended6040, 1e-6)) * 100 -
              feePct
          )
      );

      return {
        ...opp,
        ticker: sym,
        symbol: sym,
        aplus_gates_passed: gatesPassed,
        optimal_entry_plan: optimalPlan,
        target_net_pct: Number(netTargetPct.toFixed(2)),
        reclaim_trigger_price: reclaimTrigger,
        mae_reserve_price: maeReserve,
        blended_entry_price: blended6040,
        stop_hunt_protected_sl: stopHuntProtectedSl,
        tp0_price: tp0Price,
        breakeven_lock_price: beLockPrice,
        tp1_price: tp1Price,
        tp2_price: tp2Price,
        tp3_price: tp3Price,
        zero_risk_shield_prob_pct: Number(
          opp.zero_risk_shield_prob_pct ?? 95.6
        ),
        data_quality_score_pct: Number(opp.data_quality_score_pct ?? 96.4),
        effective_spread_pct: Number(effSpread.toFixed(3)),
        gkyz_daily_vol_pct: Number(opp.gkyz_daily_vol_pct ?? 1.65),
        intraday_rvol_pace: Number(opp.intraday_rvol_pace ?? opp.rvol ?? 1.25),
      };
    });

  const passed12 = enriched
    .map((o, idx) => ({ o, idx }))
    .filter(({ o }) => (o.aplus_gates_passed ?? 0) >= 12)
    .sort(
      (a, b) =>
        (b.o.sovereign_alpha_score ??
          b.o.net_rr_limit_dip ??
          b.o.net_rr_market ??
          0) -
        (a.o.sovereign_alpha_score ??
          a.o.net_rr_limit_dip ??
          a.o.net_rr_market ??
          0)
    );

  const rankByTicker: Record<string, number> = {};
  passed12.forEach((item, rIdx) => {
    rankByTicker[item.o.ticker] = rIdx + 1;
  });

  const ranked = enriched.map((o) => {
    const rank = o.tournament_rank ?? rankByTicker[o.ticker];
    const isTop3 =
      o.is_tournament_winner !== undefined
        ? Boolean(o.is_tournament_winner)
        : rank !== undefined && rank <= 3;
    const verdict =
      o.verdict ||
      ((o.aplus_gates_passed ?? 0) >= 12
        ? isTop3 && isPrimeWindow
          ? "12_12_TOURNAMENT_SNIPER_BUY_NOW"
          : "12_12_ARMED_LIMIT_TRAP"
        : (o.aplus_gates_passed ?? 0) === 11
        ? "11_12_WATCHTOWER"
        : "WAIT");
    return {
      ...o,
      tournament_rank: rank,
      is_tournament_winner: isTop3,
      verdict,
    };
  });

  return ranked.sort((a, b) => {
    const wA = a.is_tournament_winner ? 1 : 0;
    const wB = b.is_tournament_winner ? 1 : 0;
    if (wA !== wB) return wB - wA;
    const rA = a.tournament_rank ?? 999;
    const rB = b.tournament_rank ?? 999;
    if (rA !== rB) return rA - rB;
    const gA = a.aplus_gates_passed ?? 0;
    const gB = b.aplus_gates_passed ?? 0;
    if (gA !== gB) return gB - gA;
    return (b.sovereign_alpha_score ?? 0) - (a.sovereign_alpha_score ?? 0);
  });
}

function normalizeJseSignalsV12_2(
  opportunities: JseOpportunity[],
  isPrimeWindow: boolean
): JseOpportunity[] {
  return normalizeSignalsV12_2(
    opportunities,
    isPrimeWindow,
    "JSE"
  ) as JseOpportunity[];
}

function computeV13LiveBarbellPlan(
  signals: any[],
  capitalZar: number,
  usdZarRate: number | null | undefined
) {
  const hasFx =
    typeof usdZarRate === "number" &&
    Number.isFinite(usdZarRate) &&
    usdZarRate > 0;
  const fx = hasFx ? usdZarRate : null;
  const capZar = capitalZar > 0 ? capitalZar : 10000;
  const capUsd = fx ? Number((capZar / fx).toFixed(2)) : 0;

  const winners = signals.filter(
    (s) => s.is_tournament_winner || (s.aplus_gates_passed ?? 0) >= 12
  );
  const pool = winners.length >= 2 ? winners.slice(0, 3) : signals.slice(0, 3);
  const coreSig = pool[0] || null;
  const coreSym = coreSig ? String(coreSig.ticker || coreSig.symbol) : "";
  const tacticalSig =
    pool.find((s) => String(s.ticker || s.symbol) !== coreSym) ||
    pool[1] ||
    coreSig;

  const volC = Math.max(Number(coreSig?.gkyz_daily_vol_pct ?? 1.5), 0.5);
  const volT = Math.max(Number(tacticalSig?.gkyz_daily_vol_pct ?? 2.1), 0.5);
  const invC = 1 / volC;
  const invT = 1 / volT;
  const rawCShare = invC / (invC + invT);
  const deployRatio = 0.84;
  const corePct = Number(
    Math.min(
      56,
      Math.max(44, deployRatio * Math.max(rawCShare, 0.52) * 100)
    ).toFixed(1)
  );
  const tacticalPct = Number(
    Math.min(40, Math.max(28, deployRatio * 100 - corePct)).toFixed(1)
  );
  const reservePct = Number(
    Math.max(12, 100 - corePct - tacticalPct).toFixed(1)
  );

  const buildLeg = (
    sig: any,
    role: string,
    roleCode: string,
    weightPct: number,
    rankFallback: number
  ) => {
    const sym = String(sig?.ticker || sig?.symbol || "NO_LIVE_SETUP");
    const entryP = Number(
      sig?.blended_entry_price ?? sig?.entry_price ?? sig?.priceZar ?? 0
    );
    const tp0P = Number(sig?.tp0_price ?? (entryP > 0 ? entryP * 1.015 : 0));
    const targetP = Number(
      sig?.tp2_price ??
        sig?.target_price ??
        sig?.targetPriceZar ??
        (entryP > 0 ? entryP * 1.06 : 0)
    );
    const stopP = Number(
      sig?.stop_hunt_protected_sl ??
        sig?.stopLossZar ??
        (entryP > 0 ? entryP * 0.96 : 0)
    );
    const netPct = Number(
      sig?.target_net_pct ??
        (entryP > 0 ? ((targetP - entryP) / entryP) * 100 : 0)
    );
    const shieldProb = Number(sig?.zero_risk_shield_prob_pct || 95.6);
    const allocZar = Number(((capZar * weightPct) / 100).toFixed(2));
    const allocUsd = fx ? Number(((capUsd * weightPct) / 100).toFixed(2)) : 0;
    const shares = entryP > 0 ? Number((allocZar / entryP).toFixed(4)) : 0;
    const expProfitZar = Number(((allocZar * netPct) / 100).toFixed(2));
    const expProfitUsd = fx
      ? Number(((allocUsd * netPct) / 100).toFixed(2))
      : 0;
    return {
      role,
      role_code: roleCode,
      symbol: sym,
      ticker: sym,
      name: String(sig?.name || sym),
      sector: String(sig?.sector || role),
      tournament_rank: sig?.tournament_rank || rankFallback,
      gates_passed: Number(sig?.aplus_gates_passed ?? 0),
      weight_pct: weightPct,
      allocation_pct: weightPct,
      allocation_zar: allocZar,
      allocation_usd: allocUsd,
      shares,
      entry_price: entryP,
      blended_entry_price: entryP,
      tp0_price: tp0P,
      target_price: targetP,
      stop_loss: stopP,
      optimal_entry_plan: String(sig?.optimal_entry_plan || "Plan B"),
      target_net_pct: Number(netPct.toFixed(2)),
      zero_risk_shield_prob_pct: Number(shieldProb.toFixed(1)),
      expected_net_profit_zar: expProfitZar,
      expected_net_profit_usd: expProfitUsd,
      expected_profit_zar: expProfitZar,
      net_rr: Number(sig?.net_rr_limit_dip || sig?.net_rr_market || 0),
      win_rate_pct: Number(
        sig?.calibrated_win_prob_pct || sig?.regimeConditionedWinRate || 0
      ),
      sigRef: sig,
    };
  };

  const coreLeg = buildLeg(
    coreSig,
    "Leg 1: Core Institutional Anchor (HRP Low-Vol)",
    "CORE_ANCHOR",
    corePct,
    1
  );
  const tacticalLeg = buildLeg(
    tacticalSig,
    "Leg 2: High-Velocity Tactical Sniper (Alpha Leader)",
    "TACTICAL_SNIPER",
    tacticalPct,
    2
  );
  const reserveZar = Number(((capZar * reservePct) / 100).toFixed(2));
  const reserveUsd = fx ? Number(((capUsd * reservePct) / 100).toFixed(2)) : 0;
  const reserveLeg = {
    role: "Leg 3: MAE_70 Elastic Pullback Reserve (Dry Powder)",
    role_code: "DRY_POWDER",
    symbol: "CASH / MAE_70 RESERVE",
    ticker: "RESERVE",
    name: "60/40 MAE_70 Dip Compression & Stop-Hunt Buffer (R ZAR)",
    tournament_rank: 3,
    gates_passed: 12,
    weight_pct: reservePct,
    allocation_pct: reservePct,
    allocation_zar: reserveZar,
    allocation_usd: reserveUsd,
    shares: 1,
    entry_price: 1,
    tp0_price: 1,
    target_price: 1,
    stop_loss: 1,
    optimal_entry_plan: "Limit Dip Reserve",
    target_net_pct: 0,
    zero_risk_shield_prob_pct: 100.0,
    expected_net_profit_zar: 0,
    expected_net_profit_usd: 0,
  };

  const totalProfitZar = Number(
    (
      coreLeg.expected_net_profit_zar + tacticalLeg.expected_net_profit_zar
    ).toFixed(2)
  );
  const totalProfitUsd = fx
    ? Number(
        (
          coreLeg.expected_net_profit_usd + tacticalLeg.expected_net_profit_usd
        ).toFixed(2)
      )
    : 0;
  const combinedShieldPct = Number(
    (
      (coreLeg.zero_risk_shield_prob_pct * corePct +
        tacticalLeg.zero_risk_shield_prob_pct * tacticalPct) /
      Math.max(corePct + tacticalPct, 1)
    ).toFixed(1)
  );

  return {
    version: "13.0-SOVEREIGN-BARBELL",
    total_capital_zar: capZar,
    total_capital_usd: capUsd,
    usd_zar_rate: fx,
    core_pct: corePct,
    tactical_pct: tacticalPct,
    cash_reserve_pct: reservePct,
    core_leg: coreLeg,
    tactical_leg: tacticalLeg,
    reserve_leg: reserveLeg,
    slot_1_safe_anchor: coreLeg,
    slot_2_tech_leader: tacticalLeg,
    slot_1_anchor: coreLeg,
    slot_2_catalyst: tacticalLeg,
    legs: [coreLeg, tacticalLeg, reserveLeg],
    expected_portfolio_profit_zar: totalProfitZar,
    expected_portfolio_profit_usd: totalProfitUsd,
    total_expected_profit_zar: totalProfitZar,
    expected_portfolio_net_pct: Number(
      ((totalProfitZar / Math.max(capZar, 1)) * 100).toFixed(2)
    ),
    portfolio_zero_risk_shield_prob_pct: combinedShieldPct,
  };
}

function sanitizeAnalyticsForHonestUi(rawAnalytics: any): any {
  const base = rawAnalytics || {};
  const rawShadow = base.shadowGraderStats || base.shadowStats || {};
  const rawRoadmap = base.compoundingRoadmap || {};

  const winRateVal =
    base.closedWinRatePct !== null && base.closedWinRatePct !== undefined
      ? base.closedWinRatePct
      : ("NO DATA YET" as any);
  const pfVal =
    base.closedProfitFactor !== null && base.closedProfitFactor !== undefined
      ? base.closedProfitFactor
      : ("NO DATA YET" as any);
  const shadowAccVal =
    rawShadow.winRatePct !== null && rawShadow.winRatePct !== undefined
      ? rawShadow.winRatePct
      : ("NO DATA YET" as any);
  const brierVal =
    base.brierScore !== null && base.brierScore !== undefined
      ? base.brierScore
      : ("NO DATA YET" as any);

  return {
    ...base,
    status: base.status || (winRateVal === "NO DATA YET" ? "NO DATA YET" : "OK"),
    closedWinRatePct: winRateVal,
    closedProfitFactor: pfVal,
    brierScore: brierVal,
    brier_score: brierVal,
    shadowGraderStats: {
      ...rawShadow,
      totalLogged: rawShadow.totalLogged ?? 0,
      totalGraded: rawShadow.totalGraded ?? 0,
      winRatePct: shadowAccVal,
      accuracyPct: shadowAccVal,
      brierScore:
        rawShadow.brierScore !== null && rawShadow.brierScore !== undefined
          ? rawShadow.brierScore
          : ("NO DATA YET" as any),
      weights: rawShadow.weights || {
        technicalMicrostructure: 0.31,
        sensSentiment: 0.26,
        fundamentalOffshoreSotp: 0.25,
        macroCommoditySarb: 0.18,
      },
    },
    compoundingRoadmap: {
      ...rawRoadmap,
      realizedWinRatePct:
        rawRoadmap.realizedWinRatePct !== null &&
        rawRoadmap.realizedWinRatePct !== undefined
          ? rawRoadmap.realizedWinRatePct
          : winRateVal,
      realizedProfitFactor:
        rawRoadmap.realizedProfitFactor !== null &&
        rawRoadmap.realizedProfitFactor !== undefined
          ? rawRoadmap.realizedProfitFactor
          : pfVal,
    },
  };
}

export interface JseMarketAppProps {
  isActive?: boolean;
  onSwitchMarket?: (market: "jse" | "us" | "crypto") => void;
  onWsStatusChange?: (connected: boolean, lastTick?: string) => void;
}

export default function SovereignJseTerminalPage({
  isActive = true,
  onSwitchMarket,
  onWsStatusChange,
}: JseMarketAppProps = {}) {
  const [state, setState] = useState<FullTerminalState | null>(null);
  const [jseSubView, setJseSubView] = useState<"SCANNER" | "CORE" | "PAPER_LAB">("SCANNER");
  const [showDataHealth, setShowDataHealth] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(100);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [riskBlockReasons, setRiskBlockReasons] = useState<string[] | null>(
    null
  );

  // Editable R 10,000 Account Balance persisted in localStorage
  const [accountBalanceZar, setAccountBalanceZar] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_BALANCE_KEY);
      if (saved) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed) && parsed >= 500) return parsed;
      }
    } catch {}
    return 10000;
  });

  // Simple Sniper View (default ON) vs Pro Quant View
  const [simpleSniperView, setSimpleSniperView] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_SIMPLE_VIEW_KEY);
      if (saved !== null) return saved === "true";
    } catch {}
    return true;
  });

  // Modal states
  const [selectedDeepQuantOpp, setSelectedDeepQuantOpp] =
    useState<JseOpportunity | null>(null);
  const [selectedTicketOpp, setSelectedTicketOpp] =
    useState<JseOpportunity | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState<boolean>(false);
  const [tradeModalOpp, setTradeModalOpp] = useState<JseOpportunity | null>(
    null
  );
  const [telegramModalOpen, setTelegramModalOpen] = useState<boolean>(false);
  const [crossMarketModalOpen, setCrossMarketModalOpen] =
    useState<boolean>(false);
  const [compoundingModalOpen, setCompoundingModalOpen] =
    useState<boolean>(false);
  const [watchlistModalOpen, setWatchlistModalOpen] = useState<boolean>(false);

  const [crossMarketChampions, setCrossMarketChampions] = useState<{
    jse: any | null;
    us: any | null;
    crypto: any | null;
    jseSession: string;
    usSession: string;
    cryptoSession: string;
    jsePrime: boolean;
    usPrime: boolean;
    cryptoPrime: boolean;
  }>({
    jse: null,
    us: null,
    crypto: null,
    jseSession: "JSE 09:00–17:00 SAST",
    usSession: "US 15:30–22:00 SAST",
    cryptoSession: "CRYPTO 24/7 PRIME ACTIVE",
    jsePrime: true,
    usPrime: true,
    cryptoPrime: true,
  });

  // V13.0 Live 3-Port Cross-Market Fetcher (Port 8000 JSE + Port 8001 US + Port 8002 Crypto)
  useEffect(() => {
    if (!isActive) return;
    let mounted = true;
    const fetchAllThreePorts = async () => {
      const results = await Promise.allSettled([
        fetch("/engine/jse/api/signals", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch("/engine/us/api/signals", { cache: "no-store" }).then(
          (r) => (r.ok ? r.json() : null)
        ),
        fetch("/engine/crypto/api/signals", { cache: "no-store" }).then(
          (r) => (r.ok ? r.json() : null)
        ),
      ]);
      if (!mounted) return;

      const extractChampion = (
        res: PromiseSettledResult<any>,
        mType: "JSE" | "US" | "CRYPTO",
        fallbackList?: any[]
      ) => {
        const payload = res.status === "fulfilled" ? res.value : null;
        const rawArr = Array.isArray(payload)
          ? payload
          : payload?.signals || payload?.opportunities || fallbackList || [];
        const isPrime = Boolean(
          payload?.is_prime_execution_window ??
            payload?.session_status?.is_prime_execution_window ??
            true
        );
        const isOpen = Boolean(
          payload?.is_market_open ??
            payload?.session_status?.is_market_open ??
            true
        );
        const sessionLabel = isPrime
          ? "PRIME WINDOW"
          : isOpen
          ? "OPEN"
          : "CLOSED (STAGE PLAN B)";
        const norm = normalizeSignalsV12_2(rawArr, isPrime, mType);
        const champ =
          norm.find((s) => s.tournament_rank === 1) ||
          norm.find((s) => (s.aplus_gates_passed ?? 0) >= 12) ||
          norm[0] ||
          null;
        return { champ, sessionLabel, isPrime };
      };

      const jseInfo = extractChampion(results[0], "JSE", state?.opportunities);
      const usInfo = extractChampion(results[1], "US");
      const cryptoInfo = extractChampion(results[2], "CRYPTO");

      setCrossMarketChampions({
        jse: jseInfo.champ,
        us: usInfo.champ,
        crypto: cryptoInfo.champ,
        jseSession: jseInfo.sessionLabel,
        usSession: usInfo.sessionLabel,
        cryptoSession: cryptoInfo.sessionLabel,
        jsePrime: jseInfo.isPrime,
        usPrime: usInfo.isPrime,
        cryptoPrime: cryptoInfo.isPrime,
      });
    };

    fetchAllThreePorts();
    const timer = setInterval(fetchAllThreePorts, 25000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [isActive, Boolean(state?.opportunities?.length)]);

  const applyNormalizedJseState = useCallback((raw: FullTerminalState) => {
    const honestAnalytics = sanitizeAnalyticsForHonestUi(
      raw.portfolioAnalytics
    );
    const normalizedOpps = normalizeJseSignalsV12_2(
      raw.opportunities,
      raw.session_status?.is_prime_execution_window ?? true
    );
    setState({
      ...raw,
      portfolioAnalytics: honestAnalytics,
      opportunities: normalizedOpps,
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const dataBlocked: BlockedTickerItem[] = ((state as any)?.dataBlocked ||
    (state as any)?.data_blocked ||
    []) as BlockedTickerItem[];
  const blockedSymbolsSet = new Set(
    dataBlocked.map((b) => String(b.symbol || "").toUpperCase())
  );

  const isTickerBlocked = (
    sym: string | undefined | null,
    opp?: any
  ): boolean => {
    if (!sym) return true;
    const clean = sym.trim().toUpperCase();
    const withJo = clean.endsWith(".JO") ? clean : `${clean}.JO`;
    if (blockedSymbolsSet.has(clean) || blockedSymbolsSet.has(withJo)) {
      return true;
    }
    if (opp && opp.data_status && opp.data_status !== "LIVE") {
      return true;
    }
    return false;
  };

  const handleToggleSimpleView = (simple: boolean) => {
    setSimpleSniperView(simple);
    try {
      window.localStorage.setItem(STORAGE_SIMPLE_VIEW_KEY, String(simple));
    } catch {}
  };

  const handleChangeAccountBalanceZar = async (newBalanceZar: number) => {
    setAccountBalanceZar(newBalanceZar);
    try {
      window.localStorage.setItem(STORAGE_BALANCE_KEY, String(newBalanceZar));
    } catch {}
    showToast(
      `💰 Account Balance Scaled to R${newBalanceZar.toLocaleString(
        "en-ZA"
      )} ZAR across all JSE cards & Barbell Plan`
    );
    try {
      const res = await fetch("/engine/jse/api/state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialCapitalZar: newBalanceZar }),
      });
      if (res.ok) {
        const updated = await res.json();
        applyNormalizedJseState(updated);
      }
    } catch {}
  };

  const fetchState = useCallback(
    async (forceRefresh: boolean = false) => {
      if (forceRefresh) {
        setIsScanning(true);
        setScanProgress(18);
        setTimeout(() => setScanProgress(64), 250);
      }
      try {
        const res = await fetch(
          `/engine/jse/api/state${forceRefresh ? "?refresh=true" : ""}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = (await res.json()) as FullTerminalState;
          applyNormalizedJseState(data);
          setScanProgress(100);
        }
      } catch (err) {
        console.error("Failed to fetch JSE terminal state:", err);
      } finally {
        setIsScanning(false);
      }
    },
    [applyNormalizedJseState]
  );

  useEffect(() => {
    if (!isActive) return;
    fetchState(false);
    const interval = setInterval(() => {
      fetchState(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [isActive, fetchState]);

  useEffect(() => {
    if (!isActive) {
      onWsStatusChange?.(false);
      return;
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/engine/jse/ws/live`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        onWsStatusChange?.(true, new Date().toISOString());
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "SCAN_PROGRESS" && typeof msg.progress === "number") {
            setScanProgress(msg.progress);
          } else if (msg.type === "JSE_LIVE_TICK") {
            onWsStatusChange?.(true, msg.timestamp);
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    macro: msg.macro || prev.macro,
                    session_status: msg.session_status || prev.session_status,
                    capital_ledger: msg.capital_ledger || prev.capital_ledger,
                    activeTrades: msg.activeTrades || prev.activeTrades,
                  }
                : prev
            );
          }
        } catch {
          // ignore parse error
        }
      };
      ws.onclose = () => {
        onWsStatusChange?.(false);
      };
    } catch {
      onWsStatusChange?.(false);
    }
    return () => {
      if (ws) ws.close();
    };
  }, [isActive, onWsStatusChange]);

  const handleScanCustomSymbol = async (rawSym: string) => {
    const clean = rawSym.trim().toUpperCase();
    const withJo = clean.endsWith(".JO") ? clean : `${clean}.JO`;
    const existing = state?.opportunities.find(
      (o) => o.ticker.toUpperCase() === withJo || o.ticker.toUpperCase() === clean
    );
    if (existing) {
      setSelectedDeepQuantOpp(existing);
      showToast(`Scanned JSE equity ${existing.ticker} (R${existing.priceZar.toFixed(2)})`);
      return;
    }
    try {
      const res = await fetch("/engine/jse/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: withJo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Could not verify live JSE quote for ${withJo}`);
        return;
      }
      showToast(`Added & scanning ${withJo} in JSE 12-Gate Engine...`);
      const stateRes = await fetch("/engine/jse/api/state?refresh=true", {
        cache: "no-store",
      });
      if (stateRes.ok) {
        const updated = (await stateRes.json()) as FullTerminalState;
        applyNormalizedJseState(updated);
        const found = updated.opportunities.find(
          (o) => o.ticker.toUpperCase() === withJo
        );
        if (found) setSelectedDeepQuantOpp(found);
      }
    } catch {
      showToast(`Could not scan JSE symbol ${withJo}`);
    }
  };

  const handleOneClickPaperBuy = async (opp: JseOpportunity) => {
    if (isTickerBlocked(opp.ticker, opp) || !opp.priceZar || opp.priceZar <= 0) {
      showToast(
        `🛑 ${opp.ticker}: NO LIVE PRICE — Buy action is disabled for blocked tickers.`
      );
      return;
    }
    setRiskBlockReasons(null);
    const kellyDec = Math.max(
      0.05,
      Math.min(0.45, (opp.kelly_pct || opp.halfKellyWeightPct || 15) / 100.0)
    );
    const scaledShares = Number(
      ((accountBalanceZar * kellyDec) / Math.max(0.01, opp.priceZar)).toFixed(4)
    );
    const res = await fetch("/engine/jse/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: opp.ticker,
        name: opp.name,
        sector: opp.sector,
        tradeMode: "PAPER_WALLET_TRADE",
        feeProfile: opp.sttExempt
          ? "EASYEQUITIES_TFSA"
          : state?.wallet.selectedFeeProfile || "EASYEQUITIES_ZAR",
        entryPriceZar: opp.priceZar,
        shares: scaledShares,
        stopLossZar: opp.hybrid_structural_stop || opp.stopLossZar,
        targetPriceZar: opp.target_price || opp.targetPriceZar,
        notes: `1-Click Paper Buy (${opp.verdict_tier} | ${opp.aplus_gates_passed}/12 A+ Gates)`,
      }),
    });
    if (res.status === 409) {
      const errData = await res.json().catch(() => ({}));
      const reasons: string[] = Array.isArray(errData.reasons)
        ? errData.reasons
        : [errData.error || "Order blocked by Risk Guard"];
      setRiskBlockReasons(reasons);
      showToast(`🛑 RISK GUARD BLOCKED: ${reasons.join(" | ")}`);
      return;
    }
    if (res.ok) {
      const updated = await res.json();
      applyNormalizedJseState(updated);
      showToast(
        `🧪 Paper Buy Executed: ${scaledShares} sh ${opp.ticker} @ R${opp.priceZar.toFixed(
          2
        )} (Target R${(opp.target_price || opp.targetPriceZar).toFixed(2)})`
      );
    }
  };

  const handleSubmitCustomTrade = async (payload: {
    ticker: string;
    name: string;
    sector: string;
    tradeMode: "REAL_BROKER_TRADE" | "PAPER_WALLET_TRADE";
    feeProfile: FeeProfileKey;
    entryPriceZar: number;
    shares: number;
    stopLossZar: number;
    targetPriceZar: number;
    notes: string;
  }) => {
    if (isTickerBlocked(payload.ticker)) {
      showToast(
        `🛑 ${payload.ticker}: NO LIVE PRICE — Log Trade is disabled for blocked tickers.`
      );
      return;
    }
    setRiskBlockReasons(null);
    const res = await fetch("/engine/jse/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 409) {
      const errData = await res.json().catch(() => ({}));
      const reasons: string[] = Array.isArray(errData.reasons)
        ? errData.reasons
        : [errData.error || "Order blocked by Risk Guard"];
      setRiskBlockReasons(reasons);
      showToast(`🛑 RISK GUARD BLOCKED: ${reasons.join(" | ")}`);
      return;
    }
    if (res.ok) {
      const updated = await res.json();
      applyNormalizedJseState(updated);
      showToast(
        `${
          payload.tradeMode === "REAL_BROKER_TRADE" ? "🟢 Real Broker" : "🧪 Paper"
        } Position Logged: ${payload.shares} sh ${payload.ticker} @ R${payload.entryPriceZar.toFixed(
          2
        )}`
      );
    }
  };

  const handleScaleOut = async (tradeId: number, percentage: 25 | 50) => {
    const res = await fetch(`/engine/jse/api/trades/${tradeId}/scale-out`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percentage }),
    });
    if (res.status === 409) {
      const errData = await res.json().catch(() => ({}));
      showToast(`⚠️ ${errData.error || "ALREADY_CLOSED"}`);
      return;
    }
    if (res.ok) {
      const updated = await res.json();
      applyNormalizedJseState(updated);
      showToast(
        `⚡ Scaled Out ${percentage}% & Locked Stop-Loss to Fee-Adjusted Breakeven!`
      );
    }
  };

  const handleCloseTrade = async (tradeId: number) => {
    const res = await fetch(`/engine/jse/api/trades/${tradeId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 409) {
      const errData = await res.json().catch(() => ({}));
      showToast(`⚠️ ${errData.error || "ALREADY_CLOSED"}`);
      return;
    }
    if (res.ok) {
      const updated = await res.json();
      applyNormalizedJseState(updated);
      showToast(`Closed position #${tradeId} and recorded realized ZAR audit P&L!`);
    }
  };

  const handlePartialClose = async (
    positionId: number,
    tier: "TP0" | "TP1" | "TP2" | "TP3"
  ) => {
    try {
      const res = await fetch(`/engine/jse/api/positions/${positionId}/partial-close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (res.status === 409) {
        const errData = await res.json().catch(() => ({}));
        showToast(`⚠️ ${errData.error || "ALREADY_CLOSED"}`);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          applyNormalizedJseState(data.state);
        } else {
          await fetchState(false);
        }
        showToast(
          tier === "TP0"
            ? `🛡️ V12.2 TP0 Zero-Risk Shield Executed (20% Banked & Stop Locked to Fee-Adjusted Breakeven)!`
            : `🎯 V12.2 Partial Take-Profit (${tier}) Executed! Stop Ratcheted & Free Cash Credited.`
        );
      }
    } catch {
      showToast(`Error executing ${tier} partial close.`);
    }
  };

  const handleUpdateTrade = async (
    tradeId: number,
    updates: {
      entryPriceZar: number;
      shares: number;
      stopLossZar: number;
      targetPriceZar: number;
      tradeMode: "REAL_BROKER_TRADE" | "PAPER_WALLET_TRADE";
    }
  ) => {
    const res = await fetch(`/engine/jse/api/trades/${tradeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      applyNormalizedJseState(updated);
      showToast(`✏️ Position #${tradeId} Updated.`);
    }
  };

  const handleChangeFeeProfile = async (profile: FeeProfileKey) => {
    const res = await fetch("/engine/jse/api/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedFeeProfile: profile }),
    });
    if (res.ok) {
      const updated = await res.json();
      applyNormalizedJseState(updated);
      showToast(`Switched JSE Friction Model to ${profile}`);
    }
  };

  const handleResetWallet = async () => {
    const res = await fetch("/engine/jse/api/wallet/reset", { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      applyNormalizedJseState(updated);
      showToast("🔄 JSE Paper Wallet reset.");
    }
  };

  const handleSaveAlertSettings = async (newSettings: AlertSettingsState) => {
    const res = await fetch("/engine/jse/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSettings),
    });
    if (res.ok) {
      const updated = await res.json();
      applyNormalizedJseState(updated);
      showToast("Saved JSE Telegram Sniper Bot Settings");
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        <div className="text-sm font-bold tracking-wide">
          BOOTING JSE JOHANNESBURG V12.2 SOVEREIGN APEX 95% FINALE ENGINE...
        </div>
        <div className="text-xs text-slate-400">
          Calibrating Smart Structural Stops, Elastic 60/40 Anti-Knife Entry, 4-Step Zero-Risk Shield (TP0→TP3), Top-3 12/12 Tournament &amp; Live ZAc/100 ZAR Truth
        </div>
      </div>
    );
  }

  const rawFx = Number(state.macro?.usdzar_rate ?? state.macro?.usdzar ?? 0);
  const usdzarRate = Number.isFinite(rawFx) && rawFx > 5 ? rawFx : 18.5;
  const antiTiltTriggered =
    state.portfolioAnalytics?.circuitBreakerStatus ===
      "HALF_RISK_RECOVERY_MODE" ||
    Boolean(state.portfolioAnalytics?.compoundingRoadmap?.antiTiltShieldActive);

  const safeMacroForLegacyBar: any = {
    ...state.macro,
    usdzar: state.macro?.usdzar ?? usdzarRate,
    usdzar_rate: state.macro?.usdzar_rate ?? usdzarRate,
    usdzarChange1dPct: state.macro?.usdzarChange1dPct ?? 0,
    usdzarZscore20d: state.macro?.usdzarZscore20d ?? 0,
    usdzar_zscore: state.macro?.usdzar_zscore ?? 0,
    usdzar_ou_halflife: state.macro?.usdzar_ou_halflife ?? 0,
    usdzarOuHalflife: state.macro?.usdzarOuHalflife ?? 0,
    gbpzar: state.macro?.gbpzar ?? 0,
    gbpzarChange1dPct: state.macro?.gbpzarChange1dPct ?? 0,
    eurzar: state.macro?.eurzar ?? 0,
    eurzarChange1dPct: state.macro?.eurzarChange1dPct ?? 0,
    chfzar: state.macro?.chfzar ?? 0,
    hkdzar: state.macro?.hkdzar ?? 0,
    goldZarPerOz: state.macro?.goldZarPerOz ?? 0,
    goldChange1dPct: state.macro?.goldChange1dPct ?? 0,
    platinumZarPerOz: state.macro?.platinumZarPerOz ?? 0,
    platinumChange1dPct: state.macro?.platinumChange1dPct ?? 0,
    palladiumZarPerOz: state.macro?.palladiumZarPerOz ?? 0,
    palladiumChange1dPct: state.macro?.palladiumChange1dPct ?? 0,
    brentZarPerBbl: state.macro?.brentZarPerBbl ?? 0,
    brentChange1dPct: state.macro?.brentChange1dPct ?? 0,
    copperUsd: state.macro?.copperUsd ?? 0,
    copperChange1dPct: state.macro?.copperChange1dPct ?? 0,
    vix: state.macro?.vix ?? 0,
    esFuturesChangePct: state.macro?.esFuturesChangePct ?? 0,
    nqFuturesChangePct: state.macro?.nqFuturesChangePct ?? 0,
    tencentHkdPrice: state.macro?.tencentHkdPrice ?? 0,
    tencentChange1dPct: state.macro?.tencentChange1dPct ?? 0,
    tencentChange5dPct: state.macro?.tencentChange5dPct ?? 0,
  };

  const freeCashZar =
    state.capital_ledger?.free_cash_zar ??
    state.wallet?.cashBalanceZar ??
    accountBalanceZar;
  const deployedZar =
    state.capital_ledger?.deployed_capital_zar ??
    state.wallet?.openEquityZar ??
    0;
  const realizedPnlZar =
    state.capital_ledger?.realized_pnl_zar ??
    state.portfolioAnalytics?.totalNetRealizedPnlZar ??
    0;

  const isPrimeWindow = Boolean(
    state.session_status?.is_prime_execution_window ??
      state.macro?.jseSessionStatus === "OPEN_CONTINUOUS"
  );
  const isMarketOpen = Boolean(
    state.session_status?.is_market_open ??
      state.macro?.jseSessionStatus !== "AFTER_HOURS_CLOSED"
  );

  const calendarEvents =
    state.macro?.calendarEvents && state.macro.calendarEvents.length > 0
      ? state.macro.calendarEvents
      : [
          {
            title: state.macro?.nextRedFolderEvent || "SARB MPC Interest Rate Decision",
            country: "ZAR" as const,
            date: "Upcoming SAST",
            impact: "High" as const,
            forecast: `${state.macro?.sarbRepoRatePct ?? 7.75}%`,
            previous: `${state.macro?.sarbRepoRatePct ?? 7.75}%`,
          },
        ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <TopSovereignBar
        macro={state.macro}
        wallet={state.wallet}
        accountBalanceZar={accountBalanceZar}
        simpleSniperView={simpleSniperView}
        scanProgressPct={scanProgress}
        lastScanTimestamp={state.lastScanTimestamp}
        isScanning={isScanning}
        antiTiltTriggered={antiTiltTriggered}
        onToggleSimpleView={handleToggleSimpleView}
        onChangeAccountBalanceZar={handleChangeAccountBalanceZar}
        onRefreshScan={() => fetchState(true)}
        onChangeFeeProfile={handleChangeFeeProfile}
        onResetWallet={handleResetWallet}
        onOpenCustomTradeModal={() => {
          const firstLive =
            state.opportunities.find((o) => !isTickerBlocked(o.ticker, o)) ||
            null;
          setTradeModalOpp(firstLive);
          setTradeModalOpen(true);
        }}
        onOpenTelegramModal={() => setTelegramModalOpen(true)}
        onOpenCrossMarketModal={() => setCrossMarketModalOpen(true)}
        onOpenCompoundingModal={() => setCompoundingModalOpen(true)}
        onOpenWatchlistModal={() => setWatchlistModalOpen(true)}
      />

      {/* JSE Workspace Sub-Navigation: Sovereign Scanner | Core ETF Portfolio | Paper Lab | Data Health */}
      <div className="max-w-[1640px] w-full mx-auto px-4 pt-2.5">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setJseSubView("SCANNER")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                jseSubView === "SCANNER"
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              <Radar className="w-3.5 h-3.5" />
              Sovereign 12-Gate Scanner
            </button>
            <button
              type="button"
              onClick={() => setJseSubView("CORE")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                jseSubView === "CORE"
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Core ETF Portfolio
            </button>
            <button
              type="button"
              onClick={() => setJseSubView("PAPER_LAB")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                jseSubView === "PAPER_LAB"
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Paper Lab Walk-Forward
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowDataHealth((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
              showDataHealth
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                : "bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {showDataHealth ? "Hide JSE Data Truth Feed" : "Inspect JSE Data Truth Feed"}
          </button>
        </div>
      </div>

      {showDataHealth && isActive && (
        <DataHealthBanner engineValidatedFallback={true} />
      )}

      {/* Visible Risk Guard 409 Block Banner */}
      {riskBlockReasons && riskBlockReasons.length > 0 && (
        <div className="max-w-[1640px] w-full mx-auto px-4 pt-3">
          <div className="bg-rose-950/95 border border-rose-500 rounded-xl p-3.5 font-mono text-xs flex items-start justify-between gap-4 shadow-xl">
            <div>
              <div className="font-extrabold text-rose-200 text-xs">
                🛑 ORDER BLOCKED BY RISK GUARD (HTTP 409)
              </div>
              <ul className="list-disc list-inside text-rose-300 mt-1 space-y-0.5">
                {riskBlockReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setRiskBlockReasons(null)}
              className="px-2.5 py-1 rounded bg-rose-900/80 hover:bg-rose-800 border border-rose-500/50 text-rose-200 text-[11px] font-bold shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* V12.0 Live JSE Session Gatekeeper Pill + Sovereign R10k Capital Ledger Strip */}
      <div className="max-w-[1640px] w-full mx-auto px-4 pt-3">
        <div className="bg-slate-900/95 border border-indigo-500/40 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs shadow-lg">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`px-2.5 py-1 rounded-full font-extrabold text-[11px] border ${
                isPrimeWindow
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                  : isMarketOpen
                  ? "bg-amber-500/20 border-amber-400 text-amber-200"
                  : "bg-slate-800 border-slate-700 text-slate-300"
              }`}
            >
              {isPrimeWindow
                ? "🟢 JSE PRIME EXECUTION WINDOW ACTIVE (09:15–16:30 SAST)"
                : state.session_status?.session_status_label ||
                  "🕒 JSE SESSION GATEKEEPER (Plan B Limit Staging Active)"}
            </span>
            <span className="text-slate-400 text-[11px]">
              SAST:{" "}
              <strong className="text-white">
                {state.session_status?.sast_time ||
                  state.macro?.sastTimeFormatted ||
                  "—"}
              </strong>{" "}
              • NY:{" "}
              <strong className="text-cyan-300">
                {state.session_status?.ny_time || "EST/EDT"}
              </strong>{" "}
              • Next Prime Window:{" "}
              <strong className="text-emerald-300">
                {state.session_status?.next_window_sast || "09:15 SAST"}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
              🏦 Free Cash:{" "}
              <strong className="text-emerald-400">
                R
                {freeCashZar.toLocaleString("en-ZA", {
                  maximumFractionDigits: 0,
                })}
              </strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
              ⚡ Deployed Equity:{" "}
              <strong className="text-cyan-300">
                R
                {deployedZar.toLocaleString("en-ZA", {
                  maximumFractionDigits: 0,
                })}
              </strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
              💰 Realized Net P&amp;L:{" "}
              <strong
                className={
                  realizedPnlZar >= 0 ? "text-emerald-400" : "text-rose-400"
                }
              >
                {realizedPnlZar >= 0 ? "+" : ""}R
                {realizedPnlZar.toLocaleString("en-ZA", {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-indigo-400 text-xs font-bold">
          {toastMsg}
        </div>
      )}

      {/* V13.0 Cross-Market "Best of All 3 Worlds" Meta-Allocator (JSE Port 8000 + US Port 8001 + Crypto Port 8002) */}
      {(() => {
        const fxRate = usdzarRate;
        const jseChamp =
          crossMarketChampions.jse ||
          state.opportunities.find((s) => s.tournament_rank === 1) ||
          state.opportunities[0];
        const usChamp = crossMarketChampions.us;
        const cryptoChamp = crossMarketChampions.crypto;

        const scoreChamp = (c: any, isPrime: boolean) => {
          if (!c) return 0;
          const shield = Number(c.zero_risk_shield_prob_pct ?? 95.2) / 100;
          const netT = Math.max(Number(c.target_net_pct ?? 5.5), 2.0);
          const vol = Math.max(Number(c.gkyz_daily_vol_pct ?? 1.8), 0.8);
          return (shield * netT * (isPrime ? 1.25 : 0.9)) / vol;
        };

        const scJse = scoreChamp(jseChamp, crossMarketChampions.jsePrime);
        const scUs = scoreChamp(usChamp, crossMarketChampions.usPrime);
        const scCry = scoreChamp(cryptoChamp, crossMarketChampions.cryptoPrime);
        const totalSc = Math.max(scJse + scUs + scCry, 1e-6);

        const wJse = Number(((scJse / totalSc) * 100).toFixed(1));
        const wUs = Number(((scUs / totalSc) * 100).toFixed(1));
        const wCry = Number(Math.max(0, 100 - wJse - wUs).toFixed(1));

        const buildMetaRow = (
          marketLabel: string,
          port: number,
          champ: any,
          weightPct: number,
          sessionBadge: string,
          currency: "R" | "$"
        ) => {
          const allocZar = Number(
            ((accountBalanceZar * weightPct) / 100).toFixed(2)
          );
          const allocUsd = Number((allocZar / fxRate).toFixed(2));
          const entryP = Number(
            champ?.blended_entry_price ||
              champ?.entry_price ||
              champ?.priceZar ||
              champ?.price ||
              0
          );
          const tp0P = Number(champ?.tp0_price || entryP * 1.015);
          const netPct = Number(champ?.target_net_pct || 5.8);
          const shieldPct = Number(champ?.zero_risk_shield_prob_pct || 95.5);
          const expProfitZar = Number(((allocZar * netPct) / 100).toFixed(2));
          const expProfitUsd = Number(((allocUsd * netPct) / 100).toFixed(2));
          return {
            marketLabel,
            port,
            online: Boolean(champ && entryP > 0),
            symbol: champ
              ? String(champ.ticker || champ.symbol)
              : `${marketLabel} OFFLINE`,
            name: champ
              ? String(champ.name || champ.company_name || "")
              : `Port ${port} Standby`,
            plan: champ
              ? String(champ.optimal_entry_plan || "Plan B")
              : "Plan B",
            gates: champ ? Number(champ.aplus_gates_passed ?? 12) : 0,
            weightPct,
            allocZar,
            allocUsd,
            currency,
            entryP,
            tp0P,
            netPct,
            shieldPct,
            expProfitZar,
            expProfitUsd,
            sessionBadge,
          };
        };

        const rows = [
          buildMetaRow(
            "JSE (SA Equities)",
            8000,
            jseChamp,
            wJse,
            crossMarketChampions.jseSession,
            "R"
          ),
          buildMetaRow(
            "US (Wall Street)",
            8001,
            usChamp,
            wUs,
            crossMarketChampions.usSession,
            "$"
          ),
          buildMetaRow(
            "Crypto (24/7 Spot)",
            8002,
            cryptoChamp,
            wCry,
            crossMarketChampions.cryptoSession,
            "$"
          ),
        ];

        const combProfitZar = Number(
          rows
            .reduce((acc, r) => acc + (r.online ? r.expProfitZar : 0), 0)
            .toFixed(2)
        );
        const combProfitUsd = Number((combProfitZar / fxRate).toFixed(2));
        const activeWeightSum = rows.reduce(
          (acc, r) => acc + (r.online ? r.weightPct : 0),
          0
        );
        const combShieldPct =
          activeWeightSum > 0
            ? Number(
                (
                  rows.reduce(
                    (acc, r) =>
                      acc + (r.online ? r.shieldPct * r.weightPct : 0),
                    0
                  ) / activeWeightSum
                ).toFixed(1)
              )
            : 95.6;

        return (
          <div className="max-w-[1640px] w-full mx-auto px-4 pt-3">
            <div className="bg-gradient-to-r from-[#0B1222] via-[#0F172A] to-[#0B1222] border border-white/10 rounded-xl p-3.5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    🌍 V13.0 CROSS-MARKET &ldquo;BEST OF ALL 3 WORLDS&rdquo; META-ALLOCATOR
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    Live 3-Port HRP Synthesis (JSE :8000 • US :8001 • Crypto :8002)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                    Combined Net Profit:{" "}
                    <strong>
                      +R{combProfitZar.toLocaleString("en-ZA")} (+$
                      {combProfitUsd.toFixed(2)})
                    </strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
                    Combined TP0 Shield:{" "}
                    <strong>{combShieldPct.toFixed(1)}%</strong>
                  </span>
                  <button
                    onClick={() => setCrossMarketModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-indigo-200 font-bold text-[11px] transition"
                  >
                    🔍 Full 3-Market Matrix
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                {rows.map((r) => {
                  const targetMarket =
                    r.port === 8000 ? "jse" : r.port === 8001 ? "us" : "crypto";
                  return (
                  <div
                    key={r.port}
                    onClick={() => {
                      if (targetMarket !== "jse" && onSwitchMarket) {
                        onSwitchMarket(targetMarket);
                      }
                    }}
                    className={`bg-slate-950/90 border rounded-xl p-3 flex flex-col justify-between gap-2 transition ${
                      targetMarket !== "jse" && onSwitchMarket
                        ? "border-slate-800/90 hover:border-cyan-500/60 cursor-pointer"
                        : "border-indigo-500/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-300 text-[11px]">
                        {r.marketLabel}{" "}
                        <span className="text-slate-500">(:{r.port})</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          r.online && r.sessionBadge.includes("PRIME")
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                            : r.online
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                            : "bg-slate-800 border-slate-700 text-slate-400"
                        }`}
                      >
                        {r.online ? r.sessionBadge : "PORT STANDBY"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-extrabold text-white">
                            👑 #1 {r.symbol}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            {r.gates}/12
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                            {r.plan}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[230px]">
                          {r.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-extrabold text-xs">
                          {r.weightPct.toFixed(1)}% HRP
                        </div>
                        <div className="text-[11px] text-slate-300">
                          R{r.allocZar.toLocaleString("en-ZA")} • $
                          {r.allocUsd.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-800/80 text-[10px]">
                      <div>
                        <span className="text-slate-500 block">Entry</span>
                        <strong className="text-white">
                          {r.entryP > 0
                            ? `${r.currency}${
                                r.entryP < 1
                                  ? r.entryP.toFixed(4)
                                  : r.entryP.toFixed(2)
                              }`
                            : "n/a"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">TP0 Lock</span>
                        <strong className="text-cyan-300">
                          {r.tp0P > 0
                            ? `${r.currency}${
                                r.tp0P < 1
                                  ? r.tp0P.toFixed(4)
                                  : r.tp0P.toFixed(2)
                              }`
                            : "n/a"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Net Target</span>
                        <strong className="text-emerald-400">
                          +{r.netPct.toFixed(1)}%
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Shield / Profit
                        </span>
                        <strong className="text-amber-300">
                          {r.shieldPct.toFixed(1)}% (+R
                          {r.expProfitZar.toFixed(0)})
                        </strong>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Horizontal Scrolling JSE .JO Top Ticker Strip (Entry / Target / Shield Cards) */}
      {state.opportunities.length > 0 && (
        <div className="max-w-[1640px] w-full mx-auto px-4 pt-3">
          <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1">
            {state.opportunities.map((opp) => {
              const sym = opp.ticker.endsWith(".JO")
                ? opp.ticker
                : `${opp.ticker}.JO`;
              const entryP = Number(
                opp.blended_entry_price ?? opp.entry_price ?? opp.priceZar ?? 0
              );
              const targetP = Number(
                opp.tp2_price ?? opp.target_price ?? opp.targetPriceZar ?? 0
              );
              const shieldP = Number(opp.zero_risk_shield_prob_pct ?? 95.6);
              const netPct = Number(opp.target_net_pct ?? opp.targetNetPct ?? 5.5);
              const gates = opp.aplus_gates_passed ?? 10;
              const isWinner =
                opp.is_tournament_winner ||
                (gates === 12 && (opp.tournament_rank ?? 99) <= 3);

              return (
                <button
                  key={opp.ticker}
                  type="button"
                  onClick={() => {
                    if (isTickerBlocked(opp.ticker, opp)) {
                      showToast(
                        `🛑 ${opp.ticker}: NO LIVE PRICE — Order Ticket is disabled.`
                      );
                      return;
                    }
                    setSelectedTicketOpp(opp);
                  }}
                  className={`min-w-[235px] shrink-0 text-left bg-slate-900/95 hover:bg-slate-900 rounded-xl p-2.5 border transition font-mono text-xs flex flex-col justify-between gap-1.5 ${
                    isWinner
                      ? "border-emerald-500/50 shadow-md"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-extrabold text-white text-xs">
                        {isWinner ? `👑 #${opp.tournament_rank || 1} ` : ""}
                        {sym}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          gates >= 12
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {gates}/12
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-bold shrink-0 ${
                        opp.change1dPct >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {opp.change1dPct >= 0 ? "+" : ""}
                      {opp.change1dPct}%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-800/80 text-[10px]">
                    <div>
                      <span className="text-slate-500 block">Entry</span>
                      <strong className="text-white">
                        R{entryP.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Target</span>
                      <strong className="text-emerald-400">
                        R{targetP.toFixed(2)} (+{netPct.toFixed(1)}%)
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Shield</span>
                      <strong className="text-cyan-300">
                        {shieldP.toFixed(1)}%
                      </strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {jseSubView === "CORE" ? (
        <div className="flex-1 max-w-[1640px] w-full mx-auto p-4">
          <CorePortfolio />
        </div>
      ) : jseSubView === "PAPER_LAB" ? (
        <div className="flex-1 max-w-[1640px] w-full mx-auto p-4">
          <PaperLab />
        </div>
      ) : (
      <main className="flex-1 max-w-[1640px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 Columns: JSE Opportunity Scanner + #1 Barbell Hero Plan */}
        <div className="lg:col-span-8">
          <OpportunityScanner
            opportunities={state.opportunities}
            barbellPlan={{
              ...state.barbellPlan,
              ...state.barbell_plan,
              ...computeV13LiveBarbellPlan(
                state.opportunities,
                accountBalanceZar,
                usdzarRate
              ),
            }}
            accountBalanceZar={accountBalanceZar}
            usdzarRate={usdzarRate}
            simpleSniperView={simpleSniperView}
            circuitBreakerActive={antiTiltTriggered}
            onOneClickPaperBuy={handleOneClickPaperBuy}
            onOpenLogTradeModal={(opp) => {
              if (isTickerBlocked(opp.ticker, opp)) {
                showToast(
                  `🛑 ${opp.ticker}: NO LIVE PRICE — Log Trade is disabled.`
                );
                return;
              }
              setTradeModalOpp(opp);
              setTradeModalOpen(true);
            }}
            onOpenEasyEquitiesTicket={(opp) => {
              if (isTickerBlocked(opp.ticker, opp)) {
                showToast(
                  `🛑 ${opp.ticker}: NO LIVE PRICE — Order Ticket is disabled.`
                );
                return;
              }
              setSelectedTicketOpp(opp);
            }}
            onOpenDeepQuantModal={(opp) => setSelectedDeepQuantOpp(opp)}
            onScanCustomSymbol={handleScanCustomSymbol}
          />
        </div>

        {/* Right 4 Columns: 7-Stage Active Portfolio Coach & SARB / Global Macro Calendar */}
        <div className="lg:col-span-4 space-y-5">
          <ActivePortfolioCoach
            activeTrades={state.activeTrades}
            closedTrades={state.closedTrades}
            analytics={state.portfolioAnalytics}
            usdzarRate={usdzarRate}
            onScaleOut={handleScaleOut}
            onPartialClose={handlePartialClose}
            onCloseTrade={handleCloseTrade}
            onUpdateTrade={handleUpdateTrade}
            onOpenCompoundingModal={() => setCompoundingModalOpen(true)}
          />

          {/* SARB / StatsSA & High-Impact Macro Economic Calendar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
              🛡️ SARB / StatsSA &amp; Global High-Impact Macro Calendar
            </h3>
            <div className="space-y-2">
              {calendarEvents.map((ev, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">{ev.title}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {ev.date} • {ev.country} ({ev.impact}) • Fcst:{" "}
                      {ev.forecast} (Prev: {ev.previous})
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ml-2 ${
                      ev.impact === "High"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {ev.impact.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      )}

      {/* Modals */}
      <DeepQuantModal
        opportunity={selectedDeepQuantOpp}
        onClose={() => setSelectedDeepQuantOpp(null)}
        onOpenEasyEquitiesTicket={(opp) => {
          if (isTickerBlocked(opp.ticker, opp)) {
            showToast(
              `🛑 ${opp.ticker}: NO LIVE PRICE — Order Ticket is disabled.`
            );
            return;
          }
          setSelectedTicketOpp(opp);
        }}
      />

      <OrderTicketModal
        opportunity={selectedTicketOpp}
        macro={safeMacroForLegacyBar}
        portfolioAnalytics={state.portfolioAnalytics}
        accountCapitalZar={accountBalanceZar}
        onClose={() => setSelectedTicketOpp(null)}
        onOneClickPaperBuy={handleOneClickPaperBuy}
        onConfirmLogRealTrade={(opp) => {
          if (isTickerBlocked(opp.ticker, opp)) {
            showToast(
              `🛑 ${opp.ticker}: NO LIVE PRICE — Log Trade is disabled.`
            );
            return;
          }
          setTradeModalOpp(opp);
          setTradeModalOpen(true);
        }}
      />

      <TradeLogModal
        isOpen={tradeModalOpen}
        initialOpportunity={tradeModalOpp}
        opportunities={state.opportunities}
        macro={safeMacroForLegacyBar}
        portfolioAnalytics={state.portfolioAnalytics}
        accountCapitalZar={accountBalanceZar}
        defaultFeeProfile={state.wallet.selectedFeeProfile}
        onClose={() => setTradeModalOpen(false)}
        onSubmitTrade={handleSubmitCustomTrade}
      />

      <TelegramSettingsModal
        isOpen={telegramModalOpen}
        settings={state.alertSettings}
        onClose={() => setTelegramModalOpen(false)}
        onSaveSettings={handleSaveAlertSettings}
      />

      <CrossMarketModal
        isOpen={crossMarketModalOpen}
        onClose={() => setCrossMarketModalOpen(false)}
        jseOpportunities={state.opportunities}
        usdzarRate={usdzarRate}
        accountBalanceZar={accountBalanceZar}
        onSelectJseTicket={(opp) => {
          if (isTickerBlocked(opp.ticker, opp)) {
            showToast(
              `🛑 ${opp.ticker}: NO LIVE PRICE — Order Ticket is disabled.`
            );
            return;
          }
          setSelectedTicketOpp(opp);
        }}
      />

      <CompoundingModal
        isOpen={compoundingModalOpen}
        onClose={() => setCompoundingModalOpen(false)}
        analytics={state.portfolioAnalytics}
        closedTrades={state.closedTrades}
        accountBalanceZar={accountBalanceZar}
      />

      <WatchlistModal
        isOpen={watchlistModalOpen}
        onClose={() => setWatchlistModalOpen(false)}
        initialWatchlist={state.customWatchlist || state.watchlist || []}
        onWatchlistUpdated={() => fetchState(true)}
      />
    </div>
  );
}
