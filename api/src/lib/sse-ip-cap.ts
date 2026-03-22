import type { FastifyRequest } from "fastify";

const MAX_SSE_PER_IP = 20;
const counts = new Map<string, number>();

export function reserveSseSlot(req: FastifyRequest): (() => void) | null {
  const ip = req.ip || "unknown";
  const cur = counts.get(ip) ?? 0;
  if (cur >= MAX_SSE_PER_IP) return null;
  counts.set(ip, cur + 1);
  return () => {
    const n = (counts.get(ip) ?? 1) - 1;
    if (n <= 0) counts.delete(ip);
    else counts.set(ip, n);
  };
}
