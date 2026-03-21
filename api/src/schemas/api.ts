import { z } from "zod";

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
  /** Global patch template for new performances; `null` clears selection. */
  defaultPatchTemplateId: z.string().uuid().nullable().optional(),
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
  bandName: z.string().max(500).default(""),
  notes: z.string().max(10000).optional().default(""),
  startTime: timeStr,
  endTime: timeStr.optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const patchPerformanceBody = z.object({
  bandName: z.string().max(500).optional(),
  notes: z.string().max(10000).optional(),
  startTime: timeStr.optional(),
  endTime: timeStr.optional().nullable(),
  sortOrder: z.number().int().optional(),
});
