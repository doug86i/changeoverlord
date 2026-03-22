import { Component, type ReactNode } from "react";
import { isClientDebugLoggingEnabled } from "../lib/debug";

function technicalDetails(err: Error): string {
  const stack = err.stack?.trim();
  if (stack) return stack;
  return err.message || String(err);
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { err: Error | null }
> {
  state: { err: Error | null } = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  render() {
    if (this.state.err) {
      const err = this.state.err;
      const showCopy = isClientDebugLoggingEnabled;
      return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            An unexpected error occurred. You can try reloading the page.
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          {showCopy && (
            <p style={{ marginTop: "1rem" }}>
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
