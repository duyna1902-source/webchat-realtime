import type { CookieOptions, Response } from 'express';

// ==========================================
// SESSION COOKIE (ADR 0010)
// ==========================================
// `__Host-` makes the browser insist on Secure, Path=/ and no Domain, so the cookie is bound to
// this exact origin. HttpOnly keeps it out of reach of page scripts; SameSite=Strict keeps it off
// cross-site requests. Browsers accept Secure cookies on http://localhost, so dev uses the same flags.

export const SESSION_COOKIE_NAME = '__Host-session';

const BASE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
};

/** Sets the Session cookie; it lives as long as the Session's absolute TTL. */
export function setSessionCookie(res: Response, rawToken: string, maxAgeMs: number): void {
  res.cookie(SESSION_COOKIE_NAME, rawToken, { ...BASE_COOKIE_OPTIONS, maxAge: maxAgeMs });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, BASE_COOKIE_OPTIONS);
}

/** The raw Session token from a `Cookie` request header, or null. */
export function readSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === SESSION_COOKIE_NAME) {
      const value = part.slice(separator + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}
