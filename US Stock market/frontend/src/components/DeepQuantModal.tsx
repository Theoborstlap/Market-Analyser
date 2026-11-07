import React, { useState } from "react";
import {
  X,
  Activity,
  Brain,
  BarChart2,
  Layers,
  CheckCircle2,
  XCircle,
  ClipboardList,
} from "lucide-react";
import { USEquitySignal } from "../types/market";

interface Props {
  signal: USEquitySignal | null;
  onClose: () => void;
  onOpenOrderTicket?: (sig: USEquitySignal) => void;
}

export const DeepQuantModal: React.FC<Props> = ({
  signal,
  onClose,
  onOpenOrderTicket,
}) => {
  const [activeTab, setActiveTab] = useState<"GATES" | "STOCHASTIC" | "OPTIONS_SEC" | "AGENTS">(
    "GATES"
  );

  if (!signal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-5xl w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded text-xs font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                V10.1 DEEP QUANT &amp; MULTI-AGENT AUDIT
              </span>
              <h3 className="text-lg font-extrabold text-white">
                {signal.symbol} — {signal.name} (${signal.price.toFixed(2)})
              </h3>
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300">
                {signal.aplus_gates_passed}/{signal.aplus_gates_total} A+ Gates • {signal.conviction_pct}% Conviction
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {signal.traffic_light_verdict} • {signal.stop_type_badge}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenOrderTicket && (
              <button
                onClick={() => {
                  onClose();
                  onOpenOrderTicket(signal);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                📋 Open Order Ticket
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab("GATES")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeTab === "GATES"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            1. 12-Gate A+ &amp; 3-Plan Geometry
          </button>
          <button
            onClick={() => setActiveTab("STOCHASTIC")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeTab === "STOCHASTIC"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            2. QuantGuild SDE, Markov &amp; Microstructure
          </button>
          <button
            onClick={() => setActiveTab("OPTIONS_SEC")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeTab === "OPTIONS_SEC"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            3. US Options GEX, SEC Form 4 &amp; 5-Yr Backtest
          </button>
          <button
            onClick={() => setActiveTab("AGENTS")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeTab === "AGENTS"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            4. TradingAgents 3-Round Debate &amp; Red-Team
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5 text-xs">
          {activeTab === "GATES" && (
            <div className="space-y-4">
              {/* 3-Plan Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30">
                  <div className="text-emerald-300 font-extrabold">
                    Plan A: Market Entry Now
                  </div>
                  <div className="text-base font-mono font-bold text-white mt-1">
                    Entry: ${signal.entry_price.toFixed(2)}
                  </div>
                  <div className="font-mono text-slate-300 mt-1">
                    Stop: ${signal.stop_loss.toFixed(2)} | Target: $
                    {signal.target_price.toFixed(2)}
                  </div>
                  <div className="font-mono font-bold text-emerald-400 mt-1">
                    Net R:R: {signal.net_rr_market}x (After {signal.round_trip_fee_pct}% Fee)
                  </div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30">
                  <div className="text-amber-300 font-extrabold">
                    Plan B: Sniper Limit Dip ({signal.limit_fill_prob_pct.toFixed(0)}% 24h Fill)
                  </div>
                  <div className="text-base font-mono font-bold text-amber-200 mt-1">
                    Dip Entry: ${signal.limit_dip_entry_price.toFixed(2)}
                  </div>
                  <div className="font-mono text-slate-300 mt-1">
                    Anchored near VPOC ${signal.vpoc.toFixed(2)} / VAL ${signal.val.toFixed(2)}
                  </div>
                  <div className="font-mono font-bold text-amber-300 mt-1">
                    Net R:R: {signal.net_rr_limit_dip}x
                  </div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-cyan-500/30">
                  <div className="text-cyan-300 font-extrabold">
                    Plan C: 50/50 Institutional Scale-In
                  </div>
                  <div className="text-base font-mono font-bold text-cyan-200 mt-1">
                    Blended Entry: ${signal.blended_entry_price.toFixed(2)}
                  </div>
                  <div className="font-mono text-slate-300 mt-1">
                    50% Market Now + 50% Limit Dip
                  </div>
                  <div className="font-mono font-bold text-cyan-300 mt-1">
                    Blended Net R:R: {signal.blended_net_rr}x
                  </div>
                </div>
              </div>

              {/* 12-Gate Checklist Grid */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <div className="font-extrabold text-white text-sm">
                  12-Gate Institutional A+ Sniper Verification ({signal.aplus_gates_passed}/12 Passed)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(signal.aplus_checklist_items || []).map((g) => (
                    <div
                      key={g.gate}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        g.passed
                          ? "bg-emerald-950/30 border-emerald-700/40 text-emerald-200"
                          : "bg-rose-950/30 border-rose-700/40 text-rose-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {g.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold">
                            Gate {g.gate}: {g.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Req: {g.threshold}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-right">{g.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "STOCHASTIC" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400">Yang-Zhang Volatility (σ_YZ)</div>
                  <div className="text-base font-mono font-bold text-white mt-0.5">
                    {signal.yz_vol_annual_pct}% ann.
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400">OU SDE Half-Life (τ_1/2)</div>
                  <div className="text-base font-mono font-bold text-cyan-300 mt-0.5">
                    {signal.ou_halflife}d (θ=${signal.ou_theta})
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400">Split Conformal 90% Interval</div>
                  <div className="text-base font-mono font-bold text-emerald-300 mt-0.5">
                    [${signal.conformal_p05}, ${signal.conformal_p95}]
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400">2,000-Path MC Barrier Hit</div>
                  <div className="text-base font-mono font-bold text-amber-300 mt-0.5">
                    {signal.barrier_hit_prob_pct}% (P50 ${signal.mc_p50})
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 font-mono">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">FracDiff (d=0.40) Z</span>
                  <span className="text-white font-bold">{signal.fracdiff_d04_zscore}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Hurst Exponent (H)</span>
                  <span className="text-emerald-300 font-bold">{signal.hurst}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Variance Ratio VR(5)</span>
                  <span className="text-white font-bold">{signal.vr5}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Shannon Entropy S_norm</span>
                  <span className="text-cyan-300 font-bold">{signal.shannon_entropy}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Wasserstein-1 (W_1)</span>
                  <span className="text-white font-bold">{signal.wasserstein_1}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">VPIN Order Toxicity</span>
                  <span className="text-amber-300 font-bold">{signal.vpin}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Hawkes Ratio (λ/μ)</span>
                  <span className="text-white font-bold">{signal.hawkes_branching_ratio}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Corwin-Schultz Spread</span>
                  <span className="text-white font-bold">{signal.corwin_schultz_spread_bps} bps</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Volume Profile VPOC</span>
                  <span className="text-indigo-300 font-bold">
                    ${signal.vpoc} (VAH ${signal.vah} / VAL ${signal.val})
                  </span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Kalman Twin &amp; RRG</span>
                  <span className="text-emerald-300 font-bold">
                    {signal.rrg_quadrant} (Z={signal.twin_zscore})
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "OPTIONS_SEC" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-extrabold text-indigo-300 text-sm">
                    US Options Chain GEX, Call/Put Wall &amp; 25-Delta Skew
                  </div>
                  <div className="font-mono space-y-1 text-slate-300">
                    <div>Regime: <span className="text-white font-bold">{signal.options_intel.gex_regime}</span> (${signal.options_intel.net_gex_musd}M)</div>
                    <div>Call Wall: <span className="text-emerald-400 font-bold">${signal.options_intel.call_wall}</span> | Put Wall: <span className="text-rose-400 font-bold">${signal.options_intel.put_wall}</span></div>
                    <div>{signal.options_intel.gamma_front_run_note}</div>
                    <div>25d Skew: {signal.options_intel.skew_25d_pct}% | IV Term Ratio: {signal.options_intel.iv_term_ratio}x ({signal.options_intel.iv_term_structure})</div>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-extrabold text-emerald-300 text-sm">
                    SEC EDGAR Form 4 / 8-K, Finviz &amp; SUE PEAD
                  </div>
                  <div className="font-mono space-y-1 text-slate-300">
                    <div>Form 4 Insider Buys (30d): <span className="text-emerald-400 font-bold">{signal.sec_intel.form4_insider_buys_30d} (${signal.sec_intel.form4_net_buy_musd}M Net)</span></div>
                    <div>8-K Filing: {signal.sec_intel.recent_8k_summary}</div>
                    <div>Congressional Flow: {signal.sec_intel.congressional_tracker}</div>
                    <div>Short Float: {signal.sec_intel.short_float_pct}% | SUE: +{signal.sec_intel.sue_score} ({signal.sec_intel.pead_drift_status})</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="font-extrabold text-amber-300 text-sm">
                  5+ Year ({signal.backtest.trading_days_tested} Trading Days) Causal Walk-Forward Backtest (√252 Annualized)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Shrunk Win Rate</span>
                    <span className="text-emerald-400 font-bold">{signal.backtest.shrunk_win_rate_pct}%</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Profit Factor</span>
                    <span className="text-white font-bold">{signal.backtest.profit_factor}x</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Annualized Sharpe</span>
                    <span className="text-cyan-300 font-bold">{signal.backtest.annualized_sharpe}</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Prob. Sharpe (PSR)</span>
                    <span className="text-emerald-300 font-bold">{signal.backtest.psr_pct}%</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Deflated Sharpe (DSR)</span>
                    <span className="text-indigo-300 font-bold">{signal.backtest.dsr_pct}%</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Sample Uniqueness</span>
                    <span className="text-amber-300 font-bold">{signal.backtest.avg_uniqueness}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "AGENTS" && (
            <div className="space-y-4">
              {/* 4 Specialist Analysts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {signal.agents.specialists.map((sp) => (
                  <div
                    key={sp.id}
                    className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white">{sp.name}</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {sp.score}/100 (Weight {sp.weight_pct}%)
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{sp.thesis}</p>
                  </div>
                ))}
              </div>

              {/* 3-Round Bull vs Bear Debate */}
              <div className="space-y-2.5">
                {signal.agents.debate_rounds.map((r) => (
                  <div
                    key={r.round}
                    className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5"
                  >
                    <div className="font-extrabold text-indigo-300">{r.title}</div>
                    <div className="text-emerald-300">
                      <span className="font-bold">🐂 Bull: </span>
                      {r.bull_argument}
                    </div>
                    <div className="text-rose-300">
                      <span className="font-bold">🐻 Bear: </span>
                      {r.bear_argument}
                    </div>
                    <div className="text-amber-200 font-semibold">
                      ⚖️ Judge Synthesis: {r.judge_synthesis}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
