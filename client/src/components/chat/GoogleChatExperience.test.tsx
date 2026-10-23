import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  RoomReceiveMessagePayload,
  RoomRole,
  MessageType,
  MessageStatus,
} from '@webchat/shared';

const mockCurrentUser = {
  id: 'current-user-id',
  username: 'duynat',
  email: 'duynat@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockPartner = {
  id: 'partner-user-id',
  username: 'hoanglong',
  email: 'hoanglong@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockDirectChat: DirectChatListItemDto = {
  id: 'chat-1',
  partner: mockPartner,
  lastMessage: {
    id: 'msg-prev',
    directChatId: 'chat-1',
    senderId: 'partner-user-id',
    sender: mockPartner,
    content: 'Chào mừng bạn đến với GDG-HUST!',
    type: MessageType.TEXT,
    status: MessageStatus.READ,
    createdAt: new Date().toISOString(),
  },
  unreadCount: 0,
  updatedAt: new Date().toISOString(),
};

const mockRoom: RoomListItemDto = {
  id: 'room-1',
  name: 'GDG-Core-Team',
  description: 'GDG HUST Core Team Discussion',
  ownerId: 'current-user-id',
  role: RoomRole.OWNER,
  lastMessage: {
    id: 'room-msg-prev',
    roomId: 'room-1',
    senderId: 'partner-user-id',
    sender: mockPartner,
    content: 'Tối nay họp core team nhé!',
    type: MessageType.TEXT,
    createdAt: new Date().toISOString(),
  },
  unreadCount: 0,
  memberCount: 5,
  updatedAt: new Date().toISOString(),
};

function renderWithProviders(ui: React.ReactElement) {
  const authValue: any = {
    currentUser: mockCurrentUser,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };

  const socketValue: any = {
    socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
    isConnected: true,
    isConnecting: false,
    isReconnecting: false,
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

describe('Google Material Chat Experience & Mobile Navigation (Ticket 04)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/direct-chats')) {
        return Promise.resolve({ ok: true, json: async () => [mockDirectChat] });
      }
      if (url.includes('/api/rooms')) {
        return Promise.resolve({ ok: true, json: async () => [mockRoom] });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  describe('Google Material Chat Experience: Bubbles & Input Styling', () => {
    it('renders outgoing bubbles in Google Blue (#4285F4) and incoming bubbles in Google Grey (#F1F3F4) in ChatArea', () => {
      const messages: DirectReceiveMessagePayload[] = [
        {
          id: 'msg-incoming',
          directChatId: 'chat-1',
          senderId: mockPartner.id,
          sender: mockPartner,
          content: 'Incoming Google Grey bubble test',
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-outgoing',
          directChatId: 'chat-1',
          senderId: mockCurrentUser.id,
          sender: mockCurrentUser,
          content: 'Outgoing Google Blue bubble test',
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
          createdAt: new Date().toISOString(),
        },
      ];

      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={messages}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      // Incoming message bubble
      const incomingText = screen.getByText('Incoming Google Grey bubble test');
      const incomingBubble = incomingText.closest('div');
      expect(incomingBubble?.className).toMatch(/bg-google-grey100/);
      expect(incomingBubble?.className).toMatch(/text-google-grey900/);
      expect(incomingBubble?.className).toMatch(/border-google-grey200/);

      // Outgoing message bubble
      const outgoingText = screen.getByText('Outgoing Google Blue bubble test');
      const outgoingBubble = outgoingText.closest('div');
      expect(outgoingBubble?.className).toMatch(/bg-google-blue/);
      expect(outgoingBubble?.className).toMatch(/text-white/);
    });

    it('renders outgoing bubbles in Google Blue and incoming bubbles in Google Grey in RoomChatArea', () => {
      const roomMessages: RoomReceiveMessagePayload[] = [
        {
          id: 'room-msg-incoming',
          roomId: 'room-1',
          senderId: mockPartner.id,
          sender: mockPartner,
          content: 'Room incoming Google Grey bubble',
          type: MessageType.TEXT,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'room-msg-outgoing',
          roomId: 'room-1',
          senderId: mockCurrentUser.id,
          sender: mockCurrentUser,
          content: 'Room outgoing Google Blue bubble',
          type: MessageType.TEXT,
          createdAt: new Date().toISOString(),
        },
      ];

      renderWithProviders(
        <RoomChatArea
          activeRoom={mockRoom}
          roomDetails={null}
          messages={roomMessages}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
          onAddMember={vi.fn()}
          onRemoveMember={vi.fn()}
          onChangeRole={vi.fn()}
          onLeaveRoom={vi.fn()}
          onDeleteRoom={vi.fn()}
        />
      );

      const incomingText = screen.getByText('Room incoming Google Grey bubble');
      const incomingBubble = incomingText.closest('div');
      expect(incomingBubble?.className).toMatch(/bg-google-grey100/);
      expect(incomingBubble?.className).toMatch(/text-google-grey900/);
      expect(incomingBubble?.className).toMatch(/border-google-grey200/);

      const outgoingText = screen.getByText('Room outgoing Google Blue bubble');
      const outgoingBubble = outgoingText.closest('div');
      expect(outgoingBubble?.className).toMatch(/bg-google-blue/);
      expect(outgoingBubble?.className).toMatch(/text-white/);
    });

    it('renders rounded styling (rounded-2xl) and Google Blue focus rings on message composers', () => {
      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/message @hoanglong\.\.\./i);
      const composerContainer = textarea.parentElement;
      expect(composerContainer?.className).toMatch(/rounded-2xl/);
      expect(composerContainer?.className).toMatch(/focus-within:border-google-blue/);

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton.className).toMatch(/bg-google-blue/);
      expect(sendButton.className).toMatch(/rounded-full/);
    });

    it('uses deterministic Google brand colors for fallback user avatars in Sidebar, ChatArea, and RoomChatArea', () => {
      const { rerender } = renderWithProviders(
        <Sidebar
          chats={[mockDirectChat]}
          activeChatId={null}
          onSelectChat={vi.fn()}
          onStartChat={vi.fn()}
          isLoadingChats={false}
        />
      );

      // In Sidebar: partner avatar circle
      const initials = screen.getByText('HO');
      expect(initials.className).toMatch(/bg-google-(blue|red|yellow|green)/);

      // In ChatArea header:
      rerender(
        <AuthContext.Provider value={{ currentUser: mockCurrentUser } as any}>
          <SocketContext.Provider value={{ socket: null, isConnected: true } as any}>
            <ChatArea
              activeChat={mockDirectChat}
              messages={[]}
              isLoadingMessages={false}
              onSendMessage={vi.fn()}
            />
          </SocketContext.Provider>
        </AuthContext.Provider>
      );

      const chatHeaderAvatar = screen.getByText('HO');
      expect(chatHeaderAvatar.className).toMatch(/bg-google-(blue|red|yellow|green)/);

      // In RoomChatArea: message sender avatar
      const roomMsg: RoomReceiveMessagePayload = {
        id: 'msg-sender-test',
        roomId: 'room-1',
        senderId: mockPartner.id,
        sender: mockPartner,
        content: 'Testing sender avatar',
        type: MessageType.TEXT,
        createdAt: new Date().toISOString(),
      };

      rerender(
        <AuthContext.Provider value={{ currentUser: mockCurrentUser } as any}>
          <SocketContext.Provider value={{ socket: null, isConnected: true } as any}>
            <RoomChatArea
              activeRoom={mockRoom}
              roomDetails={null}
              messages={[roomMsg]}
              isLoadingMessages={false}
              onSendMessage={vi.fn()}
              onAddMember={vi.fn()}
              onRemoveMember={vi.fn()}
              onChangeRole={vi.fn()}
              onLeaveRoom={vi.fn()}
              onDeleteRoom={vi.fn()}
            />
          </SocketContext.Provider>
        </AuthContext.Provider>
      );

      const senderAvatar = screen.getByText('HO');
      expect(senderAvatar.className).toMatch(/bg-google-(blue|red|yellow|green)/);
    });
  });

  describe('Mobile Master-Detail Navigation: Zero Blank Screen & Prominent Back Button', () => {
    it('renders prominent Back button in ChatArea and RoomChatArea that triggers onBack', () => {
      const onBackDirect = vi.fn();
      const { rerender } = renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
          onBack={onBackDirect}
        />
      );

      const backBtn = screen.getByRole('button', { name: /back to chats/i });
      expect(backBtn).toBeInTheDocument();
      expect(backBtn.className).toMatch(/md:hidden/);
      expect(backBtn.className).toMatch(/rounded-full/);

      fireEvent.click(backBtn);
      expect(onBackDirect).toHaveBeenCalledTimes(1);

      const onBackRoom = vi.fn();
      rerender(
        <AuthContext.Provider value={{ currentUser: mockCurrentUser } as any}>
          <SocketContext.Provider value={{ socket: null, isConnected: true } as any}>
            <RoomChatArea
              activeRoom={mockRoom}
              roomDetails={null}
              messages={[]}
              isLoadingMessages={false}
              onSendMessage={vi.fn()}
              onAddMember={vi.fn()}
              onRemoveMember={vi.fn()}
              onChangeRole={vi.fn()}
              onLeaveRoom={vi.fn()}
              onDeleteRoom={vi.fn()}
              onBack={onBackRoom}
            />
          </SocketContext.Provider>
        </AuthContext.Provider>
      );

      const roomBackBtn = screen.getByRole('button', { name: /back to chats/i });
      expect(roomBackBtn).toBeInTheDocument();
      expect(roomBackBtn.className).toMatch(/md:hidden/);
      expect(roomBackBtn.className).toMatch(/rounded-full/);

      fireEvent.click(roomBackBtn);
      expect(onBackRoom).toHaveBeenCalledTimes(1);
    });

    it('seamlessly transitions from sidebar to chat detail pane with message history and composer on mobile with zero blank screens', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('hoanglong')).toBeInTheDocument();
      });

      // Initially no conversation is active:
      // Sidebar is full width on mobile, chat-area-container is hidden on mobile
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.className).toMatch(/w-full/);
      expect(sidebar.className).toMatch(/md:w-88/);

      const chatContainer = screen.getByTestId('chat-area-container');
      expect(chatContainer.className).toMatch(/hidden\s+md:flex/);

      // Tap conversation item to open chat
      const chatItem = screen.getByText('hoanglong').closest('button') || screen.getByText('hoanglong');
      fireEvent.click(chatItem);

      await waitFor(() => {
        // Sidebar is hidden on mobile
        expect(sidebar.className).toMatch(/hidden\s+md:flex/);
        // Chat detail pane is 100% width on mobile (w-full flex)
        expect(chatContainer.className).toMatch(/w-full\s+flex/);
      });

      // Verify ZERO blank white screen: Chat header, message history, and composer are all rendered
      expect(screen.getByRole('heading', { name: 'hoanglong' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/message @hoanglong\.\.\./i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();

      // Tap Back button returns to conversation list
      const backBtn = screen.getByRole('button', { name: /back to chats/i });
      fireEvent.click(backBtn);

      await waitFor(() => {
        expect(sidebar.className).toMatch(/w-full/);
        expect(chatContainer.className).toMatch(/hidden\s+md:flex/);
      });
    });

    it('strictly preserves dual-pane side-by-side layout on desktop viewports (>= 768px)', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('hoanglong')).toBeInTheDocument();
      });

      const sidebar = screen.getByRole('complementary');
      const chatContainer = screen.getByTestId('chat-area-container');

      // Desktop layout uses fixed 352px sidebar (md:w-88) and side-by-side flex pane (md:flex)
      expect(sidebar.className).toMatch(/md:w-88/);
      expect(chatContainer.className).toMatch(/md:flex/);
    });
  });
});
