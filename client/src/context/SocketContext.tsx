import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from '../utils/api';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectionError: string | null;
}

export const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      setIsConnecting(false);
      setIsReconnecting(false);
      return;
    }

    setIsConnecting(true);
    setIsReconnecting(false);
    setConnectionError(null);

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setIsReconnecting(false);
      setConnectionError(null);
    });

    newSocket.on('connect_error', (err) => {
      setIsConnecting(false);
      setIsConnected(false);
      setIsReconnecting(true);
      setConnectionError(err.message || 'Connection failed');
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason !== 'io client disconnect') {
        setIsReconnecting(true);
      }
    });

    newSocket.io.on('reconnect_attempt', () => {
      setIsReconnecting(true);
    });

    newSocket.io.on('reconnect', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setIsReconnecting(false);
      setConnectionError(null);
    });

    newSocket.io.on('reconnect_failed', () => {
      setIsReconnecting(false);
      setConnectionError('Reconnection failed');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isConnecting, isReconnecting, connectionError }}>
      {children}
    </SocketContext.Provider>
  );
};

export function useSocket(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
