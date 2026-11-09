import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Cpu,
  DollarSign,
  Flame,
  Globe,
  Layers,
  LineChart,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { MarketId } from "./GlobalMarketNav";

export interface BotSettings {
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

export interface BotStatus {
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

export interface TradingMemoryItem {
  id: number;
  market: string;
  ticker: string;
  created_at: string;
  as_of_date: string;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  signal_tier: string;
  final_conviction: number;
  holding_window_days: number;
  analyst_votes_json: string;
  status: string;
  resolution_date?: string | null;
  resolved_price?: number | null;
  realized_return_pct?: number | null;
  was_win?: number | null;
  reflection_notes?: string | null;
}

interface TradingBotDashboardProps {
  isActive: boolean;
  onSwitchMarket?: (market: MarketId) => void;
}

const SPECIALIST_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  quant_microstructure: {
    label: "Quant Microstructure & Volatility",
    desc: "Order book imbalance, high-frequency delta flows & realized variance",
    color: "#06b6d4",
  },
  perp_funding_options: {
    label: "Perp Funding, OI & Gamma",
    desc: "Perpetual funding rate deviations, open interest exhaustion & skew",
    color: "#8b5cf6",
  },
  onchain_defillama_dex: {
    label: "On-Chain DefiLlama & DEX Flow",
    desc: "Cross-chain TVL shifts, liquidity pool depth & smart-money flows",
    color: "#10b981",
  },
  macro_narrative_zar: {
    label: "Global Macro & ZAR Arbitrage",
    desc: "USD/ZAR mean reversion, Fed rate expectations & offshore arbitrage",
    color: "#f59e0b",
  },
};

export const TradingBotDashboard: React.FC<TradingBotDashboardProps> = ({
  isActive,
  onSwitchMarket,
}) => {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [memoryHistory, setMemoryHistory] = useState<TradingMemoryItem[]>([]);
  const [unsettledCount, setUnsettledCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "SPECIALISTS" | "SETTINGS" | "MEMORY" | "AUDIT">("OVERVIEW");

  // Form editable settings
  const [editMode, setEditMode] = useState<string>("PAPER");
  const [editMaxPositions, setEditMaxPositions] = useState<number>(3);
  const [editMinKelly, setEditMinKelly] = useState<number>(10);
  const [editEta, setEditEta] = useState<number>(0.08);
  const [editInterval, setEditInterval] = useState<number>(15);
  const [editBroker, setEditBroker] = useState<string>("BINANCE_SPOT");

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4500);
  };

  const fetchBotStatus = useCallback(async () => {
    try {
      const res = await fetch("/engine/crypto/api/bot/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok && data.status) {
        setStatus(data.status);
        if (data.status.settings) {
          setEditMode(data.status.settings.mode || "PAPER");
          setEditMaxPositions(data.status.settings.max_active_positions || 3);
          setEditMinKelly(data.status.settings.min_kelly_fraction_pct || 10);
          setEditEta(data.status.settings.eta_learning_rate || 0.08);
          setEditInterval(data.status.settings.polling_interval_sec || 15);
          setEditBroker(data.status.settings.broker_profile || "BINANCE_SPOT");
        }
      }
    } catch (err: any) {
      console.warn("TradingBotDashboard status fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMemoryHistory = useCallback(async () => {
    try {
      const res = await fetch("/engine/crypto/api/memory/history?limit=30");
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.history)) {
          setMemoryHistory(data.history);
          setUnsettledCount(data.unsettled_count || 0);
        }
      }
    } catch (err: any) {
      console.warn("TradingBotDashboard memory fetch error:", err.message);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    fetchBotStatus();
    fetchMemoryHistory();
    const interval = setInterval(() => {
      fetchBotStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [isActive, fetchBotStatus, fetchMemoryHistory]);

  const handleToggleBot = async () => {
    if (!status) return;
    setBusy(true);
    try {
      const endpoint = status.running
        ? "/engine/crypto/api/bot/stop"
        : "/engine/crypto/api/bot/start";
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        showToast(data.message || (status.running ? "Bot stopped" : "Bot started"));
        await fetchBotStatus();
      } else {
        showToast(data.error || "Failed to toggle bot", true);
      }
    } catch (err: any) {
      showToast(err.message || "Network error", true);
    } finally {
      setBusy(false);
    }
  };

  const handleRunSingleStep = async () => {
    setBusy(true);
    try {
      const res = await fetch("/engine/crypto/api/bot/step", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        const actionsCount = (data.actions_taken || []).length;
        showToast(`Test Cycle #${data.cycle || 1} complete: ${actionsCount} action(s) executed`);
        await fetchBotStatus();
        await fetchMemoryHistory();
      } else {
        showToast(data.error || "Failed to execute single step", true);
      }
    } catch (err: any) {
      showToast(err.message || "Network error executing step", true);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/engine/crypto/api/bot/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: editMode,
          max_active_positions: Number(editMaxPositions),
          min_kelly_fraction_pct: Number(editMinKelly),
          eta_learning_rate: Number(editEta),
          polling_interval_sec: Number(editInterval),
          broker_profile: editBroker,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Bot strategy settings saved successfully");
        await fetchBotStatus();
      } else {
        showToast(data.error || "Failed to save settings", true);
      }
    } catch (err: any) {
      showToast(err.message || "Network error saving settings", true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-[#04070D] text-slate-100 flex flex-col pb-16">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-xs font-mono font-bold shadow-2xl border flex items-center gap-2 transition-all ${
            toastMsg.isError
              ? "bg-rose-950/95 border-rose-500/80 text-rose-200"
              : "bg-emerald-950/95 border-emerald-500/80 text-emerald-200"
          }`}
        >
          {toastMsg.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Header Command Strip */}
      <div className="border-b border-white/10 bg-[#04070D]/90 backdrop-blur-xl px-4 py-3.5">
        <div className="max-w-[1640px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(0,229,255,0.3)]">
              <Bot className="w-5 h-5 text-slate-950 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight font-orbitron">
                  Autonomous Self-Improving Trading Bot
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
                    status?.running
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status?.running ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                    }`}
                  />
                  {status?.running ? "LIVE BOT ACTIVE" : "BOT STOPPED"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 border border-cyan-400 text-cyan-300">
                  {status?.mode || "PAPER"} MODE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Multiplicative Weights Update (MWU) • 7-Stage Risk Lifecycle • Point-in-Time Trading Memory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunSingleStep}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-bold font-mono flex items-center gap-1.5 transition disabled:opacity-50"
              title="Execute a single evaluation cycle immediately (test alpha signals &amp; settle orders)"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>TEST 1-STEP</span>
            </button>

            <button
              type="button"
              onClick={handleToggleBot}
              disabled={busy}
              className={`px-4 py-1.5 rounded-lg text-xs font-extrabold font-mono flex items-center gap-1.5 transition shadow disabled:opacity-50 ${
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
              type="button"
              onClick={() => {
                fetchBotStatus();
                fetchMemoryHistory();
              }}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 transition"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-white/5 bg-[#080E1A]/60 px-4">
        <div className="max-w-[1640px] mx-auto flex items-center gap-1 font-mono text-xs">
          {[
            { id: "OVERVIEW", label: "Performance & Status", icon: LineChart },
            { id: "SPECIALISTS", label: "Self-Improving Specialist Weights", icon: Brain },
            { id: "SETTINGS", label: "Bot & Risk Config", icon: Sliders },
            { id: "MEMORY", label: `Trading Memory (${unsettledCount} Open)`, icon: Layers },
            { id: "AUDIT", label: "Execution Audit Logs", icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-bold transition ${
                  isSel
                    ? "border-sky-400 text-white bg-white/5"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSel ? "text-sky-400" : "text-slate-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1640px] w-full mx-auto px-4 pt-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="glass-panel hover:border-cyan-500/30 transition-all rounded-2xl p-4">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Win Rate</span>
            <div className="text-xl font-bold font-mono text-white mt-0.5">
              {status?.win_rate_pct ?? 0}%
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {status?.total_trades_closed ?? 0} closed trades
            </span>
          </div>

          <div className="glass-panel hover:border-cyan-500/30 transition-all rounded-2xl p-4">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Realized Net P&amp;L</span>
            <div
              className={`text-xl font-bold font-mono mt-0.5 ${
                (status?.realized_net_pnl_usd ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              ${(status?.realized_net_pnl_usd ?? 0).toFixed(2)}
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              ≈ R{(status?.realized_net_pnl_zar ?? 0).toFixed(2)}
            </span>
          </div>

          <div className="glass-panel hover:border-cyan-500/30 transition-all rounded-2xl p-4">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Paper Cash</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              ${(status?.paper_wallet_cash_usd ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] font-mono text-slate-500">Isolated Paper Balance</span>
          </div>

          <div className="glass-panel hover:border-cyan-500/30 transition-all rounded-2xl p-4">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Active Positions</span>
            <div className="text-xl font-bold font-mono text-white mt-0.5">
              {status?.active_positions_count ?? 0}
              <span className="text-slate-500 text-sm"> / {status?.max_active_positions ?? 3}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Current live slots</span>
          </div>

          <div className="glass-panel hover:border-cyan-500/30 transition-all rounded-2xl p-4">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Cycles Run</span>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">
              #{status?.cycle_count ?? 0}
            </div>
            <span className="text-[10px] font-mono text-slate-500 truncate block">
              {status?.last_cycle_time
                ? new Date(status.last_cycle_time).toLocaleTimeString()
                : "Idle"}
            </span>
          </div>

          <div className="glass-panel hover:border-cyan-500/30 transition-all rounded-2xl p-4">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Anti-Tilt Shield</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ShieldCheck
                className={`w-5 h-5 ${
                  status?.anti_tilt_shield?.triggered ? "text-rose-400" : "text-emerald-400"
                }`}
              />
              <span className="text-xs font-bold font-mono text-white">
                {status?.anti_tilt_shield?.status_badge || "SHIELD ACTIVE"}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              Kelly Mult: {status?.anti_tilt_shield?.kelly_multiplier ?? 1.0}x
            </span>
          </div>
        </div>

        {/* Tab 1: OVERVIEW */}
        {activeTab === "OVERVIEW" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left 2 Cols: Self-Improving Specialist Weights Snapshot */}
            <div className="lg:col-span-2 bg-[#080E1A] border border-white/10 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-sky-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Self-Reflective Specialist Weight Allocations
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Learning Rate η = {status?.settings?.eta_learning_rate ?? 0.08}
                </span>
              </div>

              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Weights continuously update via the Hedge algorithm after each settled trade based on
                realized return vs prediction. Outperforming specialists gain influence; underperforming specialists are downweighted.
              </p>

              <div className="space-y-4">
                {Object.entries(status?.agent_learned_weights || {
                  quant_microstructure: 0.30,
                  perp_funding_options: 0.27,
                  onchain_defillama_dex: 0.23,
                  macro_narrative_zar: 0.20,
                }).map(([key, weight]) => {
                  const meta = SPECIALIST_LABELS[key] || {
                    label: key,
                    desc: "Specialist Alpha Generator",
                    color: "#38bdf8",
                  };
                  const pct = (Number(weight) * 100).toFixed(1);
                  return (
                    <div key={key} className="bg-slate-950/60 border border-white/5 rounded-xl p-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-200">{meta.label}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-xs font-extrabold text-white">{pct}%</span>
                          <span className="text-[11px] text-slate-500">({weight.toFixed(4)})</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden mb-1">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: meta.color,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{meta.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 1 Col: Quick Strategy Control & Instructions */}
            <div className="space-y-4">
              <div className="bg-[#080E1A] border border-white/10 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white uppercase font-mono">
                    Quick Strategy Status
                  </h3>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Execution Mode:</span>
                    <strong className="text-sky-400">{status?.mode || "PAPER"}</strong>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Max Active Slots:</span>
                    <strong className="text-white">{status?.max_active_positions || 3}</strong>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Min Kelly Fraction:</span>
                    <strong className="text-emerald-400">
                      {status?.settings?.min_kelly_fraction_pct || 10}%
                    </strong>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Scan Interval:</span>
                    <strong className="text-white">
                      {status?.settings?.polling_interval_sec || 15}s
                    </strong>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-400">Auto-Coach Integration:</span>
                    <strong className="text-emerald-400">ENABLED</strong>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-white/10 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleRunSingleStep}
                    disabled={busy}
                    className="w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-xs font-mono font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Run Single Test Cycle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("SETTINGS")}
                    className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-mono font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit Risk &amp; Sizing Parameters</span>
                  </button>
                </div>
              </div>

              {/* Anti-Tilt Guard Summary */}
              <div className="bg-[#080E1A] border border-white/10 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white uppercase font-mono">
                    Anti-Tilt Protection
                  </h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  Consecutive losses automatically reduce Kelly position sizing to protect paper capital.
                  Current loss streak: <strong className="text-white">{status?.anti_tilt_shield?.consecutive_losses ?? 0}</strong>.
                  Multiplier: <strong className="text-emerald-400">{status?.anti_tilt_shield?.kelly_multiplier ?? 1.0}x</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: SPECIALISTS DETAIL */}
        {activeTab === "SPECIALISTS" && (
          <div className="bg-[#080E1A] border border-white/10 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white font-mono">
                  Multiplicative Weights Update (Hedge Algorithm)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Mathematical formulation: <code className="text-sky-300">w_{`{i, t+1}`} = w_{`{i, t}`} · exp(-η · loss_i)</code> normalized across all active agents.
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-sky-500/20 border border-sky-400 text-sky-200 text-xs font-mono font-bold">
                η = {status?.settings?.eta_learning_rate ?? 0.08}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {Object.entries(status?.agent_learned_weights || {}).map(([key, weight]) => {
                const meta = SPECIALIST_LABELS[key] || {
                  label: key,
                  desc: "Specialist Alpha Generator",
                  color: "#38bdf8",
                };
                const pct = (Number(weight) * 100).toFixed(1);
                return (
                  <div key={key} className="bg-slate-950 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">{meta.label}</span>
                      <span className="text-sm font-extrabold font-mono text-sky-400">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{meta.desc}</p>
                    <div className="text-[11px] font-mono text-slate-500">
                      Raw normalized weight: <span className="text-slate-300">{weight.toFixed(5)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: SETTINGS */}
        {activeTab === "SETTINGS" && (
          <div className="max-w-2xl bg-[#080E1A] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h3 className="text-base font-bold text-white font-mono mb-4 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-sky-400" />
              Bot Execution &amp; Risk Parameters
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">
                  Execution Mode
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditMode("PAPER")}
                    className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold border transition ${
                      editMode === "PAPER"
                        ? "bg-indigo-600 border-indigo-400 text-white"
                        : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    PAPER TRADING (Simulated Fills)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode("REAL")}
                    className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold border transition ${
                      editMode === "REAL"
                        ? "bg-emerald-600 border-emerald-400 text-white"
                        : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    REAL BROKER (CCXT / REST)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Max Active Positions
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editMaxPositions}
                    onChange={(e) => setEditMaxPositions(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">Concurrent position slots</span>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Min Kelly Fraction (%)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={editMinKelly}
                    onChange={(e) => setEditMinKelly(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">Floor position sizing</span>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Learning Rate (η)
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    min={0.01}
                    max={0.5}
                    value={editEta}
                    onChange={(e) => setEditEta(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">Hedge calibration speed</span>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Evaluation Interval (seconds)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={editInterval}
                    onChange={(e) => setEditInterval(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">Polling loop frequency</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Target Broker / Exchange Profile
                </label>
                <select
                  value={editBroker}
                  onChange={(e) => setEditBroker(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
                >
                  <option value="BINANCE_SPOT">Binance Spot (0.10% / 0.075% BNB)</option>
                  <option value="BYBIT_SPOT">Bybit Spot (0.10% Taker / 0.10% Maker)</option>
                  <option value="VALR_ZAR_SPOT">VALR Spot ZAR (0.00% Maker / 0.05% Taker)</option>
                  <option value="PAPER_SIMULATOR">Pure Local Paper Simulator (Zero Risk)</option>
                </select>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-bold transition disabled:opacity-50"
                >
                  {busy ? "Saving Settings..." : "Save Bot Settings"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 4: TRADING MEMORY */}
        {activeTab === "MEMORY" && (
          <div className="bg-[#080E1A] border border-white/10 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white font-mono">
                  Point-in-Time Trading Memory Log
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Durable decisions logged at signal generation. Settles against holding window close prices to drive continuous learning.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchMemoryHistory}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-mono text-slate-300 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Memory</span>
              </button>
            </div>

            {memoryHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-mono text-xs">
                No trading memory decisions recorded yet. Run a test step to generate signals.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 text-[11px] uppercase bg-slate-950/40">
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Ticker</th>
                      <th className="py-2.5 px-3">Entry</th>
                      <th className="py-2.5 px-3">Stop</th>
                      <th className="py-2.5 px-3">Target</th>
                      <th className="py-2.5 px-3">Conviction</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Realized PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {memoryHistory.map((m) => {
                      const isWin = (m.realized_return_pct ?? 0) > 0;
                      return (
                        <tr key={m.id} className="hover:bg-white/[0.02] transition">
                          <td className="py-2.5 px-3 text-slate-500">#{m.id}</td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {new Date(m.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">{m.ticker}</td>
                          <td className="py-2.5 px-3">${m.entry_price?.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-rose-400">${m.stop_loss?.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-emerald-400">${m.target_price?.toFixed(2)}</td>
                          <td className="py-2.5 px-3">{((m.final_conviction || 0) * 100).toFixed(0)}%</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                m.status === "SETTLED"
                                  ? "bg-slate-800 text-slate-300"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {m.status === "SETTLED" ? (
                              <span
                                className={`font-bold ${
                                  isWin ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                {isWin ? "+" : ""}
                                {(m.realized_return_pct ?? 0).toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: AUDIT TRAIL */}
        {activeTab === "AUDIT" && (
          <div className="bg-[#080E1A] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h3 className="text-base font-bold text-white font-mono mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-400" />
              Bot Audit &amp; Event Logs
            </h3>

            {(status?.recent_audit_logs || []).length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-mono text-xs">
                No audit events logged yet.
              </div>
            ) : (
              <div className="space-y-2 font-mono text-xs">
                {(status?.recent_audit_logs || []).map((log) => (
                  <div
                    key={log.id}
                    className="bg-slate-950 border border-white/5 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/30 text-sky-300 text-[10px] font-bold">
                        {log.action_type}
                      </span>
                      {log.symbol && (
                        <span className="font-bold text-white">{log.symbol}</span>
                      )}
                    </div>
                    <div className="text-slate-400 text-[11px] max-w-xl truncate">
                      {JSON.stringify(log.details)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingBotDashboard;
