import type { CellMatrix, Sheet } from "@fortune-sheet/core";

function emptyMatrix(rows: number, cols: number): CellMatrix {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  );
}

/** Empty FortuneSheet shell (two blank tabs) for "Create blank template". */
export function createDefaultPatchWorkbookSheets(): Sheet[] {
  const rows = 36;
  const cols = 18;
  return [
    {
      id: "patch-sheet-input",
      name: "Input",
      status: 1,
      row: rows,
      column: cols,
      order: 0,
      data: emptyMatrix(rows, cols),
      calcChain: [],
    },
    {
      id: "patch-sheet-rf",
      name: "RF",
      status: 0,
      row: rows,
      column: cols,
      order: 1,
      data: emptyMatrix(rows, cols),
      calcChain: [],
    },
  ];
}
