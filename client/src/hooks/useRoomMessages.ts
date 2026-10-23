import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RoomReceiveMessagePayload,
  RoomDetailDto,
  PaginatedMessagesDto,
  SOCKET_EVENTS,
  MessageType,
  RoomRole,
  RoomSendMessagePayload,
  RoomMemberChangePayload,
  RoomReadPayload,
} from '@webchat/shared';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { apiFetch } from '../utils/apiFetch';

export interface SendRoomMessageOptions {
  type?: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
}

export function useRoomMessages(activeRoomId: string | null) {
  const { currentUser } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<RoomReceiveMessagePayload[]>([]);
  const [roomDetails, setRoomDetails] = useState<RoomDetailDto | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const lastReadEmittedIdRef = useRef<string | null>(null);
  const messagesRef = useRef<RoomReceiveMessagePayload[]>([]);
  messagesRef.current = messages;

  // Fetch room details and member roster
  const fetchRoomDetails = useCallback(async () => {
    if (!currentUser || !activeRoomId) {
      setRoomDetails(null);
      return;
    }

    try {
      setIsLoadingDetails(true);
      const res = await apiFetch(`/api/rooms/${activeRoomId}`);
      if (res.ok) {
        const data: RoomDetailDto = await res.json();
        setRoomDetails(data);
      }
    } catch (err: any) {
      console.error('Error fetching room details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [currentUser, activeRoomId]);

  // Fetch initial message history
  useEffect(() => {
    lastReadEmittedIdRef.current = null;
    if (!currentUser || !activeRoomId) {
      setMessages([]);
      setRoomDetails(null);
      setHasMore(false);
      return;
    }

    let isMounted = true;
    setIsLoadingMessages(true);
    setError(null);

    fetchRoomDetails();

    apiFetch(`/api/rooms/${activeRoomId}/messages?limit=50`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load room messages');
        }
        return res.json();
      })
      .then((data: PaginatedMessagesDto<RoomReceiveMessagePayload>) => {
        if (isMounted) {
          setMessages(Array.isArray(data?.messages) ? data.messages : []);
          setHasMore(Boolean(data?.hasMore));
          setIsLoadingMessages(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Error loading room messages');
          setIsLoadingMessages(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser, activeRoomId, fetchRoomDetails]);

  // Load older messages for cursor pagination (?before=<oldestId>)
  const loadOlderMessages = useCallback(async () => {
    if (!currentUser || !activeRoomId || isLoadingOlder || !hasMore || messages.length === 0) {
      return;
    }

    const oldestId = messages[0].id;
    setIsLoadingOlder(true);

    try {
      const res = await apiFetch(`/api/rooms/${activeRoomId}/messages?limit=50&before=${oldestId}`);

      if (res.ok) {
        const data: PaginatedMessagesDto<RoomReceiveMessagePayload> = await res.json();
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newOlder = data.messages.filter((m) => !existingIds.has(m.id));
            return [...newOlder, ...prev];
          });
        }
        setHasMore(Boolean(data?.hasMore));
      }
    } catch (err: any) {
      console.error('Error loading older room messages:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [currentUser, activeRoomId, isLoadingOlder, hasMore, messages]);

  // Catch-up Sync: fetches room messages strictly newer than latest local message, or initial batch if empty
  const syncCatchup = useCallback(async () => {
    if (!currentUser || !activeRoomId) return;
    const currentMsgs = messagesRef.current;
    const url =
      currentMsgs.length > 0
        ? `/api/rooms/${activeRoomId}/messages?after=${currentMsgs[currentMsgs.length - 1].id}`
        : `/api/rooms/${activeRoomId}/messages?limit=50`;

    try {
      const res = await apiFetch(url);

      if (res.ok) {
        const data: PaginatedMessagesDto<RoomReceiveMessagePayload> = await res.json();
        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages((prev) => {
            if (prev.length === 0) {
              return data.messages;
            }
            const existingIds = new Set(prev.map((m) => m.id));
            const newItems = data.messages.filter((m) => !existingIds.has(m.id));
            return [...prev, ...newItems];
          });
          if (currentMsgs.length === 0) {
            setHasMore(Boolean(data.hasMore));
          }
        }
      }
    } catch (err) {
      console.error('Failed to catch-up sync room messages:', err);
    }
  }, [currentUser, activeRoomId]);

  // Auto read receipt: when active room has messages, emit room:read
  useEffect(() => {
    if (!socket || !activeRoomId || messages.length === 0) return;

    const latestMsg = messages[messages.length - 1];
    if (latestMsg && latestMsg.id !== lastReadEmittedIdRef.current) {
      lastReadEmittedIdRef.current = latestMsg.id;
      socket.emit(SOCKET_EVENTS.ROOM_READ, {
        roomId: activeRoomId,
        messageId: latestMsg.id,
      });
    }
  }, [socket, activeRoomId, messages]);

  // Socket join & leave lifecycle, receive message, and read receipt listeners
  useEffect(() => {
    if (!socket || !activeRoomId) return;

    socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: activeRoomId });

    const handleRoomReceive = (msg: RoomReceiveMessagePayload) => {
      if (msg.roomId === activeRoomId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) {
            return prev;
          }
          return [...prev, msg];
        });
      }
    };

    const handleMemberChange = (payload: RoomMemberChangePayload) => {
      if (payload.roomId === activeRoomId) {
        fetchRoomDetails();
      }
    };

    const handleRoomRead = (payload: RoomReadPayload) => {
      if (payload.roomId === activeRoomId) {
        const readerId = payload.userId || payload.readByUserId;
        setRoomDetails((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            members: prev.members.map((m) =>
              m.userId === readerId ? { ...m, lastReadMessageId: payload.messageId } : m
            ),
          };
        });
      }
    };

    const handleConnect = () => {
      // Re-join room on socket
      socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: activeRoomId });

      // If session not recovered, sync missed messages and refresh room details
      if (!socket.recovered) {
        syncCatchup();
        fetchRoomDetails();
      }
    };

    socket.on(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);
    socket.on(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, handleMemberChange);
    socket.on(SOCKET_EVENTS.ROOM_READ, handleRoomRead);
    socket.on('connect', handleConnect);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);
      socket.off(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, handleMemberChange);
      socket.off(SOCKET_EVENTS.ROOM_READ, handleRoomRead);
      socket.off('connect', handleConnect);
    };
  }, [socket, activeRoomId, fetchRoomDetails, syncCatchup]);

  const sendMessage = useCallback(
    (content: string, optionsOrType?: MessageType | SendRoomMessageOptions) => {
      if (!socket || !activeRoomId) return;

      let msgType = MessageType.TEXT;
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentSize: number | null = null;

      if (typeof optionsOrType === 'string') {
        msgType = optionsOrType;
      } else if (optionsOrType) {
        msgType = optionsOrType.type ?? MessageType.TEXT;
        attachmentUrl = optionsOrType.attachmentUrl ?? null;
        attachmentName = optionsOrType.attachmentName ?? null;
        attachmentSize = optionsOrType.attachmentSize ?? null;
      }

      if (!content.trim() && !attachmentUrl) return;

      const payload: RoomSendMessagePayload = {
        roomId: activeRoomId,
        content: content.trim(),
        type: msgType,
        attachmentUrl,
        attachmentName,
        attachmentSize,
      };

      socket.emit(SOCKET_EVENTS.ROOM_SEND, payload);
    },
    [socket, activeRoomId]
  );

  const addMember = async (userId: string): Promise<void> => {
    if (!currentUser || !activeRoomId) throw new Error('Not authenticated or no active room');

    const res = await apiFetch(`/api/rooms/${activeRoomId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to add member');
    }

    await fetchRoomDetails();
  };

  const removeMember = async (userId: string): Promise<void> => {
    if (!currentUser || !activeRoomId) throw new Error('Not authenticated or no active room');

    const res = await apiFetch(`/api/rooms/${activeRoomId}/members/${userId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to remove member');
    }

    await fetchRoomDetails();
  };

  const changeRole = async (userId: string, role: RoomRole.ADMIN | RoomRole.MEMBER): Promise<void> => {
    if (!currentUser || !activeRoomId) throw new Error('Not authenticated or no active room');

    const res = await apiFetch(`/api/rooms/${activeRoomId}/members/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to change role');
    }

    await fetchRoomDetails();
  };

  const leaveRoom = async (): Promise<void> => {
    if (!currentUser || !activeRoomId) throw new Error('Not authenticated or no active room');

    const res = await apiFetch(`/api/rooms/${activeRoomId}/leave`, {
      method: 'POST',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to leave room');
    }
  };

  const deleteRoom = async (): Promise<void> => {
    if (!currentUser || !activeRoomId) throw new Error('Not authenticated or no active room');

    const res = await apiFetch(`/api/rooms/${activeRoomId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete room');
    }
  };

  return {
    messages,
    roomDetails,
    isLoadingMessages,
    isLoadingOlder,
    hasMore,
    loadOlderMessages,
    isLoadingDetails,
    error,
    sendMessage,
    addMember,
    removeMember,
    changeRole,
    leaveRoom,
    deleteRoom,
    refreshRoomDetails: fetchRoomDetails,
    syncCatchup,
  };
}
