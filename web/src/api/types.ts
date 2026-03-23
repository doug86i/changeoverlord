export type EventRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  /** Optional logo (`file_assets` row with `eventId`); use `/api/v1/files/:id/raw`. */
  logoFileId?: string | null;
  createdAt: string;
};

/** `GET /api/v1/events` paginated envelope (`page` / `limit` query params). */
export type PaginatedEventsResponse = {
  events: EventRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export type StageRow = {
  id: string;
  eventId: string;
  name: string;
  sortOrder: number;
  /** Global template used for new performances on this stage. */
  defaultPatchTemplateId?: string | null;
  /** True when a default patch workbook template is selected. */
  hasPatchTemplate?: boolean;
  /** Urgent line on stage clocks (synced via API). */
  clockMessage?: string | null;
  /** From parent event — for header branding on stage routes. */
  eventLogoFileId?: string | null;
};

/** Patch/RF workbook template. `stageId` null = global; set = local to that stage. */
export type PatchTemplateRow = {
  id: string;
  name: string;
  originalName: string;
  byteSize: number;
  /** NULL = global template; set = local to this stage. */
  stageId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** `GET /api/v1/patch-templates` paginated envelope. */
export type PaginatedPatchTemplatesResponse = {
  patchTemplates: PatchTemplateRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export type PatchTemplatePreview = {
  sheets: {
    name: string;
    row?: number;
    column?: number;
    sample: (string | number | boolean | null)[][];
  }[];
};

export type StageDayRow = {
  id: string;
  stageId: string;
  dayDate: string;
  sortOrder: number;
};

export type PerformanceRow = {
  id: string;
  stageDayId: string;
  sortOrder: number;
  bandName: string;
  notes: string;
  startTime: string;
  endTime: string | null;
};

/** Stage thread or event-wide chat message (`GET/POST /api/v1/chat/messages`). */
export type ChatMessageRow = {
  id: string;
  eventId: string;
  stageId: string | null;
  scope: "stage" | "event";
  author: string;
  body: string;
  createdAt: string;
};

/** In-memory presence snapshot (`GET /api/v1/chat/presence`). */
export type ChatPresenceOnlineRow = {
  clientId: string;
  displayName: string;
  lastSeen: string;
};

export type FileAssetPurpose = "rider_pdf" | "plot_pdf" | "generic";

export type FileAssetRow = {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  purpose: FileAssetPurpose;
  stageId: string | null;
  eventId: string | null;
  performanceId: string | null;
  parentFileId: string | null;
  createdAt: string;
  pageCount?: number;
  /** Server can build a PDF from images, Word/ODT/RTF, or plain text (see convert-to-pdf). */
  canConvertToPdf?: boolean;
};
