import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { ChatArea } from './ChatArea';
import { RoomChatArea } from '../room/RoomChatArea';
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
  describe('1-1 Direct Chat Message Delivery Checkmarks', () => {
    it('renders single gray checkmark for SENT status', () => {
      const sentMessage: DirectReceiveMessagePayload = {
        id: 'msg-sent',
        directChatId: 'chat-alice-bob',
        senderId: mockCurrentUser.id,
        sender: { id: mockCurrentUser.id, username: mockCurrentUser.username, avatarUrl: null },
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

      const sentCheckmark = screen.getByTestId('status-sent');
      expect(sentCheckmark).toBeInTheDocument();
      expect(sentCheckmark).toHaveAttribute('title', 'Sent');
    });

    it('renders double gray checkmark for DELIVERED status', () => {
      const deliveredMessage: DirectReceiveMessagePayload = {
        id: 'msg-delivered',
        directChatId: 'chat-alice-bob',
        senderId: mockCurrentUser.id,
        sender: { id: mockCurrentUser.id, username: mockCurrentUser.username, avatarUrl: null },
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

      const deliveredCheckmark = screen.getByTestId('status-delivered');
      expect(deliveredCheckmark).toBeInTheDocument();
      expect(deliveredCheckmark).toHaveAttribute('title', 'Delivered');
    });

    it('renders double blue checkmark or "Đã xem" for READ status', () => {
      const readMessage: DirectReceiveMessagePayload = {
        id: 'msg-read',
        directChatId: 'chat-alice-bob',
        senderId: mockCurrentUser.id,
        sender: { id: mockCurrentUser.id, username: mockCurrentUser.username, avatarUrl: null },
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

      const readCheckmark = screen.getByTestId('status-read');
      expect(readCheckmark).toBeInTheDocument();
      // Should indicate Read / Đã xem in title or aria-label
      expect(readCheckmark.getAttribute('title')).toMatch(/Đã xem|Read/i);
    });
  });

  describe('Room Chat Read Indicators', () => {
    it('displays read indicator for messages read by room members', () => {
      const roomMessage: RoomReceiveMessagePayload = {
        id: 'room-msg-1',
        roomId: 'room-1',
        senderId: mockCurrentUser.id,
        sender: { id: mockCurrentUser.id, username: mockCurrentUser.username, avatarUrl: null },
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
      expect(readIndicator.textContent).toMatch(/1/); // 1 reader (Bob)
    });
  });

  describe('Upward Infinite Scroll & Pagination', () => {
    it('triggers onLoadOlderMessages when scrolling near top', () => {
      const onLoadOlderMessages = vi.fn();
      const messages: DirectReceiveMessagePayload[] = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i + 1}`,
        directChatId: 'chat-alice-bob',
        senderId: mockPartnerUser.id,
        sender: { id: mockPartnerUser.id, username: mockPartnerUser.username, avatarUrl: null },
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
  });
});
