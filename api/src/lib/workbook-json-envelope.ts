import type { Sheet } from "@fortune-sheet/core";

/** Version for `changeoverlordWorkbook` JSON interchange (templates + performances). */
export const CHANGEOVERLORD_WORKBOOK_JSON_VERSION = 1 as const;

export type WorkbookJsonKind = "patchTemplate" | "performance";

export type WorkbookJsonExportV1 = {
  changeoverlordWorkbook: typeof CHANGEOVERLORD_WORKBOOK_JSON_VERSION;
  exportedAt: string;
  kind: WorkbookJsonKind;
  /** Human label for filenames / agents (template display name or band name). */
  label: string;
  templateId?: string;
  performanceId?: string;
  sheets: Sheet[];
};

export function buildWorkbookJsonExportV1(
  kind: WorkbookJsonKind,
  label: string,
  sheets: Sheet[],
  ids: { templateId?: string; performanceId?: string },
): WorkbookJsonExportV1 {
  return {
    changeoverlordWorkbook: CHANGEOVERLORD_WORKBOOK_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    kind,
    label,
    ...ids,
    sheets,
  };
}

export function safeDownloadBasename(label: string, fallback: string): string {
  const base = (label || fallback).replace(/[^a-zA-Z0-9._-]+/g, "_");
  return base.length > 0 ? base.slice(0, 120) : fallback;
}
