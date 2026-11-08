"use client";

import React from "react";
import {
  Cpu,
  Zap,
  Layers,
  Shield,
  Flame,
  Sparkles,
} from "lucide-react";
import { NarrativeBasketRanking, NarrativeBasketId } from "@crypto/types/market";

interface NarrativeRotationStripProps {
  rankings: NarrativeBasketRanking[];
  selectedNarrative: NarrativeBasketId | null;
  onSelectNarrative: (basket: NarrativeBasketId | null) => void;
}

export default function NarrativeRotationStrip({
  rankings,
  selectedNarrative,
  onSelectNarrative,
}: NarrativeRotationStripProps) {
  const getBasketIcon = (id: NarrativeBasketId) => {
    switch (id) {
      case "AI_COMPUTE":
        return <Cpu className="w-3.5 h-3.5 text-violet-400" />;
      case "HIGH_SPEED_L1":
        return <Zap className="w-3.5 h-3.5 text-cyan-400" />;
      case "DEFI_YIELD":
        return <Layers className="w-3.5 h-3.5 text-emerald-400" />;
      case "INSTITUTIONAL_CORE":
        return <Shield className="w-3.5 h-3.5 text-amber-400" />;
      case "MEME_BETA":
        return <Flame className="w-3.5 h-3.5 text-rose-400" />;
    }
  };

  return (
    <section className="max-w-[1600px] mx-auto px-4 pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
            5-Basket Narrative Rotation Radar · RS vs BTC
          </h2>
        </div>
        {selectedNarrative && (
          <button
            onClick={() => onSelectNarrative(null)}
            className="text-[11px] font-mono text-cyan-400 hover:underline cursor-pointer"
          >
            Clear Filter (Show All 26 Assets)
          </button>
        )}
      </div>

      {/* Responsive Auto-Fit Grid Layout (< 1600px Viewport Protection) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
        {rankings.map((basket) => {
          const isSelected = selectedNarrative === basket.id;
          const isLeading = basket.rank <= 2;
          const isLagging = basket.rank === 5;
          const up24 = basket.return_24h_pct >= 0;

          // Institutional Relative Strength velocity score vs BTC (-5 to +5 bounded)
          const velocityScore = basket.return_24h_pct * 0.7 + basket.return_7d_pct * 0.3;
          const normalizedPct = Math.min(100, Math.max(0, (velocityScore + 5) * 10));

          // Continuous institutional gradient: deep emerald -> neutral slate -> deep crimson
          const barColorClass =
            velocityScore >= 1.5
              ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
              : velocityScore >= 0
              ? "bg-gradient-to-r from-slate-600 to-emerald-500"
              : velocityScore >= -1.5
              ? "bg-gradient-to-r from-slate-600 to-rose-400"
              : "bg-gradient-to-r from-rose-700 to-rose-500";

          return (
            <button
              key={basket.id}
              onClick={() =>
                onSelectNarrative(isSelected ? null : basket.id)
              }
              className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? "bg-slate-900 border-emerald-400 shadow-md"
                  : isLeading
                  ? "bg-[#080E1A] border-white/10 hover:border-emerald-500/50"
                  : isLagging
                  ? "bg-[#080E1A] border-white/10 hover:border-rose-500/40"
                  : "bg-[#080E1A] border-white/10 hover:border-white/20"
              }`}
            >
              {/* Header: Rank + Conviction Boost */}
              <div className="flex items-center justify-between gap-1 mb-1.5 font-mono text-[10px]">
                <span
                  className={`px-1.5 py-0.2 rounded font-bold ${
                    isLeading
                      ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                      : isLagging
                      ? "bg-rose-950/60 text-rose-300 border border-rose-500/30"
                      : "bg-slate-900 text-slate-400 border border-white/5"
                  }`}
                >
                  #{basket.rank} {isLeading ? "LEADING" : isLagging ? "LAGGING" : "ROTATING"}
                </span>

                <span
                  className={`px-1 py-0.2 rounded font-semibold ${
                    basket.convictionModifierPct > 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {basket.convictionModifierPct > 0 ? "+" : ""}
                  {basket.convictionModifierPct}% AI
                </span>
              </div>

              {/* Basket Name */}
              <div className="flex items-center gap-1.5 mb-2">
                {getBasketIcon(basket.id)}
                <span className="font-mono font-bold text-xs text-white truncate">
                  {basket.shortName}
                </span>
              </div>

              {/* Horizontal Relative Strength (RS) Momentum Heat-Strip */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-1">
                  <span>RS VELOCITY</span>
                  <span
                    className={`font-bold tabular-nums ${
                      velocityScore >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {velocityScore >= 0 ? "+" : ""}
                    {velocityScore.toFixed(2)}σ
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5">
                  <div
                    style={{ width: `${normalizedPct}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
                  />
                </div>
              </div>

              {/* Compact Metrics Row */}
              <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-[10px] font-mono tabular-nums">
                <span className={up24 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                  {up24 ? "+" : ""}
                  {basket.return_24h_pct}% 24h
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">
                  {basket.vol_surge_ratio}x Vol
                </span>
              </div>

              {/* Leader Coin */}
              <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span className="truncate">
                  Top: <strong className="text-slate-200">{basket.topCoinSymbol}</strong> (
                  <span className={basket.topCoinChange24h >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {basket.topCoinChange24h >= 0 ? "+" : ""}
                    {basket.topCoinChange24h}%
                  </span>
                  )
                </span>
                <span className="text-slate-500 shrink-0 ml-1">
                  {basket.assetSymbols.length} coins
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
