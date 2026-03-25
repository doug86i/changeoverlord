/**
 * Semver-ish string from `web/package.json` at build time, or `VITE_APP_VERSION` / Docker `ARG` (for example git tag `v1.2.3` → `1.2.3`). **`dev`** when unset.
 */
export const APP_VERSION = __CHANGEOVERLORD_APP_VERSION__;

/** Label for UI (`v1.2.3` or `dev`). */
export function formatAppVersionLabel(version: string): string {
  if (version === "dev") return "dev";
  if (/^v\d/i.test(version)) return version;
  if (/^\d+\.\d+/.test(version)) return `v${version}`;
  return version;
}
