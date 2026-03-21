/**
 * API base: empty = same-origin (use Next.js rewrite to backend in dev/prod).
 * Or set NEXT_PUBLIC_API_BASE_URL to full backend URL (must configure CORS + cookies).
 *
 * Important: do NOT gate on `typeof process !== "undefined"`. In the browser `process`
 * is often undefined; Next still inlines `process.env.NEXT_PUBLIC_*` at build time, and
 * that branch would wrongly drop the base URL for all fetches.
 */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (raw && String(raw).trim()) {
    return `${String(raw).replace(/\/$/, "")}${p}`;
  }
  return p;
}

export function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
    },
  });
}
