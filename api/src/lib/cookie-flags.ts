import type { FastifyRequest } from "fastify";

/** SameSite + secure for session cookie (set and clear must match). */
export function sessionCookieOptions(req: FastifyRequest): {
  sameSite: "lax";
  secure: boolean;
} {
  const secure =
    process.env.FORCE_SECURE_COOKIES === "1" ||
    (() => {
      const raw = req.headers["x-forwarded-proto"];
      const first =
        typeof raw === "string"
          ? raw.split(",")[0]?.trim().toLowerCase()
          : Array.isArray(raw)
            ? raw[0]?.trim().toLowerCase()
            : "";
      return first === "https";
    })();
  return { sameSite: "lax", secure };
}
