import { useState, useEffect, useCallback } from 'react';
import {
  RoomReceiveMessagePayload,
  RoomDetailDto,
  PaginatedMessagesDto,
  SOCKET_EVENTS,
  MessageType,
  RoomRole,
  RoomSendMessagePayload,
  RoomMemberChangePayload,
} from '@webchat/shared';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export interface SendRoomMessageOptions {
  type?: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
}

export function useRoomMessages(activeRoomId: string | null) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<RoomReceiveMessagePayload[]>([]);
  const [roomDetails, setRoomDetails] = useState<RoomDetailDto | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch room details and member roster
  const fetchRoomDetails = useCallback(async () => {
    if (!token || !activeRoomId) {
      setRoomDetails(null);
      return;
    }

    try {
      setIsLoadingDetails(true);
      const res = await fetch(`/api/rooms/${activeRoomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: RoomDetailDto = await res.json();
        setRoomDetails(data);
      }
    } catch (err: any) {
      console.error('Error fetching room details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [token, activeRoomId]);

  // Fetch initial message history
  useEffect(() => {
    if (!token || !activeRoomId) {
      setMessages([]);
      setRoomDetails(null);
      return;
    }

    let isMounted = true;
    setIsLoadingMessages(true);
    setError(null);

    fetchRoomDetails();

    fetch(`/api/rooms/${activeRoomId}/messages?limit=50`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load room messages');
        }
        return res.json();
      })
      .then((data: PaginatedMessagesDto<RoomReceiveMessagePayload>) => {
        if (isMounted) {
          setMessages(Array.isArray(data?.messages) ? data.messages : []);
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
  }, [token, activeRoomId, fetchRoomDetails]);

  // Socket join & leave lifecycle
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

    socket.on(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);
    socket.on(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, handleMemberChange);

    return () => {
      socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId: activeRoomId });
      socket.off(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);
      socket.off(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, handleMemberChange);
    };
  }, [socket, activeRoomId, fetchRoomDetails]);

  const sendMessage = useCallback(
    (content: string, options?: SendRoomMessageOptions) => {
      if (!socket || !activeRoomId) return;
      if (!content.trim() && !options?.attachmentUrl) return;

      const payload: RoomSendMessagePayload = {
        roomId: activeRoomId,
        content: content.trim(),
        type: options?.type ?? MessageType.TEXT,
        attachmentUrl: options?.attachmentUrl ?? null,
        attachmentName: options?.attachmentName ?? null,
        attachmentSize: options?.attachmentSize ?? null,
      };

      socket.emit(SOCKET_EVENTS.ROOM_SEND, payload);
    },
    [socket, activeRoomId]
  );

  const addMember = async (userId: string): Promise<void> => {
    if (!token || !activeRoomId) throw new Error('Not authenticated or no active room');

    const res = await fetch(`/api/rooms/${activeRoomId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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
    if (!token || !activeRoomId) throw new Error('Not authenticated or no active room');

    const res = await fetch(`/api/rooms/${activeRoomId}/members/${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to remove member');
    }

    await fetchRoomDetails();
  };

  const changeRole = async (userId: string, role: RoomRole.ADMIN | RoomRole.MEMBER): Promise<void> => {
    if (!token || !activeRoomId) throw new Error('Not authenticated or no active room');

    const res = await fetch(`/api/rooms/${activeRoomId}/members/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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
    if (!token || !activeRoomId) throw new Error('Not authenticated or no active room');

    const res = await fetch(`/api/rooms/${activeRoomId}/leave`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to leave room');
    }
  };

  const deleteRoom = async (): Promise<void> => {
    if (!token || !activeRoomId) throw new Error('Not authenticated or no active room');

    const res = await fetch(`/api/rooms/${activeRoomId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
    isLoadingDetails,
    error,
    sendMessage,
    addMember,
    removeMember,
    changeRole,
    leaveRoom,
    deleteRoom,
    refreshRoomDetails: fetchRoomDetails,
  };
}
