import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { apiSend } from "../api/client";
import type { EventRow } from "../api/types";

export function ExportEventButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [downloading, setDownloading] = useState(false);

  const handleExport = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/v1/events/${eventId}/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${eventName.replace(/[^a-zA-Z0-9_-]/g, "_")}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button type="button" onClick={handleExport} disabled={downloading}>
      {downloading ? "Exporting…" : "Export event"}
    </button>
  );
}

export function ImportEventButton() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const data = JSON.parse(text);
      return apiSend<{ event: EventRow }>("/api/v1/import", "POST", data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={importMut.isPending}>
        {importMut.isPending ? "Importing…" : "Import event"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) importMut.mutate(f);
        }}
      />
      {importMut.isError && (
        <span style={{ color: "var(--color-danger)", fontSize: "0.85rem", marginLeft: "0.5rem" }}>
          {(importMut.error as Error).message}
        </span>
      )}
    </>
  );
}
