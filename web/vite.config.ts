import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Host-local dev: 127.0.0.1. Docker fast stack: set VITE_API_PROXY=http://api:3000 on the web container. */
const apiProxyTarget =
  process.env.VITE_API_PROXY ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
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
