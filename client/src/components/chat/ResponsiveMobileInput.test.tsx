import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatArea } from './ChatArea';
import { RoomChatArea } from '../room/RoomChatArea';
import { EmojiPickerPopover } from '../media/EmojiPickerPopover';
import { GifSearchModal } from '../media/GifSearchModal';
import { CreateRoomModal } from '../room/CreateRoomModal';
import { RoomMembersModal } from '../room/RoomMembersModal';
import { ImageLightboxModal } from './ImageLightboxModal';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { RoomRole, MessageType, MessageStatus } from '@webchat/shared';

const mockUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockPartner = {
  id: 'user-2',
  username: 'bob',
  email: 'bob@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockChat = {
  id: 'chat-1',
  partner: mockPartner,
  unreadCount: 0,
  updatedAt: new Date().toISOString(),
};

const mockRoom = {
  id: 'room-1',
  name: 'General',
  ownerId: 'user-1',
  role: RoomRole.OWNER,
  memberCount: 1,
  unreadCount: 0,
};

describe('Mobile Input, Popovers & Modals Optimization (Ticket 04)', () => {
  const renderWithContext = (ui: React.ReactElement) => {
    return render(
      <AuthContext.Provider value={{ currentUser: mockUser } as any}>
        <SocketContext.Provider value={{ socket: null, isConnected: true } as any}>
          {ui}
        </SocketContext.Provider>
      </AuthContext.Provider>
    );
  };

  it('enforces 16px font size (text-base sm:text-sm) and max-h-24 on ChatArea textarea', () => {
    renderWithContext(
      <ChatArea
        activeChat={mockChat as any}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/message @bob\.\.\./i);
    expect(textarea.className).toMatch(/text-base\s+sm:text-sm/);
    expect(textarea.className).toMatch(/max-h-24/);
  });

  it('enforces 16px font size (text-base sm:text-sm) and max-h-24 on RoomChatArea textarea', () => {
    renderWithContext(
      <RoomChatArea
        activeRoom={mockRoom as any}
        roomDetails={null}
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

    const textarea = screen.getByPlaceholderText(/message #General\.\.\./i);
    expect(textarea.className).toMatch(/text-base\s+sm:text-sm/);
    expect(textarea.className).toMatch(/max-h-24/);
  });

  it('enforces max-w-[calc(100vw-1.5rem)] on EmojiPickerPopover to prevent mobile horizontal overflow', () => {
    render(
      <EmojiPickerPopover
        isOpen={true}
        onClose={vi.fn()}
        onSelectEmoji={vi.fn()}
      />
    );

    const popover = screen.getByRole('dialog', { name: /emoji picker/i });
    expect(popover.className).toMatch(/max-w-\[calc\(100vw-1\.5rem\)\]/);
  });

  it('enforces max-h-[90dvh] on GifSearchModal', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], next: '' }),
    });

    renderWithContext(
      <GifSearchModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectGif={vi.fn()}
      />
    );

    const modalDialog = screen.getByRole('dialog', { name: /gif search/i });
    const contentBox = modalDialog.firstElementChild;
    expect(contentBox?.className).toMatch(/max-h-\[90dvh\]/);
  });

  it('enforces max-h-[90dvh] and scrollable inner container on CreateRoomModal and RoomMembersModal', () => {
    const { rerender } = renderWithContext(
      <CreateRoomModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateRoom={vi.fn()}
      />
    );

    const createModalBox = screen.getByText('Create New Room').closest('.bg-white');
    expect(createModalBox?.className).toMatch(/max-h-\[90dvh\]/);

    rerender(
      <AuthContext.Provider value={{ currentUser: mockUser } as any}>
        <SocketContext.Provider value={{ socket: null, isConnected: true } as any}>
          <RoomMembersModal
            isOpen={true}
            roomDetails={{
              id: 'room-1',
              name: 'General',
              ownerId: 'user-1',
              memberCount: 1,
              createdAt: new Date().toISOString(),
              members: [{
                userId: 'user-1',
                role: RoomRole.OWNER,
                joinedAt: new Date().toISOString(),
                user: mockUser,
              }],
            } as any}
            onClose={vi.fn()}
            onAddMember={vi.fn()}
            onRemoveMember={vi.fn()}
            onChangeRole={vi.fn()}
            onLeaveRoom={vi.fn()}
            onDeleteRoom={vi.fn()}
          />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    const membersModalBox = screen.getByText(/General — Members/i).closest('.bg-white');
    expect(membersModalBox?.className).toMatch(/max-h-\[90dvh\]/);
  });

  it('constrains long message bubbles and text boxes in ChatArea, RoomChatArea, and MessageItemContent to prevent horizontal screen overflow', () => {
    const longUnbroken = 'https://gdg.community.dev/' + 'a'.repeat(300);

    const { rerender } = renderWithContext(
      <ChatArea
        activeChat={mockChat as any}
        messages={[
          {
            id: 'dm-long-1',
            directChatId: 'chat-1',
            senderId: mockUser.id,
            sender: mockUser,
            content: longUnbroken,
            type: MessageType.TEXT,
            status: MessageStatus.SENT,
            createdAt: new Date().toISOString(),
          },
        ] as any}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const directScrollContainer = screen.getByTestId('chat-messages-container');
    expect(directScrollContainer.className).toMatch(/overflow-x-hidden/);

    const directMsgParagraph = screen.getByText(longUnbroken);
    expect(directMsgParagraph.className).toMatch(/\[overflow-wrap:anywhere\]/);

    const directBubble = directMsgParagraph.closest('div.rounded-2xl');
    expect(directBubble?.className).toMatch(/max-w-\[min\(85%,28rem\)\]/);
    expect(directBubble?.className).toMatch(/min-w-0/);
    expect(directBubble?.className).toMatch(/\[overflow-wrap:anywhere\]/);

    const directTextarea = screen.getByPlaceholderText(/message @bob\.\.\./i);
    expect(directTextarea.parentElement?.className).toMatch(/min-w-0/);

    rerender(
      <AuthContext.Provider value={{ currentUser: mockUser } as any}>
        <SocketContext.Provider value={{ socket: null, isConnected: true } as any}>
          <RoomChatArea
            activeRoom={mockRoom as any}
            roomDetails={null}
            messages={[
              {
                id: 'rm-long-1',
                roomId: 'room-1',
                senderId: mockPartner.id,
                sender: mockPartner,
                content: longUnbroken,
                type: MessageType.TEXT,
                createdAt: new Date().toISOString(),
              },
            ] as any}
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

    const roomScrollContainer = screen.getByTestId('room-messages-container');
    expect(roomScrollContainer.className).toMatch(/overflow-x-hidden/);

    const roomMsgParagraph = screen.getByText(longUnbroken);
    expect(roomMsgParagraph.className).toMatch(/\[overflow-wrap:anywhere\]/);

    const roomBubble = roomMsgParagraph.closest('div.rounded-2xl');
    expect(roomBubble?.className).toMatch(/max-w-full/);
    expect(roomBubble?.className).toMatch(/min-w-0/);
    expect(roomBubble?.className).toMatch(/\[overflow-wrap:anywhere\]/);

    const roomBubbleColumn = roomBubble?.parentElement;
    expect(roomBubbleColumn?.className).toMatch(/max-w-\[min\(85%,28rem\)\]/);
    expect(roomBubbleColumn?.className).toMatch(/min-w-0/);

    const roomTextarea = screen.getByPlaceholderText(/message #General\.\.\./i);
    expect(roomTextarea.parentElement?.className).toMatch(/min-w-0/);
  });

  it('auto-resizes composer textarea height up to 96px (max-h-24) when typing long messages and resets on send', () => {
    const onSendMessage = vi.fn();
    renderWithContext(
      <ChatArea
        activeChat={mockChat as any}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={onSendMessage}
      />
    );

    const textarea = screen.getByPlaceholderText(/message @bob\.\.\./i) as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, get: () => 140 });

    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5' } });
    expect(textarea.style.height).toBe('96px');

    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, get: () => 24 });
    const sendBtn = screen.getByRole('button', { name: /send message/i });
    fireEvent.click(sendBtn);
    expect(textarea.style.height).toBe('auto');
  });
});
