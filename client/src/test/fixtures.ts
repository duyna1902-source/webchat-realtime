import type { PublicUserDto } from '@webchat/shared';

/** Another User as the server sends them (no email): message senders, partners, Room Members. */
export function publicUser(id: string, username: string, isOnline = false): PublicUserDto {
  return { id, username, isOnline, lastSeenAt: '2026-01-01T00:00:00.000Z' };
}
