import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { RealtimeSync } from "./realtime/RealtimeSync";
import { ConnectionProvider } from "./realtime/ConnectionContext";
import { ThemeProvider } from "./theme/ThemeContext";
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
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
