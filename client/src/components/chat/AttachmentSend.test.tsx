import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { Dashboard } from '../dashboard/Dashboard';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { DirectChatListItemDto, SOCKET_EVENTS } from '@webchat/shared';
import { attachmentFixture } from '../../test/attachmentFixtures';

// Seam 4: the client sends only an `attachmentId` (after uploading) or a `gifUrl`; never a type,
// URL, name or size of its own (SEC-03, SEC-14).

const now = new Date().toISOString();
const alice = { id: 'user-alice-id', username: 'alice', email: 'alice@example.com', isOnline: true, lastSeenAt: now, createdAt: now, updatedAt: now };
const bob = { id: 'user-bob-id', username: 'bob', email: 'bob@example.com', isOnline: true, lastSeenAt: now, createdAt: now, updatedAt: now };
const directChat = { id: 'chat-alice-bob', partner: bob, lastMessage: null, unreadCount: 0, updatedAt: now } as DirectChatListItemDto;

const GIF_URL = 'https://media.giphy.com/media/abc/giphy.gif';

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function mockServer() {
  const fetchMock = vi.fn((input: any, _init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/upload') {
      return json({ attachment: attachmentFixture({ id: 'att-9', name: 'spec.pdf', url: 'https://storage.example.com/s?t=1' }) }, 201);
    }
    if (url.startsWith('/api/gifs/')) {
      return json([{ id: 'g1', title: 'Party Cat', url: GIF_URL, previewUrl: GIF_URL, width: 100, height: 100 }]);
    }
    if (url.includes('/api/direct-chats/') && url.includes('/messages')) return json({ messages: [], nextCursor: null, hasMore: false });
    if (url.includes('/api/direct-chats')) return json([directChat]);
    return json([]);
  });
  global.fetch = fetchMock as any;
  return fetchMock;
}

function renderDashboard() {
  const socket = {
    emit: vi.fn((_event: string, _payload: unknown, ack?: (response: unknown) => void) => ack?.({ success: true })),
    on: vi.fn(),
    off: vi.fn(),
  };
  const authValue: any = { currentUser: alice, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
  const socketValue: any = { socket, isConnected: true, isConnecting: false, connectionError: null };
  render(
    <AuthContext.Provider value={authValue}>
      <SocketContext.Provider value={socketValue}>
        <Dashboard />
      </SocketContext.Provider>
    </AuthContext.Provider>
  );
  return socket;
}

const sends = (socket: ReturnType<typeof renderDashboard>) =>
  socket.emit.mock.calls.filter(([event]) => event === SOCKET_EVENTS.DIRECT_SEND).map(([, payload]) => payload);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Sending Attachments and GIFs', () => {
  it('uploads the file, then sends only its attachmentId with the caption', async () => {
    const fetchMock = mockServer();
    const socket = renderDashboard();
    fireEvent.click(await screen.findByText('bob'));

    const file = new File(['%PDF-1.4'], 'spec.pdf', { type: 'application/pdf' });
    fireEvent.change(await screen.findByTestId('file-upload-input'), { target: { files: [file] } });
    fireEvent.change(await screen.findByPlaceholderText('Add a caption (optional)...'), { target: { value: 'the spec' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    });

    await waitFor(() => expect(sends(socket)).toHaveLength(1));
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/upload' && init?.method === 'POST')).toBe(true);
    expect(sends(socket)[0]).toEqual({ directChatId: 'chat-alice-bob', content: 'the spec', attachmentId: 'att-9' });
  });

  it('sends a picked GIF as gifUrl only', async () => {
    mockServer();
    const socket = renderDashboard();
    fireEvent.click(await screen.findByText('bob'));

    fireEvent.click(await screen.findByRole('button', { name: /search animated gifs/i }));
    fireEvent.click(await screen.findByTitle('Party Cat'));

    await waitFor(() => expect(sends(socket)).toHaveLength(1));
    expect(sends(socket)[0]).toEqual({ directChatId: 'chat-alice-bob', gifUrl: GIF_URL });
  });
});
