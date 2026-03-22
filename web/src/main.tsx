import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setAutoFreeze } from "immer";
import { App } from "./App";
import { RealtimeSync } from "./realtime/RealtimeSync";
import { ConnectionProvider } from "./realtime/ConnectionContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { ViewportScrollbarVar } from "./components/ViewportScrollbarVar";

/*
 * FortuneSheet uses Immer `produce` for every state update (`setContext`). React 18 may replay
 * state-updater functions (concurrent features, Strict Mode double-invoke). When `addSheet`
 * mutates its `sheetData` argument (`delete sheetData.data`) and pushes it onto
 * `ctx.luckysheetfile`, Immer's `autoFreeze` freezes that object after the first produce.
 * A replayed updater then hits the frozen reference via the closure-captured `ops` →
 * `TypeError: Unable to delete property`.  Disabling autoFreeze is the standard Immer
 * production configuration and avoids this class of freeze-vs-replay crashes.
 */
setAutoFreeze(false);

import "@fortune-sheet/react/dist/index.css";
import "./global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider>
        <RealtimeSync />
        <ThemeProvider>
          <ViewportScrollbarVar />
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
