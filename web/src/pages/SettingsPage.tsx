import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type CSSProperties } from "react";
import { apiGet, apiSend } from "../api/client";
import { PatchTemplateLibrarySettings } from "../components/PatchTemplateTools";
import { getPublicAppOrigin } from "../lib/publicAppOrigin";

type SettingsRes = { hasPassword: boolean; publicBaseUrl: string | null };

export function SettingsPage() {
  const qc = useQueryClient();
  const settingsQ = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<SettingsRes>("/api/v1/settings"),
  });
  const settings = settingsQ.data;

  const [initial, setInitial] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [clearPwd, setClearPwd] = useState("");
  const [publicBaseDraft, setPublicBaseDraft] = useState("");
  const [publicBaseDirty, setPublicBaseDirty] = useState(false);

  useEffect(() => {
    if (!settingsQ.isSuccess || publicBaseDirty) return;
    setPublicBaseDraft(settings?.publicBaseUrl ?? "");
  }, [settingsQ.isSuccess, settings?.publicBaseUrl, publicBaseDirty]);

  const patchPublicBase = useMutation({
    mutationFn: (publicBaseUrl: string | null) =>
      apiSend<{ publicBaseUrl: string | null }>("/api/v1/settings", "PATCH", {
        publicBaseUrl,
      }),
    onSuccess: async (data) => {
      setPublicBaseDirty(false);
      setPublicBaseDraft(data?.publicBaseUrl ?? "");
      await qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

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

  if (settingsQ.isLoading) {
    return (
      <div style={{ minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
        <h1 style={{ marginTop: 0 }}>Settings</h1>
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (settingsQ.isError || !settings) {
    return (
      <div style={{ minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
        <h1 style={{ marginTop: 0 }}>Settings</h1>
        <p role="alert">Failed to load settings.</p>
      </div>
    );
  }

  const fieldStyle: CSSProperties = {
    display: "block",
    width: "100%",
    maxWidth: "min(20rem, 100%)",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
      <h1 style={{ marginTop: 0 }}>Settings</h1>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <p>
          <strong>Shared password:</strong>{" "}
          {settings.hasPassword ? "enabled" : "not set (open LAN)"}
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          When a password is set, browsers must sign in once; the session cookie
          lasts about a week.
        </p>
      </div>

      <PatchTemplateLibrarySettings />

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
          Advanced — links &amp; QR base URL
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Share links and QR codes use <strong>this browser&apos;s address</strong>{" "}
          (for example <code>{window.location.origin}</code>) unless you set an
          override below — useful behind a reverse proxy or fixed hostname.
        </p>
        <label htmlFor="settings-public-base" className="muted" style={{ display: "block", marginBottom: "0.35rem" }}>
          Optional override (origin only, e.g. <code>http://192.168.1.50:8080</code>)
        </label>
        <input
          id="settings-public-base"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="Leave empty to use this page’s address"
          value={publicBaseDraft}
          onChange={(e) => {
            setPublicBaseDirty(true);
            setPublicBaseDraft(e.target.value);
          }}
          style={{ ...fieldStyle, marginBottom: "0.5rem" }}
        />
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
          Effective base for links:{" "}
          <code>
            {getPublicAppOrigin(
              publicBaseDraft.trim() === "" ? null : publicBaseDraft.trim(),
            ) || "(unknown)"}
          </code>
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button
            type="button"
            className="primary"
            onClick={() =>
              patchPublicBase.mutate(
                publicBaseDraft.trim() === "" ? null : publicBaseDraft.trim(),
              )
            }
            disabled={patchPublicBase.isPending}
          >
            Save override
          </button>
          {(settings.publicBaseUrl ?? "").trim() !== "" && (
            <button
              type="button"
              onClick={() => {
                setPublicBaseDirty(false);
                setPublicBaseDraft("");
                patchPublicBase.mutate(null);
              }}
              disabled={patchPublicBase.isPending}
            >
              Clear override
            </button>
          )}
        </div>
        {patchPublicBase.isError && (
          <p role="alert" style={{ color: "var(--color-danger)", marginBottom: 0 }}>
            {(patchPublicBase.error as Error).message}
          </p>
        )}
      </div>

      {!settings.hasPassword && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
            Set password (optional)
          </div>
          <input
            type="password"
            placeholder="New password"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
            style={{ ...fieldStyle, marginBottom: "0.5rem" }}
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
            <p role="alert" style={{ color: "var(--color-danger)" }}>
              {(setInitialPwd.error as Error).message}
            </p>
          )}
        </div>
      )}

      {settings.hasPassword && (
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
              style={{ ...fieldStyle, marginBottom: 8 }}
            />
            <input
              type="password"
              placeholder="New"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              style={{ ...fieldStyle, marginBottom: 8 }}
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
              <p role="alert" style={{ color: "var(--color-danger)" }}>
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
              style={{ ...fieldStyle, marginBottom: "0.5rem" }}
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
              <p role="alert" style={{ color: "var(--color-danger)" }}>
                {(clearPassword.error as Error).message}
              </p>
            )}
          </div>

          <div style={{ marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              style={{ maxWidth: "100%", boxSizing: "border-box" }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
