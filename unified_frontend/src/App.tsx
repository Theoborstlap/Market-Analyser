import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  EngineHealthState,
  GlobalMarketNav,
  MarketId,
} from "./components/GlobalMarketNav";
import {
  InstitutionalTelemetryStrip,
  QuickOrderTicketModal,
  VirtualizedGlobalBlotter,
  WebGlOrderBookCanvas,
} from "./components/InstitutionalBlotterAndCanvas";
import { terminalStore, useTerminalStore } from "./store/terminalStore";
import JseMarketApp from "./markets/jse/App";
import UsMarketApp from "./markets/us/App";
import CryptoMarketApp from "./markets/crypto/App";

const LS_ACTIVE_MARKET_KEY = "sovereign_unified_active_market_v13";

function resolveInitialMarket(): MarketId {
  if (typeof window !== "undefined") {
    const hash = window.location.hash.replace("#", "").trim().toLowerCase();
    if (hash === "jse" || hash === "us" || hash === "crypto") {
      return hash;
    }
    try {
      const saved = window.localStorage.getItem(LS_ACTIVE_MARKET_KEY);
      if (saved === "jse" || saved === "us" || saved === "crypto") {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
  }
  return "jse";
}

export const App: React.FC = () => {
  const [activeMarket, setActiveMarket] = useState<MarketId>(resolveInitialMarket);
  const [layoutMode, setLayoutMode] = useState<"SINGLE" | "DOCKED_GRID">("SINGLE");
  const [showDockDrawer, setShowDockDrawer] = useState<boolean>(true);
  const [hudDrawerOpen, setHudDrawerOpen] = useState<boolean>(false);
  const orders = useTerminalStore((s) => s.orders);
  const [blotterExpanded, setBlotterExpanded] = useState<boolean>(() => orders.length > 0);

  useEffect(() => {
    if (orders.length > 0) {
      setBlotterExpanded(true);
    }
  }, [orders.length]);
  const [visitedMarkets, setVisitedMarkets] = useState<Record<MarketId, boolean>>(
    () => ({
      jse: true,
      us: resolveInitialMarket() === "us",
      crypto: resolveInitialMarket() === "crypto",
    })
  );
  const [wsStatusByMarket, setWsStatusByMarket] = useState<
    Record<MarketId, { connected: boolean; lastTick: string | null }>
  >({
    jse: { connected: false, lastTick: null },
    us: { connected: false, lastTick: null },
    crypto: { connected: false, lastTick: null },
  });

  const [healthMap, setHealthMap] = useState<Record<MarketId, EngineHealthState>>({
    jse: { online: false, port: 8000 },
    us: { online: false, port: 8001 },
    crypto: { online: false, port: 8002 },
  });

  const busWsConnected = useTerminalStore((s) => s.wsConnected);
  const busLastTick = useTerminalStore((s) => s.lastTickIso);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleSelectMarket = useCallback((next: MarketId) => {
    setActiveMarket(next);
    setVisitedMarkets((prev) => (prev[next] ? prev : { ...prev, [next]: true }));
    try {
      window.localStorage.setItem(LS_ACTIVE_MARKET_KEY, next);
      window.history.replaceState(null, "", `#${next}`);
    } catch {
      // ignore history/storage errors
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, []);

  const activateDockedGrid = useCallback(() => {
    setVisitedMarkets({ jse: true, us: true, crypto: true });
    setLayoutMode((prev) => (prev === "DOCKED_GRID" ? "SINGLE" : "DOCKED_GRID"));
  }, []);

  // Institutional Bloomberg / Vim Hotkeys:
  // Space (Quick Order Ticket), Shift+Esc (Emergency Panic Flatten),
  // J/K (Blotter row navigation), 1/2/3/4 or Alt+1/2/3/4 (JSE / US / Crypto / Docked Grid)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toUpperCase() || "";
      const isInputFocused =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        Boolean(target?.isContentEditable);

      if (e.shiftKey && e.key === "Escape") {
        e.preventDefault();
        terminalStore.triggerEmergencyPanicFlatten();
        return;
      }

      if (e.key === "Escape") {
        const st = terminalStore.getState();
        if (st.quickTicketOpen) {
          e.preventDefault();
          terminalStore.updateImmediate({ quickTicketOpen: false });
          return;
        }
      }

      if (isInputFocused) return;

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        const st = terminalStore.getState();
        terminalStore.updateImmediate({ quickTicketOpen: !st.quickTicketOpen });
        return;
      }

      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        const st = terminalStore.getState();
        const maxIdx = Math.max(0, st.orders.length - 1);
        const nextIdx = Math.min(maxIdx, st.selectedBlotterIndex + 1);
        const selOrder = st.orders[nextIdx];
        terminalStore.updateImmediate({
          selectedBlotterIndex: nextIdx,
          activeBookSymbol: selOrder ? selOrder.symbol : st.activeBookSymbol,
        });
        return;
      }

      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        const st = terminalStore.getState();
        const nextIdx = Math.max(0, st.selectedBlotterIndex - 1);
        const selOrder = st.orders[nextIdx];
        terminalStore.updateImmediate({
          selectedBlotterIndex: nextIdx,
          activeBookSymbol: selOrder ? selOrder.symbol : st.activeBookSymbol,
        });
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        setLayoutMode("SINGLE");
        handleSelectMarket("jse");
      } else if (e.key === "2") {
        e.preventDefault();
        setLayoutMode("SINGLE");
        handleSelectMarket("us");
      } else if (e.key === "3") {
        e.preventDefault();
        setLayoutMode("SINGLE");
        handleSelectMarket("crypto");
      } else if (e.key === "4") {
        e.preventDefault();
        activateDockedGrid();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSelectMarket, activateDockedGrid]);

  // Sync URL hash changes if user navigates browser back/forward
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "").trim().toLowerCase();
      if (hash === "jse" || hash === "us" || hash === "crypto") {
        setActiveMarket(hash);
        setVisitedMarkets((prev) => (prev[hash] ? prev : { ...prev, [hash]: true }));
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Poll lightweight /api/health across all 3 trading engines
  useEffect(() => {
    let mounted = true;
    const pollEnginesHealth = async () => {
      const checks = await Promise.allSettled([
        fetch("/engine/jse/api/health", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch("/engine/us/api/health", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch("/engine/crypto/api/health", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
        ),
      ]);
      if (!mounted) return;
      const jsePayload = checks[0].status === "fulfilled" ? checks[0].value : null;
      const usPayload = checks[1].status === "fulfilled" ? checks[1].value : null;
      const cryptoPayload =
        checks[2].status === "fulfilled" ? checks[2].value : null;

      setHealthMap({
        jse: {
          online: Boolean(jsePayload && (jsePayload.ok || jsePayload.status === "ok")),
          port: 8000,
          sessionPhase: jsePayload?.session_phase,
        },
        us: {
          online: Boolean(usPayload && (usPayload.ok || usPayload.status === "ok")),
          port: 8001,
          universeCount: usPayload?.universe_count,
        },
        crypto: {
          online: Boolean(
            cryptoPayload && (cryptoPayload.ok || cryptoPayload.status === "ok")
          ),
          port: 8002,
          universeCount: cryptoPayload?.universe_count,
        },
      });
    };

    pollEnginesHealth();
    const timer = setInterval(pollEnginesHealth, 12000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const handleJseWs = useCallback((connected: boolean, lastTick?: string) => {
    setWsStatusByMarket((prev) => ({
      ...prev,
      jse: {
        connected,
        lastTick: lastTick ?? prev.jse.lastTick,
      },
    }));
  }, []);

  const handleUsWs = useCallback((connected: boolean, lastTick?: string) => {
    setWsStatusByMarket((prev) => ({
      ...prev,
      us: {
        connected,
        lastTick: lastTick ?? prev.us.lastTick,
      },
    }));
  }, []);

  const handleCryptoWs = useCallback((connected: boolean, lastTick?: string) => {
    setWsStatusByMarket((prev) => ({
      ...prev,
      crypto: {
        connected,
        lastTick: lastTick ?? prev.crypto.lastTick,
      },
    }));
  }, []);

  const activeWs = wsStatusByMarket[activeMarket];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#04070D] text-[#F8FAFC]">
      <GlobalMarketNav
        activeMarket={activeMarket}
        onSelectMarket={(m) => {
          setLayoutMode("SINGLE");
          handleSelectMarket(m);
        }}
        healthMap={healthMap}
        activeWsConnected={busWsConnected || activeWs.connected}
        lastWsTick={busLastTick || activeWs.lastTick}
        hudDrawerOpen={hudDrawerOpen}
        onToggleHudDrawer={() => setHudDrawerOpen((p) => !p)}
      />

      {hudDrawerOpen && (
        <InstitutionalTelemetryStrip
          layoutMode={layoutMode}
          onToggleLayoutMode={activateDockedGrid}
        />
      )}

      <QuickOrderTicketModal />

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden relative"
      >
        {layoutMode === "DOCKED_GRID" ? (
          <div
            data-testid="docked-multi-monitor-grid"
            className="grid grid-cols-1 xl:grid-cols-2 gap-2 p-2 bg-[#04070D]"
          >
            <div className="border border-white/10 rounded-md overflow-y-auto max-h-[46vh]">
              <JseMarketApp
                isActive={true}
                onSwitchMarket={handleSelectMarket}
                onWsStatusChange={handleJseWs}
              />
            </div>
            <div className="border border-white/10 rounded-md overflow-y-auto max-h-[46vh]">
              <UsMarketApp
                isActive={true}
                onSwitchMarket={handleSelectMarket}
                onWsStatusChange={handleUsWs}
              />
            </div>
            <div className="border border-white/10 rounded-md overflow-y-auto max-h-[46vh]">
              <CryptoMarketApp
                isActive={true}
                onSwitchMarket={handleSelectMarket}
                onWsStatusChange={handleCryptoWs}
              />
            </div>
            <div className="grid grid-rows-2 gap-2 max-h-[46vh]">
              <WebGlOrderBookCanvas />
              <VirtualizedGlobalBlotter />
            </div>
          </div>
        ) : (
          <>
            {/* Auto-Collapsing Empty-State Dock: Full-Width Canvas when Blotter is Empty */}
            <div className="px-3 pt-2 bg-[#04070D]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono font-bold text-slate-300">
                  OMNI-MARKET L2/L3 DEPTH ENGINE &amp; VIRTUALIZED OMS BLOTTER
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBlotterExpanded((p) => !p)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-300 hover:text-white"
                  >
                    {blotterExpanded ? "COLLAPSE BLOTTER [−]" : `EXPAND BLOTTER (${orders.length}) [⤢]`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDockDrawer((p) => !p)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-400 hover:text-white"
                  >
                    {showDockDrawer ? "HIDE DOCK [-]" : "SHOW DOCK [+]"}
                  </button>
                </div>
              </div>
              {showDockDrawer && (
                <div
                  className={`grid gap-2 mb-2 ${
                    blotterExpanded ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  <WebGlOrderBookCanvas />
                  {blotterExpanded ? (
                    <VirtualizedGlobalBlotter />
                  ) : (
                    <div className="flex items-center justify-between px-3 py-1 rounded bg-[#080E1A] border border-white/5 font-mono text-[10px] text-slate-500">
                      <span>OMS BLOTTER: 0 ACTIVE ORDERS (Tape Idle)</span>
                      <button
                        type="button"
                        onClick={() => setBlotterExpanded(true)}
                        className="text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        Click to Expand OMS Blotter
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {visitedMarkets.jse && (
              <div
                data-testid="market-panel-jse"
                className={activeMarket === "jse" ? "block" : "hidden"}
              >
                <JseMarketApp
                  isActive={activeMarket === "jse"}
                  onSwitchMarket={handleSelectMarket}
                  onWsStatusChange={handleJseWs}
                />
              </div>
            )}

            {visitedMarkets.us && (
              <div
                data-testid="market-panel-us"
                className={activeMarket === "us" ? "block" : "hidden"}
              >
                <UsMarketApp
                  isActive={activeMarket === "us"}
                  onSwitchMarket={handleSelectMarket}
                  onWsStatusChange={handleUsWs}
                />
              </div>
            )}

            {visitedMarkets.crypto && (
              <div
                data-testid="market-panel-crypto"
                className={activeMarket === "crypto" ? "block" : "hidden"}
              >
                <CryptoMarketApp
                  isActive={activeMarket === "crypto"}
                  onSwitchMarket={handleSelectMarket}
                  onWsStatusChange={handleCryptoWs}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
