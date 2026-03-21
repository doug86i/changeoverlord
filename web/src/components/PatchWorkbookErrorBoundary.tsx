import { Component, type ReactNode } from "react";
import { logDebug } from "../lib/debug";

export class PatchWorkbookErrorBoundary extends Component<
  { children: ReactNode },
  { err: Error | null }
> {
  state: { err: Error | null } = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  componentDidCatch(err: Error) {
    logDebug("patch-workbook", "FortuneSheet render error", err.message);
  }

  render() {
    if (this.state.err) {
      return (
        <p role="alert" style={{ maxWidth: 560 }}>
          Workbook failed to render: {this.state.err.message}
        </p>
      );
    }
    return this.props.children;
  }
}
