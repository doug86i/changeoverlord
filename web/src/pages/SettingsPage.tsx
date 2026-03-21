import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, apiSend } from "../api/client";

type SettingsRes = { hasPassword: boolean };

export function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<SettingsRes>("/api/v1/settings"),
  });

  const [initial, setInitial] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [clearPwd, setClearPwd] = useState("");

  const setInitialPwd = useMutation({
    mutationFn: () =>
      apiSend("/api/v1/settings/password", "POST", { password: initial }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings"] });
      await qc.invalidateQueries({ queryKey: ["authSession"] });
      setInitial("");
      window.location.href = "/login";
    },
  });

  const changePwd = useMutation({
    mutationFn: () =>
      apiSend("/api/v1/settings/password", "POST", {
        currentPassword: current,
        newPassword: next,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setCurrent("");
      setNext("");
    },
  });

  const clearPassword = useMutation({
    mutationFn: () =>
      apiSend("/api/v1/settings/password", "DELETE", {
        currentPassword: clearPwd,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings"] });
      await qc.invalidateQueries({ queryKey: ["authSession"] });
      setClearPwd("");
    },
  });

  const logout = useMutation({
    mutationFn: () => apiSend("/api/v1/auth/logout", "POST"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["authSession"] });
      window.location.href = "/login";
    },
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Settings</h1>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <p>
          <strong>Shared password:</strong>{" "}
          {settings?.hasPassword ? "enabled" : "not set (open LAN)"}
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          When a password is set, browsers must sign in once; the session cookie
          lasts about a week.
        </p>
      </div>

      {!settings?.hasPassword && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
            Set password (optional)
          </div>
          <input
            type="password"
            placeholder="New password"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
            style={{ width: "100%", maxWidth: 320, marginRight: "0.5rem" }}
          />
          <button
            type="button"
            className="primary"
            style={{ marginTop: "0.5rem" }}
            onClick={() => setInitialPwd.mutate()}
            disabled={setInitialPwd.isPending || !initial}
          >
            Save password
          </button>
          {setInitialPwd.isError && (
            <p style={{ color: "var(--color-brand)" }}>
              {(setInitialPwd.error as Error).message}
            </p>
          )}
        </div>
      )}

      {settings?.hasPassword && (
        <>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
              Change password
            </div>
            <input
              type="password"
              placeholder="Current"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              style={{ display: "block", width: "100%", maxWidth: 320, marginBottom: 8 }}
            />
            <input
              type="password"
              placeholder="New"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              style={{ display: "block", width: "100%", maxWidth: 320, marginBottom: 8 }}
            />
            <button
              type="button"
              className="primary"
              onClick={() => changePwd.mutate()}
              disabled={changePwd.isPending || !current || !next}
            >
              Update
            </button>
            {changePwd.isError && (
              <p style={{ color: "var(--color-brand)" }}>
                {(changePwd.error as Error).message}
              </p>
            )}
          </div>

          <div className="card" style={{ marginBottom: "1rem" }}>
            <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
              Remove password (open LAN)
            </div>
            <input
              type="password"
              placeholder="Current password to confirm"
              value={clearPwd}
              onChange={(e) => setClearPwd(e.target.value)}
              style={{ width: "100%", maxWidth: 320, marginRight: "0.5rem" }}
            />
            <button
              type="button"
              onClick={() => clearPassword.mutate()}
              disabled={clearPassword.isPending || !clearPwd}
              style={{ marginTop: "0.5rem" }}
            >
              Remove password
            </button>
            {clearPassword.isError && (
              <p style={{ color: "var(--color-brand)" }}>
                {(clearPassword.error as Error).message}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            Sign out
          </button>
        </>
      )}
    </div>
  );
}
