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

/** Compact, non-secret summary of an `Op[]` batch for logs when replay fails. */
function summarizeOpsForDebug(ops: Op[]): { count: number; head: string } {
  const count = ops?.length ?? 0;
  if (count === 0) return { count: 0, head: "empty" };
  const bits = ops.slice(0, 4).map((raw) => {
    const o = raw as Record<string, unknown>;
    if (typeof o.op === "string") return o.op;
    const path = o.path;
    if (Array.isArray(path) && path.length > 0) {
      return `path:${path.slice(0, 5).join("/")}`;
    }
    if (typeof o.t === "string") return o.t;
    return "?";
  });
  return { count, head: bits.join("|") };
}

type FortuneBatchCall = { name: string; args: unknown[] };

/**
 * `applyOp` / Immer patches do not clear FortuneSheet’s `formulaCellInfoMap`. If that map was built
 * from the placeholder sheet (or is otherwise stale), `execFunctionGroup` uses wrong edges and
 * dependent formulas do not refresh when you edit inputs. Upstream exposes **`jfrefreshgrid`** as a
 * **named export** from **`@fortune-sheet/core`**, but **`Workbook.batchCallApis`** only forwards to
 * the frozen **`api`** object — **`jfrefreshgrid` is not on `api`**, so calling it by name logged
 * *API jfrefreshgrid does not exist* and did nothing. We use **`api.calculateFormula`** per sheet
 * (via **`batchCallApis`**) plus global **`calculateFormula()`** to refresh values and function
 * groups after collab batches.
 */
function fullDataRange(sheet: Sheet): { row: [number, number]; column: [number, number] } {
  const data = sheet.data;
  const rowLen = Array.isArray(data) ? data.length : 0;
  const rowMax = Math.max(0, (rowLen > 0 ? rowLen : 1) - 1);
  const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
  const colLen = Array.isArray(first) ? first.length : 0;
  const colMax = Math.max(0, (colLen > 0 ? colLen : 1) - 1);
  if (!Number.isFinite(rowMax) || !Number.isFinite(colMax)) {
    return { row: [0, 0], column: [0, 0] };
  }
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

function getActiveSheetId(wb: WorkbookInstance): string | undefined {
  const sheets = wb.getAllSheets() as Sheet[];
  const active = sheets.find((s) => s.status === 1);
  if (active?.id == null || String(active.id).trim() === "") return undefined;
  return String(active.id);
}

function sheetIdExists(wb: WorkbookInstance, id: string): boolean {
  return (wb.getAllSheets() as Sheet[]).some(
    (s) => s.id != null && String(s.id) === id,
  );
}

/**
 * Rebuild formula maps / recalc across sheets. Must temporarily `activateSheet` each sheet; without
 * restoring the prior active sheet, everyone ends up on the **last** sheet (especially bad when
 * remote Yjs ops trigger recalc after e.g. adding a tab).
 */
function flushWorkbookFormulaRecalc(
  wb: WorkbookInstance,
  suppressYjsOpsRef?: MutableRefObject<boolean>,
  options?: {
    preserveActiveSheet?: boolean;
    /** When true, skip recalc (e.g. Immer replay aborted — workbook context may be inconsistent). */
    skipIfBroken?: MutableRefObject<boolean>;
  },
): void {
  if (options?.skipIfBroken?.current) return;
  const preserve = options?.preserveActiveSheet === true;
  if (suppressYjsOpsRef) suppressYjsOpsRef.current = true;
  try {
    try {
      if (!preserve) {
        activateFirstCoherentSheet(wb);
      }
      const savedActiveId = getActiveSheetId(wb);

      const sheets = wb.getAllSheets() as Sheet[];
      for (const sheet of sheets) {
        const sheetId = sheet.id;
        if (sheetId == null || sheetId === "") continue;
        try {
          const range = fullDataRange(sheet);
          const calls: FortuneBatchCall[] = [
            { name: "activateSheet", args: [{ id: sheetId }] },
            { name: "calculateFormula", args: [sheetId, range] },
          ];
          flushSync(() => {
            wb.batchCallApis(calls);
          });
        } catch (e) {
          logDebug(
            "patch-workbook-yjs",
            "per-sheet calculateFormula / activateSheet skipped for sheet",
            { sheetId },
            e,
          );
        }
      }
      try {
        flushSync(() => {
          wb.calculateFormula();
        });
        flushSync(() => {
          wb.calculateFormula();
        });
      } catch (e) {
        logDebug("patch-workbook-yjs", "calculateFormula failed during collab recalc", e);
      }

      if (savedActiveId && sheetIdExists(wb, savedActiveId)) {
        const currentSheets = wb.getAllSheets() as Sheet[];
        const activeSheet = currentSheets.find(
          (s) => s.id != null && String(s.id) === savedActiveId,
        );
        const restoreId = activeSheet?.id;
        if (restoreId != null && restoreId !== "") {
          try {
            flushSync(() => {
              wb.batchCallApis([{ name: "activateSheet", args: [{ id: restoreId }] }]);
            });
          } catch (e) {
            logDebug("patch-workbook-yjs", "restore active sheet failed", e);
          }
        }
      }
    } catch (e) {
      logDebug("patch-workbook-yjs", "flushWorkbookFormulaRecalc failed", e);
    }
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
 * Drain `opLog` entries onto the FortuneSheet instance. After an apparent catch-up we wait
 * extra animation frames so late Yjs merges (e.g. server `bindState` DB snapshot applied after
 * the first empty sync) are not missed — `yops.observe` ignores remote ops until `hydratedRef`.
 */
export type OpLogDrainResult = {
  /** Next index to apply (equals `yops.length` when fully caught up). */
  index: number;
  /** Immer / `applyOp` failed — caller must not treat the workbook as hydrated. */
  aborted: boolean;
  abortBatchIndex?: number;
  abortMessage?: string;
};

/** Returns next index to apply (equals `yops.length` when fully caught up). */
async function drainOpLogWithQuietFrames(opts: {
  yops: Y.Array<string>;
  wb: WorkbookInstance;
  runId: number;
  hydrationRunIdRef: MutableRefObject<number>;
  cancelled: () => boolean;
  startIndex: number;
  /** Max “idle” rAF cycles with `i === yops.length` before we consider the log quiescent. */
  idleFramesRequired: number;
  /**
   * When the opLog keeps growing (another user editing), strict “N empty rAFs” may never happen.
   * After we reach the tail (`i === yops.length`), if no new ops arrive for this long, treat the
   * log as quiescent anyway; later ops are applied via `yops.observe` after hydration.
   */
  maxQuietWaitMs?: number;
  roomId?: string;
  onApplyOpFailure?: (detail: {
    batchIndex: number;
    message: string;
    opSummary: { count: number; head: string };
  }) => void;
}): Promise<OpLogDrainResult> {
  const {
    yops,
    wb,
    runId,
    hydrationRunIdRef,
    cancelled,
    startIndex,
    idleFramesRequired,
    maxQuietWaitMs = 0,
    roomId,
    onApplyOpFailure,
  } = opts;
  let i = startIndex;
  let idleFrames = 0;
  /** Wall-clock start of “caught up to yops.length” streak (reset whenever new ops arrive). */
  let quietStart: number | null = null;
  while (idleFrames < idleFramesRequired) {
    if (cancelled() || runId !== hydrationRunIdRef.current) {
      return { index: i, aborted: false };
    }
    while (i < yops.length) {
      if (cancelled() || runId !== hydrationRunIdRef.current) {
        return { index: i, aborted: false };
      }
      const item = yops.get(i);
      const batchIndex = i;
      i += 1;
      let ops: Op[] = [];
      try {
        ops = JSON.parse(item) as Op[];
        wb.applyOp(ops);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const opSummary = summarizeOpsForDebug(ops);
        logDebug(
          "patch-workbook-yjs",
          "opLog replay aborted",
          {
            roomId,
            batchIndex,
            message,
            opSummary,
          },
          e,
        );
        onApplyOpFailure?.({ batchIndex, message, opSummary });
        return {
          index: i,
          aborted: true,
          abortBatchIndex: batchIndex,
          abortMessage: message,
        };
      }
      idleFrames = 0;
      quietStart = null;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    if (cancelled() || runId !== hydrationRunIdRef.current) {
      return { index: i, aborted: false };
    }
    if (i < yops.length) {
      idleFrames = 0;
      quietStart = null;
    } else {
      if (quietStart === null) quietStart = Date.now();
      idleFrames += 1;
      if (maxQuietWaitMs > 0 && Date.now() - quietStart >= maxQuietWaitMs) {
        break;
      }
    }
  }
  return { index: i, aborted: false };
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
  /** Fires when FortuneSheet may / may not accept edits (initial replay + late snapshot catch-up). */
  onHydrationChange?: (hydrated: boolean) => void,
  /**
   * Immer / `applyOp` failed during replay or live observe — workbook may be inconsistent; operator
   * should reload or leave the room and return.
   */
  onReplayFailure?: (detail: {
    phase: "hydrate" | "observe";
    message: string;
    batchIndex?: number;
    opSummary?: { count: number; head: string };
  }) => void,
): void {
  const hydratedRef = useRef(false);
  /** Bumps on each hydration layout effect so stale async `run()` cannot set `hydratedRef`. */
  const hydrationRunIdRef = useRef(0);
  /** After a failed `applyOp`, skip further remote applies and formula flush (avoids cascade errors). */
  const replayBrokenRef = useRef(false);
  /** After hydrate/apply failure, do not re-enter the layout replay loop until `roomId` changes. */
  const giveUpHydrationRef = useRef(false);
  /** Coalesce multiple remote Yjs inserts in one frame into a single recalc. */
  const remoteRecalcNeededRef = useRef(false);
  const remoteRecalcRafRef = useRef<number | null>(null);

  useEffect(() => {
    hydratedRef.current = false;
    replayBrokenRef.current = false;
    giveUpHydrationRef.current = false;
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
      if (replayBrokenRef.current) return;
      remoteRecalcNeededRef.current = true;
      if (remoteRecalcRafRef.current != null) return;
      remoteRecalcRafRef.current = requestAnimationFrame(() => {
        remoteRecalcRafRef.current = null;
        if (!remoteRecalcNeededRef.current) return;
        remoteRecalcNeededRef.current = false;
        const wb = wbRef.current;
        if (!wb || replayBrokenRef.current) return;
        // Remote peers apply edits via Immer `applyPatches` only — FortuneSheet does not run
        // `execFunctionGroup` for those mutations, so dependent formulas stay stale until recalc.
        requestAnimationFrame(() => {
          const w = wbRef.current;
          if (!w || replayBrokenRef.current) return;
          try {
            flushWorkbookFormulaRecalc(w, suppressYjsOpsRef, {
              preserveActiveSheet: true,
              skipIfBroken: replayBrokenRef,
            });
          } catch (e) {
            logDebug("patch-workbook-yjs", "remote formula recalc rAF failed", e);
          }
        });
      });
    };

    const handler = (event: YArrayEvent<string>, transaction: Transaction) => {
      if (!hydratedRef.current || replayBrokenRef.current) return;
      if (transaction.origin === PATCH_WORKBOOK_Y_ORIGIN) return;
      let appliedRemote = false;
      // Suppress outbound onOp while applying remote ops. applyOp runs through
      // setContextWithProduce → emitOp → onOp; without suppression, the re-derived
      // patches echo back to Yjs and the other peer applies them again — harmless
      // for idempotent replace ops but creates duplicates for addSheet/deleteSheet.
      // flushSync ensures the React state updater (and onOp) fires synchronously
      // while the suppress flag is still set.
      if (suppressYjsOpsRef) suppressYjsOpsRef.current = true;
      try {
        for (const d of event.changes.delta) {
          if (d.insert === undefined) continue;
          const inserts = Array.isArray(d.insert) ? d.insert : [d.insert];
          for (const item of inserts) {
            if (typeof item !== "string") continue;
            let ops: Op[] = [];
            try {
              ops = JSON.parse(item) as Op[];
              flushSync(() => {
                wbRef.current?.applyOp(ops);
              });
              appliedRemote = true;
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              const opSummary = summarizeOpsForDebug(ops);
              logDebug(
                "patch-workbook-yjs",
                "remote opLog applyOp failed — stopping further remote applies",
                { roomId, message, opSummary },
                e,
              );
              replayBrokenRef.current = true;
              giveUpHydrationRef.current = true;
              hydratedRef.current = false;
              onHydrationChange?.(false);
              onReplayFailure?.({
                phase: "observe",
                message,
                opSummary,
              });
            }
          }
        }
      } finally {
        if (suppressYjsOpsRef) suppressYjsOpsRef.current = false;
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
  }, [yops, wbRef, suppressYjsOpsRef, roomId, onHydrationChange, onReplayFailure]);

  useLayoutEffect(() => {
    if (!roomId) {
      onHydrationChange?.(false);
      return;
    }
    if (!synced || !canShowWorkbook) {
      onHydrationChange?.(false);
      return;
    }
    if (giveUpHydrationRef.current) {
      onHydrationChange?.(false);
      return;
    }
    // Avoid re-applying the full opLog after reconnect (synced toggles) — workbook still holds state.
    if (hydratedRef.current) {
      onHydrationChange?.(true);
      return;
    }

    const runId = ++hydrationRunIdRef.current;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 120;

    onHydrationChange?.(false);

    const run = async () => {
      if (cancelled || runId !== hydrationRunIdRef.current) return;
      const wb = wbRef.current;
      if (!wb) {
        if (attempts++ < maxAttempts) requestAnimationFrame(() => void run());
        return;
      }
      const isCancelled = () => cancelled || runId !== hydrationRunIdRef.current;

      const onApplyOpFailure = (detail: {
        batchIndex: number;
        message: string;
        opSummary: { count: number; head: string };
      }) => {
        replayBrokenRef.current = true;
        giveUpHydrationRef.current = true;
        onReplayFailure?.({
          phase: "hydrate",
          message: detail.message,
          batchIndex: detail.batchIndex,
          opSummary: detail.opSummary,
        });
      };

      // First drain + quiet frames: catches server snapshot applied after an initial empty sync
      // (`api` bindState loads Postgres asynchronously).
      let drain1 = await drainOpLogWithQuietFrames({
        yops,
        wb,
        runId,
        hydrationRunIdRef,
        cancelled: isCancelled,
        startIndex: 0,
        idleFramesRequired: 4,
        maxQuietWaitMs: 900,
        roomId,
        onApplyOpFailure,
      });
      if (isCancelled()) return;
      if (drain1.aborted) {
        onHydrationChange?.(false);
        return;
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      if (isCancelled()) return;

      const wbRecalc = wbRef.current;
      if (!wbRecalc) return;
      if (!replayBrokenRef.current) {
        try {
          flushWorkbookFormulaRecalc(wbRecalc, suppressYjsOpsRef, {
            skipIfBroken: replayBrokenRef,
          });
        } catch (e) {
          logDebug("patch-workbook-yjs", "post-hydrate formula recalc failed", e);
        }
      }

      // Recalc can be slow; drain anything merged during it, then settle again.
      const wbTail = wbRef.current;
      if (!wbTail) return;
      let drain2 = await drainOpLogWithQuietFrames({
        yops,
        wb: wbTail,
        runId,
        hydrationRunIdRef,
        cancelled: isCancelled,
        startIndex: drain1.index,
        idleFramesRequired: 2,
        maxQuietWaitMs: 500,
        roomId,
        onApplyOpFailure,
      });
      if (isCancelled()) return;
      if (drain2.aborted) {
        onHydrationChange?.(false);
        return;
      }

      // Only mark hydrated after replay + recalc + tail drain so `yops.observe` and local `onOp`
      // do not interleave with a stale grid or drop late snapshot batches.
      if (!cancelled && runId === hydrationRunIdRef.current && !replayBrokenRef.current) {
        hydratedRef.current = true;
        onHydrationChange?.(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
      onHydrationChange?.(false);
    };
  }, [
    synced,
    roomId,
    yops,
    canShowWorkbook,
    wbRef,
    suppressYjsOpsRef,
    onHydrationChange,
    onReplayFailure,
  ]);
}
