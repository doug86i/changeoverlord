import type { Sheet } from "@fortune-sheet/core";

const base = "";

function redirectToLoginIfNeeded(path: string, status: number) {
  if (status !== 401) return;
  if (path.includes("/auth/")) return;
  const here = window.location.pathname + window.location.search;
  if (window.location.pathname === "/login") return;
  window.location.href = `/login?returnTo=${encodeURIComponent(here)}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) {
    redirectToLoginIfNeeded(path, r.status);
    const text = await r.text();
    let msg = text || r.statusText;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (typeof j.message === "string" && j.message) msg = j.message;
    } catch {
      /* not JSON */
    }
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

/**
 * Load `sheets` from a workbook JSON export (`GET …/sheets-export`) for FortuneSheet bootstrap.
 * **404** → `null` (use placeholder + Yjs replay). Other errors throw (same handling as `apiGet`).
 */
export async function fetchPatchWorkbookBootstrapSheets(
  path: string,
): Promise<Sheet[] | null> {
  const r = await fetch(`${base}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (r.status === 404) return null;
  if (!r.ok) {
    redirectToLoginIfNeeded(path, r.status);
    const text = await r.text();
    let msg = text || r.statusText;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (typeof j.message === "string" && j.message) msg = j.message;
    } catch {
      /* not JSON */
    }
    throw new Error(msg);
  }
  const j = (await r.json()) as { sheets?: unknown };
  const sheets = j.sheets;
  if (!Array.isArray(sheets) || sheets.length === 0) return null;
  return sheets as Sheet[];
}

export async function apiSend<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return undefined as T;
  if (!r.ok) {
    redirectToLoginIfNeeded(path, r.status);
    const text = await r.text();
    let msg = text || r.statusText;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (typeof j.message === "string" && j.message) msg = j.message;
    } catch {
      /* not JSON */
    }
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

/** Read a browser `File` as UTF-8 text (e.g. JSON import). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsText(file);
  });
}

/** Download JSON workbook export (session cookie). Uses `Content-Disposition` filename when present. */
export async function downloadWorkbookJson(
  path: string,
  filenameFallback: string,
): Promise<void> {
  const r = await fetch(`${base}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) {
    redirectToLoginIfNeeded(path, r.status);
    const text = await r.text();
    let msg = text || r.statusText;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (typeof j.message === "string" && j.message) msg = j.message;
    } catch {
      /* not JSON */
    }
    throw new Error(msg);
  }
  const cd = r.headers.get("Content-Disposition");
  let filename = filenameFallback;
  const m = cd?.match(/filename="([^"]+)"/);
  if (m?.[1]) filename = m[1];
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Defer revoke so the browser can start the download before the blob URL is torn down.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function apiSendForm<T>(
  path: string,
  method: string,
  form: FormData,
): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    method,
    credentials: "include",
    headers: { Accept: "application/json" },
    body: form,
  });
  if (r.status === 204) return undefined as T;
  if (!r.ok) {
    redirectToLoginIfNeeded(path, r.status);
    const text = await r.text();
    throw new Error(text || r.statusText);
  }
  return r.json() as Promise<T>;
}
