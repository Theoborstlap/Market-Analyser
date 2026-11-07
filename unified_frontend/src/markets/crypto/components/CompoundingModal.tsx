import React from "react";
import {
  X,
  TrendingUp,
  Download,
  ShieldAlert,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import {
  CompoundingRoadmap,
  ClosedTradeRecord,
  formatCryptoPrice,
} from "../types/market";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roadmap: CompoundingRoadmap;
  closedTrades: ClosedTradeRecord[];
  usdzarRate: number;
}

export const CompoundingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  roadmap,
  closedTrades,
  usdzarRate,
}) => {
  if (!isOpen || !roadmap) return null;

  const cb = roadmap.anti_tilt_circuit_breaker;

  const handleDownloadCsv = () => {
    window.open("/engine/crypto/api/portfolio/export-csv", "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                📈 Sovereign R10,000 → R100,000 Crypto 1x Spot Compounding Roadmap &amp; Audit
              </h3>
              <p className="text-xs text-slate-400">
                Realized Win Rate, Profit Factor, Anti-Tilt Circuit Breaker &amp; 1-Click CSV Export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow transition"
            >
              <Download className="w-3.5 h-3.5" />
              📥 1-Click Export .CSV Audit
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Anti-Tilt Circuit Breaker Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold ${
              cb.triggered
                ? "bg-rose-950/60 border-rose-500/50 text-rose-200"
                : "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{cb.status_badge}</span>
            </div>
            <span className="font-mono">
              Consecutive Losses: {cb.consecutive_losses} • Active Kelly Multiplier:{" "}
              {cb.kelly_multiplier}x
            </span>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[11px]">Current Total Equity</div>
              <div className="text-base font-mono font-extrabold text-emerald-400 mt-0.5">
                R {roadmap.current_equity_zar.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono text-cyan-300">
                ~${roadmap.current_equity_usd.toLocaleString()} USDT
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[11px]">Realized Win Rate</div>
              <div className="text-base font-mono font-extrabold text-white mt-0.5">
                {roadmap.realized_win_rate_pct.toFixed(1)}%
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {roadmap.total_closed_trades} Closed 1x Spot Trades
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[11px]">Realized Profit Factor</div>
              <div className="text-base font-mono font-extrabold text-amber-300 mt-0.5">
                {roadmap.realized_profit_factor.toFixed(2)}x
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                After 0.25% 1x Spot Friction
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[11px]">Realized Net Profit</div>
              <div
                className={`text-base font-mono font-extrabold mt-0.5 ${
                  roadmap.realized_net_pnl_zar >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {roadmap.realized_net_pnl_zar >= 0 ? "+" : ""}R{" "}
                {roadmap.realized_net_pnl_zar.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono text-slate-300">
                ({roadmap.realized_net_pnl_usd >= 0 ? "+" : ""}$
                {roadmap.realized_net_pnl_usd.toFixed(2)} USDT)
              </div>
            </div>
          </div>

          {/* R10k -> R100k Milestone Progress Bar */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Trophy className="w-4 h-4" />
                R10,000 → R100,000 Compounding Progress
              </span>
              <span className="font-mono font-bold text-white">
                {roadmap.progress_to_100k_pct.toFixed(1)}% of R100k Goal
              </span>
            </div>

            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-amber-400 transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(5, roadmap.progress_to_100k_pct))}%`,
                }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              {roadmap.milestones.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                    m.reached
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300 font-bold"
                      : "bg-slate-900/60 border-slate-800 text-slate-400"
                  }`}
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      m.reached ? "text-emerald-400" : "text-slate-600"
                    }`}
                  />
                  <span className="truncate">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Closed Trades History Table */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>Closed Crypto 1x Spot Trades Audit Log (SQLite Persistent)</span>
              <span className="text-[11px] font-mono text-slate-400">
                USD/ZAR @ R{usdzarRate.toFixed(2)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/50 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Mode</th>
                    <th className="py-2 px-3">Entry ($ USDT)</th>
                    <th className="py-2 px-3">Exit ($ USDT)</th>
                    <th className="py-2 px-3">Coins</th>
                    <th className="py-2 px-3">Net P&amp;L %</th>
                    <th className="py-2 px-3">Net USDT</th>
                    <th className="py-2 px-3">Net ZAR</th>
                    <th className="py-2 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {closedTrades.map((t) => {
                    const isWin = (t.realized_net_pnl_usd || 0) >= 0;
                    return (
                      <tr key={t.id} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 font-bold text-white">{t.symbol}</td>
                        <td className="py-2 px-3 text-slate-300">{t.mode}</td>
                        <td className="py-2 px-3 text-slate-300">
                          ${formatCryptoPrice(Number(t.entry_price))}
                        </td>
                        <td className="py-2 px-3 text-white font-bold">
                          ${formatCryptoPrice(Number(t.exit_price || t.entry_price))}
                        </td>
                        <td className="py-2 px-3 text-slate-300">{t.shares}</td>
                        <td
                          className={`py-2 px-3 font-bold ${
                            isWin ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {t.realized_net_pnl_pct >= 0 ? "+" : ""}
                          {Number(t.realized_net_pnl_pct || 0).toFixed(2)}%
                        </td>
                        <td
                          className={`py-2 px-3 font-bold ${
                            isWin ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isWin ? "+" : ""}$
                          {Number(t.realized_net_pnl_usd || 0).toFixed(2)}
                        </td>
                        <td
                          className={`py-2 px-3 font-bold ${
                            isWin ? "text-emerald-300" : "text-rose-300"
                          }`}
                        >
                          {isWin ? "+" : ""}R
                          {Math.round(Number(t.realized_net_pnl_zar || 0)).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-amber-300">
                          {t.close_reason || "CLOSED"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CompoundingModal;
