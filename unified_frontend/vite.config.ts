import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
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
    strictPort: true,
    proxy: {
      "/engine/jse/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/engine\/jse/, ""),
      },
      "/engine/jse/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
        rewrite: (p) => p.replace(/^\/engine\/jse/, ""),
      },
      "/engine/us/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/engine\/us/, ""),
      },
      "/engine/us/ws": {
        target: "ws://127.0.0.1:8001",
        ws: true,
        rewrite: (p) => p.replace(/^\/engine\/us/, ""),
      },
      "/engine/crypto/api": {
        target: "http://127.0.0.1:8002",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/engine\/crypto/, ""),
      },
      "/engine/crypto/ws": {
        target: "ws://127.0.0.1:8002",
        ws: true,
        rewrite: (p) => p.replace(/^\/engine\/crypto/, ""),
      },
    },
  },
});
