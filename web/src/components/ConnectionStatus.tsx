import { useConnectionState } from "../realtime/ConnectionContext";

export function ConnectionStatus() {
  const { state } = useConnectionState();

  if (state === "connected") return null;

  return (
    <div
      className={`conn-banner ${state === "offline" ? "conn-offline" : "conn-connecting"}`}
      role="status"
      aria-live="polite"
    >
      {state === "offline"
        ? "Connection lost — data may be outdated"
        : "Reconnecting to server…"}
    </div>
  );
}
