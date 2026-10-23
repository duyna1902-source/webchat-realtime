import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { ChatArea } from './ChatArea';
import { RoomChatArea } from '../room/RoomChatArea';
import { Sidebar } from './Sidebar';
import { Dashboard } from '../dashboard/Dashboard';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import {
  DirectChatListItemDto,
  DirectReceiveMessagePayload,
  RoomListItemDto,
  RoomDetailDto,
  RoomReceiveMessagePayload,
  RoomRole,
  MessageType,
  MessageStatus,
  SOCKET_EVENTS,
} from '@webchat/shared';
import * as notificationUtils from '../../utils/notifications';
import { publicUser } from '../../test/fixtures';

const mockCurrentUser = {
  id: 'user-alice-id',
  username: 'alice',
  email: 'alice@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockPartnerUser = {
  id: 'user-bob-id',
  username: 'bob',
  email: 'bob@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockDirectChat: DirectChatListItemDto = {
  id: 'chat-alice-bob',
  partner: mockPartnerUser,
  lastMessage: null,
  unreadCount: 0,
  updatedAt: new Date().toISOString(),
};

const mockRoom: RoomListItemDto = {
  id: 'room-1',
  name: 'Dev Team',
  description: 'Team Chat',
  ownerId: 'user-alice-id',
  role: RoomRole.OWNER,
  lastMessage: null,
  unreadCount: 0,
  memberCount: 2,
  updatedAt: new Date().toISOString(),
};

const mockRoomDetails: RoomDetailDto = {
  id: 'room-1',
  name: 'Dev Team',
  description: 'Team Chat',
  ownerId: 'user-alice-id',
  role: RoomRole.OWNER,
  memberCount: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  members: [
    {
      id: 'member-1',
      roomId: 'room-1',
      userId: 'user-alice-id',
      role: RoomRole.OWNER,
      lastReadMessageId: null,
      joinedAt: new Date().toISOString(),
      user: mockCurrentUser,
    },
    {
      id: 'member-2',
      roomId: 'room-1',
      userId: 'user-bob-id',
      role: RoomRole.MEMBER,
      lastReadMessageId: 'room-msg-1',
      joinedAt: new Date().toISOString(),
      user: mockPartnerUser,
    },
  ],
};

function renderWithProviders(ui: React.ReactElement, socketMock?: any) {
  const authValue: any = {
    currentUser: mockCurrentUser,
    token: 'jwt-alice-token',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };

  const socketValue: any = {
    socket: socketMock || { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
    isConnected: true,
    isConnecting: false,
    connectionError: null,
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <SocketContext.Provider value={socketValue}>
        {ui}
      </SocketContext.Provider>
    </AuthContext.Provider>
  );
}

describe('Read Receipts, Cursor Pagination & Web Notifications', () => {
  describe('1-1 Direct Chat Message Delivery Status (Variant B Checkmark-Free & Watermark)', () => {
    it('renders minimalist text "Sent" below bubble for SENT status', () => {
      const sentMessage: DirectReceiveMessagePayload = {
        id: 'msg-sent',
        directChatId: 'chat-alice-bob',
        senderId: mockCurrentUser.id,
        sender: publicUser(mockCurrentUser.id, mockCurrentUser.username),
        content: 'Hello Bob! This is sent.',
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        createdAt: new Date().toISOString(),
      };

      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[sentMessage]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const sentStatus = screen.getByTestId('status-sent');
      expect(sentStatus).toBeInTheDocument();
      expect(sentStatus).toHaveAttribute('title', 'Sent');
      expect(sentStatus.textContent).toBe('Sent');
    });

    it('renders minimalist text "Delivered" below bubble for DELIVERED status', () => {
      const deliveredMessage: DirectReceiveMessagePayload = {
        id: 'msg-delivered',
        directChatId: 'chat-alice-bob',
        senderId: mockCurrentUser.id,
        sender: publicUser(mockCurrentUser.id, mockCurrentUser.username),
        content: 'Hello Bob! This is delivered.',
        type: MessageType.TEXT,
        status: MessageStatus.DELIVERED,
        createdAt: new Date().toISOString(),
      };

      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[deliveredMessage]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const deliveredStatus = screen.getByTestId('status-delivered');
      expect(deliveredStatus).toBeInTheDocument();
      expect(deliveredStatus).toHaveAttribute('title', 'Delivered');
      expect(deliveredStatus.textContent).toBe('Delivered');
    });

    it('renders "Seen" paired with partner Mini-Avatar for READ status', () => {
      const readMessage: DirectReceiveMessagePayload = {
        id: 'msg-read',
        directChatId: 'chat-alice-bob',
        senderId: mockCurrentUser.id,
        sender: publicUser(mockCurrentUser.id, mockCurrentUser.username),
        content: 'Hello Bob! You have read this.',
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        createdAt: new Date().toISOString(),
      };

      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[readMessage]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const readStatus = screen.getByTestId('status-read');
      expect(readStatus).toBeInTheDocument();
      expect(readStatus.getAttribute('title')).toMatch(/Đã xem|Read/i);
      expect(readStatus.textContent).toMatch(/Seen/i);
      // Partner Bob initials 'BO' in mini avatar
      expect(readStatus.textContent).toMatch(/BO/);
    });

    it('enforces single read watermark: Seen moves down to newest seen message and disappears from older messages', () => {
      const msg1: DirectReceiveMessagePayload = {
        id: 'msg-1',
        directChatId: 'chat-alice-bob',
        senderId: mockCurrentUser.id,
        sender: publicUser(mockCurrentUser.id, mockCurrentUser.username),
        content: 'First message',
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        createdAt: new Date(Date.now() - 5000).toISOString(),
      };

      const msg2: DirectReceiveMessagePayload = {
        id: 'msg-2',
        directChatId: 'chat-alice-bob',
        senderId: mockCurrentUser.id,
        sender: publicUser(mockCurrentUser.id, mockCurrentUser.username),
        content: 'Second message',
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        createdAt: new Date().toISOString(),
      };

      const { rerender } = renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[msg1, msg2]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      // Initially, msg1 is READ so it shows status-read, msg2 is SENT so it shows status-sent
      expect(screen.getByTestId('status-read')).toBeInTheDocument();
      expect(screen.getByTestId('status-sent')).toBeInTheDocument();
      expect(screen.getAllByTestId('status-read')).toHaveLength(1);

      // Now Bob reads msg2 as well
      const msg2Read: DirectReceiveMessagePayload = {
        ...msg2,
        status: MessageStatus.READ,
      };

      rerender(
        <AuthContext.Provider
          value={{
            currentUser: mockCurrentUser,
            token: 'jwt-alice-token',
            isLoading: false,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
          } as any}
        >
          <SocketContext.Provider
            value={{
              socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as any,
              isConnected: true,
              isConnecting: false,
              isReconnecting: false,
              connectionError: null,
            }}
          >
            <ChatArea
              activeChat={mockDirectChat}
              messages={[msg1, msg2Read]}
              isLoadingMessages={false}
              onSendMessage={vi.fn()}
            />
          </SocketContext.Provider>
        </AuthContext.Provider>
      );

      // Single watermark: only exactly ONE status-read exists, belonging to the newest message msg2
      const readIndicators = screen.getAllByTestId('status-read');
      expect(readIndicators).toHaveLength(1);
      expect(screen.queryByTestId('status-sent')).not.toBeInTheDocument();
    });
  });

  describe('Room Chat Read Indicators & Outgoing Message Layout', () => {
    it('hides sender own 32px avatar circle on outgoing room messages and renders Sent when 0 readers', () => {
      const roomMessage: RoomReceiveMessagePayload = {
        id: 'room-msg-sent',
        roomId: 'room-1',
        senderId: mockCurrentUser.id,
        sender: publicUser(mockCurrentUser.id, mockCurrentUser.username),
        content: 'Message waiting for readers',
        type: MessageType.TEXT,
        createdAt: new Date().toISOString(),
      };

      renderWithProviders(
        <RoomChatArea
          activeRoom={mockRoom}
          roomDetails={{ ...mockRoomDetails, members: [] }}
          messages={[roomMessage]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
          onAddMember={vi.fn()}
          onRemoveMember={vi.fn()}
          onChangeRole={vi.fn()}
          onLeaveRoom={vi.fn()}
          onDeleteRoom={vi.fn()}
        />
      );

      // Alice is sender, so 'AL' avatar circle is NOT rendered
      expect(screen.queryByText('AL')).not.toBeInTheDocument();

      // Displays Sent below outgoing message when 0 readers
      const sentIndicator = screen.getByTestId('status-sent');
      expect(sentIndicator).toBeInTheDocument();
      expect(sentIndicator.textContent).toBe('Sent');
    });

    it('displays Seen by N with reader Mini-Avatars for messages read by room members', () => {
      const roomMessage: RoomReceiveMessagePayload = {
        id: 'room-msg-1',
        roomId: 'room-1',
        senderId: mockCurrentUser.id,
        sender: publicUser(mockCurrentUser.id, mockCurrentUser.username),
        content: 'Welcome team!',
        type: MessageType.TEXT,
        createdAt: new Date().toISOString(),
      };

      renderWithProviders(
        <RoomChatArea
          activeRoom={mockRoom}
          roomDetails={mockRoomDetails}
          messages={[roomMessage]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
          onAddMember={vi.fn()}
          onRemoveMember={vi.fn()}
          onChangeRole={vi.fn()}
          onLeaveRoom={vi.fn()}
          onDeleteRoom={vi.fn()}
        />
      );

      // Member Bob has lastReadMessageId = 'room-msg-1'
      const readIndicator = screen.getByTestId('room-message-read-indicator');
      expect(readIndicator).toBeInTheDocument();
      expect(readIndicator.textContent).toMatch(/Seen by 1/i);
      expect(readIndicator.textContent).toMatch(/BO/); // Bob mini-avatar initials
    });
  });

  describe('Sidebar Outgoing Delivery Status & "You:" Prefix', () => {
    it('prefixes outgoing last message with "You: " and renders partner mini-avatar for READ status', () => {
      const chatWithReadOutgoing: DirectChatListItemDto = {
        ...mockDirectChat,
        lastMessage: {
          id: 'last-msg-1',
          content: 'Hello Bob from Alice',
          senderId: mockCurrentUser.id,
          createdAt: new Date().toISOString(),
          status: MessageStatus.READ,
          type: MessageType.TEXT,
        } as any,
      };

      renderWithProviders(
        <Sidebar
          chats={[chatWithReadOutgoing]}
          rooms={[]}
          activeChatId={null}
          activeRoomId={null}
          onSelectChat={vi.fn()}
          onSelectRoom={vi.fn()}
          onStartChat={vi.fn()}
          onCreateRoom={vi.fn()}
          isLoadingChats={false}
        />
      );

      // Verify "You: Hello Bob from Alice"
      expect(screen.getByText(/You: Hello Bob from Alice/i)).toBeInTheDocument();
      // Verify partner mini-avatar or Seen indicator in sidebar
      const partnerMiniAvatar = screen.getByTitle(`Seen by ${mockPartnerUser.username}`);
      expect(partnerMiniAvatar).toBeInTheDocument();
      expect(partnerMiniAvatar.textContent).toBe('BO');
    });

    it('prefixes outgoing last message with "You: " and renders "Delivered" for DELIVERED status', () => {
      const chatWithDeliveredOutgoing: DirectChatListItemDto = {
        ...mockDirectChat,
        lastMessage: {
          id: 'last-msg-2',
          content: 'Waiting for Bob to read',
          senderId: mockCurrentUser.id,
          createdAt: new Date().toISOString(),
          status: MessageStatus.DELIVERED,
          type: MessageType.TEXT,
        } as any,
      };

      renderWithProviders(
        <Sidebar
          chats={[chatWithDeliveredOutgoing]}
          rooms={[]}
          activeChatId={null}
          activeRoomId={null}
          onSelectChat={vi.fn()}
          onSelectRoom={vi.fn()}
          onStartChat={vi.fn()}
          onCreateRoom={vi.fn()}
          isLoadingChats={false}
        />
      );

      expect(screen.getByText(/You: Waiting for Bob to read/i)).toBeInTheDocument();
      expect(screen.getByText('Delivered')).toBeInTheDocument();
    });
  });

  describe('Upward Infinite Scroll & Pagination', () => {
    it('triggers onLoadOlderMessages when scrolling near top', () => {
      const onLoadOlderMessages = vi.fn();
      const messages: DirectReceiveMessagePayload[] = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i + 1}`,
        directChatId: 'chat-alice-bob',
        senderId: mockPartnerUser.id,
        sender: publicUser(mockPartnerUser.id, mockPartnerUser.username),
        content: `Message #${i + 1}`,
        type: MessageType.TEXT,
        status: MessageStatus.READ,
        createdAt: new Date(Date.now() - (50 - i) * 1000).toISOString(),
      }));

      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={messages}
          isLoadingMessages={false}
          hasMore={true}
          isLoadingOlder={false}
          onLoadOlderMessages={onLoadOlderMessages}
          onSendMessage={vi.fn()}
        />
      );

      const scrollContainer = screen.getByTestId('chat-messages-container');
      expect(scrollContainer).toBeInTheDocument();

      // Simulate scrolling near the top (scrollTop < 40)
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 10, writable: true });
      fireEvent.scroll(scrollContainer);

      expect(onLoadOlderMessages).toHaveBeenCalled();
    });
  });

  describe('Browser Notification Toggle & Audio Ping', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      (window as any).Notification.permission = 'default';
    });

    it('renders notification toggle button and requests permission on click', async () => {
      // Mock global fetch for dashboard hooks
      global.fetch = vi.fn((url: any) => {
        if (url.includes('/api/direct-chats')) {
          return Promise.resolve({ ok: true, json: async () => [mockDirectChat] });
        }
        if (url.includes('/api/rooms')) {
          return Promise.resolve({ ok: true, json: async () => [mockRoom] });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      }) as any;

      renderWithProviders(<Dashboard />);

      const toggleBtn = screen.getByTestId('notification-toggle-btn');
      expect(toggleBtn).toBeInTheDocument();

      // Click to toggle and request permission
      await act(async () => {
        fireEvent.click(toggleBtn);
      });

      expect((window as any).Notification.requestPermission).toHaveBeenCalled();
    });

    it('plays sound and displays browser notification when document.hidden === true', async () => {
      const socketListeners: Record<string, Function[]> = {};
      const mockSocket: any = {
        emit: vi.fn(),
        on: vi.fn((event, handler) => {
          if (!socketListeners[event]) socketListeners[event] = [];
          socketListeners[event].push(handler);
        }),
        off: vi.fn((event, handler) => {
          if (socketListeners[event]) {
            socketListeners[event] = socketListeners[event].filter((h) => h !== handler);
          }
        }),
      };

      (window as any).Notification.permission = 'granted';
      localStorage.setItem('webchat_notifications_enabled', 'true');
      Object.defineProperty(document, 'hidden', { value: true, configurable: true, writable: true });

      const playSpy = vi.spyOn(notificationUtils, 'playNotificationSound').mockImplementation(() => {});
      const showSpy = vi.spyOn(notificationUtils, 'showBrowserNotification').mockImplementation(() => null);

      global.fetch = vi.fn((url: any) => {
        if (url.includes('/api/direct-chats')) {
          return Promise.resolve({ ok: true, json: async () => [mockDirectChat] });
        }
        if (url.includes('/api/rooms')) {
          return Promise.resolve({ ok: true, json: async () => [mockRoom] });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      }) as any;

      renderWithProviders(<Dashboard />, mockSocket);

      await act(async () => {
        socketListeners[SOCKET_EVENTS.DIRECT_RECEIVE]?.forEach((fn) =>
          fn({
            id: 'msg-notif-1',
            directChatId: 'chat-other',
            senderId: 'user-bob-id',
            sender: mockPartnerUser,
            content: 'Hello in background',
            type: MessageType.TEXT,
            status: MessageStatus.SENT,
            createdAt: new Date().toISOString(),
          })
        );
      });

      expect(playSpy).toHaveBeenCalled();
      expect(showSpy).toHaveBeenCalledWith('bob', expect.objectContaining({
        body: 'Hello in background',
      }));

      playSpy.mockRestore();
      showSpy.mockRestore();
    });

    it('never uses a user-supplied URL as the browser notification icon (A04)', async () => {
      const socketListeners: Record<string, Function[]> = {};
      const mockSocket: any = {
        emit: vi.fn(),
        on: vi.fn((event, handler) => {
          if (!socketListeners[event]) socketListeners[event] = [];
          socketListeners[event].push(handler);
        }),
        off: vi.fn(),
      };

      (window as any).Notification.permission = 'granted';
      localStorage.setItem('webchat_notifications_enabled', 'true');
      Object.defineProperty(document, 'hidden', { value: true, configurable: true, writable: true });

      const playSpy = vi.spyOn(notificationUtils, 'playNotificationSound').mockImplementation(() => {});
      const showSpy = vi.spyOn(notificationUtils, 'showBrowserNotification').mockImplementation(() => null);
      global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as any;

      renderWithProviders(<Dashboard />, mockSocket);

      await act(async () => {
        socketListeners[SOCKET_EVENTS.ROOM_RECEIVE]?.forEach((fn) =>
          fn({
            id: 'msg-notif-avatar',
            roomId: 'room-other',
            senderId: 'user-bob-id',
            // An old server or a tampered payload may still carry an avatar URL.
            sender: { id: 'user-bob-id', username: 'bob', avatarUrl: 'https://attacker.example/track.png' },
            content: 'Hello',
            type: MessageType.TEXT,
            createdAt: new Date().toISOString(),
          })
        );
      });

      expect(showSpy).toHaveBeenCalledTimes(1);
      const icon = showSpy.mock.calls[0][1]?.icon;
      expect(icon).toMatch(/^blob:/);
      expect(icon).not.toContain('attacker.example');

      playSpy.mockRestore();
      showSpy.mockRestore();
    });

    it('plays sound without browser notification when document.hidden === false and message is in inactive conversation', async () => {
      const socketListeners: Record<string, Function[]> = {};
      const mockSocket: any = {
        emit: vi.fn(),
        on: vi.fn((event, handler) => {
          if (!socketListeners[event]) socketListeners[event] = [];
          socketListeners[event].push(handler);
        }),
        off: vi.fn((event, handler) => {
          if (socketListeners[event]) {
            socketListeners[event] = socketListeners[event].filter((h) => h !== handler);
          }
        }),
      };

      (window as any).Notification.permission = 'granted';
      localStorage.setItem('webchat_notifications_enabled', 'true');
      Object.defineProperty(document, 'hidden', { value: false, configurable: true, writable: true });

      const playSpy = vi.spyOn(notificationUtils, 'playNotificationSound').mockImplementation(() => {});
      const showSpy = vi.spyOn(notificationUtils, 'showBrowserNotification').mockImplementation(() => null);

      global.fetch = vi.fn((url: any) => {
        if (url.includes('/api/direct-chats')) {
          return Promise.resolve({ ok: true, json: async () => [mockDirectChat] });
        }
        if (url.includes('/api/rooms')) {
          return Promise.resolve({ ok: true, json: async () => [mockRoom] });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      }) as any;

      renderWithProviders(<Dashboard />, mockSocket);

      await act(async () => {
        socketListeners[SOCKET_EVENTS.DIRECT_RECEIVE]?.forEach((fn) =>
          fn({
            id: 'msg-notif-2',
            directChatId: 'chat-other',
            senderId: 'user-bob-id',
            sender: mockPartnerUser,
            content: 'Hello in another chat',
            type: MessageType.TEXT,
            status: MessageStatus.SENT,
            createdAt: new Date().toISOString(),
          })
        );
      });

      expect(playSpy).toHaveBeenCalled();
      expect(showSpy).not.toHaveBeenCalled();

      playSpy.mockRestore();
      showSpy.mockRestore();
    });

    it('does NOT play sound or show notification for outgoing messages or messages in active chat', async () => {
      const socketListeners: Record<string, Function[]> = {};
      const mockSocket: any = {
        emit: vi.fn(),
        on: vi.fn((event, handler) => {
          if (!socketListeners[event]) socketListeners[event] = [];
          socketListeners[event].push(handler);
        }),
        off: vi.fn((event, handler) => {
          if (socketListeners[event]) {
            socketListeners[event] = socketListeners[event].filter((h) => h !== handler);
          }
        }),
      };

      (window as any).Notification.permission = 'granted';
      localStorage.setItem('webchat_notifications_enabled', 'true');
      Object.defineProperty(document, 'hidden', { value: false, configurable: true, writable: true });

      const playSpy = vi.spyOn(notificationUtils, 'playNotificationSound').mockImplementation(() => {});
      const showSpy = vi.spyOn(notificationUtils, 'showBrowserNotification').mockImplementation(() => null);

      global.fetch = vi.fn((url: any) => {
        if (url.includes('/api/direct-chats')) {
          return Promise.resolve({ ok: true, json: async () => [mockDirectChat] });
        }
        if (url.includes('/api/rooms')) {
          return Promise.resolve({ ok: true, json: async () => [mockRoom] });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      }) as any;

      renderWithProviders(<Dashboard />, mockSocket);

      // Outgoing message sent by Alice herself
      await act(async () => {
        socketListeners[SOCKET_EVENTS.DIRECT_RECEIVE]?.forEach((fn) =>
          fn({
            id: 'msg-outgoing',
            directChatId: 'chat-alice-bob',
            senderId: mockCurrentUser.id,
            sender: mockCurrentUser,
            content: 'My own message',
            type: MessageType.TEXT,
            status: MessageStatus.SENT,
            createdAt: new Date().toISOString(),
          })
        );
      });

      expect(playSpy).not.toHaveBeenCalled();
      expect(showSpy).not.toHaveBeenCalled();

      playSpy.mockRestore();
      showSpy.mockRestore();
    });
  });
});
