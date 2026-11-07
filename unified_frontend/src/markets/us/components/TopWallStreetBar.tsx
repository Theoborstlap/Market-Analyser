import React from "react";
import {
  Clock,
  ShieldAlert,
  TrendingUp,
  Activity,
  DollarSign,
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
  onChangeAccountBalanceZar,
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
  const accountUsd = accountBalanceZar / Math.max(fxRate, 0.01);

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30">
      {/* Row 1: Session Phase Banner, Dual Clocks, Account Scaler & View Toggle */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            🇺🇸 US WALL STREET V10.1 SOVEREIGN
          </span>
          <span className="text-xs font-semibold text-slate-200">
            {session.banner_label}
          </span>
          <span className="text-xs text-amber-300/90 hidden xl:inline">
            • {session.sniper_window_note}
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
              value={accountBalanceZar}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onChangeAccountBalanceZar(Number.isFinite(v) && v > 0 ? v : 10000);
              }}
              className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
            />
            <span className="text-[11px] font-mono text-cyan-300 font-semibold">
              ZAR (~${accountUsd.toFixed(0)} USD)
            </span>
          </div>

          {/* Simple Sniper View vs Pro Quant View Toggle */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-700">
            <button
              onClick={() => onToggleViewMode(true)}
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
              onClick={() => onToggleViewMode(false)}
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
            <span className="text-sky-300 font-semibold">{session.sast_clock}</span>
            <span className="text-slate-500">|</span>
            <span className="text-indigo-300">{session.et_clock}</span>
          </div>
        </div>
      </div>

      {/* Row 2: USD/ZAR OU Shield + Wall Street Macro Telemetry + Action Bar */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Live USD/ZAR Ornstein-Uhlenbeck Currency Regime Shield */}
          <div className="px-2.5 py-1.5 rounded bg-slate-800/90 border border-cyan-500/30 flex items-center gap-2">
            <span className="text-slate-400 font-semibold">USD/ZAR:</span>
            <span className="font-mono font-bold text-cyan-300">
              R{fxRate.toFixed(2)}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              (Z={usdzar?.usdzar_zscore >= 0 ? `+${usdzar?.usdzar_zscore}` : usdzar?.usdzar_zscore} | OU τ={usdzar?.usdzar_ou_halflife}d)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-200 font-bold text-[11px]">
              {usdzar?.usdzar_regime_badge || "🟢 USD/ZAR STABLE TAILWIND"}
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded bg-slate-800/70 border border-slate-700/80 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">ES=F:</span>
            <span className="font-mono font-bold text-white">
              {macro.es_futures_price.toLocaleString()}
            </span>
            <span
              className={`font-mono font-semibold ${
                macro.es_futures_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {macro.es_futures_change_pct >= 0 ? "+" : ""}
              {macro.es_futures_change_pct}%
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded bg-slate-800/70 border border-slate-700/80 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">NQ=F:</span>
            <span className="font-mono font-bold text-white">
              {macro.nq_futures_price.toLocaleString()}
            </span>
            <span
              className={`font-mono font-semibold ${
                macro.nq_futures_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {macro.nq_futures_change_pct >= 0 ? "+" : ""}
              {macro.nq_futures_change_pct}%
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded bg-slate-800/70 border border-slate-700/80 flex items-center gap-1.5">
            <span className="text-slate-400">VIX:</span>
            <span className="font-mono font-bold text-amber-300">{macro.vix_spot}</span>
            <span className="text-[11px] text-emerald-300 font-medium">
              ({macro.vix_term_regime})
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded bg-emerald-950/50 border border-emerald-700/50 flex items-center gap-1.5 text-emerald-300">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">{macro.macro_shield_status}</span>
          </div>

          {antiTiltTriggered && (
            <div className="px-2.5 py-1.5 rounded bg-rose-950/80 border border-rose-500/60 text-rose-200 font-bold text-[11px]">
              🛑 ANTI-TILT CIRCUIT BREAKER ACTIVE (0.5x Kelly)
            </div>
          )}
        </div>

        {/* Right Controls: Friction Profile + V10.1 Action Modals */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded border border-slate-700 text-xs">
            <span className="text-slate-400">US Broker Fee:</span>
            <select
              value={feeProfile.id}
              onChange={(e) => onSelectFeeProfile(e.target.value)}
              className="bg-slate-900 text-amber-300 font-semibold px-2 py-0.5 rounded border border-slate-700 focus:outline-none"
            >
              {availableProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Upgrade 6: Global Top 3 (JSE + US + Crypto) */}
          <button
            onClick={onOpenCrossMarketModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow transition"
          >
            <Globe className="w-3.5 h-3.5" />
            🌐 Global Top 3 (JSE + US + Crypto)
          </button>

          {/* Upgrade 9: R10k -> R100k Compounding Tracker */}
          <button
            onClick={onOpenCompoundingModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold transition"
          >
            <LineChart className="w-3.5 h-3.5 text-amber-400" />
            📈 R10k → R100k Tracker
          </button>

          {/* Upgrade 10: + Add US Stock Watchlist */}
          <button
            onClick={onOpenWatchlistModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-bold transition"
          >
            <ListPlus className="w-3.5 h-3.5" />
            + Add Stock
          </button>

          {/* Upgrade 11: Telegram Sniper Bot */}
          <button
            onClick={onOpenTelegramModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-bold transition"
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            📲 Telegram Bot
          </button>

          <div className="hidden 2xl:flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1.5 rounded border border-slate-700 text-xs">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Paper Equity:</span>
            <span className="font-mono font-bold text-emerald-300">
              ${paperWallet.total_equity_usd.toLocaleString()}
            </span>
          </div>

          <button
            onClick={onOpenTradeModal}
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
