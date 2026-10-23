import type { Logger } from './logger.js';

// ==========================================
// SECURITY EVENTS (SEC-17)
// ==========================================
// One JSON log line per security-relevant event, with its name in the `event` field so an operator
// can filter on it. Log through the request's or socket's logger (`req.log`, `ctx.log`): it already
// carries `requestId`, `ip` and, once authenticated, `userId`.
//
// Never pass a password, Session token or id, cookie or secret value as a detail. The logger redacts
// sensitive-looking keys as a safety net, but a value under an innocent key would still be written.

export type SecurityEvent =
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.register'
  | 'auth.logout'
  | 'auth.logout_all'
  | 'session.revoked'
  | 'ratelimit.hit'
  | 'upload.accepted'
  | 'upload.rejected'
  | 'room.member.kicked'
  | 'room.member.role_changed'
  | 'room.deleted'
  | 'room.left'
  | 'http.401'
  | 'http.403'
  | 'socket.handshake.rejected';

/** Events that point at a refused or possibly abusive action; the rest record normal activity. */
const WARNING_EVENTS: ReadonlySet<SecurityEvent> = new Set<SecurityEvent>([
  'auth.login.failure',
  'ratelimit.hit',
  'upload.rejected',
  'http.401',
  'http.403',
  'socket.handshake.rejected',
]);

export type SecurityEventDetails = Record<string, string | number | boolean | null | undefined>;

export function logSecurityEvent(log: Logger, event: SecurityEvent, details: SecurityEventDetails = {}): void {
  const entry = { ...details, event };
  if (WARNING_EVENTS.has(event)) log.warn(entry, event);
  else log.info(entry, event);
}
