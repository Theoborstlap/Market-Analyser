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
    // Single unified server (root server.py) serves all engines under /engine/{jse,us,crypto}
    proxy: {
      "/engine": {
        target: process.env.VITE_BACKEND_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
