import { eq, asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { performances } from "../db/schema.js";
import {
  chronologicalIdsByExtendedStart,
  type PerfInterval,
} from "./performance-overlap.js";

/**
 * Reassigns `sort_order` to 0..n-1 in extended chronological order (overnight-safe).
 */
export async function normalizePerformancesOrderForStageDay(
  stageDayId: string,
): Promise<void> {
  const rows = await db
    .select()
    .from(performances)
    .where(eq(performances.stageDayId, stageDayId))
    .orderBy(
      asc(performances.sortOrder),
      asc(performances.startTime),
      asc(performances.id),
    );
  const intervals: PerfInterval[] = rows.map((r) => ({
    id: r.id,
    sortOrder: r.sortOrder,
    startTime: r.startTime,
    endTime: r.endTime,
  }));
  const ids = chronologicalIdsByExtendedStart(intervals);
  if (!ids) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(performances)
        .set({ sortOrder: i })
        .where(eq(performances.id, ids[i]!));
    }
  });
}
