"use client";

import React, { useEffect, useState } from "react";
import {
  Clock,
  ShieldAlert,
  TrendingUp,
  Activity,
  Wallet,
  PlusCircle,
  Globe,
  Sparkles,
  Microscope,
  LineChart,
  Send,
  ListPlus,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import {
  FeeProfileKey,
  MacroCommoditySnapshot,
  PaperWalletState,
} from "@/types/market";
import { JSE_EQUITY_FRICTION_PCT, JSE_ETF_FRICTION_PCT } from "@/lib/config";

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
}) => {
  const [balanceInput, setBalanceInput] = useState<string>(
    String(accountBalanceZar)
  );

  useEffect(() => {
    setBalanceInput(String(accountBalanceZar));
  }, [accountBalanceZar]);

  const handleBalanceCommit = (rawVal?: string) => {
    const val = parseFloat(rawVal ?? balanceInput);
    if (Number.isFinite(val) && val >= 500) {
      onChangeAccountBalanceZar(val);
    } else {
      setBalanceInput(String(accountBalanceZar));
    }
  };

  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
      ? null
      : Number(v);

  const fmtN = (v: unknown, decimals = 2, prefix = "", suffix = ""): string => {
    const n = num(v);
    return n === null ? "n/a" : `${prefix}${n.toFixed(decimals)}${suffix}`;
  };

  const fmtSigned = (v: unknown, suffix = ""): string => {
    const n = num(v);
    return n === null ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}${suffix}`;
  };

  const fxRate = num(macro?.usdzar_rate) ?? num(macro?.usdzar);
  const accountUsd =
    fxRate && fxRate > 0 ? accountBalanceZar / Math.max(fxRate, 0.01) : null;
  const zscore = num(macro?.usdzar_zscore ?? macro?.usdzarZscore20d);
  const ouHalfLife = num(macro?.usdzar_ou_halflife ?? macro?.usdzarOuHalflife);
  const regimeBadge =
    macro?.usdzar_regime_badge ||
    macro?.usdzarRegimeBadge ||
    (fxRate === null ? "⚪ USD/ZAR FEED STANDBY" : "🟢 USD/ZAR STABLE");

  const goldZar = num(macro?.goldZarPerOz);
  const goldChg = num(macro?.goldChange1dPct);
  const tencentPrice = num(macro?.tencentHkdPrice);
  const tencentChg = num(macro?.tencentChange1dPct);
  const vixSpot = num(macro?.vix);
  const esChg = num(macro?.esFuturesChangePct);

  const sessionBannerLabel =
    macro?.jseSessionStatus === "OPEN_CONTINUOUS"
      ? "🟢 JSE CONTINUOUS SESSION OPEN (09:00–17:00 SAST)"
      : macro?.jseSessionStatus === "CLOSING_AUCTION_TALX"
      ? "⚠️ 16:41 SAST TALX CLOSING AUCTION GUARD"
      : "🕒 JSE AFTER-HOURS (09:00–17:00 SAST)";

  const sniperWindowNote =
    macro?.jseSessionStatus === "OPEN_CONTINUOUS"
      ? `Prime Execution Window 09:15–16:30 SAST • Talx Auction in ${
          macro?.minutesToTalxAuction ?? 0
        }m`
      : "Stage Plan B MAE Limit Dip Orders Ahead of 09:00 SAST Open";

  const isLockout = Boolean(
    macro?.macroLockoutWarning || macro?.globalFuturesShieldActive
  );
  const shieldStatusLabel = macro?.macroLockoutWarning
    ? `MACRO LOCKOUT: ${macro?.nextRedFolderEvent || "SARB / CPI Event"}`
    : macro?.globalFuturesShieldActive
    ? "GLOBAL FUTURES RISK-OFF SHIELD"
    : macro?.nextRedFolderEvent
    ? `SHIELD CLEAR • ${macro.nextRedFolderEvent}`
    : `SHIELD CLEAR • ${(macro?.jseMacroRegime || "JSE_ACTIVE").replace(/_/g, " ")}`;

  const totalPaperZar =
    num(wallet?.totalPortfolioValueZar) ??
    (num(wallet?.cashBalanceZar) ?? 0) + (num(wallet?.openEquityZar) ?? 0);

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30">
      {/* Row 1: Session Phase Banner, Dual Clocks, Account Scaler & View Toggle */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            🇿🇦 JSE JOHANNESBURG V12.2 SOVEREIGN
          </span>
          <span className="text-xs font-semibold text-slate-200">
            {sessionBannerLabel}
          </span>
          <span className="text-xs text-amber-300/90 hidden xl:inline">
            • {sniperWindowNote}
          </span>
        </div>

        {/* Editable R 10,000 (~$540 USD) Account Scaler + View Mode Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-950/90 border border-emerald-500/40 rounded-lg px-2.5 py-1">
            <span className="text-[11px] font-bold text-slate-300">
              Account Balance: R
            </span>
            <input
              type="number"
              min={500}
              step={500}
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              onBlur={() => handleBalanceCommit()}
              onKeyDown={(e) => e.key === "Enter" && handleBalanceCommit()}
              className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
            />
            <span className="text-[11px] font-mono text-cyan-300 font-semibold">
              ZAR{" "}
              {accountUsd !== null ? `(~$${accountUsd.toFixed(0)} USD)` : ""}
            </span>
          </div>

          {/* Simple Sniper View vs Pro Quant View Toggle */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-700">
            <button
              onClick={() => onToggleSimpleView(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition ${
                simpleSniperView
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              ✨ Simple Sniper View
            </button>
            <button
              onClick={() => onToggleSimpleView(false)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition ${
                !simpleSniperView
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Microscope className="w-3.5 h-3.5" />
              🔬 Pro Quant View
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs font-mono bg-slate-800/90 px-2.5 py-1 rounded border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-sky-300 font-semibold">
              {macro?.sastTimeFormatted || "SAST"}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-indigo-300">
              SARB {fmtN(macro?.sarbRepoRatePct, 2, "", "%")}
            </span>
            <button
              onClick={onRefreshScan}
              disabled={isScanning}
              title="Rescan JSE Universe"
              className="ml-1 text-slate-400 hover:text-emerald-300 transition"
            >
              <RefreshCw
                className={`w-3 h-3 ${isScanning ? "animate-spin text-emerald-400" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: USD/ZAR OU Shield + JSE Macro Telemetry + Standardized Action Bar */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Live USD/ZAR Ornstein-Uhlenbeck Currency Regime Shield */}
          <div className="px-2.5 py-1.5 rounded bg-slate-800/90 border border-cyan-500/30 flex items-center gap-2">
            <span className="text-slate-400 font-semibold">USD/ZAR:</span>
            <span className="font-mono font-bold text-cyan-300">
              {fmtN(fxRate, 2, "R")}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              (Z={zscore === null ? "n/a" : `${zscore >= 0 ? `+${zscore}` : zscore}`} | OU τ=
              {ouHalfLife === null ? "n/a" : `${ouHalfLife}d`})
            </span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-200 font-bold text-[11px]">
              {regimeBadge}
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded bg-slate-800/70 border border-slate-700/80 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">GOLD:</span>
            <span className="font-mono font-bold text-white">
              {goldZar === null ? "n/a" : `R${Math.round(goldZar).toLocaleString()}`}
            </span>
            {goldChg !== null && (
              <span
                className={`font-mono font-semibold ${
                  goldChg >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {fmtSigned(goldChg, "%")}
              </span>
            )}
          </div>

          <div className="px-2.5 py-1.5 rounded bg-slate-800/70 border border-slate-700/80 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">0700.HK:</span>
            <span className="font-mono font-bold text-white">
              {fmtN(tencentPrice, 1, "HK$")}
            </span>
            <span
              className={`font-mono font-semibold ${
                tencentChg === null
                  ? "text-slate-400"
                  : tencentChg >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {fmtSigned(tencentChg, "%")}
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded bg-slate-800/70 border border-slate-700/80 flex items-center gap-1.5">
            <span className="text-slate-400">VIX:</span>
            <span className="font-mono font-bold text-amber-300">
              {fmtN(vixSpot, 2)}
            </span>
            <span className="text-[11px] text-emerald-300 font-medium">
              (ES {fmtSigned(esChg, "%")})
            </span>
          </div>

          <div
            className={`px-2.5 py-1.5 rounded border flex items-center gap-1.5 ${
              isLockout
                ? "bg-rose-950/60 border-rose-500/60 text-rose-200"
                : "bg-emerald-950/50 border-emerald-700/50 text-emerald-300"
            }`}
          >
            <ShieldAlert
              className={`w-3.5 h-3.5 ${
                isLockout ? "text-rose-400" : "text-emerald-400"
              }`}
            />
            <span className="font-semibold">{shieldStatusLabel}</span>
          </div>

          {antiTiltTriggered && (
            <div className="px-2.5 py-1.5 rounded bg-rose-950/80 border border-rose-500/60 text-rose-200 font-bold text-[11px]">
              🛑 ANTI-TILT CIRCUIT BREAKER ACTIVE (0.5x Kelly)
            </div>
          )}
        </div>

        {/* Right Controls: Friction Profile + Standardized Action Modals */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded border border-slate-700 text-xs">
            <span className="text-slate-400">JSE Broker Fee:</span>
            <select
              value={wallet?.selectedFeeProfile || "EASYEQUITIES_ZAR"}
              onChange={(e) =>
                onChangeFeeProfile(e.target.value as FeeProfileKey)
              }
              className="bg-slate-900 text-amber-300 font-semibold px-2 py-0.5 rounded border border-slate-700 focus:outline-none"
            >
              <option value="EASYEQUITIES_ZAR">
                EasyEquities ZAR ({JSE_EQUITY_FRICTION_PCT.toFixed(2)}% Eq)
              </option>
              <option value="EASYEQUITIES_TFSA">
                EasyEquities TFSA (0% STT / {JSE_ETF_FRICTION_PCT.toFixed(2)}% ETF)
              </option>
              <option value="INSTITUTIONAL_DMA_ZAR">
                Institutional DMA (0.59% Eq / 0.34% ETF)
              </option>
            </select>
          </div>

          {/* Global Top 3 (JSE + US + Crypto) */}
          <button
            onClick={onOpenCrossMarketModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow transition"
          >
            <Globe className="w-3.5 h-3.5" />
            🌐 Global Top 3 (JSE + US + Crypto)
          </button>

          {/* R10k -> R100k Compounding Tracker */}
          <button
            onClick={onOpenCompoundingModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold transition"
          >
            <LineChart className="w-3.5 h-3.5 text-amber-400" />
            📈 R10k → R100k Tracker
          </button>

          {/* + Add Stock Watchlist */}
          <button
            onClick={onOpenWatchlistModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-bold transition"
          >
            <ListPlus className="w-3.5 h-3.5" />
            + Add Stock
          </button>

          {/* Telegram Sniper Bot */}
          <button
            onClick={onOpenTelegramModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-bold transition"
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            📲 Telegram Bot
          </button>

          <div className="hidden 2xl:flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1.5 rounded border border-slate-700 text-xs">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Paper Equity:</span>
            <span className="font-mono font-bold text-emerald-300">
              R{Math.round(totalPaperZar).toLocaleString("en-ZA")}
            </span>
            <button
              onClick={onResetWallet}
              title="Reset JSE Paper Wallet"
              className="ml-1 text-slate-400 hover:text-amber-300 transition"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={onOpenCustomTradeModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            + Log Real / Custom Trade
          </button>
        </div>
      </div>
    </header>
  );
};
