/**
 * Browser debug logging — **no secrets**. Enable with Vite dev server or
 * `VITE_LOG_DEBUG=true` at build time (see `docs/LOGGING.md`).
 */
export const isClientDebugLoggingEnabled =
  import.meta.env.DEV || import.meta.env.VITE_LOG_DEBUG === "true";

const enabled = isClientDebugLoggingEnabled;

export function logDebug(
  scope: string,
  message: string,
  ...meta: unknown[]
): void {
  if (!enabled) return;
  const tag = `[changeoverlord:${scope}]`;
  if (meta.length > 0) {
    console.debug(tag, message, ...meta);
  } else {
    console.debug(tag, message);
  }
}
