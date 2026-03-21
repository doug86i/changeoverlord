import { randomUUID } from "node:crypto";
import type { Cell, CellMatrix, Sheet } from "@fortune-sheet/core";

function header(text: string): Cell {
  return { v: text, bl: 1 };
}

function emptyMatrix(rows: number, cols: number): CellMatrix {
  const data: CellMatrix = [];
  for (let r = 0; r < rows; r++) {
    const row: (Cell | null)[] = [];
    for (let c = 0; c < cols; c++) row.push(null);
    data.push(row);
  }
  return data;
}

function fillHeaderRow(data: CellMatrix, headers: string[]): void {
  for (let c = 0; c < headers.length && c < (data[0]?.length ?? 0); c++) {
    data[0][c] = header(headers[c]);
  }
}

function baseSheet(
  name: string,
  order: number,
  rows: number,
  cols: number,
  headers: string[],
): Sheet {
  const data = emptyMatrix(rows, cols);
  fillHeaderRow(data, headers);
  return {
    id: randomUUID(),
    name,
    status: order === 0 ? 1 : 0,
    row: rows,
    column: cols,
    data,
    order,
  };
}

/** Minimal two-tab workbook to edit entirely inside Changeoverlord (no Excel upload). */
export function buildBlankPatchTemplateSheets(): Sheet[] {
  return [
    baseSheet("Input", 0, 40, 10, [
      "Ch",
      "Source",
      "Destination",
      "Stand",
      "Notes",
    ]),
    baseSheet("RF", 1, 36, 8, [
      "Ch",
      "Band / act",
      "Mic",
      "Freq / group",
      "Notes",
    ]),
  ];
}

/**
 * DH-style festival patch layout (inspired by the DH Pick & Patch workbook):
 * channel list, mic/DI inventory, RF, and stage-box routing — simplified, no images/tables.
 */
export function buildExamplePatchTemplateSheets(): Sheet[] {
  return [
    baseSheet("Channel List", 0, 48, 12, [
      "Ch",
      "Band / act",
      "Source",
      "Mic or DI",
      "Stand",
      "Destination",
      "FOH",
      "Mon",
      "Notes",
    ]),
    baseSheet("Mic & DI list", 1, 40, 4, ["Item", "Qty", "Location", "Notes"]),
    baseSheet("RF", 2, 40, 8, [
      "Ch",
      "Band / act",
      "Mic",
      "Frequency",
      "Group",
      "Coord",
      "Notes",
    ]),
    baseSheet("Stage box patch", 3, 40, 6, [
      "From",
      "To",
      "Socket / circuit",
      "Label",
      "Notes",
    ]),
  ];
}
