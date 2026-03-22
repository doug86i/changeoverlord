/** Escape `%` and `_` for use inside PostgreSQL ILIKE patterns (literal match). */
export function escapeIlikePattern(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
