import type { Logger } from "drizzle-orm/logger";
import { createLogger } from "./log.js";

const lg = createLogger("drizzle");

/** Emitted when **`LOG_LEVEL=debug`** — see `db/client.ts`. */
export const drizzleDebugLogger: Logger = {
  logQuery(query: string, params: unknown[]): void {
    lg.debug({ params }, query);
  },
};
