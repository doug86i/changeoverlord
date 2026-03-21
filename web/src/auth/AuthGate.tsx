import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { apiGet } from "../api/client";

type SessionRes = {
  authenticated: boolean;
  passwordRequired: boolean;
};

export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["authSession"],
    queryFn: () => apiGet<SessionRes>("/api/v1/auth/session"),
    retry: false,
  });

  if (location.pathname === "/login") {
    return children;
  }

  if (isLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }} className="muted">
        Loading…
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Could not reach the server. Is Docker running?
      </div>
    );
  }

  if (data?.passwordRequired && !data.authenticated) {
    const returnTo = encodeURIComponent(
      location.pathname + location.search,
    );
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return children;
}
