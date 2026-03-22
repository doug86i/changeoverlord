import path from "node:path";

/**
 * True if the buffer’s leading bytes match common formats we accept for rider attachments.
 * Plain text types (.txt, .md, .csv) are not magic-checked (any UTF-8 is valid).
 * Extensions added via `RIDER_EXTRA_EXTENSIONS` skip magic (opaque / desk files).
 */
export function riderBufferMatchesMagic(
  buf: Buffer,
  filename: string | undefined,
  extraExtensions: Set<string>,
): { ok: true } | { ok: false; message: string } {
  if (buf.length < 4) {
    return { ok: false, message: "File is too small to validate" };
  }

  const ext = path.extname(filename || "").toLowerCase();
  if (extraExtensions.has(ext)) {
    return { ok: true };
  }

  const head = buf.subarray(0, Math.min(16, buf.length));

  if (ext === ".pdf") {
    if (!(head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46)) {
      return { ok: false, message: "File does not look like a PDF" };
    }
    return { ok: true };
  }

  if (ext === ".jpg" || ext === ".jpeg") {
    if (!(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)) {
      return { ok: false, message: "File does not look like a JPEG image" };
    }
    return { ok: true };
  }

  if (ext === ".png") {
    if (
      head[0] !== 0x89 ||
      head[1] !== 0x50 ||
      head[2] !== 0x4e ||
      head[3] !== 0x47
    ) {
      return { ok: false, message: "File does not look like a PNG image" };
    }
    return { ok: true };
  }

  if (ext === ".gif") {
    const g = head.subarray(0, 6).toString("ascii");
    if (!g.startsWith("GIF87a") && !g.startsWith("GIF89a")) {
      return { ok: false, message: "File does not look like a GIF image" };
    }
    return { ok: true };
  }

  if (ext === ".webp") {
    if (
      buf.length < 12 ||
      head.toString("ascii", 0, 4) !== "RIFF" ||
      buf.subarray(8, 12).toString("ascii") !== "WEBP"
    ) {
      return { ok: false, message: "File does not look like a WebP image" };
    }
    return { ok: true };
  }

  if (ext === ".tif" || ext === ".tiff") {
    const le = head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0x00;
    const be = head[0] === 0x4d && head[1] === 0x4d && head[2] === 0x00 && head[3] === 0x2a;
    if (!le && !be) {
      return { ok: false, message: "File does not look like a TIFF image" };
    }
    return { ok: true };
  }

  if (ext === ".heic" || ext === ".heif") {
    if (buf.length < 12) return { ok: false, message: "File is too small" };
    const brand = buf.subarray(4, 12);
    const s = brand.toString("ascii");
    if (!s.includes("heic") && !s.includes("mif1") && !s.includes("msf1")) {
      return { ok: false, message: "File does not look like HEIC/HEIF" };
    }
    return { ok: true };
  }

  if (ext === ".docx" || ext === ".odt") {
    if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) {
      return { ok: false, message: "File does not look like a ZIP-based Office document" };
    }
    return { ok: true };
  }

  if (ext === ".doc") {
    if (
      !(
        head[0] === 0xd0 &&
        head[1] === 0xcf &&
        head[2] === 0x11 &&
        head[3] === 0xe0
      )
    ) {
      return { ok: false, message: "File does not look like a legacy Word document" };
    }
    return { ok: true };
  }

  if (ext === ".rtf") {
    const t = buf.subarray(0, Math.min(20, buf.length)).toString("ascii").trimStart();
    if (!t.toLowerCase().startsWith("{\\rtf")) {
      return { ok: false, message: "File does not look like RTF" };
    }
    return { ok: true };
  }

  if (ext === ".txt" || ext === ".md" || ext === ".csv") {
    return { ok: true };
  }

  return { ok: true };
}
