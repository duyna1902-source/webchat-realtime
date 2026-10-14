import { useState, useEffect, useCallback } from 'react';
import { DirectChatListItemDto, SOCKET_EVENTS, DirectReceiveMessagePayload, UserDto } from '@webchat/shared';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export function useDirectChats() {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [chats, setChats] = useState<DirectChatListItemDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/direct-chats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch direct chats');
      }

      const data = await res.json();
      setChats(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Error loading chats');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Real-time update on incoming direct:receive
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (msg: DirectReceiveMessagePayload) => {
      setChats((prevChats) => {
        const existingIndex = prevChats.findIndex((c) => c.id === msg.directChatId);
        if (existingIndex !== -1) {
          const updatedChat = {
            ...prevChats[existingIndex],
            lastMessage: msg,
            updatedAt: msg.createdAt,
          };
          // Move this chat to the top
          return [updatedChat, ...prevChats.filter((_, idx) => idx !== existingIndex)];
        } else {
          // If this is a new chat, refetch list from server
          fetchChats();
          return prevChats;
        }
      });
    };

    socket.on(SOCKET_EVENTS.DIRECT_RECEIVE, handleReceive);

    return () => {
      socket.off(SOCKET_EVENTS.DIRECT_RECEIVE, handleReceive);
    };
  }, [socket, fetchChats]);

  const createOrOpenChat = async (targetUserId: string): Promise<string> => {
    if (!token) throw new Error('Not authenticated');

    const res = await fetch('/api/direct-chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUserId }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to start chat');
    }

    const data = await res.json();
    await fetchChats();
    return data.id;
  };

  return {
    chats,
    isLoading,
    error,
    refreshChats: fetchChats,
    createOrOpenChat,
  };
}
