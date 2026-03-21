import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { patchTemplates } from "../db/schema.js";
import { buildExamplePatchTemplateSheets } from "./patch-template-presets.js";
import { encodeTemplateSnapshotFromSheets } from "./yjs-template-snapshot.js";
import { sheetsToExcelBuffer } from "./sheets-to-excel.js";
import { getUploadsDir } from "./uploads-dir.js";

const BUNDLED_ORIGINAL_NAME = "bundled-dh-example.xlsx";
const BUNDLED_DISPLAY_NAME = "DH Pick & Patch (example)";

/** Inserts the shipped example template once per database (DH-style layout from presets). */
export async function seedBundledExamplePatchTemplateIfMissing(): Promise<void> {
  const [existing] = await db
    .select({ id: patchTemplates.id })
    .from(patchTemplates)
    .where(eq(patchTemplates.originalName, BUNDLED_ORIGINAL_NAME))
    .limit(1);
  if (existing) return;

  const sheets = buildExamplePatchTemplateSheets();
  const snapshot = encodeTemplateSnapshotFromSheets(sheets);
  const buf = await sheetsToExcelBuffer(sheets);
  const uploadsRoot = getUploadsDir();
  const storageKey = `patch-templates/${randomUUID()}.xlsx`;
  const abs = path.join(uploadsRoot, storageKey);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);

  await db.insert(patchTemplates).values({
    name: BUNDLED_DISPLAY_NAME,
    originalName: BUNDLED_ORIGINAL_NAME,
    storageKey,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    byteSize: buf.length,
    snapshot,
  });
}
