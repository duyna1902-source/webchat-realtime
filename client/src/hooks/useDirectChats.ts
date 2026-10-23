import { useState, useEffect, useCallback } from 'react';
import {
  DirectChatListItemDto,
  SOCKET_EVENTS,
  DirectReceiveMessagePayload,
  PresenceUpdatePayload,
  DirectReadPayload,
} from '@webchat/shared';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export function useDirectChats(activeChatId?: string | null) {
  const { token, currentUser } = useAuth();
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

  // Reset unreadCount when activeChatId changes
  useEffect(() => {
    if (activeChatId) {
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId && c.unreadCount !== 0 ? { ...c, unreadCount: 0 } : c))
      );
    }
  }, [activeChatId]);

  // Real-time update on incoming direct:receive, direct:read, presence, and reconnection
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (msg: DirectReceiveMessagePayload) => {
      setChats((prevChats) => {
        const existingIndex = prevChats.findIndex((c) => c.id === msg.directChatId);
        const isOther = msg.senderId !== currentUser?.id;
        const isInactive = msg.directChatId !== activeChatId;

        if (existingIndex !== -1) {
          const existing = prevChats[existingIndex];
          const newUnread = isOther && isInactive
            ? (existing.unreadCount || 0) + 1
            : (msg.directChatId === activeChatId ? 0 : (existing.unreadCount || 0));

          const updatedChat = {
            ...existing,
            lastMessage: msg,
            unreadCount: newUnread,
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

    const handleRead = (payload: DirectReadPayload) => {
      if (payload.userId === currentUser?.id || payload.readByUserId === currentUser?.id) {
        setChats((prev) =>
          prev.map((c) => (c.id === payload.directChatId ? { ...c, unreadCount: 0 } : c))
        );
      }
    };

    const handlePresence = (presence: PresenceUpdatePayload) => {
      if (!presence || !presence.userId) return;
      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.partner.id === presence.userId) {
            return {
              ...chat,
              partner: {
                ...chat.partner,
                isOnline: presence.isOnline,
                lastSeenAt: presence.lastSeenAt,
              },
            };
          }
          return chat;
        })
      );
    };

    const handleConnect = () => {
      fetchChats();
    };

    socket.on(SOCKET_EVENTS.DIRECT_RECEIVE, handleReceive);
    socket.on(SOCKET_EVENTS.DIRECT_READ, handleRead);
    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, handlePresence);
    socket.on('connect', handleConnect);

    return () => {
      socket.off(SOCKET_EVENTS.DIRECT_RECEIVE, handleReceive);
      socket.off(SOCKET_EVENTS.DIRECT_READ, handleRead);
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE, handlePresence);
      socket.off('connect', handleConnect);
    };
  }, [socket, activeChatId, currentUser?.id, fetchChats]);

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
