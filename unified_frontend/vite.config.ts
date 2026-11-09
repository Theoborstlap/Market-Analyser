import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function silentOfflineProxy(proxy: any) {
  proxy.on("error", (_err: any, _req: any, res: any) => {
    if (res && typeof res.writeHead === "function" && !res.headersSent) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "X-Sovereign-Offline": "1",
      });
      res.end(JSON.stringify({ ok: false, offline: true }));
    } else if (res && typeof res.end === "function") {
      try {
        res.end();
      } catch {
        // ignore socket close errors
      }
    }
  });
}

function sovereignBridgeTransformPlugin(): Plugin {
  return {
    name: "sovereign-aistudio-bridge-transform",
    enforce: "pre",
    transform(code: string, id: string) {
      const cleanId = id.split("?")[0].replace(/\\/g, "/");
      if (
        !cleanId.includes("/src/") ||
        cleanId.endsWith("/aiStudioBridge.ts") ||
        cleanId.endsWith("/initBridge.ts") ||
        (!cleanId.endsWith(".ts") && !cleanId.endsWith(".tsx"))
      ) {
        return null;
      }
      let next = code.replace(
        /(?<![.\w$])fetch\s*\(/g,
        "((globalThis as any).__sovereignFetch || fetch)("
      );
      next = next.replace(
        /\bnew\s+WebSocket\s*\(/g,
        "new ((globalThis as any).__SovereignWebSocket || WebSocket)("
      );
      return next !== code ? { code: next, map: null } : null;
    },
  };
}

export default defineConfig({
  plugins: [sovereignBridgeTransformPlugin(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@jse": path.resolve(__dirname, "./src/markets/jse"),
      "@us": path.resolve(__dirname, "./src/markets/us"),
      "@crypto": path.resolve(__dirname, "./src/markets/crypto"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/engine/jse/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/engine\/jse/, ""),
        configure: silentOfflineProxy,
      },
      "/engine/jse/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
        rewrite: (p) => p.replace(/^\/engine\/jse/, ""),
        configure: silentOfflineProxy,
      },
      "/engine/us/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/engine\/us/, ""),
        configure: silentOfflineProxy,
      },
      "/engine/us/ws": {
        target: "ws://127.0.0.1:8001",
        ws: true,
        rewrite: (p) => p.replace(/^\/engine\/us/, ""),
        configure: silentOfflineProxy,
      },
      "/engine/crypto/api": {
        target: "http://127.0.0.1:8002",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/engine\/crypto/, ""),
        configure: silentOfflineProxy,
      },
      "/engine/crypto/ws": {
        target: "ws://127.0.0.1:8002",
        ws: true,
        rewrite: (p) => p.replace(/^\/engine\/crypto/, ""),
        configure: silentOfflineProxy,
      },
      "/api/bus": {
        target: "http://127.0.0.1:8003",
        changeOrigin: true,
        configure: silentOfflineProxy,
      },
      "/ws/stream": {
        target: "ws://127.0.0.1:8003",
        ws: true,
        configure: silentOfflineProxy,
      },
    },
  },
});
