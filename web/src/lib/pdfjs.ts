import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

let workerConfigured = false;

/** Call before any pdf.js APIs (getDocument, etc.). Safe to call multiple times. */
export function ensurePdfJsWorker(): void {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  workerConfigured = true;
}

export { pdfjsLib };
