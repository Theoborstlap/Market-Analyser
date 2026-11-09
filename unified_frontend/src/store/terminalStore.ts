import { useSyncExternalStore } from "react";

export interface BookLevel {
  price: number;
  qty: number;
  orders: number;
}

export interface NormalizedOrderBook {
  symbol: string;
  market: string;
  sequence_num: number;
  timestamp_us: number;
  parity_checksum: string;
  gap_detected_count: number;
  mid_price: number;
  micro_price: number;
  best_bid: number;
  best_ask: number;
  spread_bps: number;
  imbalance: number;
  bids: BookLevel[];
  asks: BookLevel[];
}

export interface BlotterOrder {
  client_order_id: string;
  symbol: string;
  market: string;
  side: "BUY" | "SELL";
  qty: number;
  filled_qty: number;
  avg_fill_price: number;
  limit_price: number;
  status: string;
  algo_mode: string;
  expected_slippage_pct: number;
  square_root_impact_pct: number;
  sequence_num: number;
  timestamp: string;
  timestamp_us: number;
  optimistic_pending?: boolean;
  fix_raw?: string;
}

export interface TapePrint {
  id: string;
  symbol: string;
  market: string;
  price: number;
  qty: number;
  side: "BUY" | "SELL";
  imbalance: number;
  sequence_num: number;
  timestamp_us: number;
}

export interface CrossAssetRiskState {
  triggered: boolean;
  deleveraging_factor: number;
  last_cvar_95_pct: number;
  last_cvar_99_pct: number;
  net_portfolio_beta: number;
  shrinkage_alpha: number;
  reason: string;
}

export interface CrossMarketIpcSnapshot {
  seq: number;
  ts_us: number;
  jse_npn: number;
  us_nvda: number;
  crypto_btc: number;
  cross_arb_spread_bps: number;
  cvar_95_pct: number;
  net_beta: number;
  kill_switch: boolean;
}

export interface TerminalStoreState {
  wsConnected: boolean;
  reconnectAttempt: number;
  lastSequenceNum: number;
  lastTickIso: string | null;
  activeBookSymbol: string;
  selectedBlotterIndex: number;
  quickTicketOpen: boolean;
  audioMuted: boolean;
  wcagHighContrast: boolean;
  portfolioCapitalZar: number;
  freeCashZar: number;
  deployedMarginZar: number;
  realizedPnlZar: number;
  booksBySymbol: Record<string, NormalizedOrderBook>;
  priceHistoryBySymbol: Record<string, number[]>;
  orders: BlotterOrder[];
  tape: TapePrint[];
  risk: CrossAssetRiskState;
  ipc: CrossMarketIpcSnapshot;
}

// ============================================================================
// 1. Web Audio API Hardware Synthesizer Telemetry
// ============================================================================
export type TelemetrySoundType = "FILL" | "PARTIAL_FILL" | "REJECTION" | "CVAR_WARNING";

class InstitutionalAudioSynth {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public trigger(type: TelemetrySoundType, muted: boolean = false): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "FILL") {
      // Harmonic dual-step institutional fill chime (A5 -> E6)
      osc.type = "sine";
      osc.frequency.setValueAtTime(880.0, now);
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (type === "PARTIAL_FILL") {
      // Soft bell pulse (E5 -> A5)
      osc.type = "triangle";
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(880.0, now + 0.06);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "REJECTION") {
      // Low sawtooth rejection buzz (220Hz -> 146.8Hz)
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220.0, now);
      osc.frequency.linearRampToValueAtTime(146.83, now + 0.22);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === "CVAR_WARNING") {
      // Urgent dual-pulse margin/CVaR alert (440Hz <-> 587.33Hz)
      osc.type = "square";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(440.0, now + 0.09);
      osc.frequency.setValueAtTime(587.33, now + 0.18);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.start(now);
      osc.stop(now + 0.33);
    }
  }
}

export const audioSynth = new InstitutionalAudioSynth();

// ============================================================================
// 2. IndexedDB Offline In-Flight Order Queue & Snapshot Persistence
// ============================================================================
const IDB_NAME = "sovereign_terminal_idb_v13";
const IDB_VERSION = 1;
const STORE_INFLIGHT = "inflight_orders";
const STORE_SNAPSHOT = "state_snapshots";

function openTerminalIdb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_INFLIGHT)) {
          db.createObjectStore(STORE_INFLIGHT, { keyPath: "client_order_id" });
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOT)) {
          db.createObjectStore(STORE_SNAPSHOT, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPutInFlightOrder(order: BlotterOrder): Promise<void> {
  const db = await openTerminalIdb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_INFLIGHT, "readwrite");
    tx.objectStore(STORE_INFLIGHT).put(order);
  } catch {
    // ignore storage quota errors
  }
}

async function idbRemoveInFlightOrder(clientOrderId: string): Promise<void> {
  const db = await openTerminalIdb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_INFLIGHT, "readwrite");
    tx.objectStore(STORE_INFLIGHT).delete(clientOrderId);
  } catch {
    // ignore
  }
}

async function idbGetAllInFlightOrders(): Promise<BlotterOrder[]> {
  const db = await openTerminalIdb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_INFLIGHT, "readonly");
      const req = tx.objectStore(STORE_INFLIGHT).getAll();
      req.onsuccess = () => resolve((req.result as BlotterOrder[]) || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbSaveStateSnapshot(lastSeq: number, orders: BlotterOrder[]): Promise<void> {
  const db = await openTerminalIdb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_SNAPSHOT, "readwrite");
    tx.objectStore(STORE_SNAPSHOT).put({
      id: "LATEST_TERMINAL_SNAPSHOT",
      lastSeq,
      orders: orders.slice(0, 120),
      savedAt: Date.now(),
    });
  } catch {
    // ignore
  }
}

// ============================================================================
// 3. UUIDv4 Deterministic Client Order ID Generator
// ============================================================================
export function generateClientOrderUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// 4. Off-Main-Thread Web Worker + 60Hz/120Hz RAF Conflated Normalized Store
// ============================================================================
const INITIAL_BOOKS: Record<string, NormalizedOrderBook> = {
  "NPN.JO": {
    symbol: "NPN.JO",
    market: "JSE",
    sequence_num: 100001,
    timestamp_us: Date.now() * 1000,
    parity_checksum: "0x9e3779b9",
    gap_detected_count: 0,
    mid_price: 3845.0,
    micro_price: 3845.15,
    best_bid: 3843.5,
    best_ask: 3846.5,
    spread_bps: 7.8,
    imbalance: 0.14,
    bids: Array.from({ length: 10 }, (_, i) => ({ price: +(3843.5 - i * 2.5).toFixed(2), qty: +(120 - i * 8).toFixed(2), orders: 4 })),
    asks: Array.from({ length: 10 }, (_, i) => ({ price: +(3846.5 + i * 2.5).toFixed(2), qty: +(95 - i * 6).toFixed(2), orders: 3 })),
  },
  NVDA: {
    symbol: "NVDA",
    market: "US",
    sequence_num: 100002,
    timestamp_us: Date.now() * 1000,
    parity_checksum: "0x7f4a7c15",
    gap_detected_count: 0,
    mid_price: 138.6,
    micro_price: 138.64,
    best_bid: 138.55,
    best_ask: 138.65,
    spread_bps: 7.2,
    imbalance: 0.22,
    bids: Array.from({ length: 10 }, (_, i) => ({ price: +(138.55 - i * 0.08).toFixed(2), qty: +(180 - i * 11).toFixed(2), orders: 6 })),
    asks: Array.from({ length: 10 }, (_, i) => ({ price: +(138.65 + i * 0.08).toFixed(2), qty: +(140 - i * 9).toFixed(2), orders: 5 })),
  },
  BTC: {
    symbol: "BTC",
    market: "CRYPTO",
    sequence_num: 100003,
    timestamp_us: Date.now() * 1000,
    parity_checksum: "0x85ebca6b",
    gap_detected_count: 0,
    mid_price: 91450.0,
    micro_price: 91458.2,
    best_bid: 91435.0,
    best_ask: 91465.0,
    spread_bps: 3.28,
    imbalance: 0.19,
    bids: Array.from({ length: 10 }, (_, i) => ({ price: +(91435 - i * 18).toFixed(2), qty: +(14.5 - i * 0.9).toFixed(2), orders: 8 })),
    asks: Array.from({ length: 10 }, (_, i) => ({ price: +(91465 + i * 18).toFixed(2), qty: +(11.2 - i * 0.7).toFixed(2), orders: 7 })),
  },
  "GFI.JO": {
    symbol: "GFI.JO",
    market: "JSE",
    sequence_num: 100004,
    timestamp_us: Date.now() * 1000,
    parity_checksum: "0x6f31a19b",
    gap_detected_count: 0,
    mid_price: 630.19,
    micro_price: 630.25,
    best_bid: 629.8,
    best_ask: 630.58,
    spread_bps: 12.4,
    imbalance: 0.18,
    bids: Array.from({ length: 10 }, (_, i) => ({ price: +(629.8 - i * 0.9).toFixed(2), qty: +(94 - i * 6).toFixed(2), orders: 3 })),
    asks: Array.from({ length: 10 }, (_, i) => ({ price: +(630.58 + i * 0.9).toFixed(2), qty: +(76 - i * 5).toFixed(2), orders: 4 })),
  },
  SOL: {
    symbol: "SOL",
    market: "CRYPTO",
    sequence_num: 100005,
    timestamp_us: Date.now() * 1000,
    parity_checksum: "0x4b87e221",
    gap_detected_count: 0,
    mid_price: 89.66,
    micro_price: 89.69,
    best_bid: 89.62,
    best_ask: 89.7,
    spread_bps: 8.9,
    imbalance: 0.25,
    bids: Array.from({ length: 10 }, (_, i) => ({ price: +(89.62 - i * 0.12).toFixed(2), qty: +(240 - i * 14).toFixed(2), orders: 9 })),
    asks: Array.from({ length: 10 }, (_, i) => ({ price: +(89.7 + i * 0.12).toFixed(2), qty: +(185 - i * 11).toFixed(2), orders: 7 })),
  },
};

class NormalizedTerminalStore {
  private state: TerminalStoreState = {
    wsConnected: false,
    reconnectAttempt: 0,
    lastSequenceNum: 100000,
    lastTickIso: null,
    activeBookSymbol: "NPN.JO",
    selectedBlotterIndex: 0,
    quickTicketOpen: false,
    audioMuted: false,
    wcagHighContrast: true,
    portfolioCapitalZar: 10000,
    freeCashZar: 10000,
    deployedMarginZar: 0,
    realizedPnlZar: 0,
    booksBySymbol: INITIAL_BOOKS,
    priceHistoryBySymbol: {
      "NPN.JO": [3840.0, 3842.5, 3841.0, 3843.5, 3845.0, 3844.0, 3846.5, 3845.15],
      NVDA: [137.5, 137.8, 138.2, 138.1, 138.4, 138.6, 138.55, 138.64],
      BTC: [91200.0, 91280.0, 91350.0, 91400.0, 91420.0, 91460.0, 91435.0, 91458.2],
    },
    orders: [],
    tape: [],
    risk: {
      triggered: false,
      deleveraging_factor: 1.0,
      last_cvar_95_pct: 1.85,
      last_cvar_99_pct: 2.95,
      net_portfolio_beta: 0.72,
      shrinkage_alpha: 0.18,
      reason: "NOMINAL_CROSS_ASSET_RISK",
    },
    ipc: {
      seq: 1,
      ts_us: Date.now() * 1000,
      jse_npn: 3845.0,
      us_nvda: 138.6,
      crypto_btc: 91450.0,
      cross_arb_spread_bps: 4.2,
      cvar_95_pct: 1.85,
      net_beta: 0.72,
      kill_switch: false,
    },
  };

  private listeners = new Set<() => void>();
  private worker: Worker | null = null;
  private rafPending = false;
  private pendingPatch: Partial<TerminalStoreState> = {};

  constructor() {
    if (typeof window !== "undefined") {
      this.bootstrapFromIndexedDb();
      this.initOffThreadStreamWorker();
    }
  }

  public getState = (): TerminalStoreState => this.state;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private scheduleRafFlush(patch: Partial<TerminalStoreState>): void {
    Object.assign(this.pendingPatch, patch);
    if (this.rafPending) return;
    this.rafPending = true;

    const flush = () => {
      this.rafPending = false;
      const nextPatch = this.pendingPatch;
      this.pendingPatch = {};
      this.state = {
        ...this.state,
        ...nextPatch,
      };
      this.listeners.forEach((l) => l());
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(flush);
    } else {
      setTimeout(flush, 16);
    }
  }

  public updateImmediate(patch: Partial<TerminalStoreState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  public setPortfolioCapitalZar(val: number): void {
    const capital = Math.max(500, val);
    const freeCash = Math.max(0, capital - this.state.deployedMarginZar);
    this.updateImmediate({
      portfolioCapitalZar: capital,
      freeCashZar: freeCash,
    });
    try {
      localStorage.setItem("sovereign_unified_portfolio_capital_zar", String(capital));
    } catch {}
  }

  private async bootstrapFromIndexedDb(): Promise<void> {
    const inflight = await idbGetAllInFlightOrders();
    if (inflight.length > 0) {
      this.scheduleRafFlush({
        orders: [...inflight, ...this.state.orders],
      });
    }
    try {
      const resp = await fetch("/api/bus/blotter?limit=250");
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.orders)) {
          this.scheduleRafFlush({
            orders: data.orders,
            tape: Array.isArray(data.tape) ? data.tape : this.state.tape,
            risk: data.risk || this.state.risk,
          });
        }
      }
    } catch {
      // handled by worker fallback
    }
  }

  private initOffThreadStreamWorker(): void {
    if (typeof window === "undefined" || typeof Worker === "undefined") return;

    const isMultiEngineLocal =
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1") &&
      (window.location.port === "5173" ||
        window.location.port === "5174" ||
        window.location.port === "5175");
    const hasCustomWs = Boolean((import.meta as any).env?.VITE_WS_URL);

    if (!isMultiEngineLocal && !hasCustomWs) {
      this.scheduleRafFlush({
        wsConnected: true,
        reconnectAttempt: 0,
        lastTickIso: new Date().toISOString(),
      });
      return;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/stream`;

    const workerCode = `
      let ws = null;
      let attempt = 0;
      let lastSeq = 0;
      let reconnectTimer = null;

      function connect(url) {
        try {
          ws = new self.WebSocket(url);
        } catch (err) {
          scheduleReconnect(url);
          return;
        }

        ws.onopen = function () {
          attempt = 0;
          self.postMessage({ type: "WS_STATUS", connected: true, attempt: 0 });
          if (lastSeq > 0) {
            ws.send(JSON.stringify({ action: "REPLAY_FROM_SEQ", from_seq: lastSeq }));
          }
        };

        ws.onmessage = function (ev) {
          try {
            const payload = JSON.parse(ev.data);
            if (payload.seq && payload.seq > lastSeq) {
              lastSeq = payload.seq;
            }
            self.postMessage({ type: "STREAM_PAYLOAD", payload: payload });
          } catch (e) {}
        };

        ws.onclose = function () {
          self.postMessage({ type: "WS_STATUS", connected: false, attempt: attempt + 1 });
          scheduleReconnect(url);
        };

        ws.onerror = function () {
          try { ws.close(); } catch (e) {}
        };
      }

      function scheduleReconnect(url) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        attempt += 1;
        const baseDelay = Math.min(12000, 400 * Math.pow(1.8, Math.min(attempt, 8)));
        const jitter = Math.floor(Math.random() * 350);
        reconnectTimer = setTimeout(function () {
          connect(url);
        }, baseDelay + jitter);
      }

      self.onmessage = function (e) {
        const msg = e.data || {};
        if (msg.cmd === "START") {
          connect(msg.url);
        } else if (msg.cmd === "SEND" && ws && ws.readyState === 1) {
          ws.send(JSON.stringify(msg.payload));
        }
      };
    `;

    try {
      const blob = new Blob([workerCode], { type: "application/javascript" });
      this.worker = new Worker(URL.createObjectURL(blob));
      this.worker.onmessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;
        if (data.type === "WS_STATUS") {
          this.scheduleRafFlush({
            wsConnected: Boolean(data.connected),
            reconnectAttempt: Number(data.attempt || 0),
          });
          if (data.connected) {
            this.replayOfflineInFlightOrders();
          }
        } else if (data.type === "STREAM_PAYLOAD" && data.payload) {
          this.ingestWorkerPayload(data.payload);
        }
      };
      this.worker.postMessage({ cmd: "START", url: wsUrl });
    } catch {
      // Fallback if CSP blocks Blob worker
    }
  }

  private ingestWorkerPayload(payload: Record<string, unknown>): void {
    const msgType = String(payload.type || "");
    const nextBooks = { ...this.state.booksBySymbol };
    const nextHist = { ...this.state.priceHistoryBySymbol };

    if (Array.isArray(payload.books)) {
      for (const b of payload.books as NormalizedOrderBook[]) {
        if (b && b.symbol) {
          nextBooks[b.symbol] = b;
          const prevSeries = nextHist[b.symbol] || [];
          const nextSeries = [...prevSeries.slice(-79), b.micro_price || b.mid_price];
          nextHist[b.symbol] = nextSeries;
        }
      }
    }

    let nextOrders = this.state.orders;
    if (msgType === "INITIAL_SNAPSHOT" && Array.isArray(payload.orders)) {
      nextOrders = payload.orders as BlotterOrder[];
    } else if (msgType === "ORDER_EVENT" && payload.order) {
      const ord = payload.order as BlotterOrder;
      idbRemoveInFlightOrder(ord.client_order_id);
      const filtered = this.state.orders.filter((o) => o.client_order_id !== ord.client_order_id);
      nextOrders = [ord, ...filtered].slice(0, 5000);
      if (ord.status === "FILLED") {
        audioSynth.trigger("FILL", this.state.audioMuted);
      } else if (ord.status === "PARTIALLY_FILLED") {
        audioSynth.trigger("PARTIAL_FILL", this.state.audioMuted);
      } else if (ord.status === "REJECTED") {
        audioSynth.trigger("REJECTION", this.state.audioMuted);
      }
    } else if (msgType === "EMERGENCY_PANIC_FLATTEN" && payload.order) {
      const panicOrd = payload.order as BlotterOrder;
      nextOrders = [
        panicOrd,
        ...this.state.orders.map((o) =>
          o.status === "ACKED" || o.status === "PARTIALLY_FILLED"
            ? { ...o, status: "FLATTENED_CANCELLED" }
            : o
        ),
      ];
      audioSynth.trigger("CVAR_WARNING", this.state.audioMuted);
    }

    let nextTape = this.state.tape;
    if (Array.isArray(payload.tape)) {
      nextTape = payload.tape as TapePrint[];
    } else if (Array.isArray(payload.latest_tape)) {
      const incoming = payload.latest_tape as TapePrint[];
      nextTape = [...incoming, ...this.state.tape].slice(0, 2000);
    }

    const nextRisk = (payload.risk as CrossAssetRiskState) || this.state.risk;
    if (nextRisk.triggered && !this.state.risk.triggered) {
      audioSynth.trigger("CVAR_WARNING", this.state.audioMuted);
    }

    const seq = Number(payload.seq || this.state.lastSequenceNum);
    idbSaveStateSnapshot(seq, nextOrders);

    this.scheduleRafFlush({
      lastSequenceNum: seq,
      lastTickIso: new Date().toISOString(),
      booksBySymbol: nextBooks,
      priceHistoryBySymbol: nextHist,
      orders: nextOrders,
      tape: nextTape,
      risk: nextRisk,
      ipc: (payload.cross_market_ipc as CrossMarketIpcSnapshot) || this.state.ipc,
    });
  }

  private async replayOfflineInFlightOrders(): Promise<void> {
    const pending = await idbGetAllInFlightOrders();
    for (const ord of pending) {
      try {
        const res = await fetch("/api/bus/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_order_id: ord.client_order_id,
            symbol: ord.symbol,
            market: ord.market,
            side: ord.side,
            qty: ord.qty,
            limit_price: ord.limit_price,
            algo_mode: ord.algo_mode,
          }),
        });
        if (res.ok) {
          await idbRemoveInFlightOrder(ord.client_order_id);
        }
      } catch {
        // remain in IndexedDB until next reconnect
      }
    }
  }

  public async submitOptimisticOrder(params: {
    symbol: string;
    market: string;
    side: "BUY" | "SELL";
    qty: number;
    limitPrice: number;
    algoMode: string;
  }): Promise<void> {
    const clientOrderId = `SOV-${params.market}-${generateClientOrderUuidV4().slice(0, 8).toUpperCase()}`;
    const optimisticOrder: BlotterOrder = {
      client_order_id: clientOrderId,
      symbol: params.symbol.toUpperCase(),
      market: params.market.toUpperCase(),
      side: params.side,
      qty: params.qty,
      filled_qty: 0,
      avg_fill_price: params.limitPrice,
      limit_price: params.limitPrice,
      status: "OPTIMISTIC_IN_FLIGHT",
      algo_mode: params.algoMode,
      expected_slippage_pct: 0.042,
      square_root_impact_pct: 0.019,
      sequence_num: this.state.lastSequenceNum + 1,
      timestamp: new Date().toISOString(),
      timestamp_us: Date.now() * 1000,
      optimistic_pending: true,
    };

    // 1. Optimistic UI insert + IndexedDB write
    this.updateImmediate({
      orders: [optimisticOrder, ...this.state.orders],
      quickTicketOpen: false,
    });
    await idbPutInFlightOrder(optimisticOrder);

    // 2. Dispatch to Unified Bus
    try {
      const resp = await fetch("/api/bus/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_order_id: clientOrderId,
          symbol: params.symbol,
          market: params.market,
          side: params.side,
          qty: params.qty,
          limit_price: params.limitPrice,
          algo_mode: params.algoMode,
        }),
      });
      if (resp.ok) {
        const body = await resp.json();
        await idbRemoveInFlightOrder(clientOrderId);
        if (body.order) {
          const confirmed = body.order as BlotterOrder;
          const remaining = this.state.orders.filter((o) => o.client_order_id !== clientOrderId);
          this.updateImmediate({
            orders: [confirmed, ...remaining],
          });
          audioSynth.trigger(confirmed.status === "FILLED" ? "FILL" : "PARTIAL_FILL", this.state.audioMuted);
        }
      } else {
        audioSynth.trigger("REJECTION", this.state.audioMuted);
      }
    } catch {
      // Kept in IndexedDB for automatic reconnect replay
    }
  }

  public async triggerEmergencyPanicFlatten(): Promise<void> {
    audioSynth.trigger("CVAR_WARNING", this.state.audioMuted);
    this.updateImmediate({
      orders: this.state.orders.map((o) => ({ ...o, status: "FLATTENED_CANCELLED" })),
    });
    try {
      await fetch("/api/bus/panic-flatten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "SHIFT_ESC_HOTKEY_PANIC_FLATTEN" }),
      });
    } catch {
      // Already optimistically flattened
    }
  }
}

export const terminalStore = new NormalizedTerminalStore();

export function useTerminalStore<T>(selector: (state: TerminalStoreState) => T): T {
  return useSyncExternalStore(
    terminalStore.subscribe,
    () => selector(terminalStore.getState()),
    () => selector(terminalStore.getState())
  );
}
