"use client";

import React from "react";
import {
  Clock,
  ShieldAlert,
  TrendingUp,
  Activity,
  PlusCircle,
  Globe,
  Sparkles,
  Microscope,
  LineChart,
  Send,
  ListPlus,
} from "lucide-react";
import {
  MacroIntel,
  FeeProfile,
  PaperWallet,
  USDZARShield,
} from "../types/market";

interface Props {
  macro: MacroIntel;
  usdzar: USDZARShield;
  accountBalanceZar: number;
  onChangeAccountBalanceZar: (val: number) => void;
  simpleSniperView: boolean;
  onToggleViewMode: (simple: boolean) => void;
  feeProfile: FeeProfile;
  availableProfiles: FeeProfile[];
  paperWallet: PaperWallet;
  onSelectFeeProfile: (id: string) => void;
  onOpenTradeModal: () => void;
  onOpenCrossMarketModal: () => void;
  onOpenCompoundingModal: () => void;
  onOpenWatchlistModal: () => void;
  onOpenTelegramModal: () => void;
  antiTiltTriggered?: boolean;
}

export const TopWallStreetBar: React.FC<Props> = ({
  macro,
  usdzar,
  accountBalanceZar,
  simpleSniperView,
  onToggleViewMode,
  feeProfile,
  availableProfiles,
  paperWallet,
  onSelectFeeProfile,
  onOpenTradeModal,
  onOpenCrossMarketModal,
  onOpenCompoundingModal,
  onOpenWatchlistModal,
  onOpenTelegramModal,
  antiTiltTriggered,
}) => {
  const { session } = macro;
  const fxRate = usdzar?.usdzar_rate || 18.18;

  return (
    <header className="border-b border-white/10 bg-[#060A14] sticky top-0 z-30">
      {/* Consolidated Single-Row Macro Ticker & Secondary Command Bar */}
      <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Non-Repeating Macro Strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            NYSE / NASDAQ
          </span>

          <div className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400">USD/ZAR:</span>
            <span className="font-bold text-white tabular-nums">
              R {fxRate.toFixed(2)}
            </span>
            <span className="text-slate-500 text-[10px]">
              (Z={usdzar?.usdzar_zscore >= 0 ? `+${usdzar?.usdzar_zscore}` : usdzar?.usdzar_zscore} | τ={usdzar?.usdzar_ou_halflife}d)
            </span>
          </div>

          <div className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 flex items-center gap-1 text-[11px]">
            <span className="text-slate-400">ES=F:</span>
            <span className="font-bold text-white tabular-nums">
              {macro.es_futures_price.toLocaleString()}
            </span>
            <span className={macro.es_futures_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {macro.es_futures_change_pct >= 0 ? "+" : ""}{macro.es_futures_change_pct}%
            </span>
          </div>

          <div className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 flex items-center gap-1 text-[11px] hidden md:flex">
            <span className="text-slate-400">NQ=F:</span>
            <span className="font-bold text-white tabular-nums">
              {macro.nq_futures_price.toLocaleString()}
            </span>
            <span className={macro.nq_futures_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {macro.nq_futures_change_pct >= 0 ? "+" : ""}{macro.nq_futures_change_pct}%
            </span>
          </div>

          <div className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 flex items-center gap-1 text-[11px] hidden sm:flex">
            <span className="text-slate-400">VIX:</span>
            <span className="font-bold text-slate-200 tabular-nums">{macro.vix_spot}</span>
            <span className="text-[10px] text-slate-400">
              ({macro.vix_term_regime})
            </span>
          </div>

          <div className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 flex items-center gap-1 text-slate-300 text-[11px]">
            <ShieldAlert className="w-3 h-3 text-emerald-400" />
            <span>{macro.macro_shield_status}</span>
          </div>

          {antiTiltTriggered && (
            <div className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 font-bold text-[10px]">
              ANTI-TILT (0.5x Kelly)
            </div>
          )}
        </div>

        {/* Right: Controls & Modals */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => onToggleViewMode(true)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition ${
                simpleSniperView
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Simple
            </button>
            <button
              onClick={() => onToggleViewMode(false)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition ${
                !simpleSniperView
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Microscope className="w-3 h-3 text-indigo-400" />
              Pro Quant
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-1 text-[11px] font-mono bg-slate-900 px-2 py-1 rounded border border-white/10 text-slate-400">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-slate-300">{session.sast_clock}</span>
            <span>|</span>
            <span className="text-slate-300">{session.et_clock}</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-white/10 text-xs font-mono">
            <span className="text-slate-400 hidden sm:inline">Fee:</span>
            <select
              value={feeProfile.id}
              onChange={(e) => onSelectFeeProfile(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none text-[11px]"
            >
              {availableProfiles.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onOpenCrossMarketModal}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-bold transition"
          >
            <Globe className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Global Top 3</span>
          </button>

          <button
            onClick={onOpenCompoundingModal}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-bold transition"
          >
            <LineChart className="w-3 h-3 text-amber-400" />
            <span className="hidden md:inline">R10k Tracker</span>
          </button>

          <button
            onClick={onOpenWatchlistModal}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-bold transition"
          >
            <ListPlus className="w-3 h-3 text-sky-400" />
            <span>+ Stock</span>
          </button>

          <button
            onClick={onOpenTelegramModal}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-bold transition"
          >
            <Send className="w-3 h-3 text-sky-400" />
            <span className="hidden lg:inline">Bot</span>
          </button>

          <button
            onClick={onOpenTradeModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 hover:bg-white text-slate-950 text-xs font-extrabold transition shadow-sm"
          >
            <PlusCircle className="w-3 h-3" />
            <span>Log Trade</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopWallStreetBar;
