import crypto from "node:crypto";

const COOKIE = "co_session";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string {
  return process.env.SESSION_SECRET ?? "dev-only-change-in-production";
}

type Payload = { v: 1; exp: number };

export function createSessionToken(): string {
  const payload: Payload = { v: 1, exp: Date.now() + TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !token.includes(".")) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = crypto
    .createHmac("sha256", secret())
    .update(body)
    .digest("base64url");
  if (sig.length !== expected.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return false;
    }
  } catch {
    return false;
  }
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (p.v !== 1 || typeof p.exp !== "number") return false;
    if (p.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export const sessionCookieName = COOKIE;
