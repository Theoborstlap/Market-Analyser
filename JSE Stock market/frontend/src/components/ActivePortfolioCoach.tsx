"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Rocket,
  ArrowRightLeft,
  Scissors,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { CoachedTrade, PortfolioAnalytics } from "@/types/market";
import { JSE_EQUITY_FRICTION_PCT, JSE_ETF_FRICTION_PCT } from "@/lib/config";

export interface ActivePortfolioCoachProps {
  activeTrades: CoachedTrade[];
  closedTrades: CoachedTrade[];
  analytics: PortfolioAnalytics;
  usdzarRate?: number | null;
  onScaleOut: (tradeId: number, percentage: 25 | 50) => Promise<void>;
  onPartialClose?: (
    tradeId: number,
    tier: "TP0" | "TP1" | "TP2" | "TP3"
  ) => Promise<void>;
  onCloseTrade: (tradeId: number) => Promise<void>;
  onUpdateTrade: (
    tradeId: number,
    updates: {
      entryPriceZar: number;
      shares: number;
      stopLossZar: number;
      targetPriceZar: number;
      tradeMode: "REAL_BROKER_TRADE" | "PAPER_WALLET_TRADE";
    }
  ) => Promise<void>;
  onOpenCompoundingModal?: () => void;
}

const STAGE_LADDER_META = [
  { stage: 1, title: "Initial Entry & Structural Stop", threshold: "Entry" },
  { stage: 2, title: "Momentum Confirmation", threshold: "+0.20T" },
  { stage: 3, title: "Fee-Adjusted Breakeven Lock", threshold: "+0.35T" },
  { stage: 4, title: "TP1 Partial Bank", threshold: "+0.55T" },
  { stage: 5, title: "TP2 Core Harvest", threshold: "+0.75T" },
  { stage: 6, title: "Tight Trail Compression", threshold: "+0.90T" },
  { stage: 7, title: "Parabolic Chandelier Runner", threshold: "1.00T+" },
];

export const ActivePortfolioCoach: React.FC<ActivePortfolioCoachProps> = ({
  activeTrades,
  usdzarRate,
  onScaleOut,
  onPartialClose,
  onCloseTrade,
  onUpdateTrade,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editEntry, setEditEntry] = useState<string>("");
  const [editShares, setEditShares] = useState<string>("");
  const [editStop, setEditStop] = useState<string>("");
  const [editTarget, setEditTarget] = useState<string>("");
  const [editMode, setEditMode] = useState<
    "REAL_BROKER_TRADE" | "PAPER_WALLET_TRADE"
  >("PAPER_WALLET_TRADE");

  const startEditing = (t: CoachedTrade) => {
    setEditingId(t.id);
    setEditEntry(String(t.entryPriceZar));
    setEditShares(String(t.shares));
    setEditStop(String(t.stopLossZar));
    setEditTarget(String(t.targetPriceZar));
    setEditMode(t.tradeMode);
  };

  const saveEdit = async (tradeId: number) => {
    await onUpdateTrade(tradeId, {
      entryPriceZar: Number(editEntry),
      shares: Number(editShares),
      stopLossZar: Number(editStop),
      targetPriceZar: Number(editTarget),
      tradeMode: editMode,
    });
    setEditingId(null);
  };

  const fx =
    typeof usdzarRate === "number" && Number.isFinite(usdzarRate) && usdzarRate > 0
      ? usdzarRate
      : null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            7-Stage Proportional Active Portfolio &amp; Exit Coach (V12.2)
          </h2>
          <p className="text-xs text-slate-400">
            TP0 Zero-Risk Shield (0.65R) • Stage 3 Fee-BE Lock • Stage 4.5 Whale Harvest • Stage 7+ Chandelier Runner
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
          {activeTrades.length} Open JSE Position{activeTrades.length === 1 ? "" : "s"}
        </span>
      </div>

      {activeTrades.length === 0 ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
          No open JSE positions. Click &ldquo;📋 Order Ticket&rdquo; or &ldquo;+ Log Real / Custom Trade&rdquo; on any signal to activate the 7-Stage Coach.
        </div>
      ) : (
        <div className="space-y-3">
          {activeTrades.map((t) => {
            const isReal = t.tradeMode === "REAL_BROKER_TRADE";
            const isEditing = editingId === t.id;
            const netPnlPct = Number(t.netPnlPct ?? 0);
            const netPnlZar = Number(t.netPnlZar ?? 0);
            const grossPnlPct = Number(t.grossPnlPct ?? 0);
            const isProfit = netPnlZar >= 0;
            const netUsd = fx ? netPnlZar / fx : null;

            const isTfsa = t.feeProfile === "EASYEQUITIES_TFSA";
            const frictionPct = isTfsa
              ? JSE_ETF_FRICTION_PCT
              : t.feeProfile === "INSTITUTIONAL_DMA_ZAR"
              ? 0.59
              : JSE_EQUITY_FRICTION_PCT;

            const currentPrice = Number(t.currentPriceZar ?? t.entryPriceZar ?? 0);
            const feeBe = Number(
              t.feeAdjustedBreakevenZar ||
                t.entry_be_zar ||
                t.entryBeZar ||
                t.entryPriceZar * (1 + frictionPct / 100)
            );
            const chandelier = Number(
              t.chandelierStopZar || t.chandelierTrailingStopZar || t.stopLossZar
            );
            const stageNum = Math.max(1, Math.min(7, Number(t.coachStage) || 1));

            const whaleBanner =
              t.whaleEarlyHarvestBanner ||
              t.stage_4_5_whale_banner ||
              t.stage45WhaleBanner;
            const runnerBanner =
              t.parabolicRunnerBanner ||
              t.stage_7_plus_runner_banner ||
              t.stage7PlusRunnerBanner;
            const swapBanner =
              t.opportunityCostSwapBanner ||
              t.dead_money_swap_alert ||
              t.deadMoneySwapAlert;

            const specialBadge = runnerBanner || whaleBanner;

            return (
              <div
                key={t.id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg"
              >
                {/* Top Header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-extrabold text-white">
                        {t.ticker}
                      </span>
                      <span className="text-xs text-slate-400">{t.name}</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          isReal
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                        }`}
                      >
                        {isReal ? "REAL" : "PAPER"} • {t.shares} sh
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-amber-300">
                        {frictionPct.toFixed(2)}% Friction
                      </span>
                      {t.daysHeld !== undefined && (
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300">
                          Held {t.daysHeld}d
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-indigo-300 mt-1">
                      {t.coachStageLabel || `Stage ${stageNum}`}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div
                      className={`text-base font-extrabold ${
                        isProfit ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isProfit ? "+" : ""}
                      {netPnlPct.toFixed(2)}% Net ({isProfit ? "+" : ""}R
                      {netPnlZar.toFixed(2)})
                    </div>
                    {netUsd !== null && (
                      <div className="text-xs text-cyan-300 font-bold">
                        {netUsd >= 0 ? "+" : ""}${netUsd.toFixed(2)} USD
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400">
                      Gross: {grossPnlPct >= 0 ? "+" : ""}
                      {grossPnlPct.toFixed(2)}% | Target T = +{t.targetNetPct}% Net
                    </div>
                  </div>
                </div>

                {/* Stage 4.5 Whale Early Harvest OR Stage 7+ Parabolic Runner Alert */}
                {specialBadge && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs font-extrabold flex items-center gap-2 ${
                      runnerBanner
                        ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-200"
                        : "bg-amber-950/60 border-amber-500/50 text-amber-200"
                    }`}
                  >
                    {runnerBanner ? (
                      <Rocket className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span>{specialBadge}</span>
                  </div>
                )}

                {/* Dead-Money / Opportunity Cost Swap Advisor */}
                {swapBanner && (
                  <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-rose-300">
                        🔄 Dead-Money Opportunity Cost Swap Advisor
                      </div>
                      <div className="text-[11px] mt-0.5">{swapBanner}</div>
                    </div>
                  </div>
                )}

                {/* Price & Chandelier Stop Telemetry */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Entry → Current
                    </span>
                    <span className="font-mono text-white font-semibold">
                      R{t.entryPriceZar.toFixed(2)} → R{currentPrice.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Fee Breakeven (0.35T)
                    </span>
                    <span className="font-mono text-amber-300 font-semibold">
                      R{feeBe.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Recommended Stop
                    </span>
                    <span className="font-mono text-rose-400 font-bold">
                      R{t.stopLossZar.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Chandelier Ratchet Stop
                    </span>
                    <span className="font-mono text-cyan-300 font-bold">
                      R{chandelier.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Capped Target
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      R{t.targetPriceZar.toFixed(2)} ({t.progressToTargetPct ?? 0}%)
                    </span>
                  </div>
                </div>

                {/* Action Directive Box */}
                <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-700/50 text-xs text-indigo-100 font-medium">
                  {t.coachInstruction}
                </div>

                {/* 7-Stage Visual Ladder */}
                <div className="grid grid-cols-7 gap-1 pt-1">
                  {STAGE_LADDER_META.map((step) => {
                    const active = stageNum === step.stage;
                    const reached = stageNum >= step.stage;
                    return (
                      <div
                        key={step.stage}
                        title={`${step.title} (${step.threshold})`}
                        className={`p-1.5 rounded text-center border text-[10px] transition ${
                          active
                            ? "bg-indigo-600/35 border-indigo-400 text-white font-bold shadow"
                            : reached
                            ? "bg-emerald-950/50 border-emerald-700/50 text-emerald-300"
                            : "bg-slate-950/60 border-slate-800 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          {reached && (
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          )}
                          <span>S{step.stage}</span>
                        </div>
                        <div className="font-mono text-[9px] opacity-80">
                          {step.threshold}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Inline Edit Drawer */}
                {isEditing && (
                  <div className="bg-slate-950 border border-amber-500/50 rounded-lg p-3 space-y-2.5 text-xs font-mono">
                    <div className="font-bold text-amber-300">
                      ✏️ Inline Edit Position ({t.ticker})
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block">
                          Mode
                        </label>
                        <select
                          value={editMode}
                          onChange={(e) =>
                            setEditMode(
                              e.target.value as
                                | "REAL_BROKER_TRADE"
                                | "PAPER_WALLET_TRADE"
                            )
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                        >
                          <option value="REAL_BROKER_TRADE">REAL</option>
                          <option value="PAPER_WALLET_TRADE">PAPER</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block">
                          Entry (R)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editEntry}
                          onChange={(e) => setEditEntry(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block">
                          Shares
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={editShares}
                          onChange={(e) => setEditShares(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block">
                          Stop (R)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editStop}
                          onChange={(e) => setEditStop(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block">
                          Target (R)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editTarget}
                          onChange={(e) => setEditTarget(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(t.id)}
                        className="px-3 py-1 rounded bg-emerald-600 text-white font-bold flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer Controls + V12.2 4-Step Partial Profit Buttons (TP0/TP1/TP2/TP3) */}
                <div className="space-y-2 pt-1">
                  {onPartialClose && (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-950/90 border border-slate-800 rounded-lg p-2 font-mono text-[11px]">
                      <span className="text-slate-400 text-[10px]">
                        🛡️ V12.2 4-Step Shield Ladder (Rem:{" "}
                        <strong className="text-white">
                          {t.remaining_weight_pct ?? 100}%
                        </strong>
                        ):
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => onPartialClose(t.id, "TP0")}
                          disabled={Boolean(t.tp0_hit)}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                            t.tp0_hit
                              ? "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
                              : "bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-400/60 text-emerald-200"
                          }`}
                        >
                          {t.tp0_hit
                            ? "✓ TP0 Shield Locked"
                            : "🛡️ Close 20% @ TP0 (Lock Free Trade)"}
                        </button>
                        <button
                          onClick={() => onPartialClose(t.id, "TP1")}
                          disabled={Boolean(t.tp1_hit)}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                            t.tp1_hit
                              ? "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
                              : "bg-emerald-500/15 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300"
                          }`}
                        >
                          {t.tp1_hit ? "✓ TP1 Hit" : "🎯 Close 30% @ TP1"}
                        </button>
                        <button
                          onClick={() => onPartialClose(t.id, "TP2")}
                          disabled={Boolean(t.tp2_hit)}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                            t.tp2_hit
                              ? "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
                              : "bg-cyan-500/15 hover:bg-cyan-500/30 border-cyan-500/40 text-cyan-300"
                          }`}
                        >
                          {t.tp2_hit ? "✓ TP2 Hit" : "💰 Close 30% @ TP2"}
                        </button>
                        <button
                          onClick={() => onPartialClose(t.id, "TP3")}
                          className="px-2 py-1 rounded text-[10px] font-bold bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 transition"
                        >
                          🚀 Close Final 20% @ TP3
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => onScaleOut(t.id, 25)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600/20 hover:bg-sky-600/35 text-sky-300 border border-sky-500/30 text-xs font-semibold transition"
                    >
                      <Scissors className="w-3 h-3" />
                      Scale-Out 25% &amp; Lock BE
                    </button>
                    <button
                      onClick={() => startEditing(t)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold transition"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit Fill
                    </button>
                    <button
                      onClick={() => onCloseTrade(t.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/35 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
                    >
                      <XCircle className="w-3 h-3" />
                      Close &amp; Record Audit P&amp;L
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
