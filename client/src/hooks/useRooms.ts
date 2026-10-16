import { useState, useEffect, useCallback } from 'react';
import {
  RoomListItemDto,
  SOCKET_EVENTS,
  RoomReceiveMessagePayload,
  RoomMemberChangePayload,
  RoomReadPayload,
} from '@webchat/shared';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export function useRooms(activeRoomId?: string | null) {
  const { token, currentUser } = useAuth();
  const { socket } = useSocket();
  const [rooms, setRooms] = useState<RoomListItemDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/rooms', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch rooms');
      }

      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Error loading rooms');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Reset unreadCount when activeRoomId changes
  useEffect(() => {
    if (activeRoomId) {
      setRooms((prev) =>
        prev.map((r) => (r.id === activeRoomId && r.unreadCount !== 0 ? { ...r, unreadCount: 0 } : r))
      );
    }
  }, [activeRoomId]);

  // Real-time update on incoming room:receive, room:read, room:member_change, and reconnection
  useEffect(() => {
    if (!socket) return;

    const handleRoomReceive = (msg: RoomReceiveMessagePayload) => {
      setRooms((prevRooms) => {
        const existingIndex = prevRooms.findIndex((r) => r.id === msg.roomId);
        const isOther = msg.senderId !== currentUser?.id;
        const isInactive = msg.roomId !== activeRoomId;

        if (existingIndex !== -1) {
          const existing = prevRooms[existingIndex];
          const newUnread = isOther && isInactive
            ? (existing.unreadCount || 0) + 1
            : (msg.roomId === activeRoomId ? 0 : (existing.unreadCount || 0));

          const updatedRoom = {
            ...existing,
            lastMessage: msg,
            unreadCount: newUnread,
            updatedAt: msg.createdAt,
          };
          return [updatedRoom, ...prevRooms.filter((_, idx) => idx !== existingIndex)];
        } else {
          fetchRooms();
          return prevRooms;
        }
      });
    };

    const handleRoomRead = (payload: RoomReadPayload) => {
      if (payload.userId === currentUser?.id || payload.readByUserId === currentUser?.id) {
        setRooms((prev) =>
          prev.map((r) => (r.id === payload.roomId ? { ...r, unreadCount: 0 } : r))
        );
      }
    };

    const handleMemberChange = (payload: RoomMemberChangePayload) => {
      if (payload.action === 'DELETE' || (payload.action === 'KICK' && payload.userId === currentUser?.id)) {
        setRooms((prev) => prev.filter((r) => r.id !== payload.roomId));
      } else {
        // Re-fetch rooms when membership changes (JOIN, ROLE_CHANGE, etc.)
        fetchRooms();
      }
    };

    const handleConnect = () => {
      fetchRooms();
    };

    socket.on(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);
    socket.on(SOCKET_EVENTS.ROOM_READ, handleRoomRead);
    socket.on(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, handleMemberChange);
    socket.on('connect', handleConnect);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);
      socket.off(SOCKET_EVENTS.ROOM_READ, handleRoomRead);
      socket.off(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, handleMemberChange);
      socket.off('connect', handleConnect);
    };
  }, [socket, activeRoomId, currentUser?.id, fetchRooms]);

  const createRoom = async (name: string, description?: string): Promise<string> => {
    if (!token) throw new Error('Not authenticated');

    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, description }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to create room');
    }

    const data = await res.json();
    await fetchRooms();
    return data.id;
  };

  return {
    rooms,
    isLoading,
    error,
    refreshRooms: fetchRooms,
    createRoom,
  };
}
