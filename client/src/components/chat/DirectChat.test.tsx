import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

function renderWithProviders(ui: React.ReactElement, socketConnected = true, customSocket?: any) {
  const authValue: any = {
    currentUser: mockUser,
    token: 'token-xyz',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };

  const socketValue: any = {
    socket: customSocket || { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
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
    expect(screen.getByText(/select an existing direct chat from the sidebar/i)).toBeInTheDocument();
  });

  it('displays online presence status in sidebar and chat header', () => {
    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    expect(screen.getByText('Online')).toBeInTheDocument();
    const presenceDot = screen.getByTestId('chat-header-presence-dot');
    expect(presenceDot).toHaveClass('bg-emerald-500');
  });

  it('displays offline status and last seen timestamp when partner is offline', () => {
    const offlineChat: DirectChatListItemDto = {
      ...mockChat,
      partner: {
        ...mockPartner,
        isOnline: false,
        lastSeenAt: '2026-01-01T10:00:00Z',
      },
    };

    renderWithProviders(
      <ChatArea
        activeChat={offlineChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    expect(screen.getByText(/last seen/i)).toBeInTheDocument();
    const presenceDot = screen.getByTestId('chat-header-presence-dot');
    expect(presenceDot).toHaveClass('bg-gray-300');
  });

  it('emits direct:typing on key input and emits isTyping: false on submit', () => {
    const mockEmit = vi.fn();
    const mockSocket = {
      emit: mockEmit,
      on: vi.fn(),
      off: vi.fn(),
    };

    const onSendMessage = vi.fn();

    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={onSendMessage}
      />,
      true,
      mockSocket
    );

    const textarea = screen.getByPlaceholderText(/message @bobpartner\.\.\./i);

    // User types
    fireEvent.change(textarea, { target: { value: 'Typing something...' } });

    expect(mockEmit).toHaveBeenCalledWith('direct:typing', {
      directChatId: 'chat-1',
      isTyping: true,
    });

    // User submits message
    const sendBtn = screen.getByRole('button', { name: /send message/i });
    fireEvent.click(sendBtn);

    expect(mockEmit).toHaveBeenCalledWith('direct:typing', {
      directChatId: 'chat-1',
      isTyping: false,
    });
  });

  it('displays animated typing indicator when partner sends direct:typing true', () => {
    let typingCallback: ((payload: any) => void) | null = null;
    const mockSocket = {
      emit: vi.fn(),
      on: vi.fn((event: string, cb: any) => {
        if (event === 'direct:typing') {
          typingCallback = cb;
        }
      }),
      off: vi.fn(),
    };

    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />,
      true,
      mockSocket
    );

    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();

    // Simulate incoming typing event from partner
    act(() => {
      if (typingCallback) {
        (typingCallback as any)({
          directChatId: 'chat-1',
          userId: 'partner-user-id',
          isTyping: true,
        });
      }
    });

    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    expect(screen.getByText(/bobpartner is typing/i)).toBeInTheDocument();

    // Partner stops typing
    act(() => {
      if (typingCallback) {
        (typingCallback as any)({
          directChatId: 'chat-1',
          userId: 'partner-user-id',
          isTyping: false,
        });
      }
    });

    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
  });
});
