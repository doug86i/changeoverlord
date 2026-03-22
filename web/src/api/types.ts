export type EventRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string;
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
};

/** Global patch/RF workbook template (upload once; stages reference by id). */
export type PatchTemplateRow = {
  id: string;
  name: string;
  originalName: string;
  byteSize: number;
  createdAt: string;
  updatedAt: string;
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

export type FileAssetPurpose = "rider_pdf" | "plot_pdf" | "generic";

export type FileAssetRow = {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  purpose: FileAssetPurpose;
  stageId: string | null;
  performanceId: string | null;
  parentFileId: string | null;
  createdAt: string;
  pageCount?: number;
  /** Server can build a PDF from images, Word/ODT/RTF, or plain text (see convert-to-pdf). */
  canConvertToPdf?: boolean;
};
