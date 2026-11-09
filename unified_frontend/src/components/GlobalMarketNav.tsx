import React from "react";
import {
  Activity,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe,
  Grid,
  Radio,
  Sliders,
  Terminal as TerminalIcon,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { formatZar } from "../utils/formatters";
import { terminalStore, useTerminalStore } from "../store/terminalStore";

export type MarketId = "home" | "jse" | "us" | "crypto" | "bot";

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
  layoutMode?: "SINGLE" | "DOCKED_GRID";
  onToggleLayoutMode?: () => void;
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
    id: "home",
    flag: "🌐",
    label: "Overview",
    cleanPill: "XTRADER · Portal",
    port: 5173,
    shortcut: "0",
  },
  {
    id: "jse",
    flag: "🇿🇦",
    label: "JSE",
    cleanPill: "JSE · Equities",
    port: 8000,
    shortcut: "1",
  },
  {
    id: "us",
    flag: "🇺🇸",
    label: "US",
    cleanPill: "US · Wall St",
    port: 8001,
    shortcut: "2",
  },
  {
    id: "crypto",
    flag: "⚡",
    label: "Crypto",
    cleanPill: "Crypto · Spot 1x",
    port: 8002,
    shortcut: "3",
  },
  {
    id: "bot",
    flag: "🤖",
    label: "Bot Trading",
    cleanPill: "Self-Improving Bot",
    port: 8002,
    shortcut: "4",
  },
];

const PANIC_HOLD_MS = 1500;

export const HoldToConfirmPanic: React.FC = () => {
  const [progress, setProgress] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);
  const startRef = React.useRef<number>(0);

  const cancel = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setProgress(0);
  }, []);

  const tick = React.useCallback(() => {
    const pct = Math.min(1, (performance.now() - startRef.current) / PANIC_HOLD_MS);
    setProgress(pct);
    if (pct >= 1) {
      rafRef.current = null;
      setProgress(0);
      terminalStore.triggerEmergencyPanicFlatten();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = React.useCallback(() => {
    if (rafRef.current !== null) return;
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  React.useEffect(() => cancel, [cancel]);

  return (
    <button
      type="button"
      data-testid="panic-hold-button"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") cancel();
      }}
      onBlur={cancel}
      className="relative overflow-hidden px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white font-extrabold flex items-center gap-1.5 text-xs shadow-[0_0_15px_rgba(239,68,68,0.3)] transition select-none cursor-pointer"
      title="HOLD 1.5s to flatten all positions across markets (or Shift+Esc)"
      aria-label="Hold for 1.5 seconds to panic flatten all positions"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-black/50"
        style={{ width: `${progress * 100}%` }}
      />
      <AlertOctagon className="w-3.5 h-3.5 relative text-white" />
      <span className="hidden sm:inline relative font-mono tracking-wider">
        {progress > 0 ? "HOLDING…" : "HOLD PANIC"}
      </span>
    </button>
  );
};

export const GlobalMarketNav: React.FC<GlobalMarketNavProps> = ({
  activeMarket,
  onSelectMarket,
  healthMap,
  activeWsConnected,
  lastWsTick,
  hudDrawerOpen,
  onToggleHudDrawer,
  layoutMode = "SINGLE",
  onToggleLayoutMode,
}) => {
  const onlineCount = ["jse", "us", "crypto"].filter(
    (k) => healthMap[k as MarketId]?.online
  ).length;
  const activeMeta =
    MARKET_ITEMS.find((m) => m.id === activeMarket) || MARKET_ITEMS[0];
  const isLive =
    activeMarket === "bot" || activeMarket === "home"
      ? Boolean(healthMap.crypto?.online || healthMap.bot?.online || onlineCount > 0)
      : activeWsConnected && Boolean(healthMap[activeMeta.id]?.online);

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
      aria-label="Command Navigation Header"
      className="h-14 shrink-0 z-[60] bg-[#04070D]/85 backdrop-blur-xl border-b border-white/10 px-3 sm:px-6 flex items-center justify-between shadow-2xl"
    >
      {/* Left: Sovereign Brand Glyph & Version Pill (Image 1 & 3) */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => onSelectMarket("home")}
          className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
        >
          {/* Cyber Geometric Logo Mark */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 via-teal-400 to-emerald-400 p-[1px] shadow-[0_0_20px_rgba(0,229,255,0.3)] group-hover:shadow-[0_0_25px_rgba(0,229,255,0.5)] transition-all">
            <div className="w-full h-full bg-[#04070D] rounded-[11px] flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-orbitron font-extrabold text-sm tracking-wider text-white group-hover:text-cyan-300 transition-colors">
                SOVEREIGN
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
                XTRADER
              </span>
            </div>
            <span className="text-[9px] font-mono text-slate-400">
              Omni-Market V13.0
            </span>
          </div>
        </button>
      </div>

      {/* Center: Sleek Capsule Market Switcher (Image 1 Pill Style) */}
      <div
        role="tablist"
        aria-label="Select Trading Market"
        className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-full border border-white/10 backdrop-blur-md shadow-inner"
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
              title={`${item.label} (:${item.port}) [Hotkey: ${item.shortcut}]`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? "bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(0,229,255,0.4)]"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{item.flag}</span>
              <span className="font-mono text-xs">{item.label}</span>
              {item.id !== "home" && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    health?.online ? "bg-emerald-400" : "bg-rose-500"
                  }`}
                />
              )}
            </button>
          );
        })}

        {/* Multi-Monitor Docked Grid Toggle */}
        {onToggleLayoutMode && (
          <button
            type="button"
            onClick={onToggleLayoutMode}
            title="Toggle 4-Market Multi-Monitor Docked Grid"
            className={`hidden md:flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              layoutMode === "DOCKED_GRID"
                ? "bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="font-mono text-xs">Docked 4x</span>
          </button>
        )}
      </div>

      {/* Right: Portfolio Telemetry, Order Ticket, HUD & Panic Button */}
      <div className="flex items-center gap-2.5 font-mono text-xs shrink-0">
        {/* Anchored Portfolio Telemetry Glass Pill */}
        <div
          data-testid="anchored-portfolio-capital"
          className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full glass-panel border border-white/10 text-slate-300"
        >
          <span className="text-slate-400 text-[11px]">PORTFOLIO:</span>
          <strong className="text-white tabular-nums font-bold">
            {formatZar(portfolioCapitalZar, { decimals: 0 })}
          </strong>
          <span className="text-white/20">|</span>
          <span className="text-slate-400 text-[11px]">PNL:</span>
          <strong
            className={`tabular-nums font-bold ${
              realizedPnlZar >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatZar(realizedPnlZar, { decimals: 2 })}
          </strong>
        </div>

        {/* Space Quick Order Ticket Pill */}
        <button
          type="button"
          onClick={() => {
            const st = terminalStore.getState();
            terminalStore.updateImmediate({ quickTicketOpen: !st.quickTicketOpen });
          }}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold text-xs transition shadow-sm cursor-pointer"
          title="Open Quick Order Ticket (Hotkey: Space)"
        >
          <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span>ORDER</span>
          <kbd className="px-1 py-0.2 rounded bg-cyan-500/20 text-[9px]">Space</kbd>
        </button>

        {/* Live Status Indicator */}
        <div
          role="status"
          data-testid="data-freshness-badge"
          title={
            isLive
              ? `Live ${activeMeta.label} engine stream${formattedTick ? ` @ ${formattedTick}` : ""}`
              : `Engine/stream offline: cached snapshot.${formattedTick ? ` Last tick @ ${formattedTick}` : ""}`
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
            isLive
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-amber-950/60 border-amber-500/60 text-amber-300 animate-pulse"
          }`}
        >
          {isLive ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          ) : (
            <WifiOff className="w-3 h-3 text-amber-400" />
          )}
          <span className="hidden sm:inline font-mono">{isLive ? "LIVE SYNC" : "OFFLINE"}</span>
        </div>

        {/* Secondary Telemetry HUD Toggle */}
        <button
          type="button"
          onClick={onToggleHudDrawer}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-bold transition cursor-pointer ${
            hudDrawerOpen
              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
              : "glass-pill text-slate-400 hover:text-white"
          }`}
          title="Toggle Secondary Telemetry HUD Drawer (IPC, Risk, CVaR)"
        >
          <Sliders className="w-3 h-3" />
          <span className="hidden sm:inline">HUD</span>
          {hudDrawerOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Panic Flatten Hold Button */}
        <HoldToConfirmPanic />
      </div>
    </nav>
  );
};

export default GlobalMarketNav;
