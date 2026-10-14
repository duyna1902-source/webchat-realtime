import { Server } from 'socket.io';
import { AuthenticatedSocket } from './index.js';
import { getPrisma } from '../lib/prisma.js';
import { SOCKET_EVENTS, PresenceUpdatePayload } from '@webchat/shared';

// Map of userId -> Set of socket IDs currently connected
const activeUserSockets = new Map<string, Set<string>>();

// Map of socket.id -> userId
const socketToUser = new Map<string, string>();

// Map of userId -> disconnect grace period timer
const disconnectTimers = new Map<string, NodeJS.Timeout>();

const DEFAULT_GRACE_PERIOD_MS = 5000;
let presenceGracePeriodMs = process.env.PRESENCE_GRACE_PERIOD_MS
  ? parseInt(process.env.PRESENCE_GRACE_PERIOD_MS, 10)
  : DEFAULT_GRACE_PERIOD_MS;

export function setPresenceGracePeriodMs(ms: number): void {
  presenceGracePeriodMs = ms;
}

export function getPresenceGracePeriodMs(): number {
  return presenceGracePeriodMs;
}

export function clearPresenceState(): void {
  for (const timer of disconnectTimers.values()) {
    clearTimeout(timer);
  }
  disconnectTimers.clear();
  activeUserSockets.clear();
  socketToUser.clear();
}

export function isUserOnline(userId: string): boolean {
  const sockets = activeUserSockets.get(userId);
  return Boolean(sockets && sockets.size > 0);
}

export async function handleUserConnect(io: Server, socket: AuthenticatedSocket): Promise<void> {
  const userId = socket.data?.user?.userId;
  if (!userId) return;

  // If there is an active disconnect grace period timer for this user, cancel it
  const existingTimer = disconnectTimers.get(userId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    disconnectTimers.delete(userId);
  }

  const userSockets = activeUserSockets.get(userId) || new Set<string>();
  const wasOffline = userSockets.size === 0;

  userSockets.add(socket.id);
  activeUserSockets.set(userId, userSockets);
  socketToUser.set(socket.id, userId);

  // If this is the user's first connected socket (they were offline), update DB and broadcast
  if (wasOffline) {
    try {
      const prisma = getPrisma();
      const existingUser = await prisma.user.findUnique({ where: { id: userId } });
      if (existingUser) {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { isOnline: true },
        });

        const payload: PresenceUpdatePayload = {
          userId,
          isOnline: true,
          lastSeenAt: updatedUser.lastSeenAt.toISOString(),
        };

        io.emit(SOCKET_EVENTS.PRESENCE_UPDATE, payload);
      }
    } catch (err) {
      console.error(`Error updating presence on connect for user ${userId}:`, err);
    }
  }
}

export function handleUserDisconnect(io: Server, socket: AuthenticatedSocket): void {
  const userId = socketToUser.get(socket.id) || socket.data?.user?.userId;
  if (!userId) return;

  socketToUser.delete(socket.id);
  const userSockets = activeUserSockets.get(userId);

  if (userSockets) {
    userSockets.delete(socket.id);
    if (userSockets.size === 0) {
      activeUserSockets.delete(userId);

      // Start Presence Grace Period timer
      const timer = setTimeout(async () => {
        disconnectTimers.delete(userId);

        // Check if user reconnected in the meantime
        const currentSockets = activeUserSockets.get(userId);
        if (!currentSockets || currentSockets.size === 0) {
          const now = new Date();
          try {
            const prisma = getPrisma();
            const existingUser = await prisma.user.findUnique({ where: { id: userId } });
            if (existingUser) {
              await prisma.user.update({
                where: { id: userId },
                data: { isOnline: false, lastSeenAt: now },
              });
            }
          } catch (err) {
            console.error(`Error updating presence on disconnect for user ${userId}:`, err);
          }

          const payload: PresenceUpdatePayload = {
            userId,
            isOnline: false,
            lastSeenAt: now.toISOString(),
          };

          io.emit(SOCKET_EVENTS.PRESENCE_UPDATE, payload);
        }
      }, presenceGracePeriodMs);

      disconnectTimers.set(userId, timer);
    }
  }
}
