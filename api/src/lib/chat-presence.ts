/**
 * In-memory chat “who’s online” for an event (single API process).
 * Entries expire after {@link STALE_MS} without a heartbeat POST.
 * See `docs/REALTIME.md` (chat presence).
 */

const STALE_MS = 90_000;

type Entry = { displayName: string; lastSeen: number };

const byEvent = new Map<string, Map<string, Entry>>();

export function touchChatPresence(
  eventId: string,
  clientId: string,
  displayName: string,
): void {
  let m = byEvent.get(eventId);
  if (!m) {
    m = new Map();
    byEvent.set(eventId, m);
  }
  const name = displayName.trim() || "Anonymous";
  m.set(clientId, { displayName: name, lastSeen: Date.now() });
}

function pruneEvent(eventId: string): void {
  const m = byEvent.get(eventId);
  if (!m) return;
  const now = Date.now();
  for (const [cid, e] of m) {
    if (now - e.lastSeen > STALE_MS) m.delete(cid);
  }
  if (m.size === 0) byEvent.delete(eventId);
}

export function getChatPresence(eventId: string): {
  clientId: string;
  displayName: string;
  lastSeen: string;
}[] {
  pruneEvent(eventId);
  const m = byEvent.get(eventId);
  if (!m) return [];
  const out: { clientId: string; displayName: string; lastSeen: string }[] =
    [];
  for (const [clientId, e] of m) {
    out.push({
      clientId,
      displayName: e.displayName,
      lastSeen: new Date(e.lastSeen).toISOString(),
    });
  }
  out.sort(
    (a, b) =>
      a.displayName.localeCompare(b.displayName) ||
      a.clientId.localeCompare(b.clientId),
  );
  return out;
}
