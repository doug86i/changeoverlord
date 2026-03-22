/** Shown when operators leave band / act name blank (avoids fragile workbook / export edge cases). */
export const UNTITLED_PERFORMANCE_BAND_NAME = "Untitled act";

export function normalizePerformanceBandName(raw: string): string {
  const t = raw.trim();
  return t.length > 0 ? t : UNTITLED_PERFORMANCE_BAND_NAME;
}
