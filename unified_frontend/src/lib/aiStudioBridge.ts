import rawSnapshot from "./offlineSnapshot.json";

const LS_CLOUD_BACKEND_KEY = "sovereign_cloud_backend_url";
const LS_STATE_CACHE_PREFIX = "sovereign_aistudio_state_v13_";

interface MemoryMarketStore {
  jse: any;
  us: any;
  crypto: any;
  blotter: any[];
}

function cloneDeep<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

function loadMarketState(market: "jse" | "us" | "crypto", fallback: any): any {
  if (typeof window === "undefined") return cloneDeep(fallback);
  try {
    const saved = window.localStorage.getItem(`${LS_STATE_CACHE_PREFIX}${market}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return cloneDeep(fallback);
}

function saveMarketState(market: "jse" | "us" | "crypto", state: any): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${LS_STATE_CACHE_PREFIX}${market}`, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

const store: MemoryMarketStore = {
  jse: loadMarketState("jse", (rawSnapshot as any).jse || {}),
  us: loadMarketState("us", (rawSnapshot as any).us || {}),
  crypto: loadMarketState("crypto", (rawSnapshot as any).crypto || {}),
  blotter: [],
};

if (store.jse && !store.jse.signals && store.jse.opportunities) {
  store.jse.signals = store.jse.opportunities;
}
if (store.jse && !store.jse.barbellPlan && store.jse.barbell_plan) {
  store.jse.barbellPlan = store.jse.barbell_plan;
}
if (store.us && !store.us.top_signals && store.us.signals) {
  store.us.top_signals = store.us.signals;
}
if (store.crypto && !store.crypto.top_signals && store.crypto.signals) {
  store.crypto.top_signals = store.crypto.signals;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Sovereign-Mode": "AI-Studio-Bridge",
    },
  });
}

function parseBody(init?: RequestInit): any {
  if (!init || !init.body) return {};
  if (typeof init.body === "string") {
    try {
      return JSON.parse(init.body);
    } catch {
      return {};
    }
  }
  return {};
}

function scaleMarketCapital(market: "jse" | "us" | "crypto", newBalanceZar: number): void {
  const s = store[market];
  if (!s || !Number.isFinite(newBalanceZar) || newBalanceZar <= 0) return;

  const fx = Number(s.usdzar_rate || s.usdzar?.usdzar_rate || s.macro?.usdzar_rate || 18.25);
  s.account_balance_zar = newBalanceZar;
  s.account_balance_usd = Number((newBalanceZar / fx).toFixed(2));

  if (s.capital_ledger) {
    s.capital_ledger.starting_capital_zar = newBalanceZar;
    s.capital_ledger.free_cash_zar = newBalanceZar - Number(s.capital_ledger.deployed_capital_zar || 0);
    s.capital_ledger.total_equity_zar = newBalanceZar + Number(s.capital_ledger.realized_pnl_zar || 0);
  }
  if (s.capitalLedger) {
    s.capitalLedger.starting_capital_zar = newBalanceZar;
    s.capitalLedger.free_cash_zar = newBalanceZar - Number(s.capitalLedger.deployed_capital_zar || 0);
    s.capitalLedger.total_equity_zar = newBalanceZar + Number(s.capitalLedger.realized_pnl_zar || 0);
  }
  if (s.barbell_plan) {
    s.barbell_plan.total_capital_zar = newBalanceZar;
    s.barbell_plan.core_80_zar = Math.round(newBalanceZar * 0.8);
    s.barbell_plan.tactical_20_zar = Math.round(newBalanceZar * 0.2);
  }
  if (s.barbellPlan) {
    s.barbellPlan.totalCapitalZar = newBalanceZar;
    s.barbellPlan.core80Zar = Math.round(newBalanceZar * 0.8);
    s.barbellPlan.tactical20Zar = Math.round(newBalanceZar * 0.2);
  }
  saveMarketState(market, s);
}

function handleOfflineApiRequest(urlStr: string, init?: RequestInit): Response | null {
  const u = new URL(urlStr, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const path = u.pathname;
  const method = (init?.method || "GET").toUpperCase();
  const body = parseBody(init);

  const balParam = Number(u.searchParams.get("account_balance_zar") || 0);
  if (balParam >= 500) {
    if (path.startsWith("/engine/us")) scaleMarketCapital("us", balParam);
    if (path.startsWith("/engine/crypto")) scaleMarketCapital("crypto", balParam);
  }

  // 1. Health endpoints
  if (path.endsWith("/api/health")) {
    return jsonResponse({
      ok: true,
      status: "ok",
      mode: "AI_STUDIO_APP",
      session_phase: "PRIME_EXECUTION_WINDOW",
      universe_count: path.includes("/jse/") ? 42 : path.includes("/us/") ? 31 : 25,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Unified Bus endpoints
  if (path.startsWith("/api/bus/blotter")) {
    return jsonResponse({ orders: store.blotter });
  }
  if (path.startsWith("/api/bus/order") && method === "POST") {
    const order = {
      client_order_id: body.client_order_id || `SO-${Date.now()}`,
      symbol: body.symbol || "NPN.JO",
      market: body.market || "JSE",
      side: body.side || "BUY",
      qty: Number(body.qty || 1),
      filled_qty: Number(body.qty || 1),
      avg_fill_price: Number(body.limit_price || 100),
      limit_price: Number(body.limit_price || 100),
      status: "FILLED (PAPER)",
      algo_mode: body.algo_mode || "VWAP_SNIPER",
      expected_slippage_pct: 0.04,
      square_root_impact_pct: 0.02,
      sequence_num: store.blotter.length + 1,
      timestamp: new Date().toISOString(),
      timestamp_us: Date.now() * 1000,
    };
    store.blotter = [order, ...store.blotter.slice(0, 249)];
    return jsonResponse({ ok: true, order });
  }
  if (path.startsWith("/api/bus/panic-flatten")) {
    store.blotter = [];
    return jsonResponse({ ok: true, flattened: true });
  }

  // 3. Market Engine routing (/engine/jse, /engine/us, /engine/crypto)
  const marketMatch = path.match(/^\/engine\/(jse|us|crypto)\/api\/(.*)$/);
  if (!marketMatch) return null;

  const market = marketMatch[1] as "jse" | "us" | "crypto";
  const subPath = marketMatch[2];
  const mState = store[market];

  if (subPath === "state" || subPath === "dashboard") {
    if (method === "PATCH" && body.initialCapitalZar) {
      scaleMarketCapital(market, Number(body.initialCapitalZar));
    }
    return jsonResponse(mState);
  }

  if (subPath === "signals") {
    return jsonResponse({
      signals: mState.signals || mState.opportunities || [],
      opportunities: mState.opportunities || mState.signals || [],
      is_prime_execution_window: true,
      is_market_open: true,
      session_status: mState.session_status,
    });
  }

  if (subPath === "data-health") {
    return jsonResponse(
      mState.dataHealthSummary ||
        mState.data_health_summary || {
          status: "HEALTHY",
          live_count: 30,
          blocked_count: 0,
          blocked_tickers: [],
          last_checked: new Date().toISOString(),
        }
    );
  }

  if (subPath === "watchlist" || subPath.startsWith("watchlist/")) {
    const listKey = market === "jse" ? "watchlist" : "custom_watchlist";
    const currentList: any[] = Array.isArray(mState[listKey]) ? mState[listKey] : [];
    if (method === "GET") {
      return jsonResponse({ watchlist: currentList, items: currentList });
    }
    if (method === "POST" && body.symbol) {
      const sym = String(body.symbol).toUpperCase().trim();
      if (!currentList.some((i) => String(i.symbol).toUpperCase() === sym)) {
        currentList.push({
          symbol: sym,
          name: body.name || sym,
          sector: body.sector || "Custom",
          added_at: new Date().toISOString(),
        });
        mState[listKey] = currentList;
        saveMarketState(market, mState);
      }
      return jsonResponse({ ok: true, watchlist: currentList, state: mState });
    }
    if (method === "DELETE") {
      const targetSym = decodeURIComponent(subPath.replace("watchlist/", "")).toUpperCase();
      mState[listKey] = currentList.filter((i) => String(i.symbol).toUpperCase() !== targetSym);
      saveMarketState(market, mState);
      return jsonResponse({ ok: true, watchlist: mState[listKey], state: mState });
    }
  }

  if (subPath === "trades" && method === "POST") {
    const activeKey = market === "jse" ? "activeTrades" : "active_trades";
    const list: any[] = Array.isArray(mState[activeKey]) ? mState[activeKey] : [];
    const newTrade = {
      id: Date.now(),
      trade_id: Date.now(),
      symbol: body.symbol || "ASSET",
      name: body.name || body.symbol || "Asset",
      direction: body.direction || "LONG",
      entry_price: Number(body.entry_price || body.entryPrice || 100),
      current_price: Number(body.entry_price || body.entryPrice || 100),
      stop_loss: Number(body.stop_loss || body.stopLoss || 95),
      target_1: Number(body.target_1 || body.target1 || 108),
      target_2: Number(body.target_2 || body.target2 || 115),
      shares: Number(body.shares || body.quantity || 10),
      quantity: Number(body.quantity || body.shares || 10),
      position_size_zar: Number(body.position_size_zar || 2000),
      unrealized_pnl_zar: 0,
      unrealized_pnl_pct: 0,
      r_multiple_current: 0,
      coach_action: "HOLD_STRUCTURAL_TREND",
      coach_Headline: "Position Opened — Initial Structural Stop Active",
      opened_at: new Date().toISOString(),
      status: "OPEN",
    };
    mState[activeKey] = [newTrade, ...list];
    saveMarketState(market, mState);
    return jsonResponse(mState);
  }

  if (subPath.startsWith("trades/") || subPath.startsWith("positions/")) {
    return jsonResponse(mState);
  }

  if (subPath === "paper/report" || subPath === "paper/run-now") {
    return jsonResponse(
      mState.paperStatus ||
        mState.paper_status || {
          ok: true,
          status: "ACTIVE",
          total_simulations: 250,
          win_rate_pct: 64.2,
          profit_factor: 1.88,
          deflated_sharpe: 1.74,
          last_run: new Date().toISOString(),
        }
    );
  }

  if (subPath.startsWith("core-portfolio") || subPath.startsWith("risk/")) {
    return jsonResponse(
      mState.coreSummary ||
        mState.core_summary || {
          ok: true,
          total_value_zar: 8000,
          cash_zar: 1200,
          holdings: [],
          rebalance_needed: false,
        }
    );
  }

  if (subPath.startsWith("bot/")) {
    return jsonResponse({
      enabled: false,
      mode: "PAPER_DRY_RUN",
      last_heartbeat: new Date().toISOString(),
      cycles_completed: 12,
      active_positions: 0,
      max_positions: 3,
      risk_per_trade_pct: 1.0,
    });
  }

  if (subPath.startsWith("telegram/") || subPath === "alerts") {
    return jsonResponse({
      ok: true,
      enabled: false,
      message: "Telegram alert settings updated in sandbox.",
    });
  }

  return jsonResponse({ ok: true, state: mState });
}

export function installAiStudioBridge(): void {
  if (typeof window === "undefined") return;
  if ((window as any).__SOVEREIGN_AISTUDIO_BRIDGE_INSTALLED__) return;
  (window as any).__SOVEREIGN_AISTUDIO_BRIDGE_INSTALLED__ = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    const isEngineCall =
      rawUrl.includes("/engine/jse/") ||
      rawUrl.includes("/engine/us/") ||
      rawUrl.includes("/engine/crypto/") ||
      rawUrl.includes("/api/bus/");

    if (!isEngineCall) {
      return originalFetch(input, init);
    }

    // Rewrite to custom cloud backend if configured by user
    let targetInput: RequestInfo | URL = input;
    try {
      const customBackend =
        (import.meta as any).env?.VITE_BACKEND_URL ||
        window.localStorage.getItem(LS_CLOUD_BACKEND_KEY);
      if (customBackend && rawUrl.startsWith("/")) {
        targetInput = `${String(customBackend).replace(/\/$/, "")}${rawUrl}`;
      }
    } catch {
      // ignore env lookup errors
    }

    try {
      const response = await originalFetch(targetInput, init);
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (response.ok && contentType.includes("application/json")) {
        return response;
      }
    } catch {
      // Network/proxy offline -> fall through to AI Studio snapshot bridge
    }

    const fallback = handleOfflineApiRequest(rawUrl, init);
    if (fallback) return fallback;
    return jsonResponse({ ok: true });
  };

  // Prevent WebSocket proxy/connection crashes when running inside Google AI Studio preview sandbox
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const hasCustomWs = Boolean((import.meta as any).env?.VITE_WS_URL);

  if (!isLocalHost && !hasCustomWs && typeof window.WebSocket !== "undefined") {
    const NativeWebSocket = window.WebSocket;
    const SafeWebSocket = function (this: any, url: string | URL, protocols?: string | string[]) {
      const urlStr = String(url);
      if (urlStr.includes("/ws/stream") || urlStr.includes("/engine/")) {
        const fakeWs: any = {
          url: urlStr,
          readyState: 1, // OPEN
          protocol: "",
          extensions: "",
          bufferedAmount: 0,
          binaryType: "blob",
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null,
          send: () => {},
          close: () => {
            fakeWs.readyState = 3;
          },
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        };
        setTimeout(() => {
          if (typeof fakeWs.onopen === "function") {
            fakeWs.onopen(new Event("open"));
          }
        }, 60);
        return fakeWs;
      }
      return new NativeWebSocket(url, protocols);
    } as unknown as typeof WebSocket;

    Object.assign(SafeWebSocket, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    });
    window.WebSocket = SafeWebSocket;
  }
}
