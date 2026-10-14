import { useState, useEffect, useCallback } from 'react';
import { SOCKET_EVENTS, PresenceUpdatePayload } from '@webchat/shared';
import { useSocket } from '../context/SocketContext';

export interface UserPresenceState {
  isOnline: boolean;
  lastSeenAt?: string;
}

export function usePresence() {
  const { socket } = useSocket();
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresenceState>>({});

  useEffect(() => {
    if (!socket) return;

    const handlePresenceUpdate = (payload: PresenceUpdatePayload) => {
      if (!payload || !payload.userId) return;
      setPresenceMap((prev) => ({
        ...prev,
        [payload.userId]: {
          isOnline: payload.isOnline,
          lastSeenAt: payload.lastSeenAt,
        },
      }));
    };

    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, handlePresenceUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE, handlePresenceUpdate);
    };
  }, [socket]);

  const isUserOnline = useCallback(
    (userId: string, defaultOnline = false): boolean => {
      if (presenceMap[userId] !== undefined) {
        return presenceMap[userId].isOnline;
      }
      return defaultOnline;
    },
    [presenceMap]
  );

  const getUserLastSeen = useCallback(
    (userId: string, defaultLastSeen?: string): string | undefined => {
      if (presenceMap[userId] !== undefined) {
        return presenceMap[userId].lastSeenAt || defaultLastSeen;
      }
      return defaultLastSeen;
    },
    [presenceMap]
  );

  return {
    presenceMap,
    isUserOnline,
    getUserLastSeen,
  };
}
