import { FileAttachments } from "./FileAttachments";

/** Per-performance file list + upload — same UI as the performance **Files** route. */
export function PerformanceFilesPanel({
  performanceId,
  stageId,
  title = "Performance files",
  collapsedByDefault = false,
  className,
}: {
  performanceId: string;
  stageId: string;
  title?: string;
  /** When true, header shows **Show (n)** / **Collapse** (e.g. clock / compact layouts). */
  collapsedByDefault?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <FileAttachments
        scope={{ kind: "performance", performanceId, stageId }}
        title={title}
        collapsedByDefault={collapsedByDefault}
      />
    </div>
  );
}
