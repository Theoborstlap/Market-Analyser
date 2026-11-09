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
  RotateCcw,
  RefreshCw,
  Bot,
} from "lucide-react";
import {
  FeeProfileKey,
  MacroCommoditySnapshot,
  PaperWalletState,
} from "@jse/types/market";
import { JSE_EQUITY_FRICTION_PCT, JSE_ETF_FRICTION_PCT } from "@jse/lib/config";
import { formatZar } from "../../../utils/formatters";

export interface TopSovereignBarProps {
  macro: MacroCommoditySnapshot;
  wallet: PaperWalletState;
  accountBalanceZar: number;
  simpleSniperView: boolean;
  scanProgressPct?: number;
  lastScanTimestamp?: string;
  isScanning?: boolean;
  antiTiltTriggered?: boolean;
  onToggleSimpleView: (simple: boolean) => void;
  onChangeAccountBalanceZar: (balanceZar: number) => void;
  onRefreshScan: () => void;
  onChangeFeeProfile: (profile: FeeProfileKey) => void;
  onResetWallet: () => void;
  onOpenCustomTradeModal: () => void;
  onOpenTelegramModal: () => void;
  onOpenCrossMarketModal: () => void;
  onOpenCompoundingModal: () => void;
  onOpenWatchlistModal: () => void;
  onOpenBot?: () => void;
}

export const TopSovereignBar: React.FC<TopSovereignBarProps> = ({
  macro,
  wallet,
  accountBalanceZar,
  simpleSniperView,
  isScanning = false,
  antiTiltTriggered = false,
  onToggleSimpleView,
  onChangeAccountBalanceZar,
  onRefreshScan,
  onChangeFeeProfile,
  onResetWallet,
  onOpenCustomTradeModal,
  onOpenTelegramModal,
  onOpenCrossMarketModal,
  onOpenCompoundingModal,
  onOpenWatchlistModal,
  onOpenBot,
}) => {
  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
      ? null
      : Number(v);

  const fxRate = num(macro?.usdzar_rate) ?? num(macro?.usdzar);
  const zscore = num(macro?.usdzar_zscore ?? macro?.usdzarZscore20d);
  const ouHalfLife = num(macro?.usdzar_ou_halflife ?? macro?.usdzarOuHalflife);

  const goldZar = num(macro?.goldZarPerOz);
  const goldChg = num(macro?.goldChange1dPct);
  const tencentPrice = num(macro?.tencentHkdPrice);
  const tencentChg = num(macro?.tencentChange1dPct);
  const vixSpot = num(macro?.vix);
  const esChg = num(macro?.esFuturesChangePct);

  const sessionBadge =
    macro?.jseSessionStatus === "OPEN_CONTINUOUS"
      ? "CONTINUOUS OPEN"
      : macro?.jseSessionStatus === "CLOSING_AUCTION_TALX"
      ? "TALX AUCTION"
      : "AFTER-HOURS";

  const isLockout = Boolean(
    macro?.macroLockoutWarning || macro?.globalFuturesShieldActive
  );
  const shieldStatusLabel = macro?.macroLockoutWarning
    ? `LOCKOUT: ${macro?.nextRedFolderEvent || "SARB"}`
    : macro?.globalFuturesShieldActive
    ? "FUTURES RISK-OFF"
    : macro?.nextRedFolderEvent
    ? `SHIELD CLEAR • ${macro.nextRedFolderEvent}`
    : "SHIELD CLEAR";

  return (
    <header className="border-b border-white/10 bg-[#060A14] sticky top-0 z-30">
      {/* Consolidated Single-Row Macro Ticker & Secondary Command Bar */}
      <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Non-Repeating Macro Strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {sessionBadge}
          </span>

          <div className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400">USD/ZAR:</span>
            <span className="font-bold text-white tabular-nums">
              R {fxRate ? fxRate.toFixed(2) : "18.25"}
            </span>
            <span className="text-slate-500 text-[10px]">
              (Z={zscore !== null ? (zscore >= 0 ? `+${zscore.toFixed(2)}` : zscore.toFixed(2)) : "0.00"} | τ={ouHalfLife ?? 10}d)
            </span>
          </div>

          <div className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 flex items-center gap-1 text-[11px]">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-slate-400">GOLD:</span>
            <span className="font-bold text-white tabular-nums">
              {goldZar ? formatZar(goldZar, { compact: true }) : "R 67,317"}
            </span>
            {goldChg !== null && (
              <span className={goldChg >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {goldChg >= 0 ? "+" : ""}{goldChg.toFixed(2)}%
              </span>
            )}
          </div>

          <div className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 flex items-center gap-1 text-[11px] hidden md:flex">
            <span className="text-slate-400">0700.HK:</span>
            <span className="font-bold text-white tabular-nums">
              HK${tencentPrice ? tencentPrice.toFixed(1) : "419.8"}
            </span>
            {tencentChg !== null && (
              <span className={tencentChg >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {tencentChg >= 0 ? "+" : ""}{tencentChg.toFixed(2)}%
              </span>
            )}
          </div>

          <div className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 flex items-center gap-1 text-[11px] hidden sm:flex">
            <span className="text-slate-400">VIX:</span>
            <span className="font-bold text-slate-200 tabular-nums">{vixSpot ? vixSpot.toFixed(2) : "25.64"}</span>
            {esChg !== null && (
              <span className="text-[10px] text-slate-400">
                (ES {esChg >= 0 ? "+" : ""}{esChg.toFixed(2)}%)
              </span>
            )}
          </div>

          <div className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 flex items-center gap-1 text-slate-300 text-[11px]">
            <ShieldAlert className="w-3 h-3 text-emerald-400" />
            <span>{shieldStatusLabel}</span>
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
              onClick={() => onToggleSimpleView(true)}
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
              onClick={() => onToggleSimpleView(false)}
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
            <span className="text-slate-300">{macro?.sastTimeFormatted || "SAST"}</span>
            <span>|</span>
            <span className="text-slate-300">SARB {macro?.sarbRepoRatePct ? `${macro.sarbRepoRatePct}%` : "7.75%"}</span>
            <button
              onClick={onRefreshScan}
              disabled={isScanning}
              title="Rescan JSE Universe"
              className="ml-1 text-slate-400 hover:text-emerald-300 transition"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-white/10 text-xs font-mono">
            <span className="text-slate-400 hidden sm:inline">Fee:</span>
            <select
              value={wallet?.selectedFeeProfile || "EASYEQUITIES_ZAR"}
              onChange={(e) => onChangeFeeProfile(e.target.value as FeeProfileKey)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none text-[11px]"
            >
              <option value="EASYEQUITIES_ZAR" className="bg-slate-900 text-white">
                EasyEquities ({JSE_EQUITY_FRICTION_PCT.toFixed(2)}%)
              </option>
              <option value="EASYEQUITIES_TFSA" className="bg-slate-900 text-white">
                TFSA (0% STT)
              </option>
              <option value="INSTITUTIONAL_DMA_ZAR" className="bg-slate-900 text-white">
                DMA (0.59%)
              </option>
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
            onClick={onOpenBot}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-sky-500/40 text-sky-300 text-xs font-bold transition shadow-sm"
            title="Open Autonomous Self-Learning Trading Bot"
          >
            <Bot className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span className="hidden sm:inline">Auto Bot</span>
          </button>

          <button
            onClick={onOpenTelegramModal}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-bold transition"
          >
            <Send className="w-3 h-3 text-sky-400" />
            <span className="hidden lg:inline">Alerts</span>
          </button>

          <button
            onClick={onOpenCustomTradeModal}
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

export default TopSovereignBar;
