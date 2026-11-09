import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  EngineHealthState,
  GlobalMarketNav,
  MarketId,
} from "./components/GlobalMarketNav";
import {
  InstitutionalTelemetryStrip,
  QuickOrderTicketModal,
} from "./components/InstitutionalBlotterAndCanvas";
import { terminalStore, useTerminalStore } from "./store/terminalStore";
import CommandOverviewPortal from "./components/CommandOverviewPortal";
import JseMarketApp from "./markets/jse/App";
import UsMarketApp from "./markets/us/App";
import CryptoMarketApp from "./markets/crypto/App";
import TradingBotDashboard from "./components/TradingBotDashboard";

const LS_ACTIVE_MARKET_KEY = "sovereign_unified_active_market_v13";

function resolveInitialMarket(): MarketId {
  if (typeof window !== "undefined") {
    const hash = window.location.hash.replace("#", "").trim().toLowerCase();
    if (hash === "home" || hash === "jse" || hash === "us" || hash === "crypto" || hash === "bot") {
      return hash as MarketId;
    }
    try {
      const saved = window.localStorage.getItem(LS_ACTIVE_MARKET_KEY);
      if (saved === "home" || saved === "jse" || saved === "us" || saved === "crypto" || saved === "bot") {
        return saved as MarketId;
      }
    } catch {
      // ignore storage errors
    }
  }
  return "home";
}

export const App: React.FC = () => {
  const [activeMarket, setActiveMarket] = useState<MarketId>(resolveInitialMarket);
  const [layoutMode, setLayoutMode] = useState<"SINGLE" | "DOCKED_GRID">("SINGLE");
  const [hudDrawerOpen, setHudDrawerOpen] = useState<boolean>(false);

  const [visitedMarkets, setVisitedMarkets] = useState<Record<MarketId, boolean>>(
    () => ({
      home: true,
      jse: resolveInitialMarket() === "jse",
      us: resolveInitialMarket() === "us",
      crypto: resolveInitialMarket() === "crypto",
      bot: resolveInitialMarket() === "bot",
    })
  );

  const [wsStatusByMarket, setWsStatusByMarket] = useState<
    Record<MarketId, { connected: boolean; lastTick: string | null }>
  >({
    home: { connected: true, lastTick: null },
    jse: { connected: false, lastTick: null },
    us: { connected: false, lastTick: null },
    crypto: { connected: false, lastTick: null },
    bot: { connected: false, lastTick: null },
  });

  const [healthMap, setHealthMap] = useState<Record<MarketId, EngineHealthState>>({
    home: { online: true, port: 5173 },
    jse: { online: false, port: 8000 },
    us: { online: false, port: 8001 },
    crypto: { online: false, port: 8002 },
    bot: { online: false, port: 8002 },
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
    setVisitedMarkets({ home: true, jse: true, us: true, crypto: true, bot: true });
    setLayoutMode((prev) => (prev === "DOCKED_GRID" ? "SINGLE" : "DOCKED_GRID"));
  }, []);

  // Hotkeys:
  // Space: Quick Order Ticket, Shift+Esc: Emergency Panic Flatten
  // 0: Overview / Home, 1: JSE, 2: US, 3: Crypto, 4: Bot, 5/G: Docked 4x Grid
  // J/K: Blotter row navigation
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

      if (e.key === "0" || e.key === "h" || e.key === "H") {
        e.preventDefault();
        setLayoutMode("SINGLE");
        handleSelectMarket("home");
      } else if (e.key === "1") {
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
        setLayoutMode("SINGLE");
        handleSelectMarket("bot");
      } else if (e.key === "5" || e.key === "g" || e.key === "G") {
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
      if (hash === "home" || hash === "jse" || hash === "us" || hash === "crypto" || hash === "bot") {
        setActiveMarket(hash as MarketId);
        setVisitedMarkets((prev) => (prev[hash as MarketId] ? prev : { ...prev, [hash]: true }));
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
        home: { online: true, port: 5173 },
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
        bot: {
          online: Boolean(
            cryptoPayload && (cryptoPayload.ok || cryptoPayload.status === "ok")
          ),
          port: 8002,
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

  const activeWs = wsStatusByMarket[activeMarket] || { connected: true, lastTick: null };

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
        layoutMode={layoutMode}
        onToggleLayoutMode={activateDockedGrid}
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
            className="grid grid-cols-1 xl:grid-cols-2 gap-3 p-3 bg-[#04070D]"
          >
            <div className="border border-white/10 rounded-2xl overflow-y-auto max-h-[46vh] glass-panel">
              <JseMarketApp
                isActive={true}
                onSwitchMarket={handleSelectMarket}
                onWsStatusChange={handleJseWs}
                onOpenBot={() => handleSelectMarket("bot")}
              />
            </div>
            <div className="border border-white/10 rounded-2xl overflow-y-auto max-h-[46vh] glass-panel">
              <UsMarketApp
                isActive={true}
                onSwitchMarket={handleSelectMarket}
                onWsStatusChange={handleUsWs}
                onOpenBot={() => handleSelectMarket("bot")}
              />
            </div>
            <div className="border border-white/10 rounded-2xl overflow-y-auto max-h-[46vh] glass-panel">
              <CryptoMarketApp
                isActive={true}
                onSwitchMarket={handleSelectMarket}
                onWsStatusChange={handleCryptoWs}
                onOpenBot={() => handleSelectMarket("bot")}
              />
            </div>
            <div className="border border-white/10 rounded-2xl overflow-y-auto max-h-[46vh] glass-panel">
              <TradingBotDashboard
                isActive={true}
                onSwitchMarket={handleSelectMarket}
              />
            </div>
          </div>
        ) : (
          <>
            {visitedMarkets.home && (
              <div
                data-testid="market-panel-home"
                className={activeMarket === "home" ? "block" : "hidden"}
              >
                <CommandOverviewPortal
                  onSelectMarket={handleSelectMarket}
                  onOpenOrderTicket={(sym) => {
                    const st = terminalStore.getState();
                    terminalStore.updateImmediate({
                      quickTicketOpen: true,
                      activeBookSymbol: sym || st.activeBookSymbol,
                    });
                  }}
                />
              </div>
            )}

            {visitedMarkets.jse && (
              <div
                data-testid="market-panel-jse"
                className={activeMarket === "jse" ? "block" : "hidden"}
              >
                <JseMarketApp
                  isActive={activeMarket === "jse"}
                  onSwitchMarket={handleSelectMarket}
                  onWsStatusChange={handleJseWs}
                  onOpenBot={() => handleSelectMarket("bot")}
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
                  onOpenBot={() => handleSelectMarket("bot")}
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
                  onOpenBot={() => handleSelectMarket("bot")}
                />
              </div>
            )}

            {visitedMarkets.bot && (
              <div
                data-testid="market-panel-bot"
                className={activeMarket === "bot" ? "block" : "hidden"}
              >
                <TradingBotDashboard
                  isActive={activeMarket === "bot"}
                  onSwitchMarket={handleSelectMarket}
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
