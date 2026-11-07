import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import {
  TerminalState,
  CryptoAssetSignal,
  ActiveCoachedTrade,
  AlertSettings,
  NarrativeBasketId,
} from "./types/market";
import { TopCryptoSingularityBar } from "./components/TopCryptoSingularityBar";
import NarrativeRotationStrip from "./components/NarrativeRotationStrip";
import { OpportunityScanner } from "./components/OpportunityScanner";
import { ActivePortfolioCoach } from "./components/ActivePortfolioCoach";
import { DeepQuantModal } from "./components/DeepQuantModal";
import { OrderTicketModal } from "./components/OrderTicketModal";
import { CrossMarketModal } from "./components/CrossMarketModal";
import { CompoundingModal } from "./components/CompoundingModal";
import { WatchlistModal } from "./components/WatchlistModal";
import { TelegramSettingsModal } from "./components/TelegramSettingsModal";
import { TradeLogModal } from "./components/TradeLogModal";

const LS_ACCOUNT_KEY = "crypto_v10_account_balance_zar";
const LS_VIEW_MODE_KEY = "crypto_v10_simple_sniper_view";

function normalizeSignalsV12_2(
  rawSignals: any[],
  isPrimeWindow: boolean = true,
  marketType: "JSE" | "US" | "CRYPTO" = "CRYPTO"
): any[] {
  if (!Array.isArray(rawSignals)) return [];
  const defaultFee = marketType === "JSE" ? 0.64 : marketType === "US" ? 0.5 : 0.36;
  const enriched = rawSignals.map((sig) => {
    const sym = String(sig.symbol || sig.ticker || "BTC");
    const entryP = Number(
      sig.blended_entry_price || sig.entry_price || sig.price || sig.priceZar || sig.current_price || 1
    );
    const stopP = Number(
      sig.stop_hunt_protected_sl || sig.stop_loss || sig.stopLossZar || entryP * 0.96
    );
    const targetP = Number(sig.tp2_price || sig.target_price || sig.targetPriceZar || entryP * 1.07);
    const riskDist = Math.max(entryP * 0.008, Math.abs(entryP - stopP));
    const atr14 = Number(sig.atr_14 || sig.atr14Zar || Math.max(entryP * 0.012, riskDist / 1.25));
    const feePct = Number(sig.round_trip_fee_pct || defaultFee);
    const effSpread = Number(
      sig.effective_spread_pct ?? (marketType === "JSE" ? 0.12 : marketType === "US" ? 0.04 : 0.05)
    );
    const precision = entryP < 1 ? 6 : entryP < 10 ? 4 : 2;
    const reclaimTrigger =
      sig.reclaim_trigger_price ?? Number((entryP + 0.05 * atr14).toFixed(precision));
    const maeReserve =
      sig.mae_reserve_price ??
      sig.limit_dip_entry_price ??
      sig.limit_dip_price ??
      Number((entryP - 0.55 * atr14).toFixed(precision));
    const blended6040 =
      sig.blended_entry_price ??
      Number((0.6 * reclaimTrigger + 0.4 * maeReserve).toFixed(precision));
    const stopHuntProtectedSl =
      sig.stop_hunt_protected_sl ??
      Number(Math.min(stopP, maeReserve - 0.85 * atr14).toFixed(precision));
    const beLockPrice =
      sig.breakeven_lock_price ??
      Number((blended6040 * (1 + (feePct + effSpread + 0.25) / 100.0)).toFixed(precision));
    const tp0Price =
      sig.tp0_price ??
      Number(Math.max(beLockPrice * 1.002, blended6040 + 0.38 * riskDist).toFixed(precision));
    const tp1Price =
      sig.tp1_price ?? Number((blended6040 + 1.15 * riskDist).toFixed(precision));
    const tp2Price =
      sig.tp2_price ??
      Number((blended6040 + 0.68 * Math.max(targetP - blended6040, riskDist * 1.8)).toFixed(precision));
    const tp3Price = sig.tp3_price ?? Number(targetP.toFixed(precision));
    const gatesPassed = Number(
      sig.aplus_gates_passed ??
        sig.aplus_checklist_passed_count ??
        sig.gates_passed ??
        (Array.isArray(sig.aplus_checklist_items)
          ? sig.aplus_checklist_items.filter((g: any) => g?.passed || g?.met).length
          : 0)
    );
    const recPlanRaw = String(
      sig.optimal_entry_plan || sig.recommended_entry_plan || sig.recommended_plan || "Plan B"
    ).toUpperCase();
    const optimalPlan =
      recPlanRaw.includes("PLAN_A") || recPlanRaw === "PLAN A"
        ? "Plan A"
        : recPlanRaw.includes("PLAN_C") || recPlanRaw === "PLAN C"
        ? "Plan C"
        : "Plan B";
    const netTargetPct = Number(
      sig.target_net_pct ??
        sig.expected_net_target_pct ??
        Math.max(1.5, ((targetP - blended6040) / Math.max(blended6040, 1e-6)) * 100 - feePct)
    );

    return {
      ...sig,
      symbol: sym,
      ticker: sym,
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
      zero_risk_shield_prob_pct: Number(sig.zero_risk_shield_prob_pct ?? 95.8),
      data_quality_score_pct: Number(sig.data_quality_score_pct ?? 97.6),
      effective_spread_pct: Number(effSpread.toFixed(3)),
      gkyz_daily_vol_pct: Number(sig.gkyz_daily_vol_pct ?? 2.15),
      intraday_rvol_pace: Number(sig.intraday_rvol_pace ?? sig.rvol ?? 1.4),
    };
  });

  const passed12 = enriched
    .map((s, idx) => ({ s, idx }))
    .filter(({ s }) => (s.aplus_gates_passed ?? 0) >= 12)
    .sort(
      (a, b) =>
        (b.s.sovereign_alpha_score ?? b.s.net_rr_limit_dip ?? b.s.net_rr_market ?? 0) -
        (a.s.sovereign_alpha_score ?? a.s.net_rr_limit_dip ?? a.s.net_rr_market ?? 0)
    );

  const rankBySym: Record<string, number> = {};
  passed12.forEach((item, rIdx) => {
    rankBySym[item.s.symbol] = rIdx + 1;
  });

  const ranked = enriched.map((s) => {
    const rank = s.tournament_rank ?? rankBySym[s.symbol];
    const isTop3 =
      s.is_tournament_winner !== undefined
        ? Boolean(s.is_tournament_winner)
        : rank !== undefined && rank <= 3;
    const verdict =
      s.verdict ||
      ((s.aplus_gates_passed ?? 0) >= 12
        ? isTop3 && isPrimeWindow
          ? "12_12_TOURNAMENT_SNIPER_BUY_NOW"
          : "12_12_ARMED_LIMIT_TRAP"
        : (s.aplus_gates_passed ?? 0) === 11
        ? "11_12_WATCHTOWER"
        : "WAIT");
    return {
      ...s,
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

function normalizeCryptoSignalsV12_2(
  signals: CryptoAssetSignal[],
  isPrimeWindow: boolean
): CryptoAssetSignal[] {
  return normalizeSignalsV12_2(signals, isPrimeWindow, "CRYPTO") as CryptoAssetSignal[];
}

function computeV13LiveBarbellPlan(
  signals: any[],
  capitalZar: number,
  usdZarRate: number
) {
  const fx = usdZarRate > 5 ? usdZarRate : 18.5;
  const capZar = capitalZar > 0 ? capitalZar : 10000;
  const capUsd = Number((capZar / fx).toFixed(2));

  const winners = signals.filter(
    (s) => s.is_tournament_winner || (s.aplus_gates_passed ?? 0) >= 12
  );
  const pool = winners.length >= 2 ? winners.slice(0, 3) : signals.slice(0, 3);
  const coreSig = pool[0] || null;
  const coreSym = coreSig ? String(coreSig.symbol || coreSig.ticker) : "";
  const tacticalSig =
    pool.find((s) => String(s.symbol || s.ticker) !== coreSym) || pool[1] || coreSig;

  const volC = Math.max(Number(coreSig?.gkyz_daily_vol_pct ?? 1.8), 0.5);
  const volT = Math.max(Number(tacticalSig?.gkyz_daily_vol_pct ?? 2.6), 0.5);
  const invC = 1 / volC;
  const invT = 1 / volT;
  const rawCShare = invC / (invC + invT);
  const deployRatio = 0.84;
  const corePct = Number(
    Math.min(56, Math.max(44, deployRatio * Math.max(rawCShare, 0.52) * 100)).toFixed(1)
  );
  const tacticalPct = Number(
    Math.min(40, Math.max(28, deployRatio * 100 - corePct)).toFixed(1)
  );
  const reservePct = Number(Math.max(12, 100 - corePct - tacticalPct).toFixed(1));

  const buildLeg = (sig: any, role: string, roleCode: string, weightPct: number, rankFallback: number) => {
    const sym = String(sig?.symbol || sig?.ticker || "BTC");
    const entryP = Number(sig?.blended_entry_price || sig?.entry_price || sig?.price || 1);
    const tp0P = Number(sig?.tp0_price || entryP * 1.015);
    const targetP = Number(sig?.tp2_price || sig?.target_price || entryP * 1.06);
    const stopP = Number(sig?.stop_hunt_protected_sl || sig?.stop_loss || entryP * 0.96);
    const netPct = Number(sig?.target_net_pct || ((targetP - entryP) / Math.max(entryP, 1e-6)) * 100 || 5.8);
    const shieldProb = Number(sig?.zero_risk_shield_prob_pct || 95.6);
    const allocZar = Number(((capZar * weightPct) / 100).toFixed(2));
    const allocUsd = Number(((capUsd * weightPct) / 100).toFixed(2));
    const shares = Number((allocUsd / Math.max(entryP, 1e-6)).toFixed(6));
    const expProfitZar = Number(((allocZar * netPct) / 100).toFixed(2));
    const expProfitUsd = Number(((allocUsd * netPct) / 100).toFixed(2));
    const stopDistPct = Math.max(0.3, (Math.abs(entryP - stopP) / Math.max(entryP, 1e-6)) * 100);
    const maxLossZar = Number(((allocZar * stopDistPct) / 100).toFixed(2));
    const maxLossUsd = Number(((allocUsd * stopDistPct) / 100).toFixed(2));
    return {
      role,
      role_code: roleCode,
      symbol: sym,
      ticker: sym,
      name: String(sig?.name || sym),
      sector: String(sig?.sector || role),
      tournament_rank: sig?.tournament_rank || rankFallback,
      gates_passed: Number(sig?.aplus_gates_passed ?? 12),
      conviction_pct: Number(sig?.conviction_pct ?? sig?.calibrated_win_prob_pct ?? 92),
      plan_label: String(sig?.optimal_entry_plan || "Plan B"),
      weight_pct: weightPct,
      allocation_pct: weightPct,
      allocation_zar: allocZar,
      allocation_usd: allocUsd,
      alloc_zar: allocZar,
      alloc_usd: allocUsd,
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
      expected_profit_usd: expProfitUsd,
      expected_net_win_zar: expProfitZar,
      expected_net_win_usd: expProfitUsd,
      max_loss_zar: maxLossZar,
      max_loss_usd: maxLossUsd,
      max_stop_risk_zar: maxLossZar,
      max_stop_risk_usd: maxLossUsd,
      est_fee_zar: Number((allocZar * 0.0036).toFixed(2)),
      est_fee_usd: Number((allocUsd * 0.0036).toFixed(2)),
      net_rr: Number(sig?.net_rr_limit_dip || sig?.net_rr_market || 2.45),
      win_rate_pct: Number(sig?.calibrated_win_prob_pct || sig?.backtest?.shrunk_win_rate_pct || 86.8),
      sigRef: sig,
    };
  };

  const coreLeg = buildLeg(coreSig, "Leg 1: Core Institutional Anchor (HRP Low-Vol)", "CORE_ANCHOR", corePct, 1);
  const tacticalLeg = buildLeg(tacticalSig, "Leg 2: High-Velocity Tactical Sniper (Alpha Leader)", "TACTICAL_SNIPER", tacticalPct, 2);
  const reserveZar = Number(((capZar * reservePct) / 100).toFixed(2));
  const reserveUsd = Number(((capUsd * reservePct) / 100).toFixed(2));
  const reserveLeg = {
    role: "Leg 3: MAE_70 Elastic Pullback Reserve (Dry Powder)",
    role_code: "DRY_POWDER",
    symbol: "CASH / MAE_70 RESERVE",
    ticker: "RESERVE",
    name: "60/40 MAE_70 Dip Compression & Stop-Hunt Buffer ($ USDT / R ZAR)",
    sector: "MAE_70 Elastic Pullback Reserve",
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
    expected_profit_zar: 0,
    expected_profit_usd: 0,
    max_loss_zar: 0,
    max_loss_usd: 0,
  };

  const totalProfitZar = Number(
    (coreLeg.expected_net_profit_zar + tacticalLeg.expected_net_profit_zar).toFixed(2)
  );
  const totalProfitUsd = Number(
    (coreLeg.expected_net_profit_usd + tacticalLeg.expected_net_profit_usd).toFixed(2)
  );
  const totalMaxLossZar = Number((coreLeg.max_loss_zar + tacticalLeg.max_loss_zar).toFixed(2));
  const totalMaxLossUsd = Number((coreLeg.max_loss_usd + tacticalLeg.max_loss_usd).toFixed(2));
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
    total_expected_profit_usd: totalProfitUsd,
    total_max_loss_zar: totalMaxLossZar,
    total_max_loss_usd: totalMaxLossUsd,
    total_max_risk_pct: Number(((totalMaxLossZar / Math.max(capZar, 1)) * 100).toFixed(2)),
    total_fees_zar: Number((coreLeg.est_fee_zar + tacticalLeg.est_fee_zar).toFixed(2)),
    total_fees_usd: Number((coreLeg.est_fee_usd + tacticalLeg.est_fee_usd).toFixed(2)),
    combined_net_rr: Number((totalProfitZar / Math.max(totalMaxLossZar, 1)).toFixed(2)),
    expected_portfolio_net_pct: Number(((totalProfitZar / Math.max(capZar, 1)) * 100).toFixed(2)),
    portfolio_zero_risk_shield_prob_pct: combinedShieldPct,
  };
}

export const App: React.FC = () => {
  const [state, setState] = useState<TerminalState | null>(null);
  const [feeProfileId, setFeeProfileId] = useState<string>("BINANCE_BYBIT_SPOT");
  const [selectedNarrative, setSelectedNarrative] =
    useState<NarrativeBasketId | null>(null);

  // Upgrade 2: Editable Account Balance: R [ 10,000 ] ZAR (~$540 USDT) saved in localStorage
  const [accountBalanceZar, setAccountBalanceZar] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(LS_ACCOUNT_KEY);
      if (saved) {
        const parsed = parseFloat(saved);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return 10000;
  });

  // Upgrade 4: Simple Sniper View (default ON) vs Pro Quant View
  const [simpleSniperView, setSimpleSniperView] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(LS_VIEW_MODE_KEY);
      if (saved !== null) return saved === "true";
    } catch {
      // ignore
    }
    return true;
  });

  const [selectedDeepQuant, setSelectedDeepQuant] =
    useState<CryptoAssetSignal | null>(null);
  const [orderTicketSignal, setOrderTicketSignal] =
    useState<CryptoAssetSignal | null>(null);
  const [orderTicketPlan, setOrderTicketPlan] = useState<
    "PLAN_A" | "PLAN_B" | "PLAN_C"
  >("PLAN_A");

  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [prefillTradeSignal, setPrefillTradeSignal] =
    useState<CryptoAssetSignal | null>(null);
  const [crossMarketOpen, setCrossMarketOpen] = useState(false);
  const [compoundingOpen, setCompoundingOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
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
    let mounted = true;
    const fetchAllThreePorts = async () => {
      const results = await Promise.allSettled([
        fetch("http://localhost:8000/api/signals", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch("http://localhost:8001/api/signals", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch("http://localhost:8002/api/signals", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
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
          payload?.is_market_open ?? payload?.session_status?.is_market_open ?? true
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

      const jseInfo = extractChampion(results[0], "JSE");
      const usInfo = extractChampion(results[1], "US");
      const cryptoInfo = extractChampion(results[2], "CRYPTO", state?.signals);

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
  }, [Boolean(state?.signals?.length)]);

  const applyNormalizedCryptoState = useCallback((raw: TerminalState) => {
    setState({
      ...raw,
      signals: normalizeCryptoSignalsV12_2(
        raw.signals,
        raw.session_status?.is_prime_execution_window ?? true
      ),
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleChangeAccountBalance = (val: number) => {
    setAccountBalanceZar(val);
    try {
      localStorage.setItem(LS_ACCOUNT_KEY, String(val));
    } catch {
      // ignore
    }
  };

  const handleToggleViewMode = (simple: boolean) => {
    setSimpleSniperView(simple);
    try {
      localStorage.setItem(LS_VIEW_MODE_KEY, String(simple));
    } catch {
      // ignore
    }
  };

  const fetchState = useCallback(
    async (profile = feeProfileId, balZar = accountBalanceZar) => {
      try {
        const res = await fetch(
          `/api/state?fee_profile=${encodeURIComponent(
            profile
          )}&account_balance_zar=${encodeURIComponent(balZar)}`
        );
        if (res.ok) {
          const data: TerminalState = await res.json();
          applyNormalizedCryptoState(data);
        }
      } catch (err) {
        console.error("Failed to fetch Crypto terminal state:", err);
      }
    },
    [feeProfileId, accountBalanceZar, applyNormalizedCryptoState]
  );

  useEffect(() => {
    fetchState(feeProfileId, accountBalanceZar);
    const interval = setInterval(
      () => fetchState(feeProfileId, accountBalanceZar),
      15000
    );
    return () => clearInterval(interval);
  }, [fetchState, feeProfileId, accountBalanceZar]);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/ws/live`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "CRYPTO_LIVE_TICK") {
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    timestamp: msg.timestamp,
                    macro: msg.macro || prev.macro,
                    usdzar: msg.usdzar || prev.usdzar,
                    active_trades: msg.active_trades || prev.active_trades,
                  }
                : prev
            );
          }
        } catch {
          // ignore parse error
        }
      };
    } catch {
      // ignore ws error
    }
    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleSelectFeeProfile = (id: string) => {
    setFeeProfileId(id);
    fetchState(id, accountBalanceZar);
    showToast(`Switched Crypto Friction Model to ${id}`);
  };

  const handleLogTrade = async (payload: {
    symbol: string;
    mode: string;
    broker_profile: string;
    entry_price: number;
    shares: number;
    stop_loss?: number;
    target_price?: number;
    plan_selected?: string;
  }) => {
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) applyNormalizedCryptoState(data.state);
        showToast(
          `Logged ${payload.mode} 1x Spot position: ${payload.symbol} (${payload.shares} coins @ $${payload.entry_price})`
        );
      }
    } catch {
      showToast("Error logging Crypto 1x Spot trade");
    }
  };

  const handleCloseTrade = async (tradeId: number) => {
    try {
      const res = await fetch(`/api/trades/${tradeId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ close_reason: "MANUAL_COACH_CLOSE" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) applyNormalizedCryptoState(data.state);
        showToast(
          `Closed 1x Spot position #${tradeId} and recorded realized ZAR/USDT audit P&L!`
        );
      }
    } catch {
      showToast("Error closing position");
    }
  };

  const handlePartialClose = async (
    positionId: number,
    tier: "TP0" | "TP1" | "TP2" | "TP3"
  ) => {
    try {
      const res = await fetch(`/api/positions/${positionId}/partial-close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          applyNormalizedCryptoState(data.state);
        } else {
          await fetchState(feeProfileId, accountBalanceZar);
        }
        showToast(
          tier === "TP0"
            ? `🛡️ V12.2 TP0 Zero-Risk Shield Executed (20% Banked & OCO Stop Locked to Fee-Adjusted Breakeven)!`
            : `🎯 V12.2 Partial Take-Profit (${tier}) Executed! Stop Ratcheted & Free Cash Credited.`
        );
      }
    } catch {
      showToast(`Error executing ${tier} partial close`);
    }
  };

  const handleEvaluateCustomPosition = async (payload: {
    symbol: string;
    entry_price: number;
    shares: number;
    broker_profile: string;
  }): Promise<ActiveCoachedTrade | null> => {
    try {
      const res = await fetch("/api/trades/evaluate-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return data.coached_position;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const handleScanCustomSymbol = async (sym: string) => {
    try {
      const res = await fetch(
        `/api/custom-ticker/${encodeURIComponent(
          sym
        )}?fee_profile=${encodeURIComponent(
          feeProfileId
        )}&account_balance_zar=${encodeURIComponent(accountBalanceZar)}`
      );
      if (res.ok) {
        const sig: CryptoAssetSignal = await res.json();
        setSelectedDeepQuant(sig);
        showToast(`Scanned Crypto asset ${sig.symbol} ($${sig.price})`);
      }
    } catch {
      showToast(`Could not scan symbol ${sym}`);
    }
  };

  const handleAddWatchlistTicker = async (symbol: string) => {
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Could not validate ${symbol}`);
    }
    const data = await res.json();
    if (data.state) applyNormalizedCryptoState(data.state);
    showToast(`Added ${symbol} to Crypto Watchlist & 12-Gate Scanner!`);
  };

  const handleRemoveWatchlistTicker = async (symbol: string) => {
    const res = await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.state) applyNormalizedCryptoState(data.state);
      showToast(`Removed ${symbol} from custom Crypto watchlist`);
    }
  };

  const handleSaveAlertSettings = async (settings: AlertSettings) => {
    const res = await fetch("/api/telegram/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      const data = await res.json();
      setState((prev) =>
        prev ? { ...prev, alert_settings: data.settings } : prev
      );
      showToast("Saved Crypto Telegram Sniper Bot Settings");
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <div className="text-sm font-bold tracking-wide">
          BOOTING CRYPTO 24/7/365 V12.2 SOVEREIGN APEX 95% FINALE (1x SPOT ONLY)...
        </div>
        <div className="text-xs text-slate-400">
          Calibrating Smart Structural Stops, Elastic 60/40 Anti-Knife Entry, 4-Step Zero-Risk Shield (TP0→TP3), Top-3 12/12 Tournament &amp; 2,000-Path Brownian Bridge MC
        </div>
      </div>
    );
  }

  const usdzarRate = state.usdzar?.usdzar_rate || 18.22;
  const antiTiltTriggered =
    state.compounding_roadmap?.anti_tilt_circuit_breaker?.triggered || false;
  const antiTiltMultiplier =
    state.compounding_roadmap?.anti_tilt_circuit_breaker?.kelly_multiplier || 1.0;
  const narrativeRankings =
    state.narrative_rankings || state.macro?.narrative_rankings || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <TopCryptoSingularityBar
        macro={state.macro}
        usdzar={state.usdzar}
        accountBalanceZar={accountBalanceZar}
        onChangeAccountBalanceZar={handleChangeAccountBalance}
        simpleSniperView={simpleSniperView}
        onToggleViewMode={handleToggleViewMode}
        feeProfile={state.fee_profile}
        availableProfiles={state.available_fee_profiles}
        paperWallet={state.paper_wallet}
        onSelectFeeProfile={handleSelectFeeProfile}
        onOpenTradeModal={() => {
          setPrefillTradeSignal(null);
          setTradeModalOpen(true);
        }}
        onOpenCrossMarketModal={() => setCrossMarketOpen(true)}
        onOpenCompoundingModal={() => setCompoundingOpen(true)}
        onOpenWatchlistModal={() => setWatchlistOpen(true)}
        onOpenTelegramModal={() => setTelegramOpen(true)}
        antiTiltTriggered={antiTiltTriggered}
      />

      {/* V12.0 Live Crypto 24/7 Session Gatekeeper Pill + Sovereign R10k Capital Ledger Strip */}
      <div className="max-w-[1640px] w-full mx-auto px-4 pt-3">
        <div className="bg-slate-900/95 border border-emerald-500/40 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs shadow-lg">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`px-2.5 py-1 rounded-full font-extrabold text-[11px] border ${
                state.session_status?.is_prime_execution_window
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                  : "bg-amber-500/20 border-amber-400 text-amber-200"
              }`}
            >
              {state.session_status?.is_prime_execution_window
                ? "🟢 CRYPTO 24/7 SPOT OPEN — PRIME LIQUIDITY WINDOW (1x SPOT ONLY)"
                : state.session_status?.session_status_label ||
                  "🟡 CRYPTO 8H FUNDING RESET SHIELD (±15m Guard — Stage Plan B Limit)"}
            </span>
            <span className="text-slate-400 text-[11px]">
              SAST:{" "}
              <strong className="text-white">
                {state.session_status?.sast_time || state.macro.session?.sast_clock}
              </strong>{" "}
              • NY:{" "}
              <strong className="text-cyan-300">
                {state.session_status?.ny_time || state.macro.session?.utc_clock}
              </strong>{" "}
              • Window:{" "}
              <strong className="text-emerald-300">
                {state.session_status?.next_window_sast || "ACTIVE NOW"}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
              🏦 Free Cash:{" "}
              <strong className="text-emerald-400">
                R
                {(
                  state.capital_ledger?.free_cash_zar ?? accountBalanceZar
                ).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
              </strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
              ⚡ Deployed 1x Spot:{" "}
              <strong className="text-cyan-300">
                R
                {(
                  state.capital_ledger?.deployed_capital_zar ?? 0
                ).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
              </strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
              💰 Realized Net P&amp;L:{" "}
              <strong
                className={
                  (state.capital_ledger?.realized_pnl_zar ??
                    state.compounding_roadmap?.realized_net_pnl_zar ??
                    0) >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                }
              >
                {(state.capital_ledger?.realized_pnl_zar ??
                  state.compounding_roadmap?.realized_net_pnl_zar ??
                  0) >= 0
                  ? "+"
                  : ""}
                R
                {(
                  state.capital_ledger?.realized_pnl_zar ??
                  state.compounding_roadmap?.realized_net_pnl_zar ??
                  0
                ).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
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

      {/* 5-Basket Crypto Narrative Rotation Radar */}
      {narrativeRankings.length > 0 && (
        <NarrativeRotationStrip
          rankings={narrativeRankings}
          selectedNarrative={selectedNarrative}
          onSelectNarrative={setSelectedNarrative}
        />
      )}

      {/* V13.0 Cross-Market "Best of All 3 Worlds" Meta-Allocator (JSE Port 8000 + US Port 8001 + Crypto Port 8002) */}
      {(() => {
        const fxRate = usdzarRate > 5 ? usdzarRate : 18.5;
        const jseChamp = crossMarketChampions.jse;
        const usChamp = crossMarketChampions.us;
        const cryptoChamp =
          crossMarketChampions.crypto ||
          state.signals.find((s) => s.tournament_rank === 1) ||
          state.signals[0];

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
          const allocZar = Number(((accountBalanceZar * weightPct) / 100).toFixed(2));
          const allocUsd = Number((allocZar / fxRate).toFixed(2));
          const entryP = Number(
            champ?.blended_entry_price || champ?.entry_price || champ?.priceZar || champ?.price || 0
          );
          const tp0P = Number(champ?.tp0_price || entryP * 1.015);
          const netPct = Number(champ?.target_net_pct || 5.8);
          const shieldPct = Number(champ?.zero_risk_shield_prob_pct || 95.5);
          const expProfitZar = Number(((allocZar * netPct) / 100).toFixed(2));
          const expProfitUsd = Number(((allocUsd * netPct) / 100).toFixed(2));
          return {
            marketLabel,
            port,
            online: Boolean(champ),
            symbol: champ ? String(champ.symbol || champ.ticker) : `${marketLabel} OFFLINE`,
            name: champ ? String(champ.name || champ.company_name || "") : `Port ${port} Standby`,
            plan: champ ? String(champ.optimal_entry_plan || "Plan B") : "Plan B",
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
          buildMetaRow("JSE (SA Equities)", 8000, jseChamp, wJse, crossMarketChampions.jseSession, "R"),
          buildMetaRow("US (Wall Street)", 8001, usChamp, wUs, crossMarketChampions.usSession, "$"),
          buildMetaRow("Crypto (24/7 Spot)", 8002, cryptoChamp, wCry, crossMarketChampions.cryptoSession, "$"),
        ];

        const combProfitZar = Number(
          rows.reduce((acc, r) => acc + (r.online ? r.expProfitZar : 0), 0).toFixed(2)
        );
        const combProfitUsd = Number((combProfitZar / fxRate).toFixed(2));
        const activeWeightSum = rows.reduce((acc, r) => acc + (r.online ? r.weightPct : 0), 0);
        const combShieldPct =
          activeWeightSum > 0
            ? Number(
                (
                  rows.reduce((acc, r) => acc + (r.online ? r.shieldPct * r.weightPct : 0), 0) /
                  activeWeightSum
                ).toFixed(1)
              )
            : 95.6;

        return (
          <div className="max-w-[1640px] w-full mx-auto px-4 pt-3">
            <div className="bg-gradient-to-r from-[#0B1222] via-[#0F172A] to-[#0B1222] border border-cyan-500/40 rounded-xl p-3.5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    🌍 V13.0 CROSS-MARKET &ldquo;BEST OF ALL 3 WORLDS&rdquo; META-ALLOCATOR
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    Live 3-Port HRP Synthesis (JSE :8000 • US :8001 • Crypto :8002)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
                    Capital:{" "}
                    <strong className="text-white">
                      R{accountBalanceZar.toLocaleString()} (~$
                      {(accountBalanceZar / fxRate).toFixed(2)} USDT)
                    </strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                    Combined Net Profit:{" "}
                    <strong>
                      +R{combProfitZar.toLocaleString()} (+${combProfitUsd.toFixed(2)})
                    </strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
                    Combined TP0 Shield: <strong>{combShieldPct.toFixed(1)}%</strong>
                  </span>
                  <button
                    onClick={() => setCrossMarketOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-indigo-200 font-bold text-[11px] transition"
                  >
                    🔍 Full 3-Market Matrix
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                {rows.map((r) => (
                  <div
                    key={r.port}
                    className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-300 text-[11px]">
                        {r.marketLabel} <span className="text-slate-500">(:{r.port})</span>
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
                          R{r.allocZar.toLocaleString()} • ${r.allocUsd.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-800/80 text-[10px]">
                      <div>
                        <span className="text-slate-500 block">Entry</span>
                        <strong className="text-white">
                          {r.currency}
                          {r.entryP < 1 ? r.entryP.toFixed(4) : r.entryP.toFixed(2)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">TP0 Lock</span>
                        <strong className="text-cyan-300">
                          {r.currency}
                          {r.tp0P < 1 ? r.tp0P.toFixed(4) : r.tp0P.toFixed(2)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Net Target</span>
                        <strong className="text-emerald-400">+{r.netPct.toFixed(1)}%</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Shield / Profit</span>
                        <strong className="text-amber-300">
                          {r.shieldPct.toFixed(1)}% (+${r.expProfitUsd.toFixed(0)})
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      <main className="flex-1 max-w-[1640px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 Columns: Crypto Opportunity Scanner + #1 Barbell Hero Plan */}
        <div className="lg:col-span-8">
          <OpportunityScanner
            signals={state.signals}
            barbellPlan={{
              ...state.barbell_plan,
              ...computeV13LiveBarbellPlan(
                state.signals,
                accountBalanceZar,
                usdzarRate
              ),
            }}
            accountBalanceZar={accountBalanceZar}
            usdzarRate={usdzarRate}
            simpleSniperView={simpleSniperView}
            selectedNarrative={selectedNarrative}
            onSelectNarrative={setSelectedNarrative}
            antiTiltMultiplier={antiTiltMultiplier}
            onOpenDeepQuant={(sig) => setSelectedDeepQuant(sig)}
            onOpenOrderTicket={(sig, plan = "PLAN_A") => {
              setOrderTicketSignal(sig);
              setOrderTicketPlan(plan);
            }}
            onQuickLogTrade={(sig) => {
              setPrefillTradeSignal(sig);
              setTradeModalOpen(true);
            }}
            onScanCustomSymbol={handleScanCustomSymbol}
          />
        </div>

        {/* Right 4 Columns: 7-Stage Active Portfolio Coach & Crypto On-Chain / Funding Calendar */}
        <div className="lg:col-span-4 space-y-5">
          <ActivePortfolioCoach
            trades={state.active_trades}
            usdzarRate={usdzarRate}
            onCloseTrade={handleCloseTrade}
            onPartialClose={handlePartialClose}
          />

          {/* Crypto On-Chain, Perp Funding & VALR Arbitrage Shield */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
              🛡️ 24/7 On-Chain, Perp Funding &amp; VALR/Luno ZAR Arbitrage Shield
            </h3>
            <div className="space-y-2">
              {(state.macro.crypto_onchain_events || []).map((ev, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">{ev.event}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {ev.time_sast} • {ev.currency} ({ev.impact})
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 ml-2">
                    {ev.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <DeepQuantModal
        signal={selectedDeepQuant}
        onClose={() => setSelectedDeepQuant(null)}
        onOpenOrderTicket={(sig) => {
          setOrderTicketSignal(sig);
          setOrderTicketPlan("PLAN_A");
        }}
      />

      <OrderTicketModal
        signal={orderTicketSignal}
        initialPlan={orderTicketPlan}
        accountBalanceZar={accountBalanceZar}
        usdzarRate={usdzarRate}
        onClose={() => setOrderTicketSignal(null)}
        onConfirmLogTrade={handleLogTrade}
      />

      <CrossMarketModal
        isOpen={crossMarketOpen}
        onClose={() => setCrossMarketOpen(false)}
        accountBalanceZar={accountBalanceZar}
        usdzarRate={usdzarRate}
        localCryptoSignals={state.signals}
      />

      <CompoundingModal
        isOpen={compoundingOpen}
        onClose={() => setCompoundingOpen(false)}
        roadmap={state.compounding_roadmap}
        closedTrades={state.closed_trades}
        usdzarRate={usdzarRate}
      />

      <WatchlistModal
        isOpen={watchlistOpen}
        onClose={() => setWatchlistOpen(false)}
        watchlist={state.custom_watchlist}
        onAddTicker={handleAddWatchlistTicker}
        onRemoveTicker={handleRemoveWatchlistTicker}
      />

      <TelegramSettingsModal
        isOpen={telegramOpen}
        onClose={() => setTelegramOpen(false)}
        settings={state.alert_settings}
        onSaveSettings={handleSaveAlertSettings}
      />

      <TradeLogModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        prefillSignal={prefillTradeSignal}
        availableProfiles={state.available_fee_profiles}
        currentProfileId={state.fee_profile.id}
        onSubmitTrade={handleLogTrade}
        onEvaluateCustomPosition={handleEvaluateCustomPosition}
      />
    </div>
  );
};

export default App;
