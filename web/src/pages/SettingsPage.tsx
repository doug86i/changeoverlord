import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api/client";

type SettingsRes = { hasPassword: boolean };

export function SettingsPage() {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<SettingsRes>("/api/v1/settings"),
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Settings</h1>
      <div className="card">
        <p>
          <strong>Shared password:</strong>{" "}
          {data?.hasPassword ? "enabled" : "not set (open LAN)"}
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          Password management will be added in a follow-up; trusted LAN remains
          the default per product plan.
        </p>
      </div>
    </div>
  );
}
