import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { Dashboard } from '../dashboard/Dashboard';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { DirectChatListItemDto, RoomListItemDto, RoomDetailDto, RoomRole, SOCKET_EVENTS, ERROR_CODES } from '@webchat/shared';

// SEC-07: a User who hits a rate limit is told how long to wait, and loses no draft.

const now = new Date().toISOString();
const alice = { id: 'user-alice-id', username: 'alice', email: 'alice@example.com', isOnline: true, lastSeenAt: now, createdAt: now, updatedAt: now };
const bob = { id: 'user-bob-id', username: 'bob', email: 'bob@example.com', isOnline: true, lastSeenAt: now, createdAt: now, updatedAt: now };

const directChat: DirectChatListItemDto = { id: 'chat-alice-bob', partner: bob, lastMessage: null, unreadCount: 0, updatedAt: now };

const room: RoomListItemDto = {
  id: 'room-1',
  name: 'Dev Team',
  description: 'Team Chat',
  ownerId: alice.id,
  role: RoomRole.OWNER,
  lastMessage: null,
  unreadCount: 0,
  memberCount: 2,
  updatedAt: now,
};

const roomDetails: RoomDetailDto = {
  ...room,
  createdAt: now,
  members: [
    { id: 'member-1', roomId: room.id, userId: alice.id, role: RoomRole.OWNER, lastReadMessageId: null, joinedAt: now, user: alice },
    { id: 'member-2', roomId: room.id, userId: bob.id, role: RoomRole.MEMBER, lastReadMessageId: null, joinedAt: now, user: bob },
  ],
} as RoomDetailDto;

const RATE_LIMITED_ACK = { success: false, error: ERROR_CODES.RATE_LIMITED, requestId: 'req-1', retryAfterMs: 7_200 };

function json(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    headers: new Headers(status === 429 ? { 'Retry-After': '240' } : {}),
    json: async () => body,
  });
}

function rateLimitedResponse(retryAfterMs: number) {
  return json({ message: 'Too many requests.', code: ERROR_CODES.RATE_LIMITED, requestId: 'req-2', retryAfterMs }, 429);
}

/** Server stub: lists one Direct Chat and one Room; `override` answers specific URLs first. */
function mockFetch(override: (url: string) => ReturnType<typeof json> | undefined = () => undefined) {
  global.fetch = vi.fn((input: any) => {
    const url = String(input);
    const answer = override(url);
    if (answer) return answer;
    if (url.includes('/api/direct-chats/') && url.includes('/messages')) return json({ messages: [], nextCursor: null, hasMore: false });
    if (url.includes('/api/direct-chats')) return json([directChat]);
    if (url.includes('/api/rooms/room-1/messages')) return json({ messages: [], nextCursor: null, hasMore: false });
    if (url.includes('/api/rooms/room-1')) return json(roomDetails);
    if (url.includes('/api/rooms')) return json([room]);
    return json([]);
  }) as any;
}

/** A socket that acks every send with `sendAck`. */
function mockSocket(sendAck: unknown) {
  return {
    emit: vi.fn((event: string, _payload: unknown, ack?: (response: unknown) => void) => {
      if ((event === SOCKET_EVENTS.DIRECT_SEND || event === SOCKET_EVENTS.ROOM_SEND) && typeof ack === 'function') {
        ack(sendAck);
      }
    }),
    on: vi.fn(),
    off: vi.fn(),
  };
}

function renderDashboard(socket: unknown) {
  const authValue: any = { currentUser: alice, token: 'token-alice', isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
  const socketValue: any = { socket, isConnected: true, isConnecting: false, connectionError: null };
  return render(
    <AuthContext.Provider value={authValue}>
      <SocketContext.Provider value={socketValue}>
        <Dashboard />
      </SocketContext.Provider>
    </AuthContext.Provider>
  );
}

async function typeAndSend(placeholder: string, text: string) {
  const input = (await screen.findByPlaceholderText(placeholder)) as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
  });
  return input;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Rate limit notices (SEC-07)', () => {
  it('RATE_LIMITED on a Direct Chat message shows the wait time and keeps the draft', async () => {
    mockFetch();
    renderDashboard(mockSocket(RATE_LIMITED_ACK));

    fireEvent.click(await screen.findByText('bob'));
    const input = await typeAndSend('Message @bob...', 'hello bob');

    expect(await screen.findByRole('alert')).toHaveTextContent(/try again in 8 seconds/i);
    expect(input.value).toBe('hello bob');
  });

  it('RATE_LIMITED on a Room message shows the wait time and keeps the draft', async () => {
    mockFetch();
    renderDashboard(mockSocket(RATE_LIMITED_ACK));

    fireEvent.click(await screen.findByText('Rooms'));
    fireEvent.click(await screen.findByText('Dev Team'));
    const input = await typeAndSend('Message #Dev Team...', 'hello team');

    expect(await screen.findByRole('alert')).toHaveTextContent(/try again in 8 seconds/i);
    expect(input.value).toBe('hello team');
  });

  it('a sent message clears the composer', async () => {
    mockFetch();
    renderDashboard(mockSocket({ success: true }));

    fireEvent.click(await screen.findByText('bob'));
    const input = await typeAndSend('Message @bob...', 'hello bob');

    await waitFor(() => expect(input.value).toBe(''));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('429 on user search shows the wait time', async () => {
    mockFetch((url) => (url.includes('/api/users') ? rateLimitedResponse(42_000) : undefined));
    renderDashboard(mockSocket({ success: true }));

    const search = await screen.findByPlaceholderText('Search or start new chat...');
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: 'car' } });

    expect(await screen.findByText(/try again in 42 seconds/i)).toBeInTheDocument();
  });

  it('429 on GIF search shows the wait time', async () => {
    mockFetch((url) => (url.includes('/api/gifs') ? rateLimitedResponse(30_000) : undefined));
    renderDashboard(mockSocket({ success: true }));

    fireEvent.click(await screen.findByText('bob'));
    fireEvent.click(await screen.findByText('GIF'));

    expect(await screen.findByText(/try again in 30 seconds/i)).toBeInTheDocument();
  });
});
