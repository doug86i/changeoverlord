import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { settings } from "../db/schema.js";

const TTL_MS = 5000;
let cachedValue: boolean | null = null;
let cachedUntil = 0;

async function loadHasPassword(): Promise<boolean> {
  const [row] = await db
    .select({ passwordHash: settings.passwordHash })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);
  return Boolean(row?.passwordHash);
}

/** Short TTL cache to avoid hitting `settings` on every authenticated API request. */
export async function getCachedHasPassword(): Promise<boolean> {
  const now = Date.now();
  if (cachedValue !== null && now < cachedUntil) {
    return cachedValue;
  }
  const v = await loadHasPassword();
  cachedValue = v;
  cachedUntil = now + TTL_MS;
  return v;
}

export function invalidatePasswordSettingsCache(): void {
  cachedValue = null;
  cachedUntil = 0;
}
