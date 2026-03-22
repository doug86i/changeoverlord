import { Component, type ErrorInfo, type ReactNode } from "react";
import { logDebug } from "../lib/debug";
import { FORTUNE_SHEET_PACKAGE_VERSION } from "../lib/fortuneSheetVersion";

export type PatchWorkbookCollabDebug = {
  conn?: string;
  synced?: boolean;
  workbookHydrated?: boolean;
  workbookReplayError?: string | null;
};

function buildDiagnosticText(
  err: Error,
  componentStack: string | null,
  extras: {
    roomId?: string;
    collabDebug?: PatchWorkbookCollabDebug;
  },
): string {
  const lines: string[] = [];
  lines.push(`message: ${err.message || String(err)}`);
  if (err.stack?.trim()) lines.push(`stack:\n${err.stack.trim()}`);
  if (componentStack?.trim()) {
    lines.push(`componentStack:\n${componentStack.trim()}`);
  }
  if (extras.roomId) lines.push(`roomId: ${extras.roomId}`);
  const c = extras.collabDebug;
  if (c) {
    if (c.conn != null) lines.push(`collab.conn: ${c.conn}`);
    if (c.synced != null) lines.push(`collab.synced: ${String(c.synced)}`);
    if (c.workbookHydrated != null) {
      lines.push(`collab.workbookHydrated: ${String(c.workbookHydrated)}`);
    }
    if (c.workbookReplayError) {
      lines.push(`collab.workbookReplayError: ${c.workbookReplayError}`);
    }
  }
  lines.push(`viteMode: ${import.meta.env.MODE}`);
  lines.push(`fortuneSheet: @fortune-sheet/*@${FORTUNE_SHEET_PACKAGE_VERSION}`);
  lines.push(`userAgent: ${typeof navigator !== "undefined" ? navigator.userAgent : "n/a"}`);
  lines.push(`at: ${new Date().toISOString()}`);
  if (err.message.includes("Cannot apply patch")) {
    lines.push(
      "note: Immer patch path (e.g. data/row/col) targets a cell matrix slot; see docs/DECISIONS.md (FortuneSheet collab bootstrap).",
    );
  }
  return lines.join("\n\n");
}

export class PatchWorkbookErrorBoundary extends Component<
  {
    children: ReactNode;
    roomId?: string;
    collabDebug?: PatchWorkbookCollabDebug;
  },
  { err: Error | null; componentStack: string | null }
> {
  state: { err: Error | null; componentStack: string | null } = {
    err: null,
    componentStack: null,
  };

  static getDerivedStateFromError(err: Error) {
    return { err, componentStack: null as string | null };
  }

  componentDidCatch(err: Error, errorInfo: ErrorInfo) {
    logDebug("patch-workbook", "FortuneSheet render error", err);
    this.setState({ componentStack: errorInfo.componentStack ?? null });
  }

  render() {
    if (this.state.err) {
      const err = this.state.err;
      const diagnostic = buildDiagnosticText(err, this.state.componentStack, {
        roomId: this.props.roomId,
        collabDebug: this.props.collabDebug,
      });
      return (
        <div role="alert" style={{ maxWidth: 560 }}>
          <p style={{ fontWeight: 600 }}>Something went wrong</p>
          <p className="muted" style={{ marginTop: "0.35rem" }}>
            The workbook could not be displayed. Try reloading the page, opening another band, or
            leaving this template editor and returning.
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="primary"
              onClick={() => this.setState({ err: null, componentStack: null })}
            >
              Try again
            </button>
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="icon-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(diagnostic);
                } catch {
                  window.prompt("Copy technical details:", diagnostic);
                }
              }}
            >
              Copy technical details
            </button>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
