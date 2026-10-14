import { useState, useEffect, useRef, useCallback } from 'react';
import { SOCKET_EVENTS, RoomTypingPayload } from '@webchat/shared';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export function useRoomTyping(activeRoomId: string | null) {
  const { socket } = useSocket();
  const { currentUser } = useAuth();
  const [typingUsers, setTypingUsers] = useState<{ [userId: string]: string }>({});

  const isTypingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stop typing and emit false
  const stopTyping = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (isTypingRef.current && socket && activeRoomId) {
      isTypingRef.current = false;
      socket.emit(SOCKET_EVENTS.ROOM_TYPING, {
        roomId: activeRoomId,
        isTyping: false,
      });
    }
  }, [socket, activeRoomId]);

  // Call on keystrokes in active room input
  const handleTyping = useCallback(() => {
    if (!socket || !activeRoomId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit(SOCKET_EVENTS.ROOM_TYPING, {
        roomId: activeRoomId,
        isTyping: true,
      });
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      stopTyping();
    }, 2500);
  }, [socket, activeRoomId, stopTyping]);

  // Listen to incoming room:typing from server
  useEffect(() => {
    if (!socket || !activeRoomId) {
      setTypingUsers({});
      return;
    }

    const handleRoomTyping = (payload: RoomTypingPayload) => {
      if (payload.roomId === activeRoomId && payload.userId && payload.userId !== currentUser?.id) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (payload.isTyping) {
            next[payload.userId!] = payload.username || 'Someone';
          } else {
            delete next[payload.userId!];
          }
          return next;
        });
      }
    };

    socket.on(SOCKET_EVENTS.ROOM_TYPING, handleRoomTyping);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_TYPING, handleRoomTyping);
      stopTyping();
      setTypingUsers({});
    };
  }, [socket, activeRoomId, currentUser?.id, stopTyping]);

  const typingUsernames = Object.values(typingUsers);
  const isTyping = typingUsernames.length > 0;
  const typingText =
    typingUsernames.length === 1
      ? `${typingUsernames[0]} is typing...`
      : `${typingUsernames.join(', ')} are typing...`;

  return {
    typingUsers,
    isTyping,
    typingText,
    handleTyping,
    stopTyping,
  };
}
