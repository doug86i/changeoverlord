/**
 * Validates and normalizes optional public app origin for share/QR links.
 * Accepts `http(s)://host[:port]` only — no path, query, hash, or userinfo.
 */
export function normalizePublicBaseUrl(
  input: string | null | undefined,
):
  | { ok: true; value: string | null }
  | { ok: false; message: string } {
  if (input == null) return { ok: true, value: null };
  const t = typeof input === "string" ? input.trim() : "";
  if (t === "") return { ok: true, value: null };
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return { ok: false, message: "Invalid URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, message: "Only http and https URLs are allowed" };
  }
  if (u.username || u.password) {
    return { ok: false, message: "Userinfo in URL is not allowed" };
  }
  const path = u.pathname;
  if (path !== "" && path !== "/") {
    return {
      ok: false,
      message:
        "Use the site origin only (no path), e.g. http://192.168.1.50:8080",
    };
  }
  if (u.search || u.hash) {
    return { ok: false, message: "Query and hash are not allowed" };
  }
  return { ok: true, value: u.origin };
}
