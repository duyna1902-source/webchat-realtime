/**
 * Safe URL helper (SEC-03, client-side defense).
 *
 * Every URL that comes from a message (Attachment, GIF) must pass through
 * `safeUrl()` before it reaches an `href`, `src`, iframe, `fetch` or
 * `window.open`. Only `https:` and `blob:` are allowed; same-origin relative
 * URLs are accepted in dev only (local storage driver, Vite proxy).
 *
 * Returns the URL to use, or `null` when the URL must not be rendered.
 */
const ALLOWED_PROTOCOLS = new Set(['https:', 'blob:']);

export interface SafeUrlOptions {
  /** Accept same-origin relative URLs. Defaults to true in dev builds only. */
  allowRelative?: boolean;
}

export function safeUrl(
  raw: string | null | undefined,
  { allowRelative = import.meta.env.DEV }: SafeUrlOptions = {}
): string | null {
  if (typeof raw !== 'string') return null;
  const candidate = raw.trim();
  if (candidate === '') return null;

  let absolute: URL | null = null;
  try {
    absolute = new URL(candidate);
  } catch {
    absolute = null;
  }

  if (absolute) {
    return ALLOWED_PROTOCOLS.has(absolute.protocol) ? absolute.href : null;
  }

  if (!allowRelative) return null;

  try {
    const resolved = new URL(candidate, window.location.href);
    return resolved.origin === window.location.origin ? candidate : null;
  } catch {
    return null;
  }
}
