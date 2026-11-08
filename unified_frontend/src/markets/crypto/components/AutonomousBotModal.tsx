import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Play,
  Square,
  RefreshCw,
  Cpu,
  Brain,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

interface BotSettings {
  enabled: number;
  mode: string;
  max_active_positions: number;
  min_kelly_fraction_pct: number;
  eta_learning_rate: number;
  polling_interval_sec: number;
  auto_manage_coach: number;
  broker_profile: string;
  last_run_timestamp?: string | null;
}

interface BotStatus {
  running: boolean;
  mode: string;
  cycle_count: number;
  last_cycle_time: string | null;
  settings: BotSettings;
  active_positions_count: number;
  max_active_positions: number;
  total_trades_closed: number;
  win_rate_pct: number;
  realized_net_pnl_usd: number;
  realized_net_pnl_zar: number;
  paper_wallet_cash_usd: number;
  anti_tilt_shield: {
    triggered: boolean;
    consecutive_losses: number;
    kelly_multiplier: number;
    status_badge: string;
  };
  agent_learned_weights: Record<string, number>;
  recent_audit_logs: Array<{
    id: number;
    timestamp: string;
    action_type: string;
    symbol: string | null;
    trade_id: number | null;
    details: Record<string, any>;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  usdzarRate?: number;
}

export const AutonomousBotModal: React.FC<Props> = ({
  isOpen,
  onClose,
  usdzarRate = 18.42,
}) => {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchBotStatus = useCallback(async () => {
    try {
      const res = await fetch("/engine/crypto/api/bot/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok && data.status) {
        setStatus(data.status);
      }
    } catch (err: any) {
      console.error("Failed to fetch bot status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 4000);
    return () => clearInterval(interval);
  }, [isOpen, fetchBotStatus]);

  if (!isOpen) return null;

  const handleToggleBot = async () => {
    if (!status) return;
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const endpoint = status.running
        ? "/engine/crypto/api/bot/stop"
        : "/engine/crypto/api/bot/start";
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSuccessMsg(data.message || (status.running ? "Bot Stopped" : "Bot Started"));
        await fetchBotStatus();
      } else {
        setErrorMsg(data.error || "Failed to toggle bot");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  const handleRunSingleStep = async () => {
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/engine/crypto/api/bot/step", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        const actionsCount = (data.actions_taken || []).length;
        setSuccessMsg(
          `Executed cycle #${data.cycle || 1}: ${actionsCount} action(s) completed.`
        );
        await fetchBotStatus();
      } else {
        setErrorMsg(data.error || "Failed to execute step");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error executing step");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateMode = async (newMode: "PAPER" | "REAL") => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/engine/crypto/api/bot/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccessMsg(`Mode switched to ${newMode}`);
        await fetchBotStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update mode");
    } finally {
      setBusy(false);
    }
  };

  const specialistNames: Record<string, string> = {
    quant_microstructure: "Quant Microstructure & Volatility",
    perp_funding_options: "Perp Funding, OI & Options Gamma",
    onchain_defillama_dex: "On-Chain DefiLlama & DEX Flow",
    macro_narrative_zar: "Global Macro & ZAR Arbitrage",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-sky-500/40 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">
                  🤖 Sovereign Autonomous Trading &amp; Self-Learning Bot
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border flex items-center gap-1.5 ${
                    status?.running
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status?.running ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                    }`}
                  />
                  {status?.running ? "RUNNING (ACTIVE 24/7)" : "STOPPED"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 border border-indigo-400 text-indigo-300">
                  {status?.mode || "PAPER"} 1x SPOT
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated Signal Ingestion • 7-Stage Risk Lifecycle • Multiplicative Weights Update (MWU)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunSingleStep}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              title="Execute a single evaluation cycle immediately"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Step Once</span>
            </button>

            <button
              onClick={handleToggleBot}
              disabled={busy}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition shadow disabled:opacity-50 ${
                status?.running
                  ? "bg-rose-600 hover:bg-rose-500 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {status?.running ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>STOP BOT</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>START BOT</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Banners for feedback */}
        {errorMsg && (
          <div className="bg-rose-950/80 border-b border-rose-500/40 px-6 py-2 text-xs font-bold text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-6 py-2 text-xs font-bold text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>Active Slots</span>
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="text-lg font-mono font-extrabold text-white mt-0.5">
                {status?.active_positions_count ?? 0} / {status?.max_active_positions ?? 3}
              </div>
              <div className="text-[10px] text-slate-400">
                Risk Parity: 45% / 35% / 20%
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>Virtual USDT Cash</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg font-mono font-extrabold text-emerald-400 mt-0.5">
                ${status?.paper_wallet_cash_usd?.toLocaleString() ?? "0.00"}
              </div>
              <div className="text-[10px] text-slate-400">
                ~R {Math.round((status?.paper_wallet_cash_usd ?? 0) * usdzarRate).toLocaleString()} ZAR
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>Settled Win Rate</span>
                <Activity className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-lg font-mono font-extrabold text-white mt-0.5">
                {status?.win_rate_pct?.toFixed(1) ?? "0.0"}%
              </div>
              <div className="text-[10px] text-slate-400">
                {status?.total_trades_closed ?? 0} Closed Positions
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>Realized Net P&amp;L</span>
                <span className="text-[10px] text-slate-400">Net of Friction</span>
              </div>
              <div
                className={`text-lg font-mono font-extrabold mt-0.5 ${
                  (status?.realized_net_pnl_usd ?? 0) >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {(status?.realized_net_pnl_usd ?? 0) >= 0 ? "+" : ""}$
                {status?.realized_net_pnl_usd?.toFixed(2) ?? "0.00"}
              </div>
              <div className="text-[10px] text-slate-400">
                {(status?.realized_net_pnl_zar ?? 0) >= 0 ? "+" : ""}R{" "}
                {Math.round(status?.realized_net_pnl_zar ?? 0).toLocaleString()} ZAR
              </div>
            </div>
          </div>

          {/* Self-Learning Specialist Weights Engine (Multiplicative Weights Update) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Self-Learning Specialist Weights (Hedge MWU Calibration)
                </span>
              </div>
              <span className="text-[11px] font-mono text-cyan-300">
                Formula: w_{"{i,t+1}"} = w_{"{i,t}"} · exp(-η · Loss)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {status?.agent_learned_weights &&
                Object.entries(status.agent_learned_weights).map(([aid, weight]) => {
                  const pct = Math.round(weight * 100);
                  const label = specialistNames[aid] || aid;
                  return (
                    <div
                      key={aid}
                      className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">{label}</span>
                        <span className="font-mono font-extrabold text-cyan-300">
                          {pct}% ({(weight).toFixed(4)})
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(5, pct * 2.5))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Execution Mode & Safety Controls */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>Execution Mode:</span>
                <span className="text-emerald-400 font-extrabold">
                  {status?.mode === "REAL" ? "REAL 1x SPOT" : "PAPER 1x SPOT SIM ($100k Virtual)"}
                </span>
              </div>
              <div className="text-slate-400 text-[11px]">
                {status?.mode === "REAL"
                  ? "Orders route to configured CCXT exchange with 0 leverage."
                  : "Safe paper simulation with real live exchange prices, fees & slippage."}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleUpdateMode("PAPER")}
                disabled={status?.mode === "PAPER" || busy}
                className={`px-3 py-1.5 rounded-lg font-bold border transition ${
                  status?.mode === "PAPER"
                    ? "bg-sky-500/20 border-sky-400 text-sky-300 cursor-default"
                    : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Paper Mode
              </button>
              <button
                onClick={() => handleUpdateMode("REAL")}
                disabled={status?.mode === "REAL" || busy}
                className={`px-3 py-1.5 rounded-lg font-bold border transition ${
                  status?.mode === "REAL"
                    ? "bg-amber-500/20 border-amber-400 text-amber-300 cursor-default"
                    : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Real Mode
              </button>
            </div>
          </div>

          {/* Live Decision & Audit Trail */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                Live Autonomous Bot Event Log (SQLite Persistent)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Cycle #{status?.cycle_count ?? 0}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/70 font-mono text-xs">
              {!status?.recent_audit_logs || status.recent_audit_logs.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs font-sans">
                  No actions logged yet. Click &ldquo;Step Once&rdquo; or &ldquo;START BOT&rdquo; to begin.
                </div>
              ) : (
                status.recent_audit_logs.map((log) => {
                  const isExit = log.action_type.includes("EXIT");
                  const isEntry = log.action_type.includes("ENTERED");
                  const isRatchet = log.action_type.includes("RATCHET") || log.action_type.includes("BREAKEVEN");
                  const isLearning = log.action_type.includes("LEARNING");

                  const badgeClass = isExit
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                    : isEntry
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : isRatchet
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : isLearning
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                    : "bg-slate-800 border-slate-700 text-slate-300";

                  const timeStr = log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString()
                    : "";

                  return (
                    <div
                      key={log.id}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/40"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-500 text-[11px] shrink-0">{timeStr}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${badgeClass}`}
                        >
                          {log.action_type}
                        </span>
                        {log.symbol && (
                          <span className="font-bold text-white shrink-0">{log.symbol}</span>
                        )}
                        <span className="text-slate-400 truncate text-[11px]">
                          {log.details ? JSON.stringify(log.details) : ""}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutonomousBotModal;
