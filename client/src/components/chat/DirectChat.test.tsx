import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { DirectChatListItemDto, DirectReceiveMessagePayload, MessageType, MessageStatus } from '@webchat/shared';

const mockUser = {
  id: 'current-user-id',
  username: 'currentuser',
  email: 'current@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockPartner = {
  id: 'partner-user-id',
  username: 'bobpartner',
  email: 'bob@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockChat: DirectChatListItemDto = {
  id: 'chat-1',
  partner: mockPartner,
  lastMessage: {
    id: 'msg-1',
    directChatId: 'chat-1',
    senderId: 'partner-user-id',
    sender: { id: 'partner-user-id', username: 'bobpartner', avatarUrl: null },
    content: 'Hey there!',
    type: MessageType.TEXT,
    status: MessageStatus.SENT,
    attachmentUrl: null,
    attachmentName: null,
    attachmentSize: null,
    createdAt: new Date().toISOString(),
  },
  unreadCount: 0,
  updatedAt: new Date().toISOString(),
};

function renderWithProviders(ui: React.ReactElement, socketConnected = true) {
  const authValue: any = {
    currentUser: mockUser,
    token: 'token-xyz',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };

  const socketValue: any = {
    socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
    isConnected: socketConnected,
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

describe('Direct Chat Client Components', () => {
  it('renders sidebar with conversation item', () => {
    const onSelectChat = vi.fn();
    const onStartChat = vi.fn();

    renderWithProviders(
      <Sidebar
        chats={[mockChat]}
        activeChatId={null}
        onSelectChat={onSelectChat}
        onStartChat={onStartChat}
        isLoadingChats={false}
      />
    );

    expect(screen.getByText('bobpartner')).toBeInTheDocument();
    expect(screen.getByText('Hey there!')).toBeInTheDocument();

    fireEvent.click(screen.getByText('bobpartner'));
    expect(onSelectChat).toHaveBeenCalledWith('chat-1');
  });

  it('renders chat area with message bubbles and allows sending message', () => {
    const onSendMessage = vi.fn();
    const messages: DirectReceiveMessagePayload[] = [
      {
        id: 'msg-1',
        directChatId: 'chat-1',
        senderId: 'partner-user-id',
        sender: { id: 'partner-user-id', username: 'bobpartner', avatarUrl: null },
        content: 'Hello from Bob',
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        attachmentUrl: null,
        attachmentName: null,
        attachmentSize: null,
        createdAt: new Date('2026-01-01T12:00:00Z').toISOString(),
      },
      {
        id: 'msg-2',
        directChatId: 'chat-1',
        senderId: 'current-user-id',
        sender: { id: 'current-user-id', username: 'currentuser', avatarUrl: null },
        content: 'Hi Bob, how are you?',
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        attachmentUrl: null,
        attachmentName: null,
        attachmentSize: null,
        createdAt: new Date('2026-01-01T12:01:00Z').toISOString(),
      },
    ];

    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={messages}
        isLoadingMessages={false}
        onSendMessage={onSendMessage}
      />
    );

    // Verify messages are rendered
    expect(screen.getByText('Hello from Bob')).toBeInTheDocument();
    expect(screen.getByText('Hi Bob, how are you?')).toBeInTheDocument();

    // Type a new message
    const textarea = screen.getByPlaceholderText(/message @bobpartner\.\.\./i);
    fireEvent.change(textarea, { target: { value: 'Doing great!' } });

    // Click send
    const sendBtn = screen.getByRole('button', { name: /send message/i });
    fireEvent.click(sendBtn);

    expect(onSendMessage).toHaveBeenCalledWith('Doing great!');
    expect(textarea).toHaveValue('');
  });

  it('submits on Enter key without Shift', () => {
    const onSendMessage = vi.fn();

    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={onSendMessage}
      />
    );

    const textarea = screen.getByPlaceholderText(/message @bobpartner\.\.\./i);
    fireEvent.change(textarea, { target: { value: 'Test message with Enter' } });

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: false });

    expect(onSendMessage).toHaveBeenCalledWith('Test message with Enter');
  });

  it('renders empty placeholder when no chat is selected', () => {
    renderWithProviders(
      <ChatArea
        activeChat={null}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    expect(screen.getByText(/real-time direct messaging/i)).toBeInTheDocument();
    expect(screen.getByText(/select an existing conversation from the sidebar/i)).toBeInTheDocument();
  });
});
