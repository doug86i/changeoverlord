import path from "node:path";

/**
 * Resolve `relativeKey` under `root` and ensure the result does not escape `root`
 * (defence in depth if `storageKey` in the DB is ever wrong).
 */
export function resolvePathUnderUploadsRoot(root: string, relativeKey: string): string {
  const rootAbs = path.resolve(root);
  const resolved = path.resolve(rootAbs, relativeKey);
  const rel = path.relative(rootAbs, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Resolved path escapes uploads root");
  }
  return resolved;
}
