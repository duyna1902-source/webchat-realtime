// ==========================================
// API HELPER (ADR 0010)
// ==========================================
// Every call to the server goes through `apiFetch`. The Session travels in the HttpOnly
// `__Host-session` cookie, which the browser attaches by itself on same-origin requests,
// so no request carries an `Authorization` header and nothing is kept in localStorage.
// Any `401` means the Session is gone: the registered handler sends the user back to sign-in.

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/** Registers what happens on any `401` (AuthContext signs the user out). Returns an unregister function. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  onUnauthorized = handler;
  return () => {
    if (onUnauthorized === handler) onUnauthorized = null;
  };
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, { ...init, credentials: 'same-origin' });
  if (res.status === 401) {
    onUnauthorized?.();
  }
  return res;
}
