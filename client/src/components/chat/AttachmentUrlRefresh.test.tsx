import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatArea } from './ChatArea';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { DirectChatListItemDto, DirectReceiveMessagePayload, MessageStatus, MessageType } from '@webchat/shared';
import { attachmentFixture } from '../../test/attachmentFixtures';

// Seam 4: an expired or failing signed URL is refreshed through GET /api/attachments/:id/url exactly once.

const currentUser = {
  id: 'me',
  username: 'alice',
  email: 'alice@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const activeChat = {
  id: 'chat-1',
  partner: { ...currentUser, id: 'bob', username: 'bob', email: 'bob@example.com' },
  unreadCount: 0,
  updatedAt: new Date().toISOString(),
} as DirectChatListItemDto;

const OLD_URL = 'https://storage.example.com/object/sign/attachments/old?token=old';
const NEW_URL = 'https://storage.example.com/object/sign/attachments/new?token=new';

function message(overrides: Partial<DirectReceiveMessagePayload>): DirectReceiveMessagePayload {
  return {
    id: 'msg-1',
    directChatId: 'chat-1',
    senderId: 'bob',
    sender: { id: 'bob', username: 'bob' } as DirectReceiveMessagePayload['sender'],
    content: 'see attached',
    type: MessageType.IMAGE,
    status: MessageStatus.SENT,
    attachment: attachmentFixture({ id: 'att-1', name: 'cat.png', url: OLD_URL }),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderChat(messages: DirectReceiveMessagePayload[]) {
  const authValue: any = { currentUser, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
  const socketValue: any = {
    socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
    isConnected: true,
    isConnecting: false,
    connectionError: null,
  };
  return render(
    <AuthContext.Provider value={authValue}>
      <SocketContext.Provider value={socketValue}>
        <ChatArea activeChat={activeChat} messages={messages} isLoadingMessages={false} onSendMessage={vi.fn()} />
      </SocketContext.Provider>
    </AuthContext.Provider>
  );
}

function mockRefreshEndpoint(extra: (url: string) => Response | undefined = () => undefined) {
  return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/attachments/att-1/url') {
      return new Response(JSON.stringify({ url: NEW_URL, expiresAt: new Date(Date.now() + 3600_000).toISOString() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return extra(url) ?? new Response('not found', { status: 404 });
  });
}

const refreshCalls = (spy: ReturnType<typeof mockRefreshEndpoint>) =>
  spy.mock.calls.filter(([input]) => String(input) === '/api/attachments/att-1/url');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Refreshing an expired signed URL (ADR 0009)', () => {
  it('an image whose URL fails to load is refreshed exactly once and shown again', async () => {
    const fetchSpy = mockRefreshEndpoint();
    renderChat([message({})]);

    const image = screen.getByRole('img', { name: 'cat.png' });
    expect(image).toHaveAttribute('src', OLD_URL);
    fireEvent.error(image);

    await waitFor(() => expect(screen.getByRole('img', { name: 'cat.png' })).toHaveAttribute('src', NEW_URL));
    expect(refreshCalls(fetchSpy)).toHaveLength(1);

    // The refreshed URL failing too does not loop.
    fireEvent.error(screen.getByRole('img', { name: 'cat.png' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(refreshCalls(fetchSpy)).toHaveLength(1);
  });

  it('an Attachment whose urlExpiresAt has passed is refreshed before it is shown', async () => {
    const fetchSpy = mockRefreshEndpoint();
    const expired = attachmentFixture({
      id: 'att-1',
      name: 'cat.png',
      url: OLD_URL,
      urlExpiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    renderChat([message({ attachment: expired })]);

    await waitFor(() => expect(screen.getByRole('img', { name: 'cat.png' })).toHaveAttribute('src', NEW_URL));
    expect(refreshCalls(fetchSpy)).toHaveLength(1);
  });

  it('a text preview whose fetch fails is retried once with a refreshed URL', async () => {
    const fetchSpy = mockRefreshEndpoint((url) =>
      url === NEW_URL ? new Response('fresh notes', { status: 200 }) : undefined
    );
    const notes = attachmentFixture({ id: 'att-1', name: 'notes.txt', url: OLD_URL });
    renderChat([message({ type: MessageType.DOCUMENT, attachment: notes })]);

    fireEvent.click(screen.getByTestId('document-attachment-card'));

    expect((await screen.findByTestId('text-preview-content')).textContent).toBe('fresh notes');
    expect(refreshCalls(fetchSpy)).toHaveLength(1);
    expect(fetchSpy.mock.calls.map(([input]) => String(input))).toEqual(
      expect.arrayContaining([OLD_URL, NEW_URL])
    );
  });

  it('a PDF preview frame uses a refreshed URL once the signed URL expired', async () => {
    const fetchSpy = mockRefreshEndpoint();
    const pdf = attachmentFixture({
      id: 'att-1',
      name: 'spec.pdf',
      url: OLD_URL,
      urlExpiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    renderChat([message({ type: MessageType.DOCUMENT, attachment: pdf })]);

    await waitFor(() => expect(refreshCalls(fetchSpy)).toHaveLength(1));
    fireEvent.click(screen.getByTestId('document-attachment-card'));

    expect(await screen.findByTestId('pdf-preview-frame')).toHaveAttribute('src', NEW_URL);
    // The preview reuses the URL the message already refreshed.
    expect(refreshCalls(fetchSpy)).toHaveLength(1);
  });
});
