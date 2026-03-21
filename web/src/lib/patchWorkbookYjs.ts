import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Op } from "@fortune-sheet/core";
import type { WorkbookInstance } from "@fortune-sheet/react";
import type { Transaction, YArrayEvent } from "yjs";
import type * as Y from "yjs";
import { logDebug } from "./debug";

/** Must match `ydoc.transact(..., origin)` in onOp handlers for patch/template workbooks. */
export const PATCH_WORKBOOK_Y_ORIGIN = "fortune-local";

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
): void {
  const hydratedRef = useRef(false);

  useEffect(() => {
    hydratedRef.current = false;
  }, [roomId]);

  // React Strict Mode (and leaving the route) unmounts then remounts with the same roomId.
  // hydratedRef would otherwise stay true → replay is skipped → FortuneSheet remounts empty.
  useEffect(() => {
    return () => {
      hydratedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handler = (event: YArrayEvent<string>, transaction: Transaction) => {
      if (!hydratedRef.current) return;
      if (transaction.origin === PATCH_WORKBOOK_Y_ORIGIN) return;
      for (const d of event.changes.delta) {
        if (d.insert === undefined) continue;
        const inserts = Array.isArray(d.insert) ? d.insert : [d.insert];
        for (const item of inserts) {
          if (typeof item !== "string") continue;
          try {
            const ops = JSON.parse(item) as Op[];
            wbRef.current?.applyOp(ops);
          } catch {
            /* ignore bad remote payload */
          }
        }
      }
    };
    yops.observe(handler);
    return () => {
      yops.unobserve(handler);
    };
  }, [yops, wbRef]);

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
      if (!cancelled) hydratedRef.current = true;
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [synced, roomId, yops, canShowWorkbook, wbRef]);
}
