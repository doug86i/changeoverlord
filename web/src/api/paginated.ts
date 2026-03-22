import { apiGet } from "./client";
import type {
  EventRow,
  PaginatedEventsResponse,
  PaginatedPatchTemplatesResponse,
  PatchTemplateRow,
} from "./types";

const EVENT_PAGE_SIZE = 200;
const TEMPLATE_PAGE_SIZE = 200;

/** Fetch every event (multiple pages, long pages). */
export async function fetchAllEvents(): Promise<EventRow[]> {
  const out: EventRow[] = [];
  for (let page = 1; ; page += 1) {
    const r = await apiGet<PaginatedEventsResponse>(
      `/api/v1/events?page=${page}&limit=${EVENT_PAGE_SIZE}`,
    );
    out.push(...r.events);
    if (!r.hasMore) break;
  }
  return out;
}

/** Fetch every patch template visible for the list (global, or global + stage when `stageId` set). */
export async function fetchAllPatchTemplates(
  stageId?: string,
): Promise<PatchTemplateRow[]> {
  const q = stageId
    ? `stageId=${encodeURIComponent(stageId)}&`
    : "";
  const out: PatchTemplateRow[] = [];
  for (let page = 1; ; page += 1) {
    const r = await apiGet<PaginatedPatchTemplatesResponse>(
      `/api/v1/patch-templates?${q}page=${page}&limit=${TEMPLATE_PAGE_SIZE}`,
    );
    out.push(...r.patchTemplates);
    if (!r.hasMore) break;
  }
  return out;
}
