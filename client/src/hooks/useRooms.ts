import { useState, useEffect, useCallback } from 'react';
import {
  RoomListItemDto,
  SOCKET_EVENTS,
  RoomReceiveMessagePayload,
  RoomMemberChangePayload,
} from '@webchat/shared';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export function useRooms() {
  const { token } = useAuth();
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

  // Real-time update on incoming room:receive and room:member_change
  useEffect(() => {
    if (!socket) return;

    const handleRoomReceive = (msg: RoomReceiveMessagePayload) => {
      setRooms((prevRooms) => {
        const existingIndex = prevRooms.findIndex((r) => r.id === msg.roomId);
        if (existingIndex !== -1) {
          const updatedRoom = {
            ...prevRooms[existingIndex],
            lastMessage: msg,
            updatedAt: msg.createdAt,
          };
          return [updatedRoom, ...prevRooms.filter((_, idx) => idx !== existingIndex)];
        } else {
          fetchRooms();
          return prevRooms;
        }
      });
    };

    const handleMemberChange = (payload: RoomMemberChangePayload) => {
      // Re-fetch rooms when membership changes
      fetchRooms();
    };

    socket.on(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);
    socket.on(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, handleMemberChange);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);
      socket.off(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, handleMemberChange);
    };
  }, [socket, fetchRooms]);

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
