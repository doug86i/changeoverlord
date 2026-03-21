import type { Sheet } from "@fortune-sheet/core";

/**
 * Workbook `data` seed from the API (decoded Yjs snapshot or Excel fallback).
 * There is no client-generated default grid — operators add templates via upload (e.g. from
 * `examples/`) or **Create blank template** in Settings (`POST /api/v1/patch-templates/blank`;
 * same two-tab shell as **`api/src/lib/default-patch-sheets.ts`**).
 */
export function sheetsFromApiSeed(
  seed: Sheet[] | undefined | null,
): Sheet[] | null {
  if (seed && seed.length > 0) return seed;
  return null;
}
