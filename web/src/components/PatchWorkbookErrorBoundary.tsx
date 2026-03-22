import { Component, type ReactNode } from "react";
import { isClientDebugLoggingEnabled, logDebug } from "../lib/debug";

function technicalDetails(err: Error): string {
  const stack = err.stack?.trim();
  if (stack) return stack;
  return err.message || String(err);
}

export class PatchWorkbookErrorBoundary extends Component<
  { children: ReactNode },
  { err: Error | null }
> {
  state: { err: Error | null } = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  componentDidCatch(err: Error) {
    logDebug("patch-workbook", "FortuneSheet render error", err);
  }

  render() {
    if (this.state.err) {
      const err = this.state.err;
      const showCopy = isClientDebugLoggingEnabled;
      return (
        <div role="alert" style={{ maxWidth: 560 }}>
          <p style={{ fontWeight: 600 }}>Something went wrong</p>
          <p className="muted" style={{ marginTop: "0.35rem" }}>
            The workbook could not be displayed. Try reloading the page or opening
            another band.
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="primary"
              onClick={() => this.setState({ err: null })}
            >
              Try again
            </button>
          </p>
          {showCopy && (
            <p style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="icon-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(technicalDetails(err));
                  } catch {
                    window.prompt("Copy technical details:", technicalDetails(err));
                  }
                }}
              >
                Copy technical details
              </button>
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
