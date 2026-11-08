import test from "node:test";
import assert from "node:assert/strict";
import { installAiStudioBridge } from "./aiStudioBridge.ts";

test("installAiStudioBridge survives getter-only non-configurable window.fetch and serves offline endpoints", async () => {
  const fakeWindow: any = {
    location: {
      origin: "https://ais-dev-example.run.app",
      hostname: "ais-dev-example.run.app",
      port: "",
      protocol: "https:",
      host: "ais-dev-example.run.app",
    },
    localStorage: {
      store: new Map<string, string>(),
      getItem(k: string) {
        return this.store.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        this.store.set(k, v);
      },
    },
  };

  Object.defineProperty(fakeWindow, "fetch", {
    get() {
      return async () => new Response("{}", { status: 200 });
    },
    configurable: false,
  });

  Object.defineProperty(fakeWindow, "WebSocket", {
    get() {
      return class DummyWs {};
    },
    configurable: false,
  });

  (globalThis as any).window = fakeWindow;

  assert.doesNotThrow(() => {
    installAiStudioBridge();
  });

  const sovereignFetch = (globalThis as any).__sovereignFetch;
  assert.equal(typeof sovereignFetch, "function");

  const healthRes = await sovereignFetch("/engine/jse/api/health");
  assert.equal(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.equal(healthJson.ok, true);

  const jseStateRes = await sovereignFetch("/engine/jse/api/state");
  assert.equal(jseStateRes.status, 200);
  const jseState = await jseStateRes.json();
  assert.ok(Array.isArray(jseState.signals));
  assert.ok(jseState.signals.length > 0);

  const usStateRes = await sovereignFetch("/engine/us/api/state");
  assert.equal(usStateRes.status, 200);
  const usState = await usStateRes.json();
  assert.ok(Array.isArray(usState.signals));
  assert.ok(usState.signals.length > 0);

  const cryptoStateRes = await sovereignFetch("/engine/crypto/api/state");
  assert.equal(cryptoStateRes.status, 200);
  const cryptoState = await cryptoStateRes.json();
  assert.ok(Array.isArray(cryptoState.signals));
  assert.ok(cryptoState.signals.length > 0);

  const orderRes = await sovereignFetch("/api/bus/order", {
    method: "POST",
    body: JSON.stringify({
      symbol: "NPN.JO",
      market: "JSE",
      side: "BUY",
      qty: 10,
      limit_price: 3500,
    }),
  });
  assert.equal(orderRes.status, 200);
  const orderJson = await orderRes.json();
  assert.equal(orderJson.ok, true);
  assert.equal(orderJson.order.symbol, "NPN.JO");
});
