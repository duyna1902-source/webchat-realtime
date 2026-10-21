import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ChatArea } from './ChatArea';
import { RoomChatArea } from '../room/RoomChatArea';
import { EmojiPickerPopover } from '../media/EmojiPickerPopover';
import { GifSearchModal } from '../media/GifSearchModal';
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

const mockUser = {
  id: 'user-alice',
  username: 'alice',
  email: 'alice@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockPartner = {
  id: 'user-bob',
  username: 'bob',
  email: 'bob@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockDirectChat: DirectChatListItemDto = {
  id: 'chat-123',
  partner: mockPartner,
  unreadCount: 0,
  updatedAt: new Date().toISOString(),
};

const mockRoom: RoomListItemDto = {
  id: 'room-123',
  name: 'Dev Room',
  description: 'Developers room',
  ownerId: 'user-alice',
  role: RoomRole.OWNER,
  unreadCount: 0,
  memberCount: 2,
  updatedAt: new Date().toISOString(),
};

function renderWithProviders(ui: React.ReactElement) {
  const authValue: any = {
    currentUser: mockUser,
    token: 'test-token',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };

  const socketValue: any = {
    socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
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

describe('Rich Media: Emoji Picker & GIF Search Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Emoji Picker Popover Component', () => {
    it('renders standalone popover, displays category emojis, and handles search filter', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      const { rerender } = render(
        <EmojiPickerPopover isOpen={false} onClose={onClose} onSelectEmoji={onSelect} />
      );

      expect(screen.queryByRole('dialog', { name: /emoji picker/i })).not.toBeInTheDocument();

      rerender(<EmojiPickerPopover isOpen={true} onClose={onClose} onSelectEmoji={onSelect} />);

      expect(screen.getByRole('dialog', { name: /emoji picker/i })).toBeInTheDocument();

      // Search input is present
      const searchInput = screen.getByPlaceholderText(/search emojis/i);
      expect(searchInput).toBeInTheDocument();

      // Filter by keyword 'fire'
      fireEvent.change(searchInput, { target: { value: 'fire' } });
      expect(screen.getByText(/search results/i)).toBeInTheDocument();

      const fireButton = screen.getByTitle(/fire/i);
      expect(fireButton).toBeInTheDocument();
      fireEvent.click(fireButton);

      expect(onSelect).toHaveBeenCalledWith('🔥');
    });

    it('toggles Emoji Picker in Direct ChatArea and inserts emoji at textarea cursor', async () => {
      const onSendMessage = vi.fn();
      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={onSendMessage}
        />
      );

      const emojiBtn = screen.getByRole('button', { name: /choose emoji/i });
      expect(emojiBtn).toBeInTheDocument();

      // Click to open emoji picker
      fireEvent.click(emojiBtn);
      expect(screen.getByRole('dialog', { name: /emoji picker/i })).toBeInTheDocument();

      // Type initial text into message input
      const textarea = screen.getByPlaceholderText(/message @bob/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Hello ' } });

      // Click an emoji (e.g. Grinning Face 😀)
      const grinningBtn = screen.getByRole('button', { name: /^grinning face$/i });
      fireEvent.click(grinningBtn);

      // Verify emoji was inserted into textarea
      expect(textarea.value).toBe('Hello 😀');
    });
  });

  describe('GIF Search Modal Component', () => {
    const mockGifs = [
      {
        id: 'gif-dance',
        title: 'Happy Dance',
        url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
        previewUrl: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/200w.gif',
        width: 480,
        height: 480,
      },
      {
        id: 'gif-thumbs',
        title: 'Thumbs Up',
        url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
        previewUrl: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif',
        width: 480,
        height: 270,
      },
    ];

    it('loads trending GIFs when modal opens and triggers onSelectGif upon clicking a GIF item', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGifs,
      });

      const onSelect = vi.fn();
      const onClose = vi.fn();

      renderWithProviders(
        <GifSearchModal isOpen={true} onClose={onClose} onSelectGif={onSelect} />
      );

      expect(screen.getByRole('dialog', { name: /gif search/i })).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith('/api/gifs/trending', expect.anything());

      await waitFor(() => {
        expect(screen.getByTitle('Happy Dance')).toBeInTheDocument();
        expect(screen.getByTitle('Thumbs Up')).toBeInTheDocument();
      });

      const gifCard = screen.getByTitle('Happy Dance');
      fireEvent.click(gifCard);

      expect(onSelect).toHaveBeenCalledWith('https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif');
      expect(onClose).toHaveBeenCalled();
    });

    it('searches GIFs with query string in GifSearchModal', async () => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/gifs/search')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 'gif-cat',
                title: 'Cat Typing',
                url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
                previewUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/200w.gif',
                width: 480,
                height: 360,
              },
            ],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockGifs,
        });
      });

      renderWithProviders(
        <GifSearchModal isOpen={true} onClose={vi.fn()} onSelectGif={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByTitle('Happy Dance')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search gifs on tenor\/giphy/i);
      fireEvent.change(searchInput, { target: { value: 'cat' } });

      await waitFor(
        () => {
          expect(global.fetch).toHaveBeenCalledWith('/api/gifs/search?q=cat', expect.anything());
          expect(screen.getByTitle('Cat Typing')).toBeInTheDocument();
        },
        { timeout: 1500 }
      );
    });

    it('toggles GIF Search Modal from ChatArea and sends EMOJI_GIF message directly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGifs,
      });

      const onSendMessage = vi.fn();
      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={onSendMessage}
        />
      );

      const gifToggleBtn = screen.getByRole('button', { name: /search animated gifs/i });
      expect(gifToggleBtn).toBeInTheDocument();

      fireEvent.click(gifToggleBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /gif search/i })).toBeInTheDocument();
        expect(screen.getByTitle('Happy Dance')).toBeInTheDocument();
      });

      // Click Happy Dance GIF
      fireEvent.click(screen.getByTitle('Happy Dance'));

      expect(onSendMessage).toHaveBeenCalledWith(
        'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
        MessageType.EMOJI_GIF
      );
    });
  });

  describe('Rich Message Rendering (EMOJI_GIF vs TEXT)', () => {
    it('renders animated GIF with lazy loading when message type is EMOJI_GIF in Direct Chat', () => {
      const directMessages: DirectReceiveMessagePayload[] = [
        {
          id: 'msg-text',
          directChatId: 'chat-123',
          senderId: 'user-bob',
          sender: { id: 'user-bob', username: 'bob', avatarUrl: null },
          content: 'Look at this funny GIF!',
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
          attachmentUrl: null,
          attachmentName: null,
          attachmentSize: null,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-gif',
          directChatId: 'chat-123',
          senderId: 'user-alice',
          sender: { id: 'user-alice', username: 'alice', avatarUrl: null },
          content: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
          type: MessageType.EMOJI_GIF,
          status: MessageStatus.SENT,
          attachmentUrl: null,
          attachmentName: null,
          attachmentSize: null,
          createdAt: new Date().toISOString(),
        },
      ];

      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={directMessages}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      // Verify text message
      expect(screen.getByText('Look at this funny GIF!')).toBeInTheDocument();

      // Verify GIF image element with lazy loading
      const gifImg = screen.getByRole('img', { name: /gif message/i });
      expect(gifImg).toBeInTheDocument();
      expect(gifImg).toHaveAttribute('src', 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif');
      expect(gifImg).toHaveAttribute('loading', 'lazy');
    });

    it('renders animated GIF and supports emoji picker and GIF search modal in Room Chat', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'gif-party',
            title: 'Party Cat',
            url: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif',
            previewUrl: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/200w.gif',
            width: 480,
            height: 270,
          },
        ],
      });

      const onSendMessage = vi.fn();
      const roomMessages: RoomReceiveMessagePayload[] = [
        {
          id: 'room-msg-gif',
          roomId: 'room-123',
          senderId: 'user-bob',
          sender: { id: 'user-bob', username: 'bob', avatarUrl: null },
          content: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif',
          type: MessageType.EMOJI_GIF,
          attachmentUrl: null,
          attachmentName: null,
          attachmentSize: null,
          createdAt: new Date().toISOString(),
        },
      ];

      renderWithProviders(
        <RoomChatArea
          activeRoom={mockRoom}
          roomDetails={null}
          messages={roomMessages}
          isLoadingMessages={false}
          onSendMessage={onSendMessage}
          onAddMember={vi.fn()}
          onRemoveMember={vi.fn()}
          onChangeRole={vi.fn()}
          onLeaveRoom={vi.fn()}
          onDeleteRoom={vi.fn()}
        />
      );

      // Verify GIF image rendered in Room Chat
      const gifImg = screen.getByRole('img', { name: /gif message/i });
      expect(gifImg).toBeInTheDocument();
      expect(gifImg).toHaveAttribute('src', 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif');
      expect(gifImg).toHaveAttribute('loading', 'lazy');

      // Test Emoji Button in Room Chat
      const emojiBtn = screen.getByRole('button', { name: /choose emoji/i });
      fireEvent.click(emojiBtn);
      expect(screen.getByRole('dialog', { name: /emoji picker/i })).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/message #dev room/i) as HTMLTextAreaElement;
      const partyEmoji = screen.getByRole('button', { name: /partying face/i });
      fireEvent.click(partyEmoji);
      expect(textarea.value).toBe('🥳');

      // Test GIF Button in Room Chat
      const gifBtn = screen.getByRole('button', { name: /search animated gifs/i });
      fireEvent.click(gifBtn);

      await waitFor(() => {
        expect(screen.getByTitle('Party Cat')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Party Cat'));
      expect(onSendMessage).toHaveBeenCalledWith(
        'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif',
        MessageType.EMOJI_GIF
      );
    });
  });
  describe('Ticket 04: Emoji Picker Capacity Guard & Unicode Boundary Protection', () => {
    it('paste truncation preserves Unicode surrogate pairs without splitting', () => {
      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/message @bob/i) as HTMLTextAreaElement;
      const counter = screen.getByTestId('char-counter');

      // Set input to 3997 characters (remaining quota = 3)
      fireEvent.change(textarea, { target: { value: 'a'.repeat(3997) } });
      textarea.selectionStart = 3997;
      textarea.selectionEnd = 3997;

      // Paste 'AB😀' (length 4: 'A'(1), 'B'(1), '😀'(2))
      // Slicing at 3 would take 'A', 'B', and the high surrogate of '😀', corrupting Unicode.
      // With surrogate protection, it must back off to 2 ('AB'), avoiding split.
      fireEvent.paste(textarea, {
        clipboardData: {
          getData: (format: string) => (format === 'text' ? 'AB😀' : ''),
        },
      });

      expect(textarea.value.length).toBe(3999);
      expect(textarea.value).toBe('a'.repeat(3997) + 'AB');
      expect(counter.textContent).toBe('3999/4000');
    });

    it('blocks emoji insertion and displays "Character limit reached" feedback when capacity is full in Direct Chat', () => {
      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/message @bob/i) as HTMLTextAreaElement;
      const emojiBtn = screen.getByRole('button', { name: /choose emoji/i });

      // Fill textarea to max capacity (4000 characters)
      fireEvent.change(textarea, { target: { value: 'z'.repeat(4000) } });
      textarea.selectionStart = 4000;
      textarea.selectionEnd = 4000;

      // Open emoji picker and click Grinning Face 😀
      fireEvent.click(emojiBtn);
      const grinningBtn = screen.getByRole('button', { name: /^grinning face$/i });
      fireEvent.click(grinningBtn);

      // Value must remain exactly 4000 (not modified)
      expect(textarea.value.length).toBe(4000);
      expect(textarea.value).toBe('z'.repeat(4000));

      // Visual feedback indicator must be displayed
      expect(screen.getByText(/character limit reached/i)).toBeInTheDocument();
    });

    it('blocks emoji insertion when remaining capacity is 1 but emoji consumes 2 code units', () => {
      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/message @bob/i) as HTMLTextAreaElement;
      const emojiBtn = screen.getByRole('button', { name: /choose emoji/i });

      // Fill textarea to 3999 characters (1 char space remaining)
      fireEvent.change(textarea, { target: { value: 'x'.repeat(3999) } });
      textarea.selectionStart = 3999;
      textarea.selectionEnd = 3999;

      // Click Grinning Face 😀 (takes 2 UTF-16 code units)
      fireEvent.click(emojiBtn);
      const grinningBtn = screen.getByRole('button', { name: /^grinning face$/i });
      fireEvent.click(grinningBtn);

      // Must be blocked because 3999 + 2 = 4001 > 4000
      expect(textarea.value.length).toBe(3999);
      expect(screen.getByText(/character limit reached/i)).toBeInTheDocument();
    });

    it('counts multi-codepoint complex emojis accurately against character limit', () => {
      renderWithProviders(
        <ChatArea
          activeChat={mockDirectChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/message @bob/i) as HTMLTextAreaElement;
      const counter = screen.getByTestId('char-counter');

      // Set text to 3990 characters (10 code units remaining)
      fireEvent.change(textarea, { target: { value: 'c'.repeat(3990) } });
      textarea.selectionStart = 3990;
      textarea.selectionEnd = 3990;

      // Open emoji picker
      const emojiBtn = screen.getByRole('button', { name: /choose emoji/i });
      fireEvent.click(emojiBtn);

      // Switch to People & Gestures category to access Family emoji
      const gesturesCategoryBtn = screen.getByRole('button', { name: /people & gestures/i });
      fireEvent.click(gesturesCategoryBtn);

      // Family emoji 👨‍👩‍👧‍👦 takes 11 UTF-16 code units.
      // Since remaining capacity is 10, inserting 11 code units must be blocked.
      const familyBtn = screen.getByRole('button', { name: /^family$/i });
      fireEvent.click(familyBtn);

      expect(textarea.value.length).toBe(3990);
      expect(counter.textContent).toBe('3990/4000');
      expect(screen.getByText(/character limit reached/i)).toBeInTheDocument();

      // Now expand remaining capacity to 11 (text length 3989)
      fireEvent.change(textarea, { target: { value: 'c'.repeat(3989) } });
      textarea.selectionStart = 3989;
      textarea.selectionEnd = 3989;

      // Clicking Family emoji now succeeds exactly at 4000/4000!
      fireEvent.click(familyBtn);
      expect(textarea.value.length).toBe(4000);
      expect(textarea.value).toBe('c'.repeat(3989) + '👨‍👩‍👧‍👦');
      expect(counter.textContent).toBe('4000/4000');
    });

    it('blocks emoji insertion in Room Chat when MEMBER hits 2000-character limit and shows feedback', () => {
      const memberRoom: RoomListItemDto = {
        ...mockRoom,
        role: RoomRole.MEMBER,
      };

      renderWithProviders(
        <RoomChatArea
          activeRoom={memberRoom}
          roomDetails={{
            ...memberRoom,
            members: [
              {
                userId: mockUser.id,
                role: RoomRole.MEMBER,
                user: mockUser,
                joinedAt: new Date().toISOString(),
              },
            ],
          } as any}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
          onAddMember={vi.fn()}
          onRemoveMember={vi.fn()}
          onChangeRole={vi.fn()}
          onLeaveRoom={vi.fn()}
          onDeleteRoom={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/message #dev room/i) as HTMLTextAreaElement;
      const counter = screen.getByTestId('char-counter');
      expect(counter.textContent).toBe('0/2000');

      // Set input to 1999 characters (1 character left)
      fireEvent.change(textarea, { target: { value: 'm'.repeat(1999) } });
      textarea.selectionStart = 1999;
      textarea.selectionEnd = 1999;
      expect(counter.textContent).toBe('1999/2000');

      // Open emoji picker and click Partying Face 🥳 (length 2)
      const emojiBtn = screen.getByRole('button', { name: /choose emoji/i });
      fireEvent.click(emojiBtn);
      const partyEmoji = screen.getByRole('button', { name: /partying face/i });
      fireEvent.click(partyEmoji);

      // Should be blocked
      expect(textarea.value.length).toBe(1999);
      expect(counter.textContent).toBe('1999/2000');
      expect(screen.getByText(/character limit reached/i)).toBeInTheDocument();
    });
  });
});
