import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatArea } from './ChatArea';
import { RoomChatArea } from '../room/RoomChatArea';
import { EmojiPickerPopover } from '../media/EmojiPickerPopover';
import { GifSearchModal } from '../media/GifSearchModal';
import { CreateRoomModal } from '../room/CreateRoomModal';
import { RoomMembersModal } from '../room/RoomMembersModal';
import { ImageLightboxModal } from './ImageLightboxModal';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { RoomRole } from '@webchat/shared';

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
      <AuthContext.Provider value={{ currentUser: mockUser, token: 'fake-token' } as any}>
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
      <AuthContext.Provider value={{ currentUser: mockUser, token: 'fake-token' } as any}>
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
});
