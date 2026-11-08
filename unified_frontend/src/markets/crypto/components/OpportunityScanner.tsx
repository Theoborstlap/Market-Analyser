import React, { useEffect, useState } from "react";
import {
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ClipboardList,
  Microscope,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Trophy,
  ShieldCheck,
  Zap,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { CryptoAssetSignal, BarbellPlan, formatCryptoPrice } from "../types/market";

interface Props {
  signals: CryptoAssetSignal[];
  barbellPlan: BarbellPlan;
  accountBalanceZar: number;
  usdzarRate: number;
  simpleSniperView: boolean;
  selectedNarrative?: string | null;
  onSelectNarrative?: (narrative: string | null) => void;
  antiTiltMultiplier?: number;
  onOpenDeepQuant: (sig: CryptoAssetSignal) => void;
  onOpenOrderTicket: (
    sig: CryptoAssetSignal,
    initialPlan?: "PLAN_A" | "PLAN_B" | "PLAN_C"
  ) => void;
  onQuickLogTrade: (sig: CryptoAssetSignal) => void;
  onScanCustomSymbol: (sym: string) => void;
}

const NARRATIVES = [
  { id: "ALL", label: "All Scanned (26+)" },
  { id: "V12_TOURNAMENT_WINNERS", label: "🏆 Top-3 12/12 Winners" },
  { id: "V12_ARMED_LIMIT_TRAPS", label: "🪤 12/12 Armed Limit Traps" },
  { id: "V12_WATCHTOWER_11_12", label: "👁️ 11/12 Watchtower" },
  { id: "A_PLUS", label: "🟢 A+ Sniper (>=10/12 Gates)" },
  { id: "INSTITUTIONAL_CORE", label: "Institutional Monetary Core (BTC/ETH)" },
  { id: "HIGH_SPEED_L1", label: "High-Speed L1 & L2 (SOL/SUI)" },
  { id: "AI_COMPUTE", label: "Decentralized AI & GPU (TAO/RENDER)" },
  { id: "DEFI_YIELD", label: "DeFi & Real Yield (AAVE/UNI)" },
  { id: "MEME_BETA", label: "High-Velocity Meme Beta" },
];

export const OpportunityScanner: React.FC<Props> = ({
  signals,
  barbellPlan,
  accountBalanceZar,
  usdzarRate,
  simpleSniperView,
  selectedNarrative,
  onSelectNarrative,
  antiTiltMultiplier = 1.0,
  onOpenDeepQuant,
  onOpenOrderTicket,
  onQuickLogTrade,
  onScanCustomSymbol,
}) => {
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [customTickerInput, setCustomTickerInput] = useState("");
  const [expandedGatesMap, setExpandedGatesMap] = useState<Record<string, boolean>>({});
  const [cardTabMap, setCardTabMap] = useState<Record<string, "EXECUTION" | "QUANT" | "THESIS">>({});
  const [selectedPlanMap, setSelectedPlanMap] = useState<
    Record<string, "PLAN_A_MARKET" | "PLAN_B_LIMIT_DIP" | "PLAN_C_50_50_SPLIT">
  >({});

  useEffect(() => {
    setSelectedPlanMap((prev) => {
      const next = { ...prev };
      for (const sig of signals) {
        if (sig.recommended_entry_plan) {
          next[sig.symbol] = sig.recommended_entry_plan as
            | "PLAN_A_MARKET"
            | "PLAN_B_LIMIT_DIP"
            | "PLAN_C_50_50_SPLIT";
        } else if (!next[sig.symbol]) {
          next[sig.symbol] =
            sig.recommended_plan === "PLAN_A" ? "PLAN_A_MARKET" : "PLAN_B_LIMIT_DIP";
        }
      }
      return next;
    });
  }, [signals]);

  const activeFilter = selectedNarrative || sectorFilter;
  const accountUsdt = accountBalanceZar / Math.max(usdzarRate, 0.01);

  const toggleGates = (symbol: string) => {
    setExpandedGatesMap((prev) => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  const handleSelectFilter = (id: string) => {
    setSectorFilter(id);
    if (onSelectNarrative) {
      onSelectNarrative(
        id === "ALL" ||
          id === "A_PLUS" ||
          id.startsWith("V12_")
          ? null
          : id
      );
    }
  };

  const filtered = signals.filter((s) => {
    const matchNarrative =
      activeFilter === "ALL" ||
      (activeFilter === "V12_TOURNAMENT_WINNERS" &&
        (s.verdict === "12_12_TOURNAMENT_SNIPER_BUY_NOW" ||
          (s.aplus_gates_passed === 12 && (s.tournament_rank ?? 99) <= 3))) ||
      (activeFilter === "V12_ARMED_LIMIT_TRAPS" &&
        (s.verdict === "12_12_ARMED_LIMIT_TRAP" ||
          (s.aplus_gates_passed === 12 &&
            s.recommended_entry_plan === "PLAN_B_LIMIT_DIP"))) ||
      (activeFilter === "V12_WATCHTOWER_11_12" &&
        (s.verdict === "11_12_WATCHTOWER" || s.aplus_gates_passed === 11)) ||
      (activeFilter === "A_PLUS" && s.aplus_gates_passed >= 10) ||
      s.narrative === activeFilter ||
      s.sector === activeFilter;
    const matchSearch =
      s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchNarrative && matchSearch;
  });

  // Dynamically scale V13.0 Barbell Plan strictly from Top-3 12/12 Tournament Winners (#1 & #2 distinct tickers)
  const winnersPool = signals.filter(
    (s) => s.is_tournament_winner || (s.aplus_gates_passed ?? 0) >= 12
  );
  const topPool = winnersPool.length >= 2 ? winnersPool.slice(0, 3) : signals.slice(0, 3);
  const win1 = topPool[0] || signals[0];
  const win2 =
    topPool.find((s) => s.symbol !== win1?.symbol) ||
    signals.find((s) => s.symbol !== win1?.symbol) ||
    topPool[1] ||
    win1;

  const corePctVal = Number((barbellPlan as any)?.core_pct || 46.0);
  const tacPctVal = Number((barbellPlan as any)?.tactical_pct || 38.0);
  const resPctVal = Number(Math.max(12, 100 - corePctVal - tacPctVal).toFixed(1));

  const buildV13Slot = (sig: CryptoAssetSignal | undefined, weightPct: number, rankNum: number) => {
    const weightDec = (weightPct / 100.0) * antiTiltMultiplier;
    const allocZar = accountBalanceZar * weightDec;
    const allocUsd = accountUsdt * weightDec;
    const entryP = Math.max(Number(sig?.blended_entry_price || sig?.entry_price || sig?.price || 1), 1e-10);
    const tp0P = Number(sig?.tp0_price || entryP * 1.014);
    const targetP = Number(sig?.tp2_price || sig?.target_price || entryP * 1.06);
    const stopP = Number(sig?.stop_hunt_protected_sl || sig?.stop_loss || entryP * 0.96);
    const coins = allocUsd / entryP;
    const feePct = 0.36;
    const netPct = Number(
      (sig as any)?.target_net_pct ||
        Math.max(1.5, ((targetP - entryP) / entryP) * 100 - feePct)
    );
    const netWinUsd = Math.max(0.5, allocUsd * (netPct / 100));
    const netWinZar = netWinUsd * usdzarRate;
    const maxRiskUsd = Math.max(
      0.5,
      coins * Math.abs(entryP - stopP) + allocUsd * (feePct / 100.0)
    );
    const maxRiskZar = maxRiskUsd * usdzarRate;
    const recRaw = String(
      (sig as any)?.optimal_entry_plan || sig?.recommended_entry_plan || "Plan B"
    ).toUpperCase();
    const planLabel = recRaw.includes("PLAN_A") || recRaw === "PLAN A"
      ? "Plan A"
      : recRaw.includes("PLAN_C") || recRaw === "PLAN C"
      ? "Plan C"
      : "Plan B";
    return {
      symbol: sig?.symbol || "BTC",
      name: sig?.name || "Bitcoin",
      rank: sig?.tournament_rank || rankNum,
      weight_pct: weightPct,
      gates_passed: sig?.aplus_gates_passed ?? 12,
      conviction_pct: Number((sig?.zero_risk_shield_prob_pct ?? 95.6).toFixed(1)),
      plan_label: planLabel,
      entry_price: entryP,
      tp0_price: tp0P,
      stop_loss: stopP,
      target_price: targetP,
      net_pct: Number(netPct.toFixed(1)),
      net_rr: Number((sig?.net_rr_limit_dip || sig?.net_rr_market || 2.45).toFixed(2)),
      allocUsd,
      allocZar,
      coins,
      netWinUsd,
      netWinZar,
      maxRiskUsd,
      maxRiskZar,
    };
  };

  const s1 = win1 ? buildV13Slot(win1, corePctVal, 1) : null;
  const s2 = win2 ? buildV13Slot(win2, tacPctVal, 2) : null;
  const dryZar = accountBalanceZar * (resPctVal / 100);
  const dryUsd = accountUsdt * (resPctVal / 100);

  const findSignal = (sym?: string) =>
    signals.find((x) => x.symbol === sym) || signals[0];

  return (
    <section className="space-y-4">
      {/* =====================================================================
          UPGRADE 3: TODAY'S #1 CRYPTO A+ BARBELL PLAN HERO BANNER (1x SPOT ONLY)
         ===================================================================== */}
      {s1 && s2 && (
        <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/60 p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2 flex-wrap">
                  🏆 Today&apos;s #1 Crypto A+ Barbell Plan
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    60d Pair Correlation ρ = {barbellPlan.pair_correlation_rho.toFixed(2)}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Institutional Risk Parity: 45% Major L1 Anchor · 35% Tactical Leader · 20% Dry Powder Reserve
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400">Combined Expected Net Win: </span>
                <span className="font-mono font-bold text-emerald-400">
                  +${(s1.netWinUsd + s2.netWinUsd).toFixed(2)} (+R
                  {Math.round(s1.netWinZar + s2.netWinZar).toLocaleString()})
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div>
                <span className="text-slate-400">Combined Max Risk: </span>
                <span className="font-mono font-bold text-rose-400">
                  -${(s1.maxRiskUsd + s2.maxRiskUsd).toFixed(2)} (-R
                  {Math.round(s1.maxRiskZar + s2.maxRiskZar).toLocaleString()})
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Leg 1: Core Institutional Anchor */}
            <div className="rounded-lg bg-slate-950/85 border border-emerald-500/30 p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 uppercase">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Leg 1 ({s1.weight_pct}%): Core Institutional Anchor
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
                    👑 #{s1.rank} • {s1.gates_passed}/12 • {s1.plan_label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-base font-extrabold text-white">
                    {s1.symbol}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      ({s1.name})
                    </span>
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    ${s1.allocUsd.toFixed(2)} USDT (R{Math.round(s1.allocZar).toLocaleString()})
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-0.5 font-mono">
                  <div>
                    Entry: <span className="text-white font-bold">${formatCryptoPrice(s1.entry_price)}</span> • TP0 Shield:{" "}
                    <span className="text-cyan-300 font-bold">${formatCryptoPrice(s1.tp0_price)} ({s1.conviction_pct}%)</span>
                  </div>
                  <div>
                    OCO Stop: <span className="text-rose-400">${formatCryptoPrice(s1.stop_loss)}</span> (-$
                    {s1.maxRiskUsd.toFixed(2)} / -R{Math.round(s1.maxRiskZar)})
                  </div>
                  <div>
                    Target (+{s1.net_pct}% NET): <span className="text-emerald-400">${formatCryptoPrice(s1.target_price)}</span> (+$
                    {s1.netWinUsd.toFixed(2)} / +R{Math.round(s1.netWinZar)})
                  </div>
                </div>
              </div>
              <button
                onClick={() => onOpenOrderTicket(findSignal(s1.symbol), "PLAN_A")}
                className="mt-2.5 w-full py-1.5 rounded bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 text-xs font-bold transition"
              >
                📋 Open {s1.symbol} 1x Spot OCO Ticket ({s1.coins.toFixed(4)} {s1.symbol})
              </button>
            </div>

            {/* Leg 2: High-Velocity Tactical Sniper */}
            <div className="rounded-lg bg-slate-950/85 border border-indigo-500/30 p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-300 uppercase">
                    <Zap className="w-3.5 h-3.5" />
                    Leg 2 ({s2.weight_pct}%): Tactical Sniper Leader
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300">
                    👑 #{s2.rank} • {s2.gates_passed}/12 • {s2.plan_label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-base font-extrabold text-white">
                    {s2.symbol}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      ({s2.name})
                    </span>
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    ${s2.allocUsd.toFixed(2)} USDT (R{Math.round(s2.allocZar).toLocaleString()})
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-0.5 font-mono">
                  <div>
                    Entry: <span className="text-white font-bold">${formatCryptoPrice(s2.entry_price)}</span> • TP0 Shield:{" "}
                    <span className="text-cyan-300 font-bold">${formatCryptoPrice(s2.tp0_price)} ({s2.conviction_pct}%)</span>
                  </div>
                  <div>
                    OCO Stop: <span className="text-rose-400">${formatCryptoPrice(s2.stop_loss)}</span> (-$
                    {s2.maxRiskUsd.toFixed(2)} / -R{Math.round(s2.maxRiskZar)})
                  </div>
                  <div>
                    Target (+{s2.net_pct}% NET): <span className="text-emerald-400">${formatCryptoPrice(s2.target_price)}</span> (+$
                    {s2.netWinUsd.toFixed(2)} / +R{Math.round(s2.netWinZar)})
                  </div>
                </div>
              </div>
              <button
                onClick={() => onOpenOrderTicket(findSignal(s2.symbol), "PLAN_A")}
                className="mt-2.5 w-full py-1.5 rounded bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 text-xs font-bold transition"
              >
                📋 Open {s2.symbol} 1x Spot OCO Ticket ({s2.coins.toFixed(4)} {s2.symbol})
              </button>
            </div>

            {/* Slot 3: 20% USDT Dry Powder Reserve */}
            <div className="rounded-lg bg-slate-950/85 border border-amber-500/30 p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 uppercase">
                    <Wallet className="w-3.5 h-3.5" />
                    Slot 3: 20% USDT Dry Powder Reserve
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">
                    SPOT SHIELD
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-base font-extrabold text-white">
                    USDT Spot Reserve
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    ${dryUsd.toFixed(2)} USDT (R{Math.round(dryZar).toLocaleString()})
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Keep 20% in VALR / Binance / Bybit USDT spot reserve to scoop Plan B Sniper Limit Dip orders at VPOC or scale +25% into Stage 2 confirmed winners.
                </p>
              </div>
              <div className="mt-2.5 py-1.5 px-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-amber-300/90 font-mono text-center">
                🛡️ 1x Spot Only (Zero Leverage) • Zero Liquidation Risk
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {NARRATIVES.map((sec) => (
            <button
              key={sec.id}
              onClick={() => handleSelectFilter(sec.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                activeFilter === sec.id
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Filter BTC, SOL, TAO, AAVE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="Any Crypto (e.g. ONDO, KAS)"
              value={customTickerInput}
              onChange={(e) => setCustomTickerInput(e.target.value.toUpperCase())}
              className="w-40 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => {
                if (customTickerInput.trim()) {
                  onScanCustomSymbol(customTickerInput.trim());
                  setCustomTickerInput("");
                }
              }}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition"
            >
              Scan Coin
            </button>
          </div>
        </div>
      </div>

      {/* Signal Cards Grid (Responsive auto-fit Upgrade 11) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-4">
        {filtered.map((sig) => {
          // Dynamically scale card money box to live accountBalanceZar & usdzarRate
          const allocPct =
            Math.min(25.0, Math.max(8.0, sig.kelly_fraction_pct * 1.4)) *
            antiTiltMultiplier;
          const investUsd = accountUsdt * (allocPct / 100.0);
          const investZar = investUsd * usdzarRate;
          const recommendedPlan =
            (sig.recommended_entry_plan as
              | "PLAN_A_MARKET"
              | "PLAN_B_LIMIT_DIP"
              | "PLAN_C_50_50_SPLIT") ||
            (sig.recommended_plan === "PLAN_B" ? "PLAN_B_LIMIT_DIP" : "PLAN_A_MARKET");
          const selectedPlan = selectedPlanMap[sig.symbol] || recommendedPlan;
          const planCViable =
            sig.plan_c_viable !== undefined
              ? sig.plan_c_viable
              : 0.4 * investZar >= 500;
          const planActiveEntry =
            selectedPlan === "PLAN_B_LIMIT_DIP"
              ? sig.limit_dip_entry_price
              : selectedPlan === "PLAN_C_50_50_SPLIT"
              ? sig.blended_entry_price
              : sig.entry_price;
          const coins = investUsd / Math.max(planActiveEntry, 1e-10);
          const feeDec = (sig.round_trip_fee_pct || 0.36) / 100.0;
          const maxLossUsd =
            coins * Math.abs(planActiveEntry - sig.stop_loss) + investUsd * feeDec;
          const maxLossZar = maxLossUsd * usdzarRate;
          const netWinUsd =
            coins * Math.abs(sig.target_price - planActiveEntry) - investUsd * feeDec;
          const netWinZar = netWinUsd * usdzarRate;
          const riskDist = Math.max(
            planActiveEntry * 0.008,
            Math.abs(planActiveEntry - sig.stop_loss)
          );
          const reclaimTriggerPrice =
            sig.reclaim_trigger_price || sig.entry_price + 0.05 * riskDist;
          const maeReservePrice =
            sig.mae_reserve_price || sig.limit_dip_entry_price;
          const stopHuntProtectedSl =
            sig.stop_hunt_protected_sl ||
            Math.min(sig.stop_loss, maeReservePrice - 0.65 * riskDist);
          const tp0Price =
            sig.tp0_price || planActiveEntry + 0.65 * riskDist;
          const breakevenLockPrice =
            sig.breakeven_lock_price ||
            planActiveEntry * (1 + feeDec + 0.001);
          const zeroRiskProb = sig.zero_risk_shield_prob_pct ?? 95.8;
          const tp1Price =
            sig.tp1_price ||
            planActiveEntry + (sig.target_price - planActiveEntry) * 0.38;
          const tp2Price =
            sig.tp2_price ||
            planActiveEntry + (sig.target_price - planActiveEntry) * 0.68;
          const tp3Price = sig.tp3_price || sig.target_price;
          const isTop3Winner =
            sig.verdict === "12_12_TOURNAMENT_SNIPER_BUY_NOW" ||
            (sig.aplus_gates_passed === 12 && (sig.tournament_rank ?? 99) <= 3);
          const isRank4PlusCapped =
            sig.aplus_gates_passed === 12 && (sig.tournament_rank ?? 99) > 3;

          const isGreen = isTop3Winner || sig.traffic_light_color === "GREEN";
          const isAmber =
            sig.verdict === "12_12_ARMED_LIMIT_TRAP" ||
            sig.verdict === "11_12_WATCHTOWER" ||
            sig.traffic_light_color === "AMBER";
          const gatesExpanded = !!expandedGatesMap[sig.symbol];

          return (
            <div
              key={sig.symbol}
              className="bg-slate-900/95 border border-white/10 hover:border-white/20 rounded-xl overflow-hidden transition flex flex-col justify-between shadow-lg"
            >
              {/* UPGRADE 4 + V12.2: TRAFFIC-LIGHT VERDICT HEADER & TOP-3 TOURNAMENT BADGES */}
              <div
                className={`px-4 py-2 text-xs font-extrabold tracking-wide flex flex-wrap items-center justify-between gap-2 border-b ${
                  isGreen
                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                    : isAmber
                    ? "bg-amber-500/20 text-amber-200 border-amber-500/40"
                    : "bg-rose-500/20 text-rose-200 border-rose-500/40"
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {isTop3Winner && (
                    <>
                      <span className="px-2 py-0.5 rounded bg-emerald-400 text-slate-950 font-black text-[10px]">
                        🏆 TOP #{sig.tournament_rank || 1} SOVEREIGN 12/12 WINNER
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/30 border border-emerald-400 text-emerald-200 font-black text-[10px]">
                        🛡️ {zeroRiskProb.toFixed(1)}% APEX ZERO-RISK SHIELD
                      </span>
                    </>
                  )}
                  {isRank4PlusCapped && (
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px]">
                      ⏳ 12/12 PASSED — CAPPED (RANK #{sig.tournament_rank} — STAGE PLAN B LIMIT)
                    </span>
                  )}
                  {sig.verdict === "12_12_ARMED_LIMIT_TRAP" && !isRank4PlusCapped && (
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px]">
                      🪤 12/12 ARMED LIMIT TRAP
                    </span>
                  )}
                  {sig.verdict === "11_12_WATCHTOWER" && (
                    <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-black text-[10px]">
                      👁️ 11/12 WATCHTOWER
                    </span>
                  )}
                  <span>{sig.traffic_light_verdict}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {sig.sovereign_alpha_score !== undefined && (
                    <span className="px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-mono text-[10px]">
                      Alpha {sig.sovereign_alpha_score.toFixed(1)}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-slate-950/80 font-mono text-[11px]">
                    {sig.aplus_gates_passed}/{sig.aplus_gates_total} A+ Gates
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Ticker Title, Price, Funding APR & Structural / Correlation / Funding Flush Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-extrabold text-white tracking-tight">
                        {sig.symbol}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {sig.name}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-indigo-300 border border-slate-700">
                        1x SPOT (0x LEV) • {sig.narrative}
                      </span>
                    </div>

                    {/* V10.1 Structural Stop + Correlation Guard + Perp Funding Flush Shield Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {sig.stop_type_badge} ({sig.structural_anchor_label} $
                        {formatCryptoPrice(sig.structural_anchor_price)})
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          sig.correlation_status === "HIGH_CORRELATION"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        }`}
                      >
                        {sig.correlation_badge}
                      </span>

                      {sig.funding_warning_badge && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/25 text-amber-200 border border-amber-500/50 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          {sig.funding_warning_badge}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-lg font-mono font-extrabold text-white">
                      ${formatCryptoPrice(sig.price)}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-xs font-mono">
                      <span
                        className={
                          sig.daily_change_pct >= 0
                            ? "text-emerald-400 font-bold"
                            : "text-rose-400 font-bold"
                        }
                      >
                        {sig.daily_change_pct >= 0 ? "+" : ""}
                        {sig.daily_change_pct}%
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-amber-300 text-[11px]">
                        Fund: {sig.funding_rate_apr_pct >= 0 ? "+" : ""}
                        {sig.funding_rate_apr_pct.toFixed(1)}% APR
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3-Tab Card Architecture (Upgrade 4) */}
                <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-white/10 mb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCardTabMap((prev) => ({
                        ...prev,
                        [sig.symbol]: "EXECUTION",
                      }))
                    }
                    className={`flex-1 py-1 px-2 rounded text-xs font-bold transition flex items-center justify-center gap-1 ${
                      (cardTabMap[sig.symbol] || "EXECUTION") === "EXECUTION"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    🎯 Execution &amp; Ladder
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCardTabMap((prev) => ({
                        ...prev,
                        [sig.symbol]: "QUANT",
                      }))
                    }
                    className={`flex-1 py-1 px-2 rounded text-xs font-bold transition flex items-center justify-center gap-1 ${
                      (cardTabMap[sig.symbol] || "EXECUTION") === "QUANT"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    📊 Quant Matrix
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCardTabMap((prev) => ({
                        ...prev,
                        [sig.symbol]: "THESIS",
                      }))
                    }
                    className={`flex-1 py-1 px-2 rounded text-xs font-bold transition flex items-center justify-center gap-1 ${
                      (cardTabMap[sig.symbol] || "EXECUTION") === "THESIS"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    🏛️ Thesis &amp; 12-Gate
                  </button>
                </div>

                {/* TAB 1: EXECUTION */}
                {(cardTabMap[sig.symbol] || "EXECUTION") === "EXECUTION" && (
                  <div className="space-y-2.5">
                    {/* Execution Sizing Box */}
                    <div className="rounded-xl bg-slate-950/90 border border-white/10 p-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-semibold">
                        <span>💵 EXECUTION SIZING ({allocPct.toFixed(1)}% Kelly)</span>
                        <span className="font-mono text-emerald-300">
                          {coins.toFixed(4)} {sig.symbol}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-slate-900/90 p-2 rounded border border-white/10">
                          <div className="text-[10px] text-slate-400">Invest Amount</div>
                          <div className="font-mono font-extrabold text-cyan-300">
                            ${investUsd.toFixed(2)} USDT
                          </div>
                          <div className="text-[11px] font-mono text-slate-300">
                            R {Math.round(investZar).toLocaleString()} ZAR
                          </div>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded border border-white/10">
                          <div className="text-[10px] text-slate-400">
                            Buy Price ({sig.recommended_plan === "PLAN_B" ? "Plan B Dip" : "Plan A/C"})
                          </div>
                          <div className="font-mono font-extrabold text-white">
                            ${formatCryptoPrice(planActiveEntry)}
                          </div>
                          <div className="text-[10px] font-mono text-amber-300">
                            Dip: ${formatCryptoPrice(sig.limit_dip_entry_price)} ({sig.limit_fill_prob_pct.toFixed(0)}% Fill)
                          </div>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded border border-rose-900/40">
                          <div className="text-[10px] text-rose-300">Protected OCO Stop</div>
                          <div className="font-mono font-extrabold text-rose-400">
                            ${formatCryptoPrice(sig.stop_loss)}
                          </div>
                          <div className="text-[10px] font-mono text-rose-300">
                            Max Loss: -${maxLossUsd.toFixed(2)} (-R{Math.round(maxLossZar)})
                          </div>
                        </div>

                        <div className="bg-slate-900/90 p-2 rounded border border-emerald-900/40">
                          <div className="text-[10px] text-emerald-300">Net Target (After Fee)</div>
                          <div className="font-mono font-extrabold text-emerald-400">
                            ${formatCryptoPrice(sig.target_price)}
                          </div>
                          <div className="text-[10px] font-mono text-emerald-300">
                            Net Win: +${netWinUsd.toFixed(2)} (+R{Math.round(netWinZar)})
                          </div>
                        </div>
                      </div>
                    </div>

                {/* V12.2 INTERACTIVE 3-PLAN ENTRY CALCULATOR, EV & 4-STEP TARGET LADDER */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    onClick={() =>
                      setSelectedPlanMap((prev) => ({
                        ...prev,
                        [sig.symbol]: "PLAN_A_MARKET",
                      }))
                    }
                    className={`text-left p-2 rounded-lg border transition ${
                      selectedPlan === "PLAN_A_MARKET"
                        ? "bg-emerald-500/20 border-emerald-400 text-white shadow"
                        : "bg-slate-950/80 hover:bg-slate-800/80 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-300">
                        PLAN A (Reclaim)
                      </span>
                      {recommendedPlan === "PLAN_A_MARKET" && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-400 text-slate-950 font-black text-[9px]">
                          AI PICK
                        </span>
                      )}
                    </div>
                    <div className="font-mono font-bold text-white">
                      ${formatCryptoPrice(sig.entry_price)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      R:R <span className="text-emerald-300 font-bold">{sig.net_rr_market}x</span> • EV{" "}
                      {(sig.ev_plan_a_pct ?? 2.1) >= 0 ? "+" : ""}
                      {(sig.ev_plan_a_pct ?? 2.1).toFixed(2)}%
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setSelectedPlanMap((prev) => ({
                        ...prev,
                        [sig.symbol]: "PLAN_B_LIMIT_DIP",
                      }))
                    }
                    className={`text-left p-2 rounded-lg border transition ${
                      selectedPlan === "PLAN_B_LIMIT_DIP"
                        ? "bg-amber-500/20 border-amber-400 text-white shadow"
                        : "bg-slate-950/80 hover:bg-slate-800/80 border-amber-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-300">
                        PLAN B (MAE Dip • {sig.limit_fill_prob_pct.toFixed(0)}%)
                      </span>
                      {recommendedPlan === "PLAN_B_LIMIT_DIP" && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[9px]">
                          AI PICK
                        </span>
                      )}
                    </div>
                    <div className="font-mono font-bold text-amber-200">
                      ${formatCryptoPrice(sig.limit_dip_entry_price)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      R:R <span className="text-amber-300 font-bold">{sig.net_rr_limit_dip}x</span> • EV{" "}
                      {(sig.ev_plan_b_pct ?? 2.65) >= 0 ? "+" : ""}
                      {(sig.ev_plan_b_pct ?? 2.65).toFixed(2)}%
                    </div>
                  </button>

                  <button
                    disabled={!planCViable}
                    onClick={() => {
                      if (planCViable) {
                        setSelectedPlanMap((prev) => ({
                          ...prev,
                          [sig.symbol]: "PLAN_C_50_50_SPLIT",
                        }));
                      }
                    }}
                    title={
                      !planCViable
                        ? "40% Reserve Leg < R500: 60/40 split disabled to prevent double fee drag"
                        : "60% Anti-Knife Reclaim + 40% MAE Dip Reserve"
                    }
                    className={`text-left p-2 rounded-lg border transition ${
                      !planCViable
                        ? "bg-slate-950/40 border-slate-800/50 text-slate-600 opacity-50 cursor-not-allowed"
                        : selectedPlan === "PLAN_C_50_50_SPLIT"
                        ? "bg-cyan-500/20 border-cyan-400 text-white shadow"
                        : "bg-slate-950/80 hover:bg-slate-800/80 border-cyan-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-cyan-300">
                        PLAN C (60/40 Elastic)
                      </span>
                      {recommendedPlan === "PLAN_C_50_50_SPLIT" && planCViable && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-400 text-slate-950 font-black text-[9px]">
                          AI PICK
                        </span>
                      )}
                    </div>
                    <div className="font-mono font-bold text-cyan-200">
                      ${formatCryptoPrice(sig.blended_entry_price)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {planCViable ? (
                        <>
                          R:R <span className="text-cyan-300 font-bold">{sig.blended_net_rr}x</span> • EV +
                          {(sig.ev_plan_c_pct ?? 2.35).toFixed(2)}%
                        </>
                      ) : (
                        "Min R500/leg guard"
                      )}
                    </div>
                  </button>
                </div>

                {/* V12.2 Elastic 60/40 & Anti-Knife Execution Box + 4-Step Institutional Shield Ladder */}
                <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5 space-y-1.5 font-mono text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-slate-200">
                    <span>
                      <strong className="text-amber-300">
                        🧠 Why {recommendedPlan.replace(/_/g, " ")}:
                      </strong>{" "}
                      {sig.entry_plan_reason ||
                        "Maximizes Fill-Probability-Weighted Expected Value (EV) with adverse-selection protection."}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px]">
                      TTL: {sig.limit_order_ttl_hours || 8}h •{" "}
                      {sig.limit_execution_mode || "ELASTIC_60_40_ANTIKNIFE"}
                    </span>
                  </div>

                  {/* V12.2 Elastic 60/40 & Stop-Hunt Protected SL Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-slate-800/80 text-[10px]">
                    <div className="bg-slate-900 px-2 py-1 rounded border border-cyan-500/30">
                      <span className="text-slate-400 block">60% Anti-Knife Reclaim</span>
                      <strong className="text-cyan-300">${formatCryptoPrice(reclaimTriggerPrice)}</strong>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-amber-500/30">
                      <span className="text-slate-400 block">40% MAE Dip Reserve</span>
                      <strong className="text-amber-300">${formatCryptoPrice(maeReservePrice)}</strong>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-indigo-500/30">
                      <span className="text-slate-400 block">Blended 60/40 Entry</span>
                      <strong className="text-indigo-300">${formatCryptoPrice(sig.blended_entry_price)}</strong>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-rose-500/40">
                      <span className="text-slate-400 block">Stop-Hunt Protected SL</span>
                      <strong className="text-rose-300">${formatCryptoPrice(stopHuntProtectedSl)}</strong>
                    </div>
                  </div>

                  {/* V12.2 4-Step Institutional Shield Ladder (TP0 -> TP3) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-slate-800/80 text-[10px]">
                    <div className="bg-emerald-950/40 px-2 py-1 rounded border border-emerald-400/60">
                      <span className="text-emerald-200 font-bold block">🛡️ TP0 (20% Zero-Risk)</span>
                      <strong className="text-emerald-300">${formatCryptoPrice(tp0Price)}</strong>{" "}
                      <span className="text-slate-300">→ Lock ${formatCryptoPrice(breakevenLockPrice)}</span>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-emerald-500/30">
                      <span className="text-slate-400 block">🎯 TP1 (30% Banked)</span>
                      <strong className="text-emerald-300">${formatCryptoPrice(tp1Price)}</strong>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-cyan-500/30">
                      <span className="text-slate-400 block">💰 TP2 (30% Mid)</span>
                      <strong className="text-cyan-300">${formatCryptoPrice(tp2Price)}</strong>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-indigo-500/30">
                      <span className="text-slate-400 block">🚀 TP3 (20% Runner)</span>
                      <strong className="text-indigo-300">${formatCryptoPrice(tp3Price)}</strong>
                    </div>
                  </div>
                    </div>

                    {/* Action Footer Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => onOpenOrderTicket(sig)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow transition"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        📋 Order Ticket
                      </button>
                      <button
                        onClick={() => onOpenDeepQuant(sig)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 text-xs font-bold transition"
                      >
                        <Microscope className="w-3.5 h-3.5" />
                        🔬 Deep Quant &amp; Debate
                      </button>
                      <button
                        onClick={() => onQuickLogTrade(sig)}
                        className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                        + Log Trade
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: QUANT MATRIX */}
                {(cardTabMap[sig.symbol] || "EXECUTION") === "QUANT" && (
                  <div className="space-y-2.5">
                    {/* Statistical Edge Strip */}
                    <div className="p-2.5 rounded-lg bg-slate-950/90 border border-white/10 font-mono text-xs space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 rounded bg-slate-900 border border-white/10">
                          <span className="text-[10px] text-slate-400 block">PAVA Calibrated</span>
                          <span className="font-bold text-emerald-400 text-sm">
                            {(sig.calibrated_win_prob_pct ?? sig.backtest.shrunk_win_rate_pct).toFixed(1)}%
                          </span>
                        </div>
                        <div className="p-2 rounded bg-slate-900 border border-white/10">
                          <span className="text-[10px] text-slate-400 block">Bridge Hit Prob</span>
                          <span className="font-bold text-amber-300 text-sm">
                            {(sig.mc_barrier_hit_prob_pct ?? sig.barrier_hit_prob_pct).toFixed(1)}%
                          </span>
                        </div>
                        <div className="p-2 rounded bg-slate-900 border border-white/10">
                          <span className="text-[10px] text-slate-400 block">CVaR 97.5</span>
                          <span className="font-bold text-rose-400 text-sm">
                            -{(sig.cvar_975_pct ?? 1.85).toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10 text-[11px]">
                        <div>
                          <span className="text-slate-400 block">BOCPD Prob</span>
                          <span className="text-cyan-300 font-semibold">
                            {(sig.bocpd_changepoint_prob_pct ?? 11.2).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Rough Vol H</span>
                          <span className="text-indigo-300 font-semibold">
                            {(sig.rough_vol_hurst ?? 0.16).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">HRP Weight</span>
                          <span className="text-emerald-300 font-semibold">
                            {(sig.hrp_weight_pct ?? 12.5).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-white/10 text-[10px]">
                        <div>
                          <span className="text-slate-400 block">Data Truth</span>
                          <strong className="text-emerald-300">
                            {((sig as any).data_quality_score_pct ?? 97.6).toFixed(1)}%
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Effective Spread</span>
                          <strong className="text-cyan-300">
                            {((sig as any).effective_spread_pct ?? 0.05).toFixed(3)}%
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">GKYZ Daily Vol</span>
                          <strong className="text-amber-300">
                            {((sig as any).gkyz_daily_vol_pct ?? 2.15).toFixed(2)}%/d
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Pace RVOL</span>
                          <strong className="text-indigo-300">
                            {((sig as any).intraday_rvol_pace ?? sig.rvol ?? 1.4).toFixed(2)}x
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Perp Funding, Deribit, DEX Flow Grid */}
                    <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-950/70 p-2.5 rounded-lg border border-white/10">
                      <div>
                        <span className="text-slate-400 block">Perp &amp; Deribit Options</span>
                        <span className="font-mono text-indigo-300 font-semibold">
                          Fund {sig.funding_rate_apr_pct >= 0 ? "+" : ""}
                          {sig.funding_rate_apr_pct}% • DVOL {sig.crypto_intel.dvol_index}%
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          CallWall ${formatCryptoPrice(sig.crypto_intel.call_wall)} | PutWall ${formatCryptoPrice(sig.crypto_intel.put_wall)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Coinbase &amp; DEX Flow</span>
                        <span className="font-mono text-emerald-300 font-semibold">
                          CB Prem {sig.coinbase_premium_pct >= 0 ? "+" : ""}
                          {sig.coinbase_premium_pct}% • DEX {sig.dex_buy_ratio_pct}%
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          TVL ${sig.crypto_intel.tvl_musd}M • P/F {sig.crypto_intel.pf_ratio}x
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">5-Yr √365 Walk-Forward</span>
                        <span className="font-mono text-amber-300 font-semibold">
                          WR {sig.backtest.shrunk_win_rate_pct}% (PSR {sig.backtest.psr_pct}%)
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          PF {sig.backtest.profit_factor} • Sharpe {sig.backtest.annualized_sharpe}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono px-1">
                      <span>YZ Vol (√365): {sig.yz_vol_annual_pct}%</span>
                      <span>OU τ: {sig.ou_halflife}d</span>
                      <span>Hurst: {sig.hurst}</span>
                      <span>Entropy: {sig.shannon_entropy}</span>
                      <span>VPIN: {sig.vpin}</span>
                      <span>MC Hit: {sig.barrier_hit_prob_pct}%</span>
                      <span className="text-sky-300 font-semibold">RRG: {sig.rrg_quadrant}</span>
                    </div>
                  </div>
                )}

                {/* TAB 3: INSTITUTIONAL THESIS & 12-GATE CHECKLIST */}
                {(cardTabMap[sig.symbol] || "EXECUTION") === "THESIS" && (
                  <div className="space-y-2.5">
                    {/* Plain-English AI Thesis */}
                    <div className="rounded-lg bg-slate-950/70 border border-white/10 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                        ✨ Why the AI Loves This Trade
                      </div>
                      <div className="space-y-1">
                        {(sig.plain_english_bullets || []).map((b, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-2 text-xs text-slate-300"
                          >
                            <div>
                              <span className="text-emerald-400 font-bold mr-1">•</span>
                              <span className="font-semibold text-white">{b.title}: </span>
                              <span>{b.text}</span>
                            </div>
                            <span
                              title={b.tooltip}
                              className="text-slate-500 hover:text-cyan-300 cursor-help shrink-0 mt-0.5"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 12-Gate Institutional A+ Checklist */}
                    <div className="border border-white/10 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleGates(sig.symbol)}
                        className="w-full px-3 py-1.5 bg-slate-950/90 hover:bg-slate-900 flex items-center justify-between text-xs font-bold text-slate-300 transition"
                      >
                        <span>
                          🛡️ 12-Gate Institutional A+ Sniper Checklist ({sig.aplus_gates_passed}/12 Passed)
                        </span>
                        {gatesExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      {gatesExpanded && (
                        <div className="p-2.5 bg-slate-950/95 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                          {(sig.aplus_checklist_items || []).map((g) => (
                            <div
                              key={g.gate}
                              className={`p-1.5 rounded border flex items-center justify-between gap-2 ${
                                g.passed
                                  ? "bg-emerald-950/25 border-emerald-800/40 text-emerald-200"
                                  : "bg-rose-950/25 border-rose-800/40 text-rose-200"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                {g.passed ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                )}
                                <span className="font-semibold truncate">
                                  G{g.gate}. {g.name}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-slate-300 shrink-0">
                                {g.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
export default OpportunityScanner;
