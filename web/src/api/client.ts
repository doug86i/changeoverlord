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
    throw new Error(text || r.statusText);
  }
  return r.json() as Promise<T>;
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
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return undefined as T;
  if (!r.ok) {
    redirectToLoginIfNeeded(path, r.status);
    const text = await r.text();
    throw new Error(text || r.statusText);
  }
  return r.json() as Promise<T>;
}
