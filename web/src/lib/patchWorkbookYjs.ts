import { useEffect, useLayoutEffect, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";
import { flushSync } from "react-dom";
import type { Op } from "@fortune-sheet/core";
import type { WorkbookInstance } from "@fortune-sheet/react";
import type { Transaction, YArrayEvent } from "yjs";
import type * as Y from "yjs";
import { logDebug } from "./debug";

/** Must match `ydoc.transact(..., origin)` in onOp handlers for patch/template workbooks. */
export const PATCH_WORKBOOK_Y_ORIGIN = "fortune-local";

/**
 * Full-sheet formula pass (twice for dependency order). Must match post–opLog-replay behaviour.
 * Suppresses `onOp` so recalc does not append large patches to Yjs (see FortuneSheet `setCellValue` paths).
 */
function flushWorkbookFormulaRecalc(
  wb: WorkbookInstance,
  suppressYjsOpsRef?: MutableRefObject<boolean>,
): void {
  if (suppressYjsOpsRef) suppressYjsOpsRef.current = true;
  try {
    flushSync(() => {
      wb.calculateFormula();
    });
    flushSync(() => {
      wb.calculateFormula();
    });
  } finally {
    if (suppressYjsOpsRef) {
      setTimeout(() => {
        suppressYjsOpsRef.current = false;
      }, 0);
    }
  }
}

/**
 * FortuneSheet only receives remote changes via `applyOp`. Yjs may sync the full `opLog`
 * before `<Workbook>` mounts, so `yops.observe` runs while `wbRef.current` is still null and
 * those updates are dropped — empty sheet, “wrong” template, or edits that never appear.
 *
 * After sync + workbook mount, we replay the entire `opLog` once. Remote inserts are ignored
 * until then so we never double-apply the initial batch.
 */
export function usePatchWorkbookOpLogEffects(
  roomId: string | undefined,
  yops: Y.Array<string>,
  wbRef: RefObject<WorkbookInstance | null>,
  synced: boolean,
  canShowWorkbook: boolean,
  /** While true, `onOp` must not push to Yjs — `calculateFormula` would otherwise append huge batches after hydrate. */
  suppressYjsOpsRef?: MutableRefObject<boolean>,
): void {
  const hydratedRef = useRef(false);
  /** Coalesce multiple remote Yjs inserts in one frame into a single recalc. */
  const remoteRecalcNeededRef = useRef(false);
  const remoteRecalcRafRef = useRef<number | null>(null);

  useEffect(() => {
    hydratedRef.current = false;
    remoteRecalcNeededRef.current = false;
    if (remoteRecalcRafRef.current != null) {
      cancelAnimationFrame(remoteRecalcRafRef.current);
      remoteRecalcRafRef.current = null;
    }
  }, [roomId]);

  // React Strict Mode (and leaving the route) unmounts then remounts with the same roomId.
  // hydratedRef would otherwise stay true → replay is skipped → FortuneSheet remounts empty.
  useEffect(() => {
    return () => {
      hydratedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const queueRemoteFormulaRecalc = () => {
      remoteRecalcNeededRef.current = true;
      if (remoteRecalcRafRef.current != null) return;
      remoteRecalcRafRef.current = requestAnimationFrame(() => {
        remoteRecalcRafRef.current = null;
        if (!remoteRecalcNeededRef.current) return;
        remoteRecalcNeededRef.current = false;
        const wb = wbRef.current;
        if (!wb) return;
        // Remote peers apply edits via Immer `applyPatches` only — FortuneSheet does not run
        // `execFunctionGroup` for those mutations, so dependent formulas stay stale until recalc.
        requestAnimationFrame(() => {
          const w = wbRef.current;
          if (!w) return;
          flushWorkbookFormulaRecalc(w, suppressYjsOpsRef);
        });
      });
    };

    const handler = (event: YArrayEvent<string>, transaction: Transaction) => {
      if (!hydratedRef.current) return;
      if (transaction.origin === PATCH_WORKBOOK_Y_ORIGIN) return;
      let appliedRemote = false;
      for (const d of event.changes.delta) {
        if (d.insert === undefined) continue;
        const inserts = Array.isArray(d.insert) ? d.insert : [d.insert];
        for (const item of inserts) {
          if (typeof item !== "string") continue;
          try {
            const ops = JSON.parse(item) as Op[];
            wbRef.current?.applyOp(ops);
            appliedRemote = true;
          } catch {
            /* ignore bad remote payload */
          }
        }
      }
      if (appliedRemote) queueRemoteFormulaRecalc();
    };
    yops.observe(handler);
    return () => {
      yops.unobserve(handler);
      if (remoteRecalcRafRef.current != null) {
        cancelAnimationFrame(remoteRecalcRafRef.current);
        remoteRecalcRafRef.current = null;
      }
      remoteRecalcNeededRef.current = false;
    };
  }, [yops, wbRef, suppressYjsOpsRef]);

  useLayoutEffect(() => {
    if (!synced || !canShowWorkbook || !roomId) return;
    // Avoid re-applying the full opLog after reconnect (synced toggles) — workbook still holds state.
    if (hydratedRef.current) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 120;

    const run = async () => {
      if (cancelled) return;
      const wb = wbRef.current;
      if (!wb) {
        if (attempts++ < maxAttempts) requestAnimationFrame(() => void run());
        return;
      }
      const entries = yops.toArray();
      for (let i = 0; i < entries.length; i++) {
        if (cancelled) return;
        const item = entries[i];
        try {
          const ops = JSON.parse(item) as Op[];
          wb.applyOp(ops);
        } catch (e) {
          logDebug("patch-workbook-yjs", `opLog replay batch ${i} failed`, e);
        }
        // One animation frame per Yjs batch so Immer / FortuneSheet can commit before the next applyOp.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }
      if (!cancelled) {
        hydratedRef.current = true;
        // Cross-sheet formulas often stay stale until the engine runs; replay only applies ops.
        // FortuneSheet emits `onOp` for formula value patches — suppress Yjs so we do not append recalc ops.
        requestAnimationFrame(() => {
          if (cancelled) return;
          const wb = wbRef.current;
          if (!wb) return;
          flushWorkbookFormulaRecalc(wb, suppressYjsOpsRef);
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [synced, roomId, yops, canShowWorkbook, wbRef]);
}
