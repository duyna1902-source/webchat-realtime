import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatArea } from './ChatArea';
import { RoomChatArea } from '../room/RoomChatArea';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { DirectChatListItemDto, RoomDetailDto, RoomListItemDto, RoomRole } from '@webchat/shared';

const now = new Date().toISOString();
const me = { id: 'me-id', username: 'alice', email: 'alice@example.com', isOnline: true, lastSeenAt: now, createdAt: now, updatedAt: now };
const partner = { ...me, id: 'partner-id', username: 'bob', email: 'bob@example.com' };

const chat: DirectChatListItemDto = { id: 'chat-1', partner, unreadCount: 0, updatedAt: now };

const room: RoomListItemDto = {
  id: 'room-1',
  name: 'Engineering',
  description: null,
  ownerId: 'me-id',
  role: RoomRole.OWNER,
  memberCount: 1,
  unreadCount: 0,
  lastMessage: null,
  updatedAt: now,
} as RoomListItemDto;

const roomDetails = {
  ...room,
  createdAt: now,
  members: [{ id: 'm-1', roomId: 'room-1', userId: 'me-id', role: RoomRole.OWNER, joinedAt: now, user: me }],
} as unknown as RoomDetailDto;

function renderWithProviders(ui: React.ReactElement) {
  const authValue: any = { currentUser: me, token: 'token-xyz', isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
  const socketValue: any = { socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() }, isConnected: true, isConnecting: false, connectionError: null };
  return render(
    <AuthContext.Provider value={authValue}>
      <SocketContext.Provider value={socketValue}>{ui}</SocketContext.Provider>
    </AuthContext.Provider>
  );
}

function renderDirectChat(onSendMessage = vi.fn()) {
  renderWithProviders(<ChatArea activeChat={chat} messages={[]} isLoadingMessages={false} onSendMessage={onSendMessage} />);
  return onSendMessage;
}

function renderRoomChat(onSendMessage = vi.fn()) {
  renderWithProviders(
    <RoomChatArea
      activeRoom={room}
      roomDetails={roomDetails}
      messages={[]}
      isLoadingMessages={false}
      onSendMessage={onSendMessage}
      onAddMember={vi.fn()}
      onRemoveMember={vi.fn()}
      onChangeRole={vi.fn()}
      onLeaveRoom={vi.fn()}
      onDeleteRoom={vi.fn()}
    />
  );
  return onSendMessage;
}

// The upload allowlist from the spec: images, PDF, modern and legacy Office, and text documents.
const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt',
  '.txt', '.csv', '.md', '.json',
];

function acceptedExtensions(input: HTMLElement): string[] {
  return (input.getAttribute('accept') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.startsWith('.'))
    .sort();
}

async function chooseAndSend(testId: string, file: File) {
  fireEvent.change(screen.getByTestId(testId), { target: { files: [file] } });
  await screen.findByTestId('attachment-preview');
  fireEvent.click(screen.getByRole('button', { name: /^send (room )?message$/i }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Upload hardening (cyber-upgradation Ticket 12)', () => {
  it.each([
    ['Direct Chat', 'file-upload-input', () => renderDirectChat()],
    ['Room Chat', 'room-file-upload-input', () => renderRoomChat()],
  ])('the %s file input only offers the allowed file types', (_label, testId, renderChat) => {
    renderChat();

    const input = screen.getByTestId(testId);
    expect(acceptedExtensions(input)).toEqual([...ALLOWED_EXTENSIONS].sort());
    expect(input.getAttribute('accept')).not.toMatch(/svg|html|zip|exe|\*/i);
  });

  it.each([
    ['Direct Chat', 'file-upload-input', renderDirectChat],
    ['Room Chat', 'room-file-upload-input', renderRoomChat],
  ])('a %s upload rejected as a disallowed file type shows a clear message', async (_label, testId, renderChat) => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unsupported Media Type', code: 'UNSUPPORTED_FILE_TYPE', requestId: 'req-1' }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const onSendMessage = renderChat();

    await chooseAndSend(testId, new File(['<svg/>'], 'logo.png', { type: 'image/png' }));

    expect(await screen.findByText(/this file type isn't allowed/i)).toBeInTheDocument();
    expect(screen.getByText(/JPEG, PNG, GIF, WebP/)).toBeInTheDocument();
    expect(onSendMessage).not.toHaveBeenCalled();
  });
});
