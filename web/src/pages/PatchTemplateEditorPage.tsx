import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { Workbook } from "@fortune-sheet/react";
import { apiGet } from "../api/client";
import { PatchWorkbookErrorBoundary } from "../components/PatchWorkbookErrorBoundary";
import {
  createDefaultPatchWorkbookSheets,
  usePatchWorkbookCollab,
} from "../lib/patchWorkbookCollab";

export function PatchTemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();

  const tplQ = useQuery({
    queryKey: ["patchTemplate", templateId],
    queryFn: () =>
      apiGet<{ patchTemplate: { id: string; name: string } }>(
        `/api/v1/patch-templates/${templateId}`,
      ),
    enabled: Boolean(templateId),
  });

  const workbookReady = Boolean(templateId && tplQ.isSuccess && tplQ.data);

  const { wbRef, onOp, conn, synced } = usePatchWorkbookCollab({
    roomId: templateId,
    mode: "template",
    workbookReady,
  });

  const initialSheets = useMemo(
    () => createDefaultPatchWorkbookSheets(),
    [templateId],
  );

  if (!templateId) return null;
  if (tplQ.isLoading) return <p className="muted">Loading…</p>;
  if (tplQ.error || !tplQ.data) {
    return <p role="alert">Template not found.</p>;
  }

  const tpl = tplQ.data.patchTemplate;

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        <Link to="/settings">Settings</Link>
        {" · "}
        <span>{tpl.name}</span>
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "0.75rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Edit patch template</h1>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {conn === "error"
            ? "Realtime connection error — check network / login"
            : !synced
              ? "Syncing…"
              : "Live (saved to library)"}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Changes are saved automatically and apply to <strong>new</strong>{" "}
        performances that use this template. Close this tab when done.
      </p>
      <div
        className="patch-workbook-host"
        style={{
          height: "min(70vh, 720px)",
          minHeight: 360,
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
      >
        <PatchWorkbookErrorBoundary key={templateId}>
          <Workbook
            key={templateId}
            ref={wbRef}
            data={initialSheets}
            onOp={onOp}
            showToolbar
            showFormulaBar
            showSheetTabs
          />
        </PatchWorkbookErrorBoundary>
      </div>
    </div>
  );
}
