/**
 * Use the **legacy** pdf.js bundle so `Map`/`WeakMap` helpers like
 * `getOrInsertComputed` are polyfilled — the default build targets very new
 * runtimes only and throws in older embedded browsers (e.g. some automation
 * WebViews) with: "getOrInsertComputed is not a function".
 */
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

let workerConfigured = false;

/** Call before any pdf.js APIs (getDocument, etc.). Safe to call multiple times. */
export function ensurePdfJsWorker(): void {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  workerConfigured = true;
}

/**
 * pdf.js 5.x needs CMap, standard font, and WASM base URLs when loading from
 * raw bytes; omitting them can throw in the worker ("… not initialized, see useWorkerFetch").
 * These paths match the published npm package (same version as pdfjsLib).
 */
export function getPdfDocumentParams(data: Uint8Array) {
  const v = pdfjsLib.version;
  const base = `https://unpkg.com/pdfjs-dist@${v}/`;
  return {
    data,
    useSystemFonts: true,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
  };
}

export { pdfjsLib };
