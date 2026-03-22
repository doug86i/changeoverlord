import { z } from "zod";
import { normalizePerformanceBandName } from "../lib/performance-band-name.js";

export const uuidParam = z.object({
  id: z.string().uuid(),
});

export const eventIdParam = z.object({
  eventId: z.string().uuid(),
});

export const stageIdParam = z.object({
  stageId: z.string().uuid(),
});

export const stageDayIdParam = z.object({
  stageDayId: z.string().uuid(),
});

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const timeStr = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Expected HH:mm (24h)");

export const createEventBody = z.object({
  name: z.string().min(1).max(500),
  startDate: dateStr,
  endDate: dateStr,
});

export const patchEventBody = z.object({
  name: z.string().min(1).max(500).optional(),
  startDate: dateStr.optional(),
  endDate: dateStr.optional(),
});

export const createStageBody = z.object({
  name: z.string().min(1).max(500),
  sortOrder: z.number().int().optional(),
});

export const patchStageBody = z.object({
  name: z.string().min(1).max(500).optional(),
  sortOrder: z.number().int().optional(),
  /** Global patch template for new performances (stored library row only). */
  defaultPatchTemplateId: z.string().uuid().optional(),
});

/** Set or clear the urgent line on stage clocks (`null` or empty clears). */
export const patchStageClockMessageBody = z.object({
  message: z.union([z.string().max(500), z.null()]),
});

export const createStageDayBody = z.object({
  dayDate: dateStr,
  sortOrder: z.number().int().optional(),
});

export const patchStageDayBody = z.object({
  dayDate: dateStr.optional(),
  sortOrder: z.number().int().optional(),
});

export const createPerformanceBody = z.object({
  bandName: z
    .string()
    .max(500)
    .default("")
    .transform(normalizePerformanceBandName),
  notes: z.string().max(10000).optional().default(""),
  startTime: timeStr,
  endTime: timeStr.optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const patchPerformanceBody = z.object({
  bandName: z
    .string()
    .max(500)
    .optional()
    .transform((s) =>
      s === undefined ? undefined : normalizePerformanceBandName(s),
    ),
  notes: z.string().max(10000).optional(),
  startTime: timeStr.optional(),
  endTime: timeStr.optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const chatMessagesQuery = z.object({
  eventId: z.string().uuid(),
  stageId: z.string().uuid(),
});

export const postChatMessageBody = z
  .object({
    eventId: z.string().uuid(),
    scope: z.enum(["stage", "event"]),
    /** Required when `scope` is `stage` (must belong to `eventId`). */
    stageId: z.string().uuid().optional(),
    author: z.string().max(80).optional().default(""),
    body: z.string().min(1).max(2000),
  })
  .superRefine((data, ctx) => {
    if (data.scope === "stage" && !data.stageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "stageId is required when scope is stage",
        path: ["stageId"],
      });
    }
  });
