import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) btnRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={title}
      className="confirm-overlay"
      onClick={onCancel}
    >
      <div className="card confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="title-bar" style={{ marginBottom: "0.5rem" }}>
          {title}
        </div>
        <p style={{ margin: "0.5rem 0 1rem" }}>{message}</p>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            ref={btnRef}
            type="button"
            className={danger ? "primary" : ""}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
