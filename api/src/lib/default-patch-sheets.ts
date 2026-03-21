import type { Sheet } from "@fortune-sheet/core";

/**
 * Empty FortuneSheet shell (two blank tabs, no cell data).
 * Keep in sync with any client-side workbook seed expectations (see **`patchWorkbookSeed`**).
 */
export function createDefaultPatchWorkbookSheets(): Sheet[] {
  return [
    {
      id: "patch-sheet-input",
      name: "Input",
      status: 1,
      row: 36,
      column: 18,
      order: 0,
    },
    {
      id: "patch-sheet-rf",
      name: "RF",
      status: 0,
      row: 36,
      column: 18,
      order: 1,
    },
  ];
}
