import React from "react";
import { Activity, Cpu, Globe, Radio, Wifi, WifiOff } from "lucide-react";

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
}

interface MarketMeta {
  id: MarketId;
  flag: string;
  shortLabel: string;
  subtitle: string;
  port: number;
  shortcut: string;
  accentActive: string;
  dotColor: string;
}

const MARKET_ITEMS: MarketMeta[] = [
  {
    id: "jse",
    flag: "🇿🇦",
    shortLabel: "JSE Johannesburg",
    subtitle: "SA Equities & ETFs",
    port: 8000,
    shortcut: "Alt+1",
    accentActive:
      "bg-indigo-600/90 border-indigo-400 text-white shadow-lg shadow-indigo-950/60",
    dotColor: "bg-indigo-400",
  },
  {
    id: "us",
    flag: "🇺🇸",
    shortLabel: "US Wall Street",
    subtitle: "NYSE / NASDAQ",
    port: 8001,
    shortcut: "Alt+2",
    accentActive:
      "bg-cyan-600/90 border-cyan-400 text-white shadow-lg shadow-cyan-950/60",
    dotColor: "bg-cyan-400",
  },
  {
    id: "crypto",
    flag: "⚡",
    shortLabel: "Crypto 24/7 Spot",
    subtitle: "1x Spot Singularity",
    port: 8002,
    shortcut: "Alt+3",
    accentActive:
      "bg-emerald-600/90 border-emerald-400 text-white shadow-lg shadow-emerald-950/60",
    dotColor: "bg-emerald-400",
  },
];

export const GlobalMarketNav: React.FC<GlobalMarketNavProps> = ({
  activeMarket,
  onSelectMarket,
  healthMap,
  activeWsConnected,
  lastWsTick,
}) => {
  const onlineCount = (Object.values(healthMap) as EngineHealthState[]).filter(
    (h) => h.online
  ).length;
  const activeMeta =
    MARKET_ITEMS.find((m) => m.id === activeMarket) || MARKET_ITEMS[0];

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
      aria-label="Global Market Switcher"
      className="relative shrink-0 z-[60] bg-[#04070E] border-b border-slate-800/90 px-4 py-2 shadow-xl"
    >
      <div className="max-w-[1680px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Sovereign Omni-Market Identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-cyan-500 to-emerald-500 flex items-center justify-center shadow-md shrink-0">
            <Globe className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold tracking-wider text-white uppercase">
                Sovereign Omni-Market Terminal
              </span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-300">
                UNIFIED V13.0
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 hidden sm:block">
              Persistent Multi-Engine Command • Zero-Interruption Background Daemons
            </div>
          </div>
        </div>

        {/* Center: Seamless 3-Market Switcher */}
        <div
          role="tablist"
          aria-label="Select Trading Market"
          className="flex items-center gap-1.5 bg-slate-950/95 p-1 rounded-xl border border-slate-800"
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
                title={`Switch active terminal to ${item.shortLabel} (Port ${item.port}) [${item.shortcut}]`}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? item.accentActive
                    : "bg-slate-900/70 border-transparent hover:border-slate-700 hover:bg-slate-900 text-slate-300"
                }`}
              >
                <span className="text-sm leading-none">{item.flag}</span>
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold tracking-tight">
                      {item.shortLabel}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        health?.online
                          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                          : "bg-rose-500"
                      }`}
                      title={
                        health?.online
                          ? `Engine :${item.port} ONLINE`
                          : `Engine :${item.port} OFFLINE`
                      }
                    />
                  </div>
                  <div
                    className={`text-[10px] font-mono ${
                      isSelected ? "text-slate-100/90" : "text-slate-400"
                    }`}
                  >
                    {item.subtitle} • :{item.port}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Active Routing & Background Engine Telemetry */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <div
            data-testid="active-engine-badge"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Active Feed:</span>
            <strong className="text-white">
              {activeMeta.shortLabel} (:{activeMeta.port})
            </strong>
          </div>

          <div
            data-testid="ws-status-badge"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
              activeWsConnected
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                : "bg-amber-950/50 border-amber-500/40 text-amber-300"
            }`}
          >
            {activeWsConnected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="font-bold">
              {activeWsConnected ? "WS STREAM" : "WS SYNC"}
            </span>
            {formattedTick && (
              <span className="text-[10px] text-emerald-200/80 hidden md:inline">
                {formattedTick}
              </span>
            )}
          </div>

          <div
            data-testid="engines-online-badge"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
              onlineCount === 3
                ? "bg-slate-900/90 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/60 border-rose-500/40 text-rose-300"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-bold">{onlineCount}/3 ENGINES</span>
            <Activity className="w-3 h-3 opacity-80" />
          </div>
        </div>
      </div>
    </nav>
  );
};
