import path from "node:path";

/** Extensions from `RIDER_EXTRA_EXTENSIONS` (comma-separated, with or without leading dot). */
export function parseRiderExtraExtensions(): Set<string> {
  const raw = process.env.RIDER_EXTRA_EXTENSIONS ?? "";
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase();
    if (!t) continue;
    out.add(t.startsWith(".") ? t : `.${t}`);
  }
  return out;
}

export function mergeRiderExtensionSet(base: Set<string>): Set<string> {
  const merged = new Set(base);
  for (const e of parseRiderExtraExtensions()) {
    merged.add(e);
  }
  return merged;
}

export function riderExtraExtensions(): Set<string> {
  return parseRiderExtraExtensions();
}
