import path from "node:path";

/** Writable uploads root (Compose: `/var/changeoverlord/uploads`). */
export function getUploadsDir(): string {
  const env = process.env.UPLOADS_DIR;
  if (env) return path.resolve(env);
  return path.resolve(process.cwd(), "data", "uploads");
}
