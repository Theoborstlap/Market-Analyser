"use client";

import React from "react";
import {
  CheckCircle2,
  Download,
  Flame,
  Shield,
  ShieldAlert,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import { CoachedTrade, PortfolioAnalytics } from "@jse/types/market";

interface CompoundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  analytics: PortfolioAnalytics;
  closedTrades: CoachedTrade[];
  accountBalanceZar: number;
}

/** Append a unit suffix only to real numbers; pass through "NO DATA YET"/null as text. */
function fmtMetric(val: unknown, suffix: string = ""): string {
  if (val === null || val === undefined) return "NO DATA YET";
  if (typeof val === "number") {
    return Number.isFinite(val) ? `${val}${suffix}` : "NO DATA YET";
  }
  const s = String(val);
  return s === "" || Number.isNaN(Number(s)) ? s || "NO DATA YET" : `${s}${suffix}`;
}

export const CompoundingModal: React.FC<CompoundingModalProps> = ({
  isOpen,
  onClose,
  analytics,
  closedTrades,
  accountBalanceZar,
}) => {
  if (!isOpen) return null;

  const roadmap = analytics.compoundingRoadmap || {
    startingCapitalZar: accountBalanceZar || 10000,
    currentCapitalZar:
      (accountBalanceZar || 10000) +
      (analytics.totalNetRealizedPnlZar || 0) +
      (analytics.totalOpenUnrealizedNetPnlZar || 0),
    targetMilestoneZar: 15000,
    overallTargetZar: 100000,
    closedTradeCount: analytics.closedTradesCount || closedTrades.length,
    realizedWinRatePct: analytics.closedWinRatePct || 0,
    realizedProfitFactor: analytics.closedProfitFactor || 0,
    netRealizedProfitZar: analytics.totalNetRealizedPnlZar || 0,
    antiTiltShieldActive:
      analytics.circuitBreakerStatus === "HALF_RISK_RECOVERY_MODE",
    antiTiltBadge:
      analytics.circuitBreakerStatus === "HALF_RISK_RECOVERY_MODE"
        ? "🛡️ ANTI-TILT SHIELD ACTIVE: Kelly Size Halved (0.5x) & Non-A+ Setups Filtered"
        : "🟢 ANTI-TILT SHIELD CLEAR: Full Institutional Kelly Sizing Active",
    milestones: [
      { label: "R10k Base", targetZar: 10000, reached: true, progressPct: 100 },
      { label: "R15k Stage 1", targetZar: 15000, reached: false, progressPct: 20 },
      { label: "R25k Stage 2", targetZar: 25000, reached: false, progressPct: 8 },
      { label: "R50k Stage 3", targetZar: 50000, reached: false, progressPct: 4 },
      { label: "R100k Sovereign", targetZar: 100000, reached: false, progressPct: 2 },
    ],
  };

  // Scale current capital dynamically if user changed account balance
  const liveCurrentEquity = Number(
    (
      accountBalanceZar +
      (analytics.totalNetRealizedPnlZar || 0) +
      (analytics.totalOpenUnrealizedNetPnlZar || 0)
    ).toFixed(2)
  );

  const milestoneSteps = [10000, 15000, 25000, 50000, 100000];
  const overallProgressPct = Math.min(
    100,
    Math.max(2, ((liveCurrentEquity - 10000) / (100000 - 10000)) * 100)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0D1322] border border-emerald-500/50 rounded-2xl max-w-3xl w-full p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                📈 R10k → R100k Sovereign Compounding Roadmap & Anti-Tilt Shield
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Realized Audit Ledger • Prop-Firm Drawdown Guard • 1-Click SARS CGT & Audit CSV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/engine/jse/api/portfolio/export-csv"
              download
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              📥 1-Click CSV Export
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Anti-Tilt Circuit Breaker Banner */}
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-3 font-mono text-xs ${
            roadmap.antiTiltShieldActive
              ? "bg-amber-950/50 border-amber-500/60 text-amber-200"
              : "bg-emerald-950/35 border-emerald-500/40 text-emerald-200"
          }`}
        >
          {roadmap.antiTiltShieldActive ? (
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold text-sm">{roadmap.antiTiltBadge}</div>
            <p className="text-[11px] text-slate-300 mt-1 font-sans">
              {analytics.circuitBreakerReason}
            </p>
          </div>
        </div>

        {/* 4 Core Realized KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="bg-[#060911] border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] text-slate-400">CLOSED TRADE COUNT</div>
            <div className="text-lg font-extrabold text-white mt-0.5">
              {roadmap.closedTradeCount} Trades
            </div>
            <div className="text-[10px] text-slate-500">SQLite Verified</div>
          </div>

          <div className="bg-[#060911] border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] text-slate-400">REALIZED WIN RATE %</div>
            <div className="text-lg font-extrabold text-emerald-400 mt-0.5">
              {fmtMetric(roadmap.realizedWinRatePct, "%")}
            </div>
            <div className="text-[10px] text-slate-500">After JSE STT & Fees</div>
          </div>

          <div className="bg-[#060911] border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] text-slate-400">PROFIT FACTOR</div>
            <div className="text-lg font-extrabold text-cyan-300 mt-0.5">
              {fmtMetric(roadmap.realizedProfitFactor, "x")}
            </div>
            <div className="text-[10px] text-slate-500">Gross Wins / Losses</div>
          </div>

          <div className="bg-[#060911] border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] text-slate-400">NET REALIZED PROFIT</div>
            <div
              className={`text-lg font-extrabold mt-0.5 ${
                roadmap.netRealizedProfitZar >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {roadmap.netRealizedProfitZar >= 0 ? "+" : ""}R
              {roadmap.netRealizedProfitZar.toLocaleString("en-ZA", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] text-slate-500">Net ZAR P&L</div>
          </div>
        </div>

        {/* R10k -> R15k -> R25k -> R50k -> R100k Milestone Progress Bar */}
        <div className="bg-[#060911] border border-slate-800 rounded-xl p-4 space-y-3 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              Compounding Trajectory: R10k → R15k → R25k → R50k → R100k
            </span>
            <span className="text-emerald-300 font-bold">
              Current Equity: R{liveCurrentEquity.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${overallProgressPct}%` }}
            />
          </div>

          {/* 5 Milestone Nodes */}
          <div className="grid grid-cols-5 gap-2 pt-1 text-center text-xs">
            {milestoneSteps.map((stepZar, i) => {
              const reached = liveCurrentEquity >= stepZar;
              const prevStep = i === 0 ? 0 : milestoneSteps[i - 1];
              const stepProgress =
                liveCurrentEquity >= stepZar
                  ? 100
                  : liveCurrentEquity <= prevStep
                  ? 0
                  : Math.round(
                      ((liveCurrentEquity - prevStep) / (stepZar - prevStep)) * 100
                    );

              return (
                <div
                  key={stepZar}
                  className={`p-2 rounded-lg border ${
                    reached
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                      : "bg-[#0D1322] border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 font-bold">
                    {reached ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Flame className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>R{(stepZar / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="text-[10px] mt-0.5">
                    {reached ? "UNLOCKED" : `${stepProgress}%`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Closed Trades History Table */}
        <div className="bg-[#060911] border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-bold text-slate-300">
              Closed JSE Trade Audit Ledger ({closedTrades.length})
            </span>
            <span className="text-[11px] text-slate-500">
              Includes 0.25% STT & Brokerage Deductions
            </span>
          </div>

          {closedTrades.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 font-mono">
              No closed trades logged yet. Close an active swing position to populate your compounding
              audit ledger.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto pr-1">
              <table className="w-full text-left font-mono text-xs">
                <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-1.5">Ticker</th>
                    <th className="py-1.5">Shares</th>
                    <th className="py-1.5">Entry</th>
                    <th className="py-1.5">Exit</th>
                    <th className="py-1.5">Net %</th>
                    <th className="py-1.5">Net P&L (ZAR)</th>
                    <th className="py-1.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {closedTrades.map((ct) => (
                    <tr key={ct.id}>
                      <td className="py-1.5 font-bold text-white">{ct.ticker}</td>
                      <td className="py-1.5 text-slate-300">{ct.shares}</td>
                      <td className="py-1.5 text-slate-300">R{ct.entryPriceZar.toFixed(2)}</td>
                      <td className="py-1.5 text-slate-300">
                        R{(ct.exitPriceZar || ct.currentPriceZar).toFixed(2)}
                      </td>
                      <td
                        className={`py-1.5 font-bold ${
                          ct.netPnlPct >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {ct.netPnlPct >= 0 ? "+" : ""}
                        {ct.netPnlPct.toFixed(2)}%
                      </td>
                      <td
                        className={`py-1.5 font-bold ${
                          ct.realizedPnlZar >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {ct.realizedPnlZar >= 0 ? "+" : ""}R{ct.realizedPnlZar.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-slate-400 text-[10px]">
                        {ct.closeReason || "MANUAL_CLOSE"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
