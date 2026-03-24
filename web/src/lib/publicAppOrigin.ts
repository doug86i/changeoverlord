/**
 * Base URL for absolute links and QR codes: optional Settings override, else
 * the address this page was loaded from (`window.location.origin`).
 */
export function getPublicAppOrigin(
  settingsPublicBaseUrl: string | null | undefined,
): string {
  const trimmed = settingsPublicBaseUrl?.trim();
  if (trimmed) return trimmed.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}
