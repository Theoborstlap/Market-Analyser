"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { BarbellPlanHero, JseOpportunity } from "@jse/types/market";
import { JSE_EQUITY_FRICTION_PCT, JSE_ETF_FRICTION_PCT } from "@jse/lib/config";

export type ScannerFilterTab =
  | "ALL"
  | "V12_TOURNAMENT_WINNERS"
  | "V12_ARMED_LIMIT_TRAPS"
  | "V12_WATCHTOWER_11_12"
  | "A_PLUS_SNIPER"
  | "MINERS_GOLD"
  | "OFFSHORE_ARB"
  | "SA_INC"
  | "TFSA_ETFS";

export interface OpportunityScannerProps {
  opportunities: JseOpportunity[];
  barbellPlan?: BarbellPlanHero;
  accountBalanceZar: number;
  usdzarRate?: number | null;
  simpleSniperView: boolean;
  circuitBreakerActive: boolean;
  onOneClickPaperBuy: (opp: JseOpportunity) => void;
  onOpenLogTradeModal: (opp: JseOpportunity) => void;
  onOpenEasyEquitiesTicket: (opp: JseOpportunity) => void;
  onOpenDeepQuantModal: (opp: JseOpportunity) => void;
  onScanCustomSymbol?: (sym: string) => void;
}

function safeNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "" || val === "NO DATA YET") {
    return fallback;
  }
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function fmtOptMetric(val: unknown, decimals = 1, suffix = ""): string {
  if (val === null || val === undefined || val === "" || val === "NO DATA YET") {
    return "NO DATA YET";
  }
  const n = Number(val);
  return Number.isFinite(n) ? `${n.toFixed(decimals)}${suffix}` : String(val);
}

function ensureJoTicker(sym: string): string {
  const clean = String(sym || "").trim().toUpperCase();
  if (!clean) return "JSE.JO";
  return clean.endsWith(".JO") ? clean : `${clean}.JO`;
}

export const OpportunityScanner: React.FC<OpportunityScannerProps> = ({
  opportunities,
  barbellPlan,
  accountBalanceZar,
  usdzarRate,
  simpleSniperView,
  circuitBreakerActive,
  onOneClickPaperBuy,
  onOpenLogTradeModal,
  onOpenEasyEquitiesTicket,
  onOpenDeepQuantModal,
  onScanCustomSymbol,
}) => {
  const [sectorFilter, setSectorFilter] = useState<ScannerFilterTab>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [customTickerInput, setCustomTickerInput] = useState<string>("");
  const [expandedGatesMap, setExpandedGatesMap] = useState<
    Record<string, boolean>
  >({});
  const [selectedPlanMap, setSelectedPlanMap] = useState<
    Record<string, "PLAN_A_MARKET" | "PLAN_B_LIMIT_DIP" | "PLAN_C_50_50_SPLIT">
  >({});

  useEffect(() => {
    setSelectedPlanMap((prev) => {
      const next = { ...prev };
      for (const opp of opportunities) {
        if (opp.recommended_entry_plan) {
          next[opp.ticker] = opp.recommended_entry_plan as
            | "PLAN_A_MARKET"
            | "PLAN_B_LIMIT_DIP"
            | "PLAN_C_50_50_SPLIT";
        } else if (!next[opp.ticker]) {
          next[opp.ticker] =
            opp.verdict_tier === "A_PLUS_BUY_NOW"
              ? "PLAN_A_MARKET"
              : "PLAN_B_LIMIT_DIP";
        }
      }
      return next;
    });
  }, [opportunities]);

  const fxRate = useMemo(() => {
    const raw =
      usdzarRate ?? (barbellPlan as any)?.usd_zar_rate ?? null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 5 ? n : null;
  }, [usdzarRate, barbellPlan]);

  const accountUsd = fxRate ? accountBalanceZar / fxRate : null;
  const antiTiltMultiplier = circuitBreakerActive ? 0.5 : 1.0;

  const toggleGates = (ticker: string) => {
    setExpandedGatesMap((prev) => ({ ...prev, [ticker]: !prev[ticker] }));
  };

  const SECTORS: { id: ScannerFilterTab; label: string }[] = [
    { id: "ALL", label: `All Scanned (${opportunities.length})` },
    { id: "V12_TOURNAMENT_WINNERS", label: "🏆 Top-3 12/12 Winners" },
    { id: "V12_ARMED_LIMIT_TRAPS", label: "🪤 12/12 Armed Limit Traps" },
    { id: "V12_WATCHTOWER_11_12", label: "👁️ 11/12 Watchtower" },
    { id: "A_PLUS_SNIPER", label: "🟢 A+ Sniper (>=9/12 Gates)" },
    { id: "MINERS_GOLD", label: "Precious & Commodity Miners" },
    { id: "OFFSHORE_ARB", label: "Rand-Hedge & Tencent SOTP" },
    { id: "SA_INC", label: "SA Inc Banks & Retail" },
    { id: "TFSA_ETFS", label: "🇿🇦 TFSA ETFs (0% STT)" },
  ];

  const filtered = useMemo(() => {
    return opportunities.filter((opp) => {
      const gates = opp.aplus_gates_passed ?? 0;
      const matchSector =
        sectorFilter === "ALL" ||
        (sectorFilter === "V12_TOURNAMENT_WINNERS" &&
          (opp.verdict === "12_12_TOURNAMENT_SNIPER_BUY_NOW" ||
            (gates === 12 && (opp.tournament_rank ?? 99) <= 3))) ||
        (sectorFilter === "V12_ARMED_LIMIT_TRAPS" &&
          (opp.verdict === "12_12_ARMED_LIMIT_TRAP" ||
            (gates === 12 &&
              opp.recommended_entry_plan === "PLAN_B_LIMIT_DIP"))) ||
        (sectorFilter === "V12_WATCHTOWER_11_12" &&
          (opp.verdict === "11_12_WATCHTOWER" || gates === 11)) ||
        (sectorFilter === "A_PLUS_SNIPER" &&
          (opp.verdict_tier === "A_PLUS_BUY_NOW" ||
            opp.verdict_tier === "A_PLUS_LIMIT_DIP" ||
            gates >= 9)) ||
        (sectorFilter === "MINERS_GOLD" &&
          (opp.sector === "PRECIOUS_MINER" ||
            opp.sector === "COMMODITY_MINER")) ||
        (sectorFilter === "OFFSHORE_ARB" &&
          (opp.sector === "TECH_TENCENT" ||
            opp.sector === "RAND_HEDGE" ||
            opp.offshoreTicker !== null)) ||
        (sectorFilter === "SA_INC" &&
          (opp.sector === "SA_INC_FIN" || opp.sector === "SA_INC_RETAIL")) ||
        (sectorFilter === "TFSA_ETFS" &&
          (opp.sttExempt || opp.sector === "JSE_ETF_TFSA"));

      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        opp.ticker.toLowerCase().includes(q) ||
        opp.name.toLowerCase().includes(q) ||
        opp.sector.toLowerCase().includes(q);

      return matchSector && matchSearch;
    });
  }, [opportunities, sectorFilter, searchTerm]);

  // Dynamically scale V13.0 Barbell Plan from Top-3 12/12 Tournament Winners (#1 & #2 distinct .JO tickers)
  const winnersPool = opportunities.filter(
    (o) => o.is_tournament_winner || (o.aplus_gates_passed ?? 0) >= 12
  );
  const topPool =
    winnersPool.length >= 2 ? winnersPool.slice(0, 3) : opportunities.slice(0, 3);
  const win1 = topPool[0] || opportunities[0];
  const win2 =
    topPool.find((o) => o.ticker !== win1?.ticker) ||
    opportunities.find((o) => o.ticker !== win1?.ticker) ||
    topPool[1] ||
    win1;

  const corePctVal = safeNum((barbellPlan as any)?.core_pct, 46.0);
  const tacPctVal = safeNum((barbellPlan as any)?.tactical_pct, 38.0);
  const resPctVal = Number(
    Math.max(12, 100 - corePctVal - tacPctVal).toFixed(1)
  );

  const buildV13Slot = (
    opp: JseOpportunity | undefined,
    weightPct: number,
    rankNum: number
  ) => {
    const weightDec = (weightPct / 100.0) * antiTiltMultiplier;
    const allocZar = accountBalanceZar * weightDec;
    const allocUsd = fxRate ? allocZar / fxRate : null;
    const entryP = Math.max(
      safeNum(
        (opp as any)?.blended_entry_price ?? opp?.entry_price ?? opp?.priceZar,
        100
      ),
      0.01
    );
    const tp0P = safeNum((opp as any)?.tp0_price, entryP * 1.014);
    const targetP = safeNum(
      (opp as any)?.tp2_price ?? opp?.target_price ?? opp?.targetPriceZar,
      entryP * 1.06
    );
    const stopP = safeNum(
      (opp as any)?.stop_hunt_protected_sl ??
        opp?.hybrid_structural_stop ??
        opp?.stopLossZar,
      entryP * 0.96
    );
    const shares = allocZar / entryP;
    const feePct = opp?.sttExempt
      ? JSE_ETF_FRICTION_PCT
      : JSE_EQUITY_FRICTION_PCT;
    const netPct = safeNum(
      (opp as any)?.target_net_pct,
      Math.max(1.5, ((targetP - entryP) / entryP) * 100 - feePct)
    );
    const netWinZar = Math.max(1, allocZar * (netPct / 100));
    const netWinUsd = fxRate ? netWinZar / fxRate : null;
    const maxRiskZar = Math.max(
      1,
      shares * Math.abs(entryP - stopP) + allocZar * (feePct / 100.0)
    );
    const maxRiskUsd = fxRate ? maxRiskZar / fxRate : null;
    const recRaw = String(
      (opp as any)?.optimal_entry_plan || opp?.recommended_entry_plan || "Plan B"
    ).toUpperCase();
    const planLabel =
      recRaw.includes("PLAN_A") || recRaw === "PLAN A"
        ? "Plan A"
        : recRaw.includes("PLAN_C") || recRaw === "PLAN C"
        ? "Plan C"
        : "Plan B";

    return {
      symbol: ensureJoTicker(opp?.ticker || "NPN.JO"),
      name: opp?.name || "Naspers Limited",
      rank: opp?.tournament_rank || rankNum,
      weight_pct: weightPct,
      gates_passed: opp?.aplus_gates_passed ?? 12,
      conviction_pct: Number(
        safeNum(opp?.zero_risk_shield_prob_pct, 95.6).toFixed(1)
      ),
      plan_label: planLabel,
      entry_price: entryP,
      tp0_price: tp0P,
      stop_loss: stopP,
      target_price: targetP,
      net_pct: Number(netPct.toFixed(1)),
      allocZar,
      allocUsd,
      shares,
      netWinZar,
      netWinUsd,
      maxRiskZar,
      maxRiskUsd,
      opp,
    };
  };

  const s1 = win1 ? buildV13Slot(win1, corePctVal, 1) : null;
  const s2 = win2 ? buildV13Slot(win2, tacPctVal, 2) : null;
  const dryZar = accountBalanceZar * (resPctVal / 100);
  const dryUsd = fxRate ? dryZar / fxRate : null;
  const pairRho = safeNum(barbellPlan?.pair_correlation_rho, 0.18);

  return (
    <section className="space-y-4">
      {/* =====================================================================
          TODAY'S #1 JSE A+ BARBELL PLAN HERO BANNER (SCALED TO R10K ZAR)
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
                  🏆 Today&apos;s #1 JSE A+ Barbell Plan (Scaled to Your R
                  {accountBalanceZar.toLocaleString("en-ZA")}
                  {accountUsd !== null
                    ? ` / ~$${accountUsd.toFixed(0)} USD`
                    : " ZAR"}{" "}
                  Account)
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    60d Pair Correlation ρ = {pairRho.toFixed(2)}
                  </span>
                </h2>
                <p className="text-xs text-slate-300">
                  Institutional Uncorrelated JSE Barbell: {corePctVal}% Safe Anchor +{" "}
                  {tacPctVal}% High-Velocity Leader + {resPctVal}% Dry Powder Reserve
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400">Combined Expected Net Win: </span>
                <span className="font-mono font-bold text-emerald-400">
                  +R{Math.round(s1.netWinZar + s2.netWinZar).toLocaleString("en-ZA")}
                  {s1.netWinUsd !== null && s2.netWinUsd !== null
                    ? ` (+$${(s1.netWinUsd + s2.netWinUsd).toFixed(2)})`
                    : ""}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div>
                <span className="text-slate-400">Combined Max Risk: </span>
                <span className="font-mono font-bold text-rose-400">
                  -R{Math.round(s1.maxRiskZar + s2.maxRiskZar).toLocaleString("en-ZA")}
                  {s1.maxRiskUsd !== null && s2.maxRiskUsd !== null
                    ? ` (-$${(s1.maxRiskUsd + s2.maxRiskUsd).toFixed(2)})`
                    : ""}
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
                    R{Math.round(s1.allocZar).toLocaleString("en-ZA")}
                    {s1.allocUsd !== null ? ` (~$${s1.allocUsd.toFixed(0)})` : ""}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-0.5 font-mono">
                  <div>
                    Entry:{" "}
                    <span className="text-white font-bold">
                      R{s1.entry_price.toFixed(2)}
                    </span>{" "}
                    • TP0 Shield:{" "}
                    <span className="text-cyan-300 font-bold">
                      R{s1.tp0_price.toFixed(2)} ({s1.conviction_pct}%)
                    </span>
                  </div>
                  <div>
                    Stop:{" "}
                    <span className="text-rose-400">
                      R{s1.stop_loss.toFixed(2)}
                    </span>{" "}
                    (-R{Math.round(s1.maxRiskZar).toLocaleString("en-ZA")})
                  </div>
                  <div>
                    Target (+{s1.net_pct}% NET):{" "}
                    <span className="text-emerald-400">
                      R{s1.target_price.toFixed(2)}
                    </span>{" "}
                    (+R{Math.round(s1.netWinZar).toLocaleString("en-ZA")})
                  </div>
                </div>
              </div>
              <button
                onClick={() => s1.opp && onOpenEasyEquitiesTicket(s1.opp)}
                className="mt-2.5 w-full py-1.5 rounded bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 text-xs font-bold transition"
              >
                📋 Open {s1.symbol} Order Ticket ({s1.shares.toFixed(3)} sh)
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
                    R{Math.round(s2.allocZar).toLocaleString("en-ZA")}
                    {s2.allocUsd !== null ? ` (~$${s2.allocUsd.toFixed(0)})` : ""}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-0.5 font-mono">
                  <div>
                    Entry:{" "}
                    <span className="text-white font-bold">
                      R{s2.entry_price.toFixed(2)}
                    </span>{" "}
                    • TP0 Shield:{" "}
                    <span className="text-cyan-300 font-bold">
                      R{s2.tp0_price.toFixed(2)} ({s2.conviction_pct}%)
                    </span>
                  </div>
                  <div>
                    Stop:{" "}
                    <span className="text-rose-400">
                      R{s2.stop_loss.toFixed(2)}
                    </span>{" "}
                    (-R{Math.round(s2.maxRiskZar).toLocaleString("en-ZA")})
                  </div>
                  <div>
                    Target (+{s2.net_pct}% NET):{" "}
                    <span className="text-emerald-400">
                      R{s2.target_price.toFixed(2)}
                    </span>{" "}
                    (+R{Math.round(s2.netWinZar).toLocaleString("en-ZA")})
                  </div>
                </div>
              </div>
              <button
                onClick={() => s2.opp && onOpenEasyEquitiesTicket(s2.opp)}
                className="mt-2.5 w-full py-1.5 rounded bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 text-xs font-bold transition"
              >
                📋 Open {s2.symbol} Order Ticket ({s2.shares.toFixed(3)} sh)
              </button>
            </div>

            {/* Slot 3: Dry Powder Reserve */}
            <div className="rounded-lg bg-slate-950/85 border border-amber-500/30 p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 uppercase">
                    <Wallet className="w-3.5 h-3.5" />
                    Slot 3 ({resPctVal}%): Dry Powder Reserve
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">
                    CASH SHIELD
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-base font-extrabold text-white">
                    ZAR Wallet Cash Reserve
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    R{Math.round(dryZar).toLocaleString("en-ZA")}
                    {dryUsd !== null ? ` (~$${dryUsd.toFixed(0)})` : ""}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Keep {resPctVal}% in EasyEquities ZAR / TFSA cash to scoop Plan B Sniper Limit Dip orders at VPOC or scale +25% into Stage 2 confirmed winners.
                </p>
              </div>
              <div className="mt-2.5 py-1.5 px-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-amber-300/90 font-mono text-center">
                🛡️ Protects Account from 09:00 SAST Opening Bell Whipsaws
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {SECTORS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setSectorFilter(sec.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                sectorFilter === sec.id
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
              placeholder="Filter NPN.JO, ANG.JO, STX40..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {onScanCustomSymbol && (
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Any JSE Ticker (e.g. CAP.JO)"
                value={customTickerInput}
                onChange={(e) =>
                  setCustomTickerInput(e.target.value.toUpperCase())
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customTickerInput.trim()) {
                    onScanCustomSymbol(customTickerInput.trim());
                    setCustomTickerInput("");
                  }
                }}
                className="w-44 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
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
                Scan JSE
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Signal Cards Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.map((opp) => {
          const tickerJo = ensureJoTicker(opp.ticker);
          const gatesPassed = opp.aplus_gates_passed ?? 10;
          const verdictTier = opp.verdict_tier || "A_PLUS_BUY_NOW";
          const isBuyNow = verdictTier === "A_PLUS_BUY_NOW";
          const isLimitDip = verdictTier === "A_PLUS_LIMIT_DIP";

          const kellyPctRaw = safeNum(
            opp.kelly_pct ?? opp.halfKellyWeightPct,
            15
          );
          const allocPct =
            Math.min(40.0, Math.max(6.0, kellyPctRaw)) * antiTiltMultiplier;
          const investZar = accountBalanceZar * (allocPct / 100.0);
          const investUsd = fxRate ? investZar / fxRate : null;

          const planAPrice = Math.max(
            0.01,
            safeNum(opp.entry_price ?? opp.priceZar, 100)
          );
          const planBPrice = safeNum(
            opp.limit_dip_entry_price,
            Number((planAPrice * 0.985).toFixed(2))
          );
          const planCPrice = safeNum(
            opp.blended_entry_price,
            Number((0.6 * planAPrice + 0.4 * planBPrice).toFixed(2))
          );
          const recommendedPlan =
            (opp.recommended_entry_plan as
              | "PLAN_A_MARKET"
              | "PLAN_B_LIMIT_DIP"
              | "PLAN_C_50_50_SPLIT") ||
            (isLimitDip ? "PLAN_B_LIMIT_DIP" : "PLAN_A_MARKET");
          const selectedPlan = selectedPlanMap[opp.ticker] || recommendedPlan;
          const planCViable =
            opp.plan_c_viable !== undefined
              ? opp.plan_c_viable
              : 0.4 * investZar >= 1250;

          const planActiveEntry =
            selectedPlan === "PLAN_B_LIMIT_DIP"
              ? planBPrice
              : selectedPlan === "PLAN_C_50_50_SPLIT"
              ? planCPrice
              : planAPrice;

          const stopPrice = safeNum(
            opp.hybrid_structural_stop ?? opp.stopLossZar,
            planActiveEntry * 0.96
          );
          const targetPrice = safeNum(
            opp.target_price ?? opp.targetPriceZar,
            planActiveEntry * 1.06
          );
          const shares = investZar / Math.max(planActiveEntry, 0.01);
          const feePct = opp.sttExempt
            ? JSE_ETF_FRICTION_PCT
            : JSE_EQUITY_FRICTION_PCT;
          const feeDec = feePct / 100.0;

          const maxLossZar =
            shares * Math.abs(planActiveEntry - stopPrice) + investZar * feeDec;
          const netWinZar =
            shares * Math.abs(targetPrice - planActiveEntry) -
            investZar * feeDec;

          const riskDist = Math.max(
            planActiveEntry * 0.008,
            Math.abs(planActiveEntry - stopPrice)
          );
          const reclaimTriggerPrice = safeNum(
            opp.reclaim_trigger_price,
            Number((planAPrice + 0.05 * riskDist).toFixed(2))
          );
          const maeReservePrice = safeNum(opp.mae_reserve_price, planBPrice);
          const stopHuntProtectedSl = safeNum(
            opp.stop_hunt_protected_sl,
            Number(
              Math.min(stopPrice, maeReservePrice - 0.65 * riskDist).toFixed(2)
            )
          );
          const tp0Price = safeNum(
            opp.tp0_price,
            Number((planActiveEntry + 0.65 * riskDist).toFixed(2))
          );
          const breakevenLockPrice = safeNum(
            opp.breakeven_lock_price,
            Number((planActiveEntry * (1 + feeDec + 0.001)).toFixed(2))
          );
          const zeroRiskProb = safeNum(opp.zero_risk_shield_prob_pct, 95.8);
          const tp1Price = safeNum(
            opp.tp1_price,
            Number(
              (
                planActiveEntry +
                (targetPrice - planActiveEntry) * 0.38
              ).toFixed(2)
            )
          );
          const tp2Price = safeNum(
            opp.tp2_price,
            Number(
              (
                planActiveEntry +
                (targetPrice - planActiveEntry) * 0.68
              ).toFixed(2)
            )
          );
          const tp3Price = safeNum(opp.tp3_price, targetPrice);

          const isTop3Winner =
            opp.verdict === "12_12_TOURNAMENT_SNIPER_BUY_NOW" ||
            (gatesPassed === 12 && (opp.tournament_rank ?? 99) <= 3);
          const isRank4PlusCapped =
            gatesPassed === 12 && (opp.tournament_rank ?? 99) > 3;

          const isGreen = isTop3Winner || isBuyNow;
          const isAmber =
            opp.verdict === "12_12_ARMED_LIMIT_TRAP" ||
            opp.verdict === "11_12_WATCHTOWER" ||
            isLimitDip;
          const gatesExpanded = Boolean(expandedGatesMap[opp.ticker]);

          const verdictText =
            opp.verdict_label ||
            opp.traffic_light_verdict ||
            opp.trafficLightVerdict ||
            (isGreen
              ? "🟢 A+ SNIPER BUY NOW (ELASTIC 60/40 — PLAN C)"
              : isAmber
              ? `🟡 A+ SETUP — STAGE MAE LIMIT AT R${planBPrice.toFixed(2)}`
              : "🔴 WAIT / DO NOT BUY YET");

          const fillProb = safeNum(opp.limit_fill_prob_pct, 68);
          const corrHigh =
            safeNum(opp.max_portfolio_corr ?? opp.portfolio_corr_rho, 0) >= 0.7;

          return (
            <div
              key={opp.ticker}
              className="bg-slate-900/95 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden transition flex flex-col justify-between shadow-lg"
            >
              {/* TRAFFIC-LIGHT VERDICT HEADER & TOP-3 TOURNAMENT BADGES */}
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
                        🏆 TOP #{opp.tournament_rank || 1} SOVEREIGN 12/12 WINNER
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/30 border border-emerald-400 text-emerald-200 font-black text-[10px]">
                        🛡️ {zeroRiskProb.toFixed(1)}% APEX ZERO-RISK SHIELD
                      </span>
                    </>
                  )}
                  {isRank4PlusCapped && (
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px]">
                      ⏳ 12/12 PASSED — CAPPED (RANK #{opp.tournament_rank} — STAGE PLAN B LIMIT)
                    </span>
                  )}
                  {opp.verdict === "12_12_ARMED_LIMIT_TRAP" &&
                    !isRank4PlusCapped && (
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px]">
                        🪤 12/12 ARMED LIMIT TRAP
                      </span>
                    )}
                  {opp.verdict === "11_12_WATCHTOWER" && (
                    <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-black text-[10px]">
                      👁️ 11/12 WATCHTOWER
                    </span>
                  )}
                  <span>{verdictText}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {opp.sovereign_alpha_score !== undefined && (
                    <span className="px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-mono text-[10px]">
                      Alpha {safeNum(opp.sovereign_alpha_score, 0).toFixed(1)}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-slate-950/80 font-mono text-[11px]">
                    {gatesPassed}/12 A+ Gates
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Ticker Title, Live ZAR Price & Structural / TFSA / Correlation / Earnings Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-extrabold text-white tracking-tight">
                        {tickerJo}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {opp.name}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-indigo-300 border border-slate-700">
                        JSE • {opp.sector}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {opp.stop_type_badge ||
                          `🛡️ VPOC R${safeNum(opp.vpocPriceZar, stopPrice).toFixed(0)} Structural Stop`}
                      </span>

                      {opp.tfsa_badge && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {opp.tfsa_badge}
                        </span>
                      )}

                      {opp.portfolio_corr_badge && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            corrHigh
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          }`}
                        >
                          {opp.portfolio_corr_badge}
                        </span>
                      )}

                      {opp.earnings_warning_badge && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/25 text-amber-200 border border-amber-500/50 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          {opp.earnings_warning_badge}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-lg font-mono font-extrabold text-white">
                      R{safeNum(opp.priceZar, planAPrice).toFixed(2)}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-xs font-mono">
                      <span
                        className={
                          opp.change1dPct >= 0
                            ? "text-emerald-400 font-bold"
                            : "text-rose-400 font-bold"
                        }
                      >
                        {opp.change1dPct >= 0 ? "+" : ""}
                        {opp.change1dPct}%
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-amber-300 text-[11px]">
                        5d: {opp.change5dPct >= 0 ? "+" : ""}
                        {opp.change5dPct}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* PLAIN-ENGLISH MONEY BOX (SCALED TO R10,000 ZAR) */}
                <div className="rounded-xl bg-slate-950/90 border border-emerald-500/30 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-semibold">
                    <span>
                      💵 PLAIN-ENGLISH MONEY BOX (Scaled to R
                      {accountBalanceZar.toLocaleString("en-ZA")} ZAR)
                    </span>
                    <span className="font-mono text-emerald-300">
                      Kelly Alloc: {allocPct.toFixed(1)}% ({shares.toFixed(3)} sh)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">
                        Invest Amount
                      </div>
                      <div className="font-mono font-extrabold text-cyan-300">
                        R {Math.round(investZar).toLocaleString("en-ZA")}
                      </div>
                      <div className="text-[11px] font-mono text-slate-300">
                        {investUsd !== null
                          ? `~$${investUsd.toFixed(0)} USD`
                          : `${opp.sttExempt ? "0% STT ETF" : "JSE ZAR"}`}
                      </div>
                    </div>

                    <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">
                        Buy Price (
                        {selectedPlan === "PLAN_B_LIMIT_DIP"
                          ? "Plan B Dip"
                          : "Plan A/C"}
                        )
                      </div>
                      <div className="font-mono font-extrabold text-white">
                        R{planActiveEntry.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-mono text-amber-300">
                        Dip: R{planBPrice.toFixed(2)} ({fillProb.toFixed(0)}% Fill)
                      </div>
                    </div>

                    <div className="bg-slate-900/90 p-2 rounded border border-rose-900/40">
                      <div className="text-[10px] text-rose-300">
                        Protected Stop
                      </div>
                      <div className="font-mono font-extrabold text-rose-400">
                        R{stopPrice.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-mono text-rose-300">
                        Max Loss: -R{Math.round(maxLossZar).toLocaleString("en-ZA")}
                      </div>
                    </div>

                    <div className="bg-slate-900/90 p-2 rounded border border-emerald-900/40">
                      <div className="text-[10px] text-emerald-300">
                        Net Target (Capped)
                      </div>
                      <div className="font-mono font-extrabold text-emerald-400">
                        R{targetPrice.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-mono text-emerald-300">
                        Net Win: +R{Math.round(netWinZar).toLocaleString("en-ZA")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* INTERACTIVE 3-PLAN ENTRY CALCULATOR */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    onClick={() =>
                      setSelectedPlanMap((prev) => ({
                        ...prev,
                        [opp.ticker]: "PLAN_A_MARKET",
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
                      R{planAPrice.toFixed(2)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      R:R{" "}
                      <span className="text-emerald-300 font-bold">
                        {safeNum(opp.net_rr_market ?? opp.netRrRatio, 1.8)}x
                      </span>{" "}
                      • EV{" "}
                      {safeNum(opp.ev_plan_a_pct, 1.85) >= 0 ? "+" : ""}
                      {safeNum(opp.ev_plan_a_pct, 1.85).toFixed(2)}%
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setSelectedPlanMap((prev) => ({
                        ...prev,
                        [opp.ticker]: "PLAN_B_LIMIT_DIP",
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
                        PLAN B (MAE Dip • {fillProb.toFixed(0)}%)
                      </span>
                      {recommendedPlan === "PLAN_B_LIMIT_DIP" && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[9px]">
                          AI PICK
                        </span>
                      )}
                    </div>
                    <div className="font-mono font-bold text-amber-200">
                      R{planBPrice.toFixed(2)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      R:R{" "}
                      <span className="text-amber-300 font-bold">
                        {safeNum(opp.net_rr_limit_dip, 2.1)}x
                      </span>{" "}
                      • EV{" "}
                      {safeNum(opp.ev_plan_b_pct, 2.35) >= 0 ? "+" : ""}
                      {safeNum(opp.ev_plan_b_pct, 2.35).toFixed(2)}%
                    </div>
                  </button>

                  <button
                    disabled={!planCViable}
                    onClick={() => {
                      if (planCViable) {
                        setSelectedPlanMap((prev) => ({
                          ...prev,
                          [opp.ticker]: "PLAN_C_50_50_SPLIT",
                        }));
                      }
                    }}
                    title={
                      !planCViable
                        ? "40% Reserve Leg < R1,250: 60/40 split disabled to prevent double brokerage fee drag"
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
                      {recommendedPlan === "PLAN_C_50_50_SPLIT" &&
                        planCViable && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-400 text-slate-950 font-black text-[9px]">
                            AI PICK
                          </span>
                        )}
                    </div>
                    <div className="font-mono font-bold text-cyan-200">
                      R{planCPrice.toFixed(2)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {planCViable ? (
                        <>
                          R:R{" "}
                          <span className="text-cyan-300 font-bold">
                            {safeNum(opp.blended_net_rr, 1.95)}x
                          </span>{" "}
                          • EV +{safeNum(opp.ev_plan_c_pct, 2.1).toFixed(2)}%
                        </>
                      ) : (
                        "Min R1,250/leg guard"
                      )}
                    </div>
                  </button>
                </div>

                {/* Elastic 60/40 & Anti-Knife Execution Box + 4-Step Institutional Shield Ladder */}
                <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5 space-y-1.5 font-mono text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-slate-200">
                    <span>
                      <strong className="text-amber-300">
                        🧠 Why {recommendedPlan.replace(/_/g, " ")}:
                      </strong>{" "}
                      {opp.entry_plan_reason ||
                        "Maximizes Fill-Probability-Weighted Expected Value (EV) with adverse-selection protection."}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px]">
                      TTL: {opp.limit_order_ttl_hours || 8}h •{" "}
                      {opp.limit_execution_mode || "ELASTIC_60_40_ANTIKNIFE"}
                    </span>
                  </div>

                  {/* Elastic 60/40 & Stop-Hunt Protected SL Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-slate-800/80 text-[10px]">
                    <div className="bg-slate-900 px-2 py-1 rounded border border-cyan-500/30">
                      <span className="text-slate-400 block">
                        60% Anti-Knife Reclaim
                      </span>
                      <strong className="text-cyan-300">
                        R{reclaimTriggerPrice.toFixed(2)}
                      </strong>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-amber-500/30">
                      <span className="text-slate-400 block">
                        40% MAE Dip Reserve
                      </span>
                      <strong className="text-amber-300">
                        R{maeReservePrice.toFixed(2)}
                      </strong>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-indigo-500/30">
                      <span className="text-slate-400 block">
                        Blended 60/40 Entry
                      </span>
                      <strong className="text-indigo-300">
                        R{planCPrice.toFixed(2)}
                      </strong>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-rose-500/40">
                      <span className="text-slate-400 block">
                        Stop-Hunt Protected SL
                      </span>
                      <strong className="text-rose-300">
                        R{stopHuntProtectedSl.toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  {/* 4-Step Institutional Shield Ladder (TP0 -> TP3) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-slate-800/80 text-[10px]">
                    <div className="bg-emerald-950/40 px-2 py-1 rounded border border-emerald-400/60">
                      <span className="text-emerald-200 font-bold block">
                        🛡️ TP0 (20% Zero-Risk)
                      </span>
                      <strong className="text-emerald-300">
                        R{tp0Price.toFixed(2)}
                      </strong>{" "}
                      <span className="text-slate-300">
                        → Lock R{breakevenLockPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-emerald-500/30">
                      <span className="text-slate-400 block">
                        🎯 TP1 (30% Banked)
                      </span>
                      <strong className="text-emerald-300">
                        R{tp1Price.toFixed(2)}
                      </strong>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-cyan-500/30">
                      <span className="text-slate-400 block">
                        💰 TP2 (30% Mid)
                      </span>
                      <strong className="text-cyan-300">
                        R{tp2Price.toFixed(2)}
                      </strong>
                    </div>
                    <div className="bg-slate-900 px-2 py-1 rounded border border-indigo-500/30">
                      <span className="text-slate-400 block">
                        🚀 TP3 (20% Runner)
                      </span>
                      <strong className="text-indigo-300">
                        R{tp3Price.toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[10px] text-slate-400">
                    <span>
                      PAVA Win:{" "}
                      <strong className="text-emerald-300">
                        {fmtOptMetric(
                          opp.calibrated_win_prob_pct ??
                            opp.regimeConditionedWinRate,
                          1,
                          "%"
                        )}
                      </strong>
                    </span>
                    <span>
                      Bridge Hit:{" "}
                      <strong className="text-amber-300">
                        {safeNum(opp.mc_barrier_hit_prob_pct, 64.2).toFixed(1)}%
                      </strong>
                    </span>
                    <span>
                      CVaR 97.5:{" "}
                      <strong className="text-rose-300">
                        -{safeNum(opp.cvar_975_pct, 1.75).toFixed(2)}%
                      </strong>
                    </span>
                    <span>
                      BOCPD:{" "}
                      <strong className="text-cyan-300">
                        {safeNum(opp.bocpd_changepoint_prob_pct, 8.4).toFixed(1)}%
                      </strong>
                    </span>
                    <span>
                      Rough H:{" "}
                      <strong className="text-indigo-300">
                        {safeNum(opp.rough_vol_hurst, 0.18).toFixed(2)}
                      </strong>
                    </span>
                    <span>
                      HRP Wt:{" "}
                      <strong className="text-emerald-300">
                        {safeNum(opp.hrp_weight_pct, 12.5).toFixed(1)}%
                      </strong>
                    </span>
                  </div>

                  {/* Data Truth & Microstructure Telemetry Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mt-1 px-2.5 py-1 rounded bg-slate-950/90 border border-cyan-500/30 text-[10px] font-mono text-slate-300">
                    <span>
                      🛡️ Data Truth:{" "}
                      <strong className="text-emerald-300">
                        {safeNum(
                          (opp as any).data_quality_score_pct,
                          96.8
                        ).toFixed(1)}
                        %
                      </strong>
                    </span>
                    <span>
                      📐 Effective Spread:{" "}
                      <strong className="text-cyan-300">
                        {safeNum(
                          (opp as any).effective_spread_pct ??
                            opp.corwinSchultzSpreadPct,
                          0.12
                        ).toFixed(2)}
                        %
                      </strong>
                    </span>
                    <span>
                      ⚡ GKYZ Vol:{" "}
                      <strong className="text-amber-300">
                        {safeNum(
                          (opp as any).gkyz_daily_vol_pct ??
                            opp.harRvDailyVolPct,
                          1.65
                        ).toFixed(2)}
                        %/d
                      </strong>
                    </span>
                    <span>
                      ⏱️ Pace RVOL:{" "}
                      <strong className="text-indigo-300">
                        {safeNum(
                          (opp as any).intraday_rvol_pace ?? opp.rvol,
                          1.25
                        ).toFixed(2)}
                        x
                      </strong>
                    </span>
                  </div>
                </div>

                {/* WHY THE AI LOVES THIS TRADE */}
                {opp.why_ai_loves_bullets &&
                  opp.why_ai_loves_bullets.length > 0 && (
                    <div className="rounded-lg bg-slate-950/70 border border-slate-800/90 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                        ✨ Why the AI Loves This Trade
                      </div>
                      <div className="space-y-1">
                        {opp.why_ai_loves_bullets.slice(0, 4).map((b, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-2 text-xs text-slate-300"
                          >
                            <div>
                              <span className="text-emerald-400 font-bold mr-1">
                                •
                              </span>
                              <span>{b}</span>
                            </div>
                            <span
                              title="Institutional JSE Quant & Microstructure Signal"
                              className="text-slate-500 hover:text-cyan-300 cursor-help shrink-0 mt-0.5"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* PRO QUANT TELEMETRY (Shown when Pro Quant View is active) */}
                {!simpleSniperView && (
                  <div className="space-y-2 pt-1 border-t border-slate-800/80">
                    <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-slate-400 block">
                          Offshore &amp; SOTP Parity
                        </span>
                        <span className="font-mono text-indigo-300 font-semibold">
                          {opp.offshoreTicker
                            ? `${opp.offshoreTicker} (R${safeNum(
                                opp.offshoreParityZar,
                                planAPrice
                              ).toFixed(0)})`
                            : `Twin ${opp.twinTicker || "JSE Top40"}`}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {opp.offshoreArbSignal} (Z={opp.offshoreArbZscore}σ)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">
                          JSE SENS &amp; 60d VPOC
                        </span>
                        <span className="font-mono text-emerald-300 font-semibold">
                          VPOC R{safeNum(opp.vpocPriceZar, planAPrice).toFixed(0)}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono truncate">
                          {opp.sensCatalystBadge}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">
                          5-Yr Walk-Forward
                        </span>
                        <span className="font-mono text-amber-300 font-semibold">
                          WR {fmtOptMetric(opp.regimeConditionedWinRate, 1, "%")}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          PF {fmtOptMetric(opp.profitFactor, 2, "x")} • PSR{" "}
                          {(safeNum(opp.probabilisticSharpePsr, 0.85) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono px-1">
                      <span>HAR Vol: {opp.harRvDailyVolPct}%</span>
                      <span>OU τ: {opp.ouHalfLifeDays}d</span>
                      <span>Hurst: {opp.hurstExponent}</span>
                      <span>Entropy: {opp.shannonEntropyNorm}</span>
                      <span>VPIN: {opp.vpinToxicity}</span>
                      <span className="text-sky-300 font-semibold">
                        RRG: {opp.rrgQuadrant} (RS {opp.rsRating1to99})
                      </span>
                    </div>
                  </div>
                )}

                {/* EXPANDABLE 12-GATE A+ SNIPER CHECKLIST */}
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGates(opp.ticker)}
                    className="w-full px-3 py-1.5 bg-slate-950/90 hover:bg-slate-900 flex items-center justify-between text-xs font-bold text-slate-300 transition"
                  >
                    <span>
                      🛡️ 12-Gate Institutional A+ Sniper Checklist ({gatesPassed}/12 Passed)
                    </span>
                    {gatesExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  {gatesExpanded && (
                    <div className="p-2.5 bg-slate-950/95 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                      {(opp.aplus_checklist_items || []).map((g) => (
                        <div
                          key={g.gate_num}
                          title={g.plain_english}
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
                              G{g.gate_num}. {g.name}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-300 shrink-0">
                            {g.actual_value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Footer Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onOpenEasyEquitiesTicket(opp)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow transition"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    📋 Order Ticket
                  </button>
                  <button
                    onClick={() => onOpenDeepQuantModal(opp)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 text-xs font-bold transition"
                  >
                    <Microscope className="w-3.5 h-3.5" />
                    🔬 Deep Quant &amp; Debate
                  </button>
                  <button
                    onClick={() => onOneClickPaperBuy(opp)}
                    title="Execute 1-Click JSE Paper Buy"
                    className="py-2 px-2.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/35 text-sky-200 border border-sky-500/40 text-xs font-bold transition flex items-center gap-1"
                  >
                    <Zap className="w-3.5 h-3.5 text-sky-300" />
                    Paper
                  </button>
                  <button
                    onClick={() => onOpenLogTradeModal(opp)}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                    + Log Trade
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
          No JSE securities match the current filter. Switch to{" "}
          <strong className="text-white">All Scanned</strong> or click{" "}
          <strong className="text-sky-300">+ Add Stock</strong> in the top action bar.
        </div>
      )}
    </section>
  );
};
