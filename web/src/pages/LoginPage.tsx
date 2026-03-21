import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiSend } from "../api/client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function LoginPage() {
  const [password, setPassword] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const login = useMutation({
    mutationFn: () =>
      apiSend<{ ok: boolean }>("/api/v1/auth/login", "POST", { password }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["authSession"] });
      const ret = searchParams.get("returnTo");
      navigate(ret ? decodeURIComponent(ret) : "/", { replace: true });
    },
  });

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div className="card" style={{ maxWidth: 360, width: "100%" }}>
        <h1 style={{ marginTop: 0 }}>Sign in</h1>
        <p className="muted">Enter the shared password for this instance.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
        >
          <label>
            <span className="muted" style={{ display: "block", marginBottom: 6 }}>
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ width: "100%", marginBottom: "1rem" }}
            />
          </label>
          <button type="submit" className="primary" disabled={login.isPending}>
            Continue
          </button>
        </form>
        {login.isError && (
          <p style={{ color: "var(--color-brand)", marginTop: "0.75rem" }}>
            {(login.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}
