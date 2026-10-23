import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PublicUserDto, RoomDetailDto, RoomRole, SelfUserDto } from '@webchat/shared';
import { Sidebar } from './chat/Sidebar';
import { RoomMembersModal } from './room/RoomMembersModal';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';

// SEC-13: other Users arrive as PublicUserDto. The UI shows their username, never an email,
// and user search asks for a username only.

const now = new Date().toISOString();
const me: SelfUserDto = {
  id: 'me-id',
  username: 'alice',
  email: 'alice@example.com',
  isOnline: true,
  lastSeenAt: now,
  createdAt: now,
  updatedAt: now,
};
const bob: PublicUserDto = { id: 'bob-id', username: 'bob', isOnline: false, lastSeenAt: now };

function renderWithProviders(ui: React.ReactElement) {
  const authValue: any = { currentUser: me, token: 'token-xyz', isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
  const socketValue: any = { socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() }, isConnected: true, isConnecting: false, connectionError: null };
  return render(
    <AuthContext.Provider value={authValue}>
      <SocketContext.Provider value={socketValue}>{ui}</SocketContext.Provider>
    </AuthContext.Provider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Public profiles in the client', () => {
  it('direct chat user search asks for a username and lists public profiles', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [bob] });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(
      <Sidebar
        chats={[]}
        activeChatId={null}
        onSelectChat={vi.fn()}
        onStartChat={vi.fn()}
        isLoadingChats={false}
        rooms={[]}
        activeRoomId={null}
        onSelectRoom={vi.fn()}
        activeTab="direct"
        onTabChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle(/start new direct chat/i));
    expect(screen.getByText(/type a username to search/i)).toBeInTheDocument();
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search or start new chat/i), { target: { value: 'bo' } });

    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/users?q=bo', expect.anything());
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('room member roster and member search show usernames, not emails', async () => {
    const charlie: PublicUserDto = { id: 'charlie-id', username: 'charlie', isOnline: true, lastSeenAt: now };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [charlie] }));

    // A stray email on a member (e.g. from an older server) must still never be rendered.
    const roomDetails: RoomDetailDto = {
      id: 'room-1',
      name: 'Team',
      ownerId: me.id,
      role: RoomRole.OWNER,
      memberCount: 2,
      createdAt: now,
      updatedAt: now,
      members: [
        { id: 'm1', roomId: 'room-1', userId: me.id, role: RoomRole.OWNER, joinedAt: now, user: me },
        {
          id: 'm2',
          roomId: 'room-1',
          userId: bob.id,
          role: RoomRole.MEMBER,
          joinedAt: now,
          user: { ...bob, email: 'bob@example.com' } as PublicUserDto,
        },
      ],
    };

    renderWithProviders(
      <RoomMembersModal
        isOpen={true}
        onClose={vi.fn()}
        roomDetails={roomDetails}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />
    );

    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument();

    const search = screen.getByPlaceholderText(/search username to add/i);
    fireEvent.change(search, { target: { value: 'char' } });

    await waitFor(() => expect(screen.getByText('charlie')).toBeInTheDocument());
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });
});
