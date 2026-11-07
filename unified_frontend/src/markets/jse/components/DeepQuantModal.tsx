"use client";

import React, { useState } from "react";
import {
  Activity,
  BarChart3,
  Brain,
  ExternalLink,
  Globe,
  MessageSquare,
  ShieldAlert,
  X,
} from "lucide-react";
import { JseOpportunity } from "@jse/types/market";

interface DeepQuantModalProps {
  opportunity: JseOpportunity | null;
  onClose: () => void;
  onOpenEasyEquitiesTicket: (opp: JseOpportunity) => void;
}

export const DeepQuantModal: React.FC<DeepQuantModalProps> = ({
  opportunity,
  onClose,
  onOpenEasyEquitiesTicket,
}) => {
  const [activeTab, setActiveTab] = useState<"CHART_MC" | "ARB_STOCHASTIC" | "AGENTS_DEBATE">(
    "CHART_MC"
  );
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!opportunity) return null;

  const candles = opportunity.candles90d;
  const allPrices = [
    ...candles.flatMap((c) => [c.high, c.low, c.avwap52wHigh, c.avwap60dLow]),
    opportunity.targetPriceZar,
    opportunity.stopLossZar,
    opportunity.vpocPriceZar,
  ];
  const minP = Math.min(...allPrices) * 0.985;
  const maxP = Math.max(...allPrices) * 1.015;
  const priceRange = Math.max(1, maxP - minP);

  const svgWidth = 820;
  const svgHeight = 290;
  const priceToY = (p: number) =>
    svgHeight - 24 - ((p - minP) / priceRange) * (svgHeight - 48);

  const hoveredCandle =
    hoverIdx !== null && candles[hoverIdx] ? candles[hoverIdx] : candles[candles.length - 1];

  // Monte Carlo Fan Chart coordinates
  const mcPoints = opportunity.monteCarloFan;
  const mcMin = Math.min(...mcPoints.map((m) => m.p05)) * 0.98;
  const mcMax = Math.max(...mcPoints.map((m) => m.p95)) * 1.02;
  const mcRange = Math.max(1, mcMax - mcMin);
  const mcToY = (p: number) => 210 - 20 - ((p - mcMin) / mcRange) * 170;
  const mcToX = (day: number) => 40 + (day / 15) * 740;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0D1322] border border-slate-700 rounded-2xl max-w-5xl w-full p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-extrabold text-white">
                {opportunity.ticker}
              </span>
              <span className="text-sm font-bold text-slate-200">
                {opportunity.name}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold">
                {opportunity.signalTier} ({opportunity.finalConvictionScore}/100)
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono text-xs font-bold">
                {opportunity.mtfStatusBadge}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Live R{opportunity.priceZar.toFixed(2)} • Dynamic Target: +{opportunity.targetNetPct}%
              NET (R{opportunity.targetPriceZar.toFixed(2)}) • Stop: R
              {opportunity.stopLossZar.toFixed(2)} • Net R:R: {opportunity.netRrRatio}x
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenEasyEquitiesTicket(opportunity);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold cursor-pointer"
            >
              🟢 Open EasyEquities Ticket
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3 Institutional Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 font-mono text-xs">
          <button
            onClick={() => setActiveTab("CHART_MC")}
            className={`px-3.5 py-2 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === "CHART_MC"
                ? "bg-emerald-500/20 border border-emerald-500 text-emerald-300"
                : "bg-[#060911] border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Tab 1: 90d JSE Chart, 3 AVWAPs, VPOC & 2,000-Path Conformal Fan
          </button>

          <button
            onClick={() => setActiveTab("ARB_STOCHASTIC")}
            className={`px-3.5 py-2 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === "ARB_STOCHASTIC"
                ? "bg-cyan-500/20 border border-cyan-500 text-cyan-300"
                : "bg-[#060911] border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Globe className="w-4 h-4" />
            Tab 2: Offshore Arb, Tencent SOTP, Kalman Twin & QuantGuild Calculus
          </button>

          <button
            onClick={() => setActiveTab("AGENTS_DEBATE")}
            className={`px-3.5 py-2 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === "AGENTS_DEBATE"
                ? "bg-amber-500/20 border border-amber-500 text-amber-300"
                : "bg-[#060911] border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Brain className="w-4 h-4" />
            Tab 3: TradingAgents 4-Analysts, 3-Round Debate, Red-Team & 5Y Walk-Forward
          </button>
        </div>

        {/* TAB 1: Interactive 90-Day JSE Candlestick Chart + 2,000-Path Conformal Monte Carlo Fan */}
        {activeTab === "CHART_MC" && (
          <div className="space-y-4">
            <div className="bg-[#060911] border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-white font-bold">
                    90-Day JSE Price Action (Normalized R ZAR)
                  </span>
                  <span className="text-amber-400">― AVWAP 52w High (R{opportunity.avwap52wHighZar})</span>
                  <span className="text-cyan-400">― AVWAP 60d Low (R{opportunity.avwapSwingLow60dZar})</span>
                  <span className="text-purple-400">― VPOC (R{opportunity.vpocPriceZar})</span>
                </div>
                {hoveredCandle && (
                  <div className="text-[11px] text-slate-300">
                    {hoveredCandle.date} • O: R{hoveredCandle.open} H: R{hoveredCandle.high} L: R
                    {hoveredCandle.low} C: <strong className="text-white">R{hoveredCandle.close}</strong>
                  </div>
                )}
              </div>

              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-64 bg-[#050811] rounded-lg border border-slate-800/80"
              >
                {/* Target, VPOC & Stop horizontal lines */}
                <line
                  x1={0}
                  y1={priceToY(opportunity.targetPriceZar)}
                  x2={svgWidth}
                  y2={priceToY(opportunity.targetPriceZar)}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                />
                <text
                  x={10}
                  y={priceToY(opportunity.targetPriceZar) - 4}
                  fill="#10B981"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  Target R{opportunity.targetPriceZar} (+{opportunity.targetNetPct}% NET)
                </text>

                <line
                  x1={0}
                  y1={priceToY(opportunity.vpocPriceZar)}
                  x2={svgWidth}
                  y2={priceToY(opportunity.vpocPriceZar)}
                  stroke="#A855F7"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                <text
                  x={10}
                  y={priceToY(opportunity.vpocPriceZar) - 4}
                  fill="#A855F7"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  60d VPOC R{opportunity.vpocPriceZar}
                </text>

                <line
                  x1={0}
                  y1={priceToY(opportunity.stopLossZar)}
                  x2={svgWidth}
                  y2={priceToY(opportunity.stopLossZar)}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                />
                <text
                  x={10}
                  y={priceToY(opportunity.stopLossZar) - 4}
                  fill="#EF4444"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  Hard Stop R{opportunity.stopLossZar}
                </text>

                {/* AVWAP 52w High Polyline */}
                <polyline
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={1.5}
                  points={candles
                    .map((c, idx) => {
                      const x = 15 + (idx / Math.max(1, candles.length - 1)) * (svgWidth - 30);
                      return `${x},${priceToY(c.avwap52wHigh)}`;
                    })
                    .join(" ")}
                />

                {/* AVWAP 60d Low Polyline */}
                <polyline
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth={1.5}
                  points={candles
                    .map((c, idx) => {
                      const x = 15 + (idx / Math.max(1, candles.length - 1)) * (svgWidth - 30);
                      return `${x},${priceToY(c.avwap60dLow)}`;
                    })
                    .join(" ")}
                />

                {/* 90d Candlesticks */}
                {candles.map((c, idx) => {
                  const x = 15 + (idx / Math.max(1, candles.length - 1)) * (svgWidth - 30);
                  const isBull = c.close >= c.open;
                  const color = isBull ? "#10B981" : "#EF4444";
                  const yHigh = priceToY(c.high);
                  const yLow = priceToY(c.low);
                  const yTop = priceToY(Math.max(c.open, c.close));
                  const yBot = priceToY(Math.min(c.open, c.close));
                  const bodyH = Math.max(2, yBot - yTop);
                  return (
                    <g
                      key={c.date}
                      onMouseEnter={() => setHoverIdx(idx)}
                      className="cursor-crosshair"
                    >
                      <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth={1} />
                      <rect
                        x={x - 2.5}
                        y={yTop}
                        width={5}
                        height={bodyH}
                        fill={color}
                        rx={0.5}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* 2,000-Path Antithetic Conformal Monte Carlo Fan Chart */}
            <div className="bg-[#060911] border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between font-mono text-xs">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Hybrid HAR-RV + GARCH(1,1) + Merton Jump 2,000-Path Antithetic Conformal Fan (15d)
                </span>
                <span className="text-cyan-300">
                  90% Split Conformal Band: [R{opportunity.conformalP05Zar} – R
                  {opportunity.conformalP95Zar}]
                </span>
              </div>

              <svg
                viewBox="0 0 820 210"
                className="w-full h-48 bg-[#050811] rounded-lg border border-slate-800/80"
              >
                {/* P05 - P95 Outer Shaded Polygon */}
                <polygon
                  fill="rgba(56, 189, 248, 0.12)"
                  points={[
                    ...mcPoints.map((m) => `${mcToX(m.day)},${mcToY(m.p95)}`),
                    ...[...mcPoints].reverse().map((m) => `${mcToX(m.day)},${mcToY(m.p05)}`),
                  ].join(" ")}
                />
                {/* P25 - P75 Inner Shaded Polygon */}
                <polygon
                  fill="rgba(16, 185, 129, 0.22)"
                  points={[
                    ...mcPoints.map((m) => `${mcToX(m.day)},${mcToY(m.p75)}`),
                    ...[...mcPoints].reverse().map((m) => `${mcToX(m.day)},${mcToY(m.p25)}`),
                  ].join(" ")}
                />
                {/* Median P50 Drift Trajectory */}
                <polyline
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={2.2}
                  points={mcPoints.map((m) => `${mcToX(m.day)},${mcToY(m.p50)}`).join(" ")}
                />
                {mcPoints.map((m) => (
                  <circle
                    key={m.day}
                    cx={mcToX(m.day)}
                    cy={mcToY(m.p50)}
                    r={2.5}
                    fill="#10B981"
                  />
                ))}
              </svg>
            </div>
          </div>
        )}

        {/* TAB 2: Offshore Dual-Listed Arbitrage, Tencent SOTP, Kalman Twin & QuantGuild Stochastic Matrix */}
        {activeTab === "ARB_STOCHASTIC" && (
          <div className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Offshore Arbitrage & Tencent SOTP Box */}
              <div className="bg-[#060911] border border-cyan-500/40 rounded-xl p-4 space-y-2.5">
                <div className="text-cyan-300 font-bold text-sm">
                  🌍 Dual-Listed Offshore Parity & Tencent (0700.HK) SOTP Lead
                </div>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Offshore Primary Ticker:</span>
                    <strong className="text-white">
                      {opportunity.offshoreTicker || "Domestic SA Inc"} (
                      {opportunity.offshoreCurrency || "ZAR"})
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">20d Median Implied Ratio:</span>
                    <strong className="text-white">
                      {opportunity.impliedRatio20d ?? 1.0}x
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Offshore Fair-Value Parity (R ZAR):</span>
                    <strong className="text-emerald-300">
                      R{(opportunity.offshoreParityZar ?? opportunity.priceZar).toFixed(2)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Arbitrage Spread % & Z-Score:</span>
                    <strong className="text-cyan-300">
                      {opportunity.offshoreArbSpreadPct}% (Z = {opportunity.offshoreArbZscore}σ)
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Offshore Arbitrage Signal:</span>
                    <strong className="text-amber-300">{opportunity.offshoreArbSignal}</strong>
                  </div>
                  {opportunity.tencentLeadGapPct !== null && (
                    <div className="flex justify-between pt-1 border-t border-slate-800">
                      <span className="text-indigo-300">Tencent 0700.HK SOTP Lead Gap:</span>
                      <strong className="text-emerald-400">
                        +{opportunity.tencentLeadGapPct}% (SOTP Z={opportunity.sotpDiscountZscore}σ)
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* 2D State-Space Kalman Filter Cointegrated Twin Pair */}
              <div className="bg-[#060911] border border-emerald-500/40 rounded-xl p-4 space-y-2.5">
                <div className="text-emerald-300 font-bold text-sm">
                  🔗 2D State-Space Kalman Filter Cointegrated JSE Twin Pair
                </div>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cointegrated JSE Twin:</span>
                    <strong className="text-white">{opportunity.twinTicker}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dynamic Kalman Hedge Ratio (β_t):</span>
                    <strong className="text-white">{opportunity.kalmanHedgeRatio}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Kalman Innovation Spread Z-Score:</span>
                    <strong className="text-cyan-300">{opportunity.kalmanSpreadZscore}σ</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Engle-Granger ADF Stationarity p-value:</span>
                    <strong className="text-emerald-400">p = {opportunity.adfPValue}</strong>
                  </div>
                  <div className="pt-1 border-t border-slate-800 text-amber-300 font-bold">
                    {opportunity.pairArbitrageSignal}
                  </div>
                </div>
              </div>
            </div>

            {/* QuantGuild & Marcos López de Prado Stochastic Calculus Grid */}
            <div className="bg-[#060911] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="text-white font-bold text-sm">
                📐 QuantGuild & Marcos López de Prado Microstructure & Stochastic Calculus (√252)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#0D1322] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">ORNSTEIN-UHLENBECK HALF-LIFE</div>
                  <div className="text-white font-bold">
                    {opportunity.ouHalfLifeDays}d (θ={opportunity.ouTheta}, Z={opportunity.ouZscore}σ)
                  </div>
                </div>
                <div className="bg-[#0D1322] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">MARKOV REGIME & 5D SURVIVAL</div>
                  <div className="text-emerald-300 font-bold">
                    {opportunity.markovState} ({(opportunity.markov5dSurvivalProb * 100).toFixed(0)}%)
                  </div>
                </div>
                <div className="bg-[#0D1322] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">FRACDIFF (d=0.40) & CUSUM</div>
                  <div className="text-cyan-300 font-bold">
                    Stat: {opportunity.fracDiffStationaryScore} • {opportunity.cusumSignal}
                  </div>
                </div>
                <div className="bg-[#0D1322] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">HURST (H) & VARIANCE RATIO VR(5)</div>
                  <div className="text-white font-bold">
                    H = {opportunity.hurstExponent} • VR(5) = {opportunity.varianceRatioVr5}
                  </div>
                </div>
                <div className="bg-[#0D1322] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">BULK-VOLUME VPIN & HAWKES λ_t</div>
                  <div className="text-white font-bold">
                    VPIN {opportunity.vpinToxicity} • λ={opportunity.hawkesIntensity}
                  </div>
                </div>
                <div className="bg-[#0D1322] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">CORWIN-SCHULTZ & ALMGREN-CHRISS</div>
                  <div className="text-white font-bold">
                    Spread {opportunity.corwinSchultzSpreadPct}% • Impact{" "}
                    {opportunity.almgrenChrissImpactPct}%
                  </div>
                </div>
                <div className="bg-[#0D1322] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">YANG-ZHANG ANNUAL VOL (√252)</div>
                  <div className="text-amber-300 font-bold">
                    {opportunity.yangZhangVolAnnualPct}% (GARCH {opportunity.garchCondVolPct}%)
                  </div>
                </div>
                <div className="bg-[#0D1322] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">WASSERSTEIN-1 & SHANNON ENTROPY</div>
                  <div className="text-white font-bold">
                    W1={opportunity.wassersteinRegimeDist} • S={opportunity.shannonEntropyNorm}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TradingAgents 4-Analysts, 3-Round Bull/Bear Debate, Red-Team & 5-Year Walk-Forward */}
        {activeTab === "AGENTS_DEBATE" && (
          <div className="space-y-4 text-xs">
            {/* 4 Specialized JSE Analyst Agent Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {opportunity.analystVotes.map((agent) => (
                <div
                  key={agent.agentId}
                  className="bg-[#060911] border border-slate-800 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-white">{agent.agentName}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      {agent.score}/100 (Weight {(agent.weight * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{agent.rationale}</p>
                  <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                    {agent.keyMetrics.map((m, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-[#0D1322] border border-slate-800 text-cyan-300"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 3-Round Bull vs Bear Researcher Dialectical Debate */}
            <div className="bg-[#060911] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="font-mono font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                3-Round Bull vs. Bear Researcher Dialectical Debate & Cross-Examination
              </div>
              <div className="space-y-2.5">
                {opportunity.debateRounds.map((r) => (
                  <div
                    key={r.round}
                    className="bg-[#0D1322] border border-slate-800 rounded-lg p-3 space-y-1.5"
                  >
                    <div className="font-mono font-bold text-amber-300">
                      ROUND {r.round} CROSS-EXAMINATION
                    </div>
                    <div className="text-emerald-300">🟢 {r.bullArgument}</div>
                    <div className="text-rose-300">🔴 {r.bearCounter}</div>
                    <div className="text-cyan-200 font-mono text-[11px] pt-1 border-t border-slate-800">
                      ⚖️ Verdict: {r.crossExamVerdict}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Adversarial Red-Team Pre-Mortem & 5-Year Causal Walk-Forward Backtester */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
              <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-3.5 space-y-2">
                <div className="text-rose-300 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Adversarial Red-Team Pre-Mortem (Kill Prob:{" "}
                  {(opportunity.redTeamKillProb * 100).toFixed(0)}%)
                </div>
                <p className="text-slate-200 font-sans leading-relaxed">
                  {opportunity.redTeamPreMortem}
                </p>
              </div>

              <div className="bg-[#060911] border border-emerald-500/40 rounded-xl p-3.5 space-y-2">
                <div className="text-emerald-300 font-bold">
                  📈 5-Year (1,260+ Day) Causal Walk-Forward Backtester
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    Regime Win Rate:{" "}
                    <strong className="text-white">
                      {opportunity.regimeConditionedWinRate}%
                    </strong>
                  </div>
                  <div>
                    Expectancy:{" "}
                    <strong className="text-emerald-400">
                      +{opportunity.regimeConditionedExpectancyPct}% / trade
                    </strong>
                  </div>
                  <div>
                    Profit Factor:{" "}
                    <strong className="text-white">{opportunity.profitFactor}x</strong>
                  </div>
                  <div>
                    PSR / DSR:{" "}
                    <strong className="text-cyan-300">
                      {(opportunity.probabilisticSharpePsr * 100).toFixed(0)}% /{" "}
                      {(opportunity.deflatedSharpeDsr * 100).toFixed(0)}%
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Clickable JSE SENS & Financial News Headlines */}
            <div className="bg-[#060911] border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="font-mono font-bold text-amber-300">
                📰 Live JSE SENS & Moneyweb / Sharenet Catalyst Headlines
              </div>
              <div className="space-y-1.5">
                {opportunity.sensHeadlines.map((h, i) => (
                  <a
                    key={i}
                    href={h.link}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#0D1322] border border-slate-800 hover:border-emerald-500/50 rounded-lg px-3 py-2 flex items-center justify-between gap-2 transition"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[10px]">
                        {h.source}
                      </span>
                      <span className="text-slate-200 truncate">{h.title}</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
