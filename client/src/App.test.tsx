import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { io } from 'socket.io-client';
import App from './App';

// The socket is faked so the tests can see how the client connects; nothing else depends on it.
vi.mock('socket.io-client', () => {
  const fakeSocket = () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    io: { on: vi.fn(), off: vi.fn() },
  });
  return { io: vi.fn(() => fakeSocket()) };
});

interface FakeResponse {
  status: number;
  body?: unknown;
}

type Route = FakeResponse | ((init: RequestInit | undefined) => FakeResponse | Promise<FakeResponse>);

const userDto = (id: string, username: string) => ({
  id,
  username,
  email: `${username}@gdghust.dev`,
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/**
 * Fakes the server: `routes` maps "METHOD /path" (query string ignored) to a response.
 * Any other GET answers 200 with an empty list, so the Dashboard can load.
 */
function mockServer(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${url.split('?')[0]}`;
    const route = routes[key];
    const { status, body } = route === undefined
      ? key.startsWith('GET ') ? { status: 200, body: [] } : { status: 404, body: { message: 'Not found' } }
      : typeof route === 'function' ? await route(init) : route;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** Every header any request carried, lowercased. */
function sentHeaderNames(fetchMock: ReturnType<typeof mockServer>): string[] {
  return fetchMock.mock.calls.flatMap(([, init]) => [...new Headers(init?.headers ?? {}).keys()]);
}

const unauthenticated = { 'GET /api/auth/me': { status: 401, body: { message: 'Authentication required', code: 'UNAUTHORIZED' } } };

async function renderSignedOut() {
  render(<App />);
  await screen.findByRole('button', { name: /sign in to gdg-hust/i });
}

describe('GDG-HUST Auth Screen & Zero-Shift Authentication Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(io).mockClear();
    mockServer(unauthenticated);
  });

  it('renders GDG-HUST branded header with logo, title, and subtitle', async () => {
    await renderSignedOut();

    // Primary title and subtitle
    const heading = screen.getByRole('heading', { level: 1, name: /gdg-hust/i });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText(/Google Developer Groups on Campus • Hanoi University of Science and Technology/i)
    ).toBeInTheDocument();

    // Sharp GDG brackets logo badge
    const logoImg = screen.getByAltText(/gdg logo/i);
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveAttribute('src', '/assets/brand/logo-gdg-clean.webp');

    // Solid Google Blue header block (160px)
    const headerBlock = heading.closest('div');
    expect(headerBlock).toHaveClass('bg-google-blue');
    expect(headerBlock).toHaveStyle({ height: '160px' });
  });

  it('renders rigid zero-shift layout with single pill toggle and no bottom toggle link', async () => {
    await renderSignedOut();

    // Rigid card container locked to 540px (max 90vh)
    const cardContainer = screen.getByRole('heading', { level: 1, name: /gdg-hust/i }).closest('.auth-card-lock');
    expect(cardContainer).toBeInTheDocument();
    expect(cardContainer).toHaveStyle({ height: '540px', maxHeight: '90vh' });

    // Single pill toggle at the top of the body
    const signInTab = screen.getByRole('tab', { name: /^sign in$/i });
    const createAccountTab = screen.getByRole('tab', { name: /^create account$/i });
    expect(signInTab).toBeInTheDocument();
    expect(createAccountTab).toBeInTheDocument();

    // Redundant bottom toggle text link is completely removed
    expect(screen.queryByText(/already have an account\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/don't have an account\?/i)).not.toBeInTheDocument();

    // Rigid form container locked to 275px
    const formContainer = screen.getByTestId('auth-form-container');
    expect(formContainer).toBeInTheDocument();
    expect(formContainer).toHaveStyle({ height: '275px' });

    // In Sign In mode: Sign In submit button is present
    const signInSubmitBtn = screen.getByRole('button', { name: /sign in to gdg-hust/i });
    expect(signInSubmitBtn).toBeInTheDocument();
  });

  it('can toggle between Sign In and Create Account tabs with zero shift', async () => {
    await renderSignedOut();

    const signInTab = screen.getByRole('tab', { name: /^sign in$/i });
    const createAccountTab = screen.getByRole('tab', { name: /^create account$/i });

    // Initial state: Sign In is active
    expect(signInTab).toHaveAttribute('aria-selected', 'true');
    expect(createAccountTab).toHaveAttribute('aria-selected', 'false');

    const signInPanel = document.getElementById('panel-signin')!;
    const registerPanel = document.getElementById('panel-register')!;
    expect(signInPanel).not.toHaveClass('hidden');
    expect(registerPanel).toHaveClass('hidden');

    // Switch to Create Account
    fireEvent.click(createAccountTab);

    expect(createAccountTab).toHaveAttribute('aria-selected', 'true');
    expect(signInTab).toHaveAttribute('aria-selected', 'false');
    expect(registerPanel).not.toHaveClass('hidden');
    expect(signInPanel).toHaveClass('hidden');

    // Create Account fields within registerPanel
    expect(within(registerPanel).getByLabelText(/^username$/i)).toBeInTheDocument();
    expect(within(registerPanel).getByLabelText(/email address/i)).toBeInTheDocument();
    expect(within(registerPanel).getByLabelText(/^password$/i)).toBeInTheDocument();

    // Create Account submit button is visible and fully accessible
    const createAccountSubmitBtn = within(registerPanel).getByRole('button', { name: /create gdg-hust account/i });
    expect(createAccountSubmitBtn).toBeInTheDocument();

    // Switch back to Sign In
    fireEvent.click(signInTab);
    expect(signInTab).toHaveAttribute('aria-selected', 'true');
    expect(createAccountTab).toHaveAttribute('aria-selected', 'false');
    expect(signInPanel).not.toHaveClass('hidden');
    expect(registerPanel).toHaveClass('hidden');

    // Redundant bottom link remains completely absent
    expect(screen.queryByText(/already have an account\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/don't have an account\?/i)).not.toBeInTheDocument();
  });

  it('submits registration with Create GDG-HUST Account button and logs into Dashboard', async () => {
    const fetchMock = mockServer({
      ...unauthenticated,
      'POST /api/auth/register': { status: 201, body: { user: userDto('user-1', 'alice_client') } },
    });

    await renderSignedOut();

    // Switch to register tab
    fireEvent.click(screen.getByRole('tab', { name: /^create account$/i }));

    const registerPanel = document.getElementById('panel-register')!;
    fireEvent.change(within(registerPanel).getByLabelText(/^username$/i), { target: { value: 'alice_client' } });
    fireEvent.change(within(registerPanel).getByLabelText(/email address/i), { target: { value: 'alice@gdghust.dev' } });
    fireEvent.change(within(registerPanel).getByLabelText(/^password$/i), { target: { value: 'Secret123!' } });

    fireEvent.click(within(registerPanel).getByRole('button', { name: /create gdg-hust account/i }));

    await waitFor(() => {
      expect(screen.getByText(/welcome, alice_client/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({ method: 'POST' }));
    expect(localStorage.length).toBe(0);
  });

  it('submits login with Sign In to GDG-HUST button and logs into Dashboard', async () => {
    mockServer({
      ...unauthenticated,
      'POST /api/auth/login': { status: 200, body: { user: userDto('user-2', 'bob_client') } },
    });

    await renderSignedOut();

    const signInPanel = document.getElementById('panel-signin')!;
    fireEvent.change(within(signInPanel).getByLabelText(/email or username/i), { target: { value: 'bob_client' } });
    fireEvent.change(within(signInPanel).getByLabelText(/^password$/i), { target: { value: 'Password123!' } });

    fireEvent.click(within(signInPanel).getByRole('button', { name: /sign in to gdg-hust/i }));

    await waitFor(() => {
      expect(screen.getByText(/welcome, bob_client/i)).toBeInTheDocument();
    });

    expect(localStorage.length).toBe(0);
  });
});

describe('Session cookie startup and sign-out (SEC-11, Q46)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(io).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks GET /api/auth/me on startup and opens the Dashboard when it answers 200', async () => {
    const fetchMock = mockServer({ 'GET /api/auth/me': { status: 200, body: { user: userDto('user-3', 'charlie_client') } } });

    render(<App />);

    expect(await screen.findByText(/welcome, charlie_client/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/me');
  });

  it('opens the AuthScreen when /api/auth/me answers 401', async () => {
    mockServer(unauthenticated);

    render(<App />);

    expect(await screen.findByRole('button', { name: /sign in to gdg-hust/i })).toBeInTheDocument();
    expect(screen.queryByText(/welcome,/i)).not.toBeInTheDocument();
  });

  it('shows a waiting state while the server is still waking up', async () => {
    let answer: (response: FakeResponse) => void = () => undefined;
    mockServer({ 'GET /api/auth/me': () => new Promise<FakeResponse>((resolve) => (answer = resolve)) });

    render(<App />);

    expect(screen.getByText(/connecting to the server/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in to gdg-hust/i })).not.toBeInTheDocument();

    answer({ status: 200, body: { user: userDto('user-4', 'dana_client') } });
    expect(await screen.findByText(/welcome, dana_client/i)).toBeInTheDocument();
  });

  it('a 401 in the middle of the session goes back to the sign-in screen', async () => {
    let expireSession: () => void = () => undefined;
    const sessionExpired = new Promise<void>((resolve) => (expireSession = resolve));
    mockServer({
      'GET /api/auth/me': { status: 200, body: { user: userDto('user-5', 'eve_client') } },
      // The Session is revoked server-side while the Dashboard's request is in flight.
      'GET /api/direct-chats': async () => {
        await sessionExpired;
        return { status: 401, body: { message: 'Authentication required', code: 'UNAUTHORIZED' } };
      },
    });

    render(<App />);
    expect(await screen.findByText(/welcome, eve_client/i)).toBeInTheDocument();

    expireSession();

    expect(await screen.findByRole('button', { name: /sign in to gdg-hust/i })).toBeInTheDocument();
    expect(screen.queryByText(/welcome, eve_client/i)).not.toBeInTheDocument();
  });

  it('"Sign Out" calls POST /api/auth/logout and returns to the auth screen', async () => {
    const fetchMock = mockServer({
      'GET /api/auth/me': { status: 200, body: { user: userDto('user-6', 'frank_client') } },
      'POST /api/auth/logout': { status: 204 },
    });

    render(<App />);
    await screen.findByText(/welcome, frank_client/i);

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(await screen.findByRole('button', { name: /sign in to gdg-hust/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
  });

  it('keeps nothing in localStorage and sends no Authorization header, from login to logout', async () => {
    const fetchMock = mockServer({
      ...unauthenticated,
      'POST /api/auth/login': { status: 200, body: { user: userDto('user-7', 'gina_client') } },
      'POST /api/auth/logout': { status: 204 },
    });

    await renderSignedOut();
    const signInPanel = document.getElementById('panel-signin')!;
    fireEvent.change(within(signInPanel).getByLabelText(/email or username/i), { target: { value: 'gina_client' } });
    fireEvent.change(within(signInPanel).getByLabelText(/^password$/i), { target: { value: 'Password123!' } });
    fireEvent.click(within(signInPanel).getByRole('button', { name: /sign in to gdg-hust/i }));
    await screen.findByText(/welcome, gina_client/i);
    // Let the Dashboard fire its first API requests.
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(2));

    expect(localStorage.length).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    await screen.findByRole('button', { name: /sign in to gdg-hust/i });

    expect(localStorage.length).toBe(0);
    expect(sentHeaderNames(fetchMock)).not.toContain('authorization');
  });

  it('connects the socket without an auth payload (the cookie authenticates it)', async () => {
    mockServer({ 'GET /api/auth/me': { status: 200, body: { user: userDto('user-8', 'hank_client') } } });

    render(<App />);
    await screen.findByText(/welcome, hank_client/i);

    await waitFor(() => expect(io).toHaveBeenCalled());
    for (const args of vi.mocked(io).mock.calls) {
      const options = args.find((arg) => typeof arg === 'object') as Record<string, unknown> | undefined;
      expect(options).not.toHaveProperty('auth');
    }
  });
});
