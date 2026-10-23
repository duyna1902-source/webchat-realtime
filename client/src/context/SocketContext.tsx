import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, SessionEndedPayload } from '@webchat/shared';
import { useAuth } from './AuthContext';

/** What the sign-in screen says when the server ended the Session. */
export const SESSION_ENDED_NOTICES: Record<SessionEndedPayload['reason'] | 'unauthenticated', string> = {
  revoked: 'Session revoked (signed out on another device). Please sign in again.',
  expired: 'Your session expired. Please sign in again.',
  unauthenticated: 'Your session ended. Please sign in again.',
};

/** The handshake error the server gives a socket whose Session is unknown, expired or revoked. */
const AUTHENTICATION_REQUIRED = 'Authentication required';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectionError: string | null;
}

export const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, endSession } = useAuth();
  // The socket follows the signed-in User; the Session cookie authenticates its handshake.
  const userId = currentUser?.id ?? null;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
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

    // No URL: the socket always connects to the page's own origin (single-host, ADR 0010), and
    // no `auth` payload: the browser sends the HttpOnly Session cookie with the handshake.
    const newSocket = io({
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

    // The server ended the Session (revoked or expired) and is about to close this socket.
    newSocket.on(SOCKET_EVENTS.SESSION_ENDED, ({ reason }: SessionEndedPayload) => {
      endSession(SESSION_ENDED_NOTICES[reason] ?? SESSION_ENDED_NOTICES.unauthenticated);
    });

    newSocket.on('connect_error', (err) => {
      // Retrying cannot help without a Session: back to sign-in rather than "Reconnecting...".
      if (err.message === AUTHENTICATION_REQUIRED) {
        endSession(SESSION_ENDED_NOTICES.unauthenticated);
        return;
      }
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
    // `endSession` is stable; the socket follows the User only.
  }, [userId]);

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
