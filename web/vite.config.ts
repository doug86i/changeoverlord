import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/** Host-local dev: 127.0.0.1. Docker fast stack: set VITE_API_PROXY=http://api:3000 on the web container. */
const apiProxyTarget =
  process.env.VITE_API_PROXY ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      /** Unminified SW avoids flaky terser during `vite build` in constrained environments. */
      mode: "development",
      registerType: "autoUpdate",
      includeAssets: [],
      manifest: {
        name: "Changeoverlord",
        short_name: "Changeoverlord",
        description: "Stage schedule, patch/RF workbooks, and clocks",
        display: "standalone",
        start_url: "/",
        theme_color: "#16213e",
        background_color: "#0f0f12",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
        /** Main bundle includes FortuneSheet (~3 MiB precache). */
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/[^/]+\/api\/.*/i,
            handler: "NetworkOnly",
            options: {},
          },
          {
            urlPattern: /^wss?:\/\/.*/i,
            handler: "NetworkOnly",
            options: {},
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
