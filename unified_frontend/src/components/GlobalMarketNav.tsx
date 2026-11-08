import React from "react";
import { Activity, AlertOctagon, ChevronDown, ChevronUp, Cpu, Globe, Radio, Sliders, Wifi, WifiOff } from "lucide-react";
import { formatZar } from "../utils/formatters";
import { terminalStore, useTerminalStore } from "../store/terminalStore";

export type MarketId = "jse" | "us" | "crypto";

export interface EngineHealthState {
  online: boolean;
  port: number;
  universeCount?: number;
  sessionPhase?: string;
}

export interface GlobalMarketNavProps {
  activeMarket: MarketId;
  onSelectMarket: (market: MarketId) => void;
  healthMap: Record<MarketId, EngineHealthState>;
  activeWsConnected: boolean;
  lastWsTick: string | null;
  hudDrawerOpen: boolean;
  onToggleHudDrawer: () => void;
}

interface MarketMeta {
  id: MarketId;
  flag: string;
  label: string;
  cleanPill: string;
  port: number;
  shortcut: string;
}

const MARKET_ITEMS: MarketMeta[] = [
  {
    id: "jse",
    flag: "🇿🇦",
    label: "JSE",
    cleanPill: "JSE · Equities",
    port: 8000,
    shortcut: "Alt+1",
  },
  {
    id: "us",
    flag: "🇺🇸",
    label: "US",
    cleanPill: "US · Wall St",
    port: 8001,
    shortcut: "Alt+2",
  },
  {
    id: "crypto",
    flag: "⚡",
    label: "Crypto",
    cleanPill: "Crypto · Spot 1x",
    port: 8002,
    shortcut: "Alt+3",
  },
];

export const GlobalMarketNav: React.FC<GlobalMarketNavProps> = ({
  activeMarket,
  onSelectMarket,
  healthMap,
  activeWsConnected,
  lastWsTick,
  hudDrawerOpen,
  onToggleHudDrawer,
}) => {
  const onlineCount = (Object.values(healthMap) as EngineHealthState[]).filter(
    (h) => h.online
  ).length;
  const activeMeta =
    MARKET_ITEMS.find((m) => m.id === activeMarket) || MARKET_ITEMS[0];

  const portfolioCapitalZar = useTerminalStore((s) => s.portfolioCapitalZar);
  const freeCashZar = useTerminalStore((s) => s.freeCashZar);
  const realizedPnlZar = useTerminalStore((s) => s.realizedPnlZar);

  const formattedTick = lastWsTick
    ? (() => {
        try {
          return new Date(lastWsTick).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <nav
      aria-label="48px Command Header"
      className="h-12 shrink-0 z-[60] bg-[#04070E] border-b border-white/10 px-3 sm:px-4 flex items-center justify-between shadow-xl"
    >
      {/* Left: Sovereign Identity & Clean Market Status Pill */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 via-cyan-500 to-emerald-500 flex items-center justify-center shrink-0">
          <Globe className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-wider text-white uppercase hidden md:inline">
            SOVEREIGN
          </span>
          <span className="px-1 py-0.2 rounded bg-white/5 border border-white/10 text-[9px] font-mono font-bold text-slate-400">
            V13.0
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-white/10 text-[10px] font-mono font-bold text-slate-200">
            [{activeMeta.cleanPill}]
          </span>
        </div>
      </div>

      {/* Center: Compact Market Switcher */}
      <div
        role="tablist"
        aria-label="Select Trading Market"
        className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-white/10"
      >
        {MARKET_ITEMS.map((item) => {
          const isSelected = activeMarket === item.id;
          const health = healthMap[item.id];
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              data-testid={`market-switch-${item.id}`}
              onClick={() => onSelectMarket(item.id)}
              title={`${item.label} (:${item.port}) [${item.shortcut}]`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition ${
                isSelected
                  ? "bg-slate-200 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <span>{item.flag}</span>
              <span className="font-mono">{item.label}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  health?.online ? "bg-emerald-400" : "bg-rose-500"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Right: Anchored Portfolio Capital, Telemetry Status & HUD Toggle */}
      <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
        {/* Single Source of Truth Portfolio Telemetry */}
        <div
          data-testid="anchored-portfolio-capital"
          className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/90 border border-white/10 text-slate-300"
        >
          <span className="text-slate-400">Portfolio:</span>
          <strong className="text-white tabular-nums">
            {formatZar(portfolioCapitalZar, { decimals: 0 })}
          </strong>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Cash:</span>
          <strong className="text-emerald-400 tabular-nums">
            {formatZar(freeCashZar, { decimals: 0 })}
          </strong>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">PnL:</span>
          <strong
            className={`tabular-nums ${
              realizedPnlZar >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatZar(realizedPnlZar)}
          </strong>
        </div>

        {/* WS Stream Indicator */}
        <div
          title={
            activeWsConnected
              ? `WS Stream Active ${formattedTick ? `@ ${formattedTick}` : ""}`
              : "WS Connecting..."
          }
          className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] ${
            activeWsConnected
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-amber-950/40 border-amber-500/30 text-amber-300"
          }`}
        >
          {activeWsConnected ? (
            <Wifi className="w-3 h-3 text-emerald-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-amber-400" />
          )}
          <span className="font-bold hidden xl:inline">
            {activeWsConnected ? "STREAM" : "SYNC"}
          </span>
        </div>

        {/* Engines Online Pill */}
        <div
          title={`${onlineCount}/3 Background Engines Online`}
          className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-white/10 text-slate-300 text-[10px]"
        >
          <Cpu className="w-3 h-3 text-slate-400" />
          <span>{onlineCount}/3</span>
        </div>

        {/* Collapsible Secondary HUD Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleHudDrawer}
          className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-bold transition ${
            hudDrawerOpen
              ? "bg-slate-800 text-white border-white/20"
              : "bg-slate-900 text-slate-400 hover:text-white border-white/10"
          }`}
          title="Toggle Secondary Telemetry HUD Drawer (IPC, Risk, CVaR)"
        >
          <Sliders className="w-3 h-3" />
          <span>HUD</span>
          {hudDrawerOpen ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        {/* Panic Flatten [Shift+Esc] */}
        <button
          type="button"
          onClick={() => terminalStore.triggerEmergencyPanicFlatten()}
          className="px-2 py-1 rounded bg-[#ef4444] text-white font-extrabold hover:brightness-110 flex items-center gap-1 text-[10px] shadow-sm"
          title="Shift+Esc Emergency Cross-Market Panic Flatten"
        >
          <AlertOctagon className="w-3 h-3" />
          <span className="hidden sm:inline">PANIC</span>
        </button>
      </div>
    </nav>
  );
};

export default GlobalMarketNav;
