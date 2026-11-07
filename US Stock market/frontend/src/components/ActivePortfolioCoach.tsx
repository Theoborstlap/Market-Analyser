import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Send,
  AlertTriangle,
  Rocket,
  ArrowRightLeft,
} from "lucide-react";
import { ActiveCoachedTrade } from "../types/market";

interface Props {
  trades: ActiveCoachedTrade[];
  usdzarRate: number;
  onCloseTrade: (id: number) => void;
  onPartialClose?: (id: number, tier: "TP0" | "TP1" | "TP2" | "TP3") => void;
  onExecuteAlpacaPaper: (trade: ActiveCoachedTrade) => void;
}

export const ActivePortfolioCoach: React.FC<Props> = ({
  trades,
  usdzarRate,
  onCloseTrade,
  onPartialClose,
  onExecuteAlpacaPaper,
}) => {
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
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          {trades.length} Open US Position{trades.length === 1 ? "" : "s"}
        </span>
      </div>

      {trades.length === 0 ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
          No open US positions. Click &ldquo;📋 Order Ticket&rdquo; or &ldquo;+ Log Real / Custom Trade&rdquo; on any signal to activate the 7-Stage Coach.
        </div>
      ) : (
        <div className="space-y-3">
          {trades.map((t) => {
            const isProfit = t.net_pnl_pct >= 0;
            const netZar =
              t.net_pnl_zar !== undefined
                ? t.net_pnl_zar
                : t.net_pnl_usd * usdzarRate;
            const chandelier =
              t.chandelier_ratchet_stop || t.recommended_stop;

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
                        {t.symbol}
                      </span>
                      <span className="text-xs text-slate-400">{t.name}</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          t.mode === "REAL"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                        }`}
                      >
                        {t.mode} • {t.shares} sh
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-amber-300">
                        {t.round_trip_fee_pct}% Friction
                      </span>
                      {t.days_held !== undefined && (
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300">
                          Held {t.days_held}d
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-indigo-300 mt-1">
                      {t.stage_label}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div
                      className={`text-base font-extrabold ${
                        isProfit ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isProfit ? "+" : ""}
                      {t.net_pnl_pct}% Net ({isProfit ? "+" : ""}$
                      {t.net_pnl_usd.toFixed(2)})
                    </div>
                    <div className="text-xs text-cyan-300 font-bold">
                      {netZar >= 0 ? "+" : ""}R {Math.round(netZar).toLocaleString()} ZAR
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Gross: {t.gross_pnl_pct >= 0 ? "+" : ""}
                      {t.gross_pnl_pct}% | Target T = +{t.target_net_pct}% Net
                    </div>
                  </div>
                </div>

                {/* UPGRADE 7: Stage 4.5 Whale Early Harvest OR Stage 7+ Parabolic Runner Alert */}
                {t.special_stage_badge && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs font-extrabold flex items-center gap-2 ${
                      t.stage_7_plus_runner_unlocked
                        ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-200"
                        : "bg-amber-950/60 border-amber-500/50 text-amber-200"
                    }`}
                  >
                    {t.stage_7_plus_runner_unlocked ? (
                      <Rocket className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span>{t.special_stage_badge}</span>
                  </div>
                )}

                {/* UPGRADE 7: Dead-Money / Opportunity Cost Swap Advisor */}
                {t.dead_money_swap_advisor && t.dead_money_swap_advisor.flagged && (
                  <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-rose-300">
                        🔄 Dead-Money Opportunity Cost Swap Advisor
                      </div>
                      <div className="text-[11px] mt-0.5">
                        {t.dead_money_swap_advisor.reason}
                      </div>
                    </div>
                  </div>
                )}

                {/* Price & Chandelier Stop Telemetry */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Entry → Current</span>
                    <span className="font-mono text-white font-semibold">
                      ${t.entry_price.toFixed(2)} → ${t.current_price.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Fee Breakeven (0.35T)
                    </span>
                    <span className="font-mono text-amber-300 font-semibold">
                      ${t.fee_adjusted_breakeven.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Recommended Stop
                    </span>
                    <span className="font-mono text-rose-400 font-bold">
                      ${t.recommended_stop.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Chandelier Ratchet Stop
                    </span>
                    <span className="font-mono text-cyan-300 font-bold">
                      ${chandelier.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Capped Target
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      ${t.target_price.toFixed(2)} ({t.progress_toward_target_pct}%)
                    </span>
                  </div>
                </div>

                {/* Action Directive Box */}
                <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-700/50 text-xs text-indigo-100 font-medium">
                  {t.action_directive}
                </div>

                {/* 7-Stage Visual Ladder */}
                <div className="grid grid-cols-7 gap-1 pt-1">
                  {t.stage_ladder.map((step) => (
                    <div
                      key={step.stage}
                      title={`${step.title} (${step.threshold})`}
                      className={`p-1.5 rounded text-center border text-[10px] transition ${
                        step.active
                          ? "bg-indigo-600/35 border-indigo-400 text-white font-bold shadow"
                          : step.reached
                          ? "bg-emerald-950/50 border-emerald-700/50 text-emerald-300"
                          : "bg-slate-950/60 border-slate-800 text-slate-500"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        {step.reached && (
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        )}
                        <span>S{step.stage}</span>
                      </div>
                      <div className="font-mono text-[9px] opacity-80">
                        {step.threshold}
                      </div>
                    </div>
                  ))}
                </div>

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

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onExecuteAlpacaPaper(t)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600/20 hover:bg-sky-600/35 text-sky-300 border border-sky-500/30 text-xs font-semibold transition"
                    >
                      <Send className="w-3 h-3" />
                      Sync Alpaca Paper Bracket
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
