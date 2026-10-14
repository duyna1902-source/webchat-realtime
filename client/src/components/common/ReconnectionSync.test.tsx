import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { ConnectionStatusBanner } from './ConnectionStatusBanner';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { useDirectMessages } from '../../hooks/useDirectMessages';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { MessageType, MessageStatus, SOCKET_EVENTS } from '@webchat/shared';

function TestDirectMessagesComponent({ chatId }: { chatId: string }) {
  const { messages, syncCatchup } = useDirectMessages(chatId);
  return (
    <div>
      <div data-testid="direct-message-count">{messages.length}</div>
      <ul>
        {messages.map((m) => (
          <li key={m.id} data-testid={`direct-msg-${m.id}`}>
            {m.content}
          </li>
        ))}
      </ul>
      <button onClick={() => syncCatchup?.()} data-testid="manual-sync-btn">
        Sync
      </button>
    </div>
  );
}

function TestRoomMessagesComponent({ roomId }: { roomId: string }) {
  const { messages, syncCatchup } = useRoomMessages(roomId);
  return (
    <div>
      <div data-testid="room-message-count">{messages.length}</div>
      <ul>
        {messages.map((m) => (
          <li key={m.id} data-testid={`room-msg-${m.id}`}>
            {m.content}
          </li>
        ))}
      </ul>
      <button onClick={() => syncCatchup?.()} data-testid="manual-room-sync-btn">
        Sync
      </button>
    </div>
  );
}

describe('Reconnection & Catch-up Sync Client Features', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ConnectionStatusBanner Component', () => {
    it('renders null when socket is connected', () => {
      const { container } = render(
        <SocketContext.Provider
          value={{
            socket: null,
            isConnected: true,
            isConnecting: false,
            isReconnecting: false,
            connectionError: null,
          }}
        >
          <ConnectionStatusBanner />
        </SocketContext.Provider>
      );

      expect(container.firstChild).toBeNull();
    });

    it('displays "Đang kết nối lại..." banner when socket disconnects / isReconnecting', () => {
      render(
        <SocketContext.Provider
          value={{
            socket: null,
            isConnected: false,
            isConnecting: false,
            isReconnecting: true,
            connectionError: null,
          }}
        >
          <ConnectionStatusBanner />
        </SocketContext.Provider>
      );

      expect(screen.getByText(/đang kết nối lại/i)).toBeInTheDocument();
      expect(screen.getByText(/reconnecting to server/i)).toBeInTheDocument();
    });

    it('displays "Đang kết nối lại..." banner even when connectionError is present during reconnection', () => {
      render(
        <SocketContext.Provider
          value={{
            socket: null,
            isConnected: false,
            isConnecting: false,
            isReconnecting: true,
            connectionError: 'Transport close error',
          }}
        >
          <ConnectionStatusBanner />
        </SocketContext.Provider>
      );

      expect(screen.getByText(/đang kết nối lại/i)).toBeInTheDocument();
    });

    it('displays initial connecting banner when isConnecting is true and not reconnecting', () => {
      render(
        <SocketContext.Provider
          value={{
            socket: null,
            isConnected: false,
            isConnecting: true,
            isReconnecting: false,
            connectionError: null,
          }}
        >
          <ConnectionStatusBanner />
        </SocketContext.Provider>
      );

      expect(screen.getByText(/render free tier waking up/i)).toBeInTheDocument();
    });
  });

  describe('useDirectMessages Catch-up Sync & Deduplication', () => {
    it('triggers catch-up sync on socket connect when socket.recovered is false and deduplicates', async () => {
      const socketListeners: Record<string, Function> = {};
      const mockSocket: any = {
        recovered: false,
        on: vi.fn((event, handler) => {
          socketListeners[event] = handler;
        }),
        off: vi.fn((event) => {
          delete socketListeners[event];
        }),
        emit: vi.fn(),
      };

      const initialMessage = {
        id: 'msg-1',
        directChatId: 'chat-1',
        senderId: 'user-1',
        sender: { id: 'user-1', username: 'alice', avatarUrl: null },
        content: 'Initial message',
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        createdAt: '2026-01-01T10:00:00.000Z',
      };

      const catchupMessage = {
        id: 'msg-2',
        directChatId: 'chat-1',
        senderId: 'user-2',
        sender: { id: 'user-2', username: 'bob', avatarUrl: null },
        content: 'Catch-up missed message',
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        createdAt: '2026-01-01T10:01:00.000Z',
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('limit=50')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ messages: [initialMessage], hasMore: false }),
          });
        }
        if (url.includes('after=msg-1')) {
          // Returns catchup message AND a duplicate of initial message to test deduplication
          return Promise.resolve({
            ok: true,
            json: async () => ({ messages: [initialMessage, catchupMessage], hasMore: false }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });

      render(
        <AuthContext.Provider
          value={{
            currentUser: { id: 'user-1', username: 'alice', email: 'alice@test.com' } as any,
            token: 'test-token',
            isLoading: false,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <SocketContext.Provider
            value={{
              socket: mockSocket,
              isConnected: true,
              isConnecting: false,
              isReconnecting: false,
              connectionError: null,
            }}
          >
            <TestDirectMessagesComponent chatId="chat-1" />
          </SocketContext.Provider>
        </AuthContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('direct-msg-msg-1')).toBeInTheDocument();
      });

      // Simulate socket reconnection with recovered = false
      mockSocket.recovered = false;
      await act(async () => {
        if (socketListeners['connect']) {
          await socketListeners['connect']();
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('direct-msg-msg-2')).toBeInTheDocument();
      });

      // Confirm deduplication: total message count must be 2, not 3
      expect(screen.getByTestId('direct-message-count').textContent).toBe('2');

      // Test socket incoming deduplication
      await act(async () => {
        if (socketListeners[SOCKET_EVENTS.DIRECT_RECEIVE]) {
          socketListeners[SOCKET_EVENTS.DIRECT_RECEIVE](catchupMessage);
        }
      });

      expect(screen.getByTestId('direct-message-count').textContent).toBe('2');
    });

    it('does NOT trigger catch-up sync on socket connect when socket.recovered is true', async () => {
      const socketListeners: Record<string, Function> = {};
      const mockSocket: any = {
        recovered: true,
        on: vi.fn((event, handler) => {
          socketListeners[event] = handler;
        }),
        off: vi.fn((event) => {
          delete socketListeners[event];
        }),
        emit: vi.fn(),
      };

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes('limit=50')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              messages: [
                {
                  id: 'msg-existing',
                  directChatId: 'chat-1',
                  senderId: 'user-1',
                  sender: { id: 'user-1', username: 'alice', avatarUrl: null },
                  content: 'Already there',
                  type: MessageType.TEXT,
                  status: MessageStatus.SENT,
                  createdAt: '2026-01-01T10:00:00.000Z',
                },
              ],
              hasMore: false,
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });
      global.fetch = fetchSpy;

      render(
        <AuthContext.Provider
          value={{
            currentUser: { id: 'user-1', username: 'alice', email: 'alice@test.com' } as any,
            token: 'test-token',
            isLoading: false,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <SocketContext.Provider
            value={{
              socket: mockSocket,
              isConnected: true,
              isConnecting: false,
              isReconnecting: false,
              connectionError: null,
            }}
          >
            <TestDirectMessagesComponent chatId="chat-1" />
          </SocketContext.Provider>
        </AuthContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('direct-msg-msg-existing')).toBeInTheDocument();
      });

      fetchSpy.mockClear();

      // Trigger socket connect with recovered = true
      mockSocket.recovered = true;
      await act(async () => {
        if (socketListeners['connect']) {
          await socketListeners['connect']();
        }
      });

      // Verify no catch-up sync was fetched
      expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining('after='));
    });
  });

  describe('useRoomMessages Catch-up Sync & Deduplication', () => {
    it('triggers catch-up sync on socket connect when socket.recovered is false and re-joins room', async () => {
      const socketListeners: Record<string, Function> = {};
      const mockSocket: any = {
        recovered: false,
        on: vi.fn((event, handler) => {
          socketListeners[event] = handler;
        }),
        off: vi.fn((event) => {
          delete socketListeners[event];
        }),
        emit: vi.fn(),
      };

      const initialRoomMessage = {
        id: 'rmsg-1',
        roomId: 'room-1',
        senderId: 'user-1',
        sender: { id: 'user-1', username: 'alice', avatarUrl: null },
        content: 'Initial room message',
        type: MessageType.TEXT,
        createdAt: '2026-01-01T10:00:00.000Z',
      };

      const missedRoomMessage = {
        id: 'rmsg-2',
        roomId: 'room-1',
        senderId: 'user-2',
        sender: { id: 'user-2', username: 'bob', avatarUrl: null },
        content: 'Missed room message',
        type: MessageType.TEXT,
        createdAt: '2026-01-01T10:01:00.000Z',
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/rooms/room-1/messages?limit=50')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ messages: [initialRoomMessage], hasMore: false }),
          });
        }
        if (url.includes('/api/rooms/room-1/messages?after=rmsg-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ messages: [initialRoomMessage, missedRoomMessage], hasMore: false }),
          });
        }
        if (url.includes('/api/rooms/room-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 'room-1',
              name: 'Room 1',
              ownerId: 'user-1',
              members: [],
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });

      render(
        <AuthContext.Provider
          value={{
            currentUser: { id: 'user-1', username: 'alice', email: 'alice@test.com' } as any,
            token: 'test-token',
            isLoading: false,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
          }}
        >
          <SocketContext.Provider
            value={{
              socket: mockSocket,
              isConnected: true,
              isConnecting: false,
              isReconnecting: false,
              connectionError: null,
            }}
          >
            <TestRoomMessagesComponent roomId="room-1" />
          </SocketContext.Provider>
        </AuthContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('room-msg-rmsg-1')).toBeInTheDocument();
      });

      mockSocket.recovered = false;
      await act(async () => {
        if (socketListeners['connect']) {
          await socketListeners['connect']();
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('room-msg-rmsg-2')).toBeInTheDocument();
      });

      // Deduplication verification: 2 items instead of 3
      expect(screen.getByTestId('room-message-count').textContent).toBe('2');

      // Verify room re-join was emitted on reconnect
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ROOM_JOIN, { roomId: 'room-1' });
    });
  });
});
