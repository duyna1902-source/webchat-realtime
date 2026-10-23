import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { DirectChatListItemDto, DirectReceiveMessagePayload, MessageType, MessageStatus, MESSAGE_LIMITS } from '@webchat/shared';
import { attachmentFixture } from '../../test/attachmentFixtures';
import { publicUser } from '../../test/fixtures';

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
    sender: publicUser('partner-user-id', 'bobpartner'),
    content: 'Hey there!',
    type: MessageType.TEXT,
    status: MessageStatus.SENT,
    attachment: null,
    createdAt: new Date().toISOString(),
  },
  unreadCount: 0,
  updatedAt: new Date().toISOString(),
};

function renderWithProviders(ui: React.ReactElement, socketConnected = true, customSocket?: any) {
  const authValue: any = {
    currentUser: mockUser,
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
        sender: publicUser('partner-user-id', 'bobpartner'),
        content: 'Hello from Bob',
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        attachment: null,
        createdAt: new Date('2026-01-01T12:00:00Z').toISOString(),
      },
      {
        id: 'msg-2',
        directChatId: 'chat-1',
        senderId: 'current-user-id',
        sender: publicUser('current-user-id', 'currentuser'),
        content: 'Hi Bob, how are you?',
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        attachment: null,
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
    expect(presenceDot).toHaveClass('bg-google-green');
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

  it('renders a mobile Back button when onBack is provided, hidden on desktop, and invokes callback on click', () => {
    const onBack = vi.fn();

    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onBack={onBack}
      />
    );

    const backButton = screen.getByRole('button', { name: /back to chats/i });
    expect(backButton).toBeInTheDocument();
    expect(backButton.className).toMatch(/md:hidden/);

    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders Google Blue Unread Count Badge when unreadCount > 0 and caps at 99+', () => {
    const chatWithUnread: DirectChatListItemDto = {
      ...mockChat,
      id: 'chat-unread',
      unreadCount: 5,
    };

    const chatWithHugeUnread: DirectChatListItemDto = {
      ...mockChat,
      id: 'chat-huge',
      unreadCount: 120,
    };

    const { rerender } = renderWithProviders(
      <Sidebar
        chats={[chatWithUnread]}
        activeChatId={null}
        onSelectChat={vi.fn()}
        onStartChat={vi.fn()}
        isLoadingChats={false}
      />
    );

    const badge = screen.getByTestId('unread-badge-chat-unread');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('5');
    expect(badge.className).toMatch(/bg-google-blue/);

    rerender(
      <AuthContext.Provider
        value={{
          currentUser: mockUser,
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
          <Sidebar
            chats={[chatWithHugeUnread]}
            activeChatId={null}
            onSelectChat={vi.fn()}
            onStartChat={vi.fn()}
            isLoadingChats={false}
          />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    const hugeBadge = screen.getByTestId('unread-badge-chat-huge');
    expect(hugeBadge.textContent).toBe('99+');
  });

  it('formats friendly media snippets in sidebar preview for IMAGE, DOCUMENT and GIF', () => {
    const chatImage: DirectChatListItemDto = {
      ...mockChat,
      id: 'chat-img',
      lastMessage: {
        id: 'msg-img',
        directChatId: 'chat-img',
        senderId: 'partner-user-id',
        sender: publicUser('partner-user-id', 'bobpartner'),
        content: '',
        type: MessageType.IMAGE,
        status: MessageStatus.DELIVERED,
        attachment: attachmentFixture({ url: 'https://example.com/photo.png', name: 'photo.png', size: 1024 }),
        createdAt: new Date().toISOString(),
      },
    };

    const chatDoc: DirectChatListItemDto = {
      ...mockChat,
      id: 'chat-doc',
      lastMessage: {
        id: 'msg-doc',
        directChatId: 'chat-doc',
        senderId: 'partner-user-id',
        sender: publicUser('partner-user-id', 'bobpartner'),
        content: '',
        type: MessageType.DOCUMENT,
        status: MessageStatus.DELIVERED,
        attachment: attachmentFixture({ url: 'https://example.com/spec.pdf', name: 'Project_Spec.pdf', size: 2048 }),
        createdAt: new Date().toISOString(),
      },
    };

    const chatGif: DirectChatListItemDto = {
      ...mockChat,
      id: 'chat-gif',
      lastMessage: {
        id: 'msg-gif',
        directChatId: 'chat-gif',
        senderId: 'partner-user-id',
        sender: publicUser('partner-user-id', 'bobpartner'),
        content: 'https://media.giphy.com/media/test.gif',
        type: MessageType.EMOJI_GIF,
        status: MessageStatus.DELIVERED,
        attachment: null,
        createdAt: new Date().toISOString(),
      },
    };

    renderWithProviders(
      <Sidebar
        chats={[chatImage, chatDoc, chatGif]}
        activeChatId={null}
        onSelectChat={vi.fn()}
        onStartChat={vi.fn()}
        isLoadingChats={false}
      />
    );

    expect(screen.getByText(/📷 Sent an image/i)).toBeInTheDocument();
    expect(screen.getByText(/📎 Project_Spec.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/✨ Sent a GIF/i)).toBeInTheDocument();
  });
});

describe('Direct Chat 4000-Character Limit & Anti-Clipping UI (Ticket 01)', () => {
  it('displays initial counter 0/4000 with neutral grey color and enforces maxLength 4000 on textarea', () => {
    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const counter = screen.getByTestId('char-counter');
    expect(counter).toBeInTheDocument();
    expect(counter.textContent).toBe('0/4000');
    expect(counter.className).toContain('text-google-grey700');

    const textarea = screen.getByPlaceholderText(/message @bobpartner\.\.\./i);
    expect(textarea).toHaveAttribute('maxLength', '4000');

    // Container should use rounded-2xl two-tier layout
    const container = counter.closest('.rounded-2xl');
    expect(container).not.toBeNull();
  });

  it('updates character count and transitions color to yellow at >=90% (3600 chars)', () => {
    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/message @bobpartner\.\.\./i);
    const counter = screen.getByTestId('char-counter');

    // 100 characters (< 90%)
    fireEvent.change(textarea, { target: { value: 'a'.repeat(100) } });
    expect(counter.textContent).toBe('100/4000');
    expect(counter.className).toContain('text-google-grey700');

    // 3600 characters (90% threshold) -> yellow
    fireEvent.change(textarea, { target: { value: 'a'.repeat(3600) } });
    expect(counter.textContent).toBe('3600/4000');
    expect(counter.className).toContain('text-google-yellow');

    // 3999 characters (< 100%) -> yellow
    fireEvent.change(textarea, { target: { value: 'a'.repeat(3999) } });
    expect(counter.textContent).toBe('3999/4000');
    expect(counter.className).toContain('text-google-yellow');
  });

  it('transitions color to red at 100% (4000 chars) and clamps direct input overflow', () => {
    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/message @bobpartner\.\.\./i);
    const counter = screen.getByTestId('char-counter');
    const sendBtn = screen.getByRole('button', { name: /send message/i });

    // 4000 characters -> red, send button still enabled
    fireEvent.change(textarea, { target: { value: 'a'.repeat(4000) } });
    expect(counter.textContent).toBe('4000/4000');
    expect(counter.className).toContain('text-google-red');
    expect(sendBtn).not.toBeDisabled();

    // 4001 characters -> red, send button disabled
    fireEvent.change(textarea, { target: { value: 'a'.repeat(4001) } });
    expect(counter.textContent).toBe('4000/4000');
    expect(counter.className).toContain('text-google-red');
    expect(sendBtn).not.toBeDisabled();
  });

  it('automatically trims pasted clipboard text to fit the 4000-character quota', () => {
    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/message @bobpartner\.\.\./i) as HTMLTextAreaElement;
    const counter = screen.getByTestId('char-counter');

    // Paste 5000 chars into empty textarea
    const oversizedClip = 'x'.repeat(5000);
    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (format: string) => (format === 'text' ? oversizedClip : ''),
      },
    });

    expect(textarea.value.length).toBe(4000);
    expect(counter.textContent).toBe('4000/4000');

    // Clear and type 3500 chars, then paste 1000 chars (exceeding 4000 by 500)
    fireEvent.change(textarea, { target: { value: 'a'.repeat(3500) } });
    textarea.selectionStart = 3500;
    textarea.selectionEnd = 3500;

    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (format: string) => (format === 'text' ? 'b'.repeat(1000) : ''),
      },
    });

    expect(textarea.value.length).toBe(4000);
    expect(textarea.value).toBe('a'.repeat(3500) + 'b'.repeat(500));
    expect(counter.textContent).toBe('4000/4000');
  });

  it('disables send button when input is empty and has no attachment', () => {
    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    expect(sendBtn).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/message @bobpartner\.\.\./i);
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(sendBtn).toBeDisabled();
  });
});
