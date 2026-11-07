"use client";

import React from "react";
import {
  Cpu,
  Zap,
  Layers,
  Shield,
  Flame,
  TrendingUp,
  TrendingDown,
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
        return <Cpu className="w-4 h-4 text-violet-400" />;
      case "HIGH_SPEED_L1":
        return <Zap className="w-4 h-4 text-cyan-400" />;
      case "DEFI_YIELD":
        return <Layers className="w-4 h-4 text-emerald-400" />;
      case "INSTITUTIONAL_CORE":
        return <Shield className="w-4 h-4 text-amber-400" />;
      case "MEME_BETA":
        return <Flame className="w-4 h-4 text-rose-400" />;
    }
  };

  return (
    <section className="max-w-[1600px] mx-auto px-4 pt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
            5-BASKET CRYPTO NARRATIVE ROTATION RADAR (EQUAL-WEIGHTED 24H/7D VELOCITY & RS VS BTC)
          </h2>
        </div>
        {selectedNarrative && (
          <button
            onClick={() => onSelectNarrative(null)}
            className="text-xs font-mono text-cyan-400 hover:underline cursor-pointer"
          >
            Clear Narrative Filter (Show All 26 Assets)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {rankings.map((basket) => {
          const isSelected = selectedNarrative === basket.id;
          const isLeading = basket.rank <= 2;
          const isLagging = basket.rank === 5;
          const up24 = basket.return_24h_pct >= 0;

          return (
            <button
              key={basket.id}
              onClick={() =>
                onSelectNarrative(isSelected ? null : basket.id)
              }
              className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? "bg-emerald-950/40 border-emerald-400 shadow-lg shadow-emerald-500/15"
                  : isLeading
                  ? "bg-[#0C1222] border-emerald-500/40 hover:border-emerald-400/70"
                  : isLagging
                  ? "bg-[#0C1222]/80 border-rose-500/30 hover:border-rose-400/60"
                  : "bg-[#0C1222] border-slate-800 hover:border-slate-700"
              }`}
            >
              {/* Top Row: Rank Badge & Conviction Boost/Drag */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded ${
                    basket.rank === 1
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                      : basket.rank === 2
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : basket.rank === 5
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  #{basket.rank} {basket.rank <= 2 ? "LEADING" : basket.rank === 5 ? "LAGGING" : "ROTATING"}
                </span>

                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    basket.convictionModifierPct > 0
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {basket.convictionModifierPct > 0 ? "+" : ""}
                  {basket.convictionModifierPct}% AI Boost
                </span>
              </div>

              {/* Basket Name */}
              <div className="flex items-center gap-2 mb-2">
                {getBasketIcon(basket.id)}
                <span className="font-mono font-bold text-xs text-white truncate">
                  {basket.shortName}
                </span>
              </div>

              {/* 24h & 7d Returns + Volume Surge */}
              <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                <div>
                  <div className="text-[9px] text-slate-400">24H RET</div>
                  <div
                    className={`font-bold flex items-center ${
                      up24 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {up24 ? (
                      <TrendingUp className="w-3 h-3 mr-0.5" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-0.5" />
                    )}
                    {up24 ? "+" : ""}
                    {basket.return_24h_pct}%
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-slate-400">7D RET</div>
                  <div
                    className={`font-bold ${
                      basket.return_7d_pct >= 0 ? "text-cyan-300" : "text-rose-400"
                    }`}
                  >
                    {basket.return_7d_pct >= 0 ? "+" : ""}
                    {basket.return_7d_pct}%
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-slate-400">VOL SURGE</div>
                  <div className="font-bold text-amber-300">
                    {basket.vol_surge_ratio}x
                  </div>
                </div>
              </div>

              {/* Leader Coin & Constituents */}
              <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>
                  Leader:{" "}
                  <strong className="text-white">{basket.topCoinSymbol}</strong> (
                  <span
                    className={
                      basket.topCoinChange24h >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }
                  >
                    {basket.topCoinChange24h >= 0 ? "+" : ""}
                    {basket.topCoinChange24h}%
                  </span>
                  )
                </span>
                <span className="text-slate-500">
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
