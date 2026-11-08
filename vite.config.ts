import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function silentOfflineProxy(proxy: any) {
  proxy.on("error", (_err: any, _req: any, res: any) => {
    if (res && typeof res.writeHead === "function" && !res.headersSent) {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("Offline");
    } else if (res && typeof res.end === "function") {
      try {
        res.end();
      } catch {
        // ignore socket close errors
      }
    }
  });
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./unified_frontend/src"),
      "@jse": path.resolve(__dirname, "./unified_frontend/src/markets/jse"),
      "@us": path.resolve(__dirname, "./unified_frontend/src/markets/us"),
      "@crypto": path.resolve(__dirname, "./unified_frontend/src/markets/crypto"),
    },
  },
  server: {
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
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        configure: silentOfflineProxy,
      },
      "/ws/stream": {
        target: "ws://127.0.0.1:8000",
        ws: true,
        configure: silentOfflineProxy,
      },
    },
  },
});
