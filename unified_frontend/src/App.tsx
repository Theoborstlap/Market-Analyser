import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  EngineHealthState,
  GlobalMarketNav,
  MarketId,
} from "./components/GlobalMarketNav";
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
  const [visitedMarkets, setVisitedMarkets] = useState<Record<MarketId, boolean>>(
    () => ({
      jse: resolveInitialMarket() === "jse",
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

  // Keyboard shortcuts: Alt+1 (JSE), Alt+2 (US), Alt+3 (Crypto)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === "1") {
        e.preventDefault();
        handleSelectMarket("jse");
      } else if (e.key === "2") {
        e.preventDefault();
        handleSelectMarket("us");
      } else if (e.key === "3") {
        e.preventDefault();
        handleSelectMarket("crypto");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSelectMarket]);

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
    <div className="h-screen flex flex-col overflow-hidden bg-[#060911] text-slate-100">
      <GlobalMarketNav
        activeMarket={activeMarket}
        onSelectMarket={handleSelectMarket}
        healthMap={healthMap}
        activeWsConnected={activeWs.connected}
        lastWsTick={activeWs.lastTick}
      />

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden relative"
      >
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
      </div>
    </div>
  );
};

export default App;
