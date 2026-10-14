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
});
