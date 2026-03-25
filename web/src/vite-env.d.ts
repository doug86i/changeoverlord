/// <reference types="vite/client" />

/** Injected by Vite `define` in `vite.config.ts`. */
declare const __CHANGEOVERLORD_APP_VERSION__: string;

interface ImportMetaEnv {
  /** Set `true` to enable `logDebug()` in production builds (see `docs/LOGGING.md`). */
  readonly VITE_LOG_DEBUG?: string;
  /** Fast stack: POST collab NDJSON to API (`docs/LOGGING.md`). */
  readonly VITE_CLIENT_LOG_FILE?: string;
}
