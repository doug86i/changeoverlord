import { useEffect, useRef } from "react";

const SHORTCUTS = [
  { key: "/", desc: "Search" },
  { key: "?", desc: "Show keyboard shortcuts" },
  { key: "g e", desc: "Go to Events" },
  { key: "g d", desc: "Go to Event dashboard" },
  { key: "g m", desc: "My stage today" },
  { key: "g c", desc: "Go to Clock" },
  { key: "g s", desc: "Go to Settings" },
];

export function KeyboardShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="card" style={{ maxWidth: 400, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>Keyboard shortcuts</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {SHORTCUTS.map(({ key, desc }) => (
              <tr key={key}>
                <td style={{ padding: "0.35rem 0.5rem" }}>
                  <kbd style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0.15rem 0.5rem",
                    fontFamily: "inherit",
                    fontSize: "0.85rem",
                  }}>
                    {key}
                  </kbd>
                </td>
                <td style={{ padding: "0.35rem 0.5rem" }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: "right", marginTop: "0.75rem" }}>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function useGlobalShortcuts({
  onSearch,
  onHelp,
  navigate,
  onMyStageToday,
  onClockNavigate,
}: {
  onSearch: () => void;
  onHelp: () => void;
  navigate: (path: string) => void;
  onMyStageToday?: () => void | Promise<void>;
  /** When set (e.g. last-viewed stage day), `g c` uses this instead of `/dashboard`. */
  onClockNavigate?: () => void;
}) {
  const gPendingRef = useRef(false);
  const gTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onSearch();
        return;
      }
      if ((e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        onSearch();
        return;
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        onHelp();
        return;
      }
      if (gPendingRef.current) {
        gPendingRef.current = false;
        clearTimeout(gTimeoutRef.current);
        gTimeoutRef.current = undefined;
        if (e.key === "e") { navigate("/"); return; }
        if (e.key === "d") { navigate("/dashboard"); return; }
        if (e.key === "m" && onMyStageToday) {
          e.preventDefault();
          void onMyStageToday();
          return;
        }
        if (e.key === "c") {
          if (onClockNavigate) onClockNavigate();
          else navigate("/dashboard");
          return;
        }
        if (e.key === "s") { navigate("/settings"); return; }
        return;
      }
      if (e.key === "g" && !e.ctrlKey && !e.metaKey) {
        gPendingRef.current = true;
        clearTimeout(gTimeoutRef.current);
        gTimeoutRef.current = setTimeout(() => {
          gPendingRef.current = false;
          gTimeoutRef.current = undefined;
        }, 1000);
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      clearTimeout(gTimeoutRef.current);
      gTimeoutRef.current = undefined;
    };
  }, [onSearch, onHelp, navigate, onMyStageToday, onClockNavigate]);
}
