import { useState, useEffect, useRef, useCallback } from 'react';
import { SOCKET_EVENTS, DirectTypingPayload } from '@webchat/shared';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export function useTyping(activeChatId: string | null) {
  const { socket } = useSocket();
  const { currentUser } = useAuth();
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);

  const isTypingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stop typing and emit false
  const stopTyping = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (isTypingRef.current && socket && activeChatId) {
      isTypingRef.current = false;
      socket.emit(SOCKET_EVENTS.DIRECT_TYPING, {
        directChatId: activeChatId,
        isTyping: false,
      });
    }
  }, [socket, activeChatId]);

  // Call on keystrokes in active chat input
  const handleTyping = useCallback(() => {
    if (!socket || !activeChatId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit(SOCKET_EVENTS.DIRECT_TYPING, {
        directChatId: activeChatId,
        isTyping: true,
      });
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      stopTyping();
    }, 2500);
  }, [socket, activeChatId, stopTyping]);

  // Listen to incoming direct:typing from server
  useEffect(() => {
    if (!socket || !activeChatId) {
      setIsPartnerTyping(false);
      return;
    }

    const handleDirectTyping = (payload: DirectTypingPayload) => {
      if (payload.directChatId === activeChatId && payload.userId !== currentUser?.id) {
        setIsPartnerTyping(payload.isTyping);
      }
    };

    socket.on(SOCKET_EVENTS.DIRECT_TYPING, handleDirectTyping);

    return () => {
      socket.off(SOCKET_EVENTS.DIRECT_TYPING, handleDirectTyping);
      stopTyping();
      setIsPartnerTyping(false);
    };
  }, [socket, activeChatId, currentUser?.id, stopTyping]);

  return {
    isPartnerTyping,
    handleTyping,
    stopTyping,
  };
}
