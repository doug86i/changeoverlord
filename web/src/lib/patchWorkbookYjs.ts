import { useEffect, useLayoutEffect, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";
import { flushSync } from "react-dom";
import type { Op, Sheet } from "@fortune-sheet/core";
import type { WorkbookInstance } from "@fortune-sheet/react";
import type { Transaction, YArrayEvent } from "yjs";
import type * as Y from "yjs";
import { logDebug } from "./debug";

/** Must match `ydoc.transact(..., origin)` in onOp handlers for patch/template workbooks. */
export const PATCH_WORKBOOK_Y_ORIGIN = "fortune-local";

type FortuneBatchCall = { name: string; args: unknown[] };

/**
 * `applyOp` / Immer patches do not clear FortuneSheet’s `formulaCellInfoMap`. If that map was built
 * from the placeholder sheet (or is otherwise stale), `execFunctionGroup` uses wrong edges and
 * dependent formulas do not refresh when you edit inputs. `jfrefreshgrid` runs `runExecFunction`,
 * which rebuilds `setFormulaCellInfo` for the range and re-runs `execFunctionGroup` (see upstream
 * `@fortune-sheet/core` `jfrefreshgrid` / `runExecFunction`).
 */
function fullDataRange(sheet: Sheet): { row: [number, number]; column: [number, number] } {
  const data = sheet.data;
  const rowMax = Math.max(0, (data?.length ?? 1) - 1);
  const colMax = Math.max(0, ((data?.[0] as unknown[] | null | undefined)?.length ?? 1) - 1);
  return { row: [0, rowMax], column: [0, colMax] };
}

/**
 * After Yjs `applyOp` batches: rebuild per-sheet formula dependency info, then full `calculateFormula`
 * passes (twice for cross-sheet ordering, matching prior behaviour).
 *
 * Suppresses `onOp` so recalc does not append huge op batches to Yjs. Clears suppression after two
 * animation frames so nested FortuneSheet updates finish before local ops resume.
 */
/** After `luckysheetfile` replace, `currentSheetId` can still point at the mount placeholder until a tab activates. */
function activateFirstCoherentSheet(wb: WorkbookInstance): void {
  const sheets = wb.getAllSheets() as Sheet[];
  const valid = sheets.filter(
    (s) => s.id != null && String(s.id).trim() !== "",
  );
  if (valid.length === 0) return;
  const pick =
    valid.find((s) => s.status === 1) ??
    [...valid].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
  if (!pick?.id) return;
  flushSync(() => {
    wb.batchCallApis([{ name: "activateSheet", args: [{ id: pick.id }] }]);
  });
}

function flushWorkbookFormulaRecalc(
  wb: WorkbookInstance,
  suppressYjsOpsRef?: MutableRefObject<boolean>,
): void {
  if (suppressYjsOpsRef) suppressYjsOpsRef.current = true;
  try {
    activateFirstCoherentSheet(wb);
    const sheets = wb.getAllSheets() as Sheet[];
    for (const sheet of sheets) {
      const sheetId = sheet.id;
      if (sheetId == null || sheetId === "") continue;
      const range = [fullDataRange(sheet)];
      // FortuneSheet `getSheet` / `activateSheet` use `options.id`, not `sheetId`.
      const calls: FortuneBatchCall[] = [
        { name: "activateSheet", args: [{ id: sheetId }] },
        { name: "jfrefreshgrid", args: [null, range] },
      ];
      flushSync(() => {
        wb.batchCallApis(calls);
      });
    }
    flushSync(() => {
      wb.calculateFormula();
    });
    flushSync(() => {
      wb.calculateFormula();
    });
  } finally {
    if (suppressYjsOpsRef) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          suppressYjsOpsRef.current = false;
        });
      });
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
  /** Bumps on each hydration layout effect so stale async `run()` cannot set `hydratedRef`. */
  const hydrationRunIdRef = useRef(0);
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

    const runId = ++hydrationRunIdRef.current;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 120;

    const run = async () => {
      if (cancelled || runId !== hydrationRunIdRef.current) return;
      const wb = wbRef.current;
      if (!wb) {
        if (attempts++ < maxAttempts) requestAnimationFrame(() => void run());
        return;
      }
      // Drain by index so batches appended while we replay (e.g. remote edits) are not skipped.
      // A one-shot `toArray()` misses tail inserts that occurred mid-replay while `hydratedRef` is false.
      let i = 0;
      while (i < yops.length) {
        if (cancelled || runId !== hydrationRunIdRef.current) return;
        const item = yops.get(i);
        i += 1;
        try {
          const ops = JSON.parse(item) as Op[];
          wb.applyOp(ops);
        } catch (e) {
          logDebug("patch-workbook-yjs", `opLog replay batch ${i - 1} failed`, e);
        }
        // One animation frame per Yjs batch so Immer / FortuneSheet can commit before the next applyOp.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }
      if (cancelled || runId !== hydrationRunIdRef.current) return;
      // Let one frame elapse so `applyOp` commits before recalc touches formula maps / current sheet.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      if (cancelled || runId !== hydrationRunIdRef.current) return;
      const wbRecalc = wbRef.current;
      if (!wbRecalc) return;
      try {
        flushWorkbookFormulaRecalc(wbRecalc, suppressYjsOpsRef);
      } catch (e) {
        logDebug("patch-workbook-yjs", "post-hydrate formula recalc failed", e);
      }
      // Only mark hydrated after recalc so `yops.observe` and user input do not interleave with a stale `currentSheetId`.
      if (!cancelled && runId === hydrationRunIdRef.current) {
        hydratedRef.current = true;
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [synced, roomId, yops, canShowWorkbook, wbRef, suppressYjsOpsRef]);
}
