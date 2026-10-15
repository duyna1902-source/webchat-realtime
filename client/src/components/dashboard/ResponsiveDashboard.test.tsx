import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';

const mockUser = {
  id: 'user-alice',
  username: 'alice',
  email: 'alice@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Responsive Master-Detail Navigation (Ticket 01)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/direct-chats')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'chat-1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              partner: {
                id: 'user-bob',
                username: 'bob',
                email: 'bob@example.com',
                isOnline: true,
              },
              unreadCount: 0,
            },
          ],
        });
      }
      if (url.includes('/api/rooms')) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  const renderDashboard = () => {
    const authValue: any = {
      currentUser: mockUser,
      token: 'token-xyz',
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    };

    const socketValue: any = {
      socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
      isConnected: true,
      isConnecting: false,
      isReconnecting: false,
      connectionError: null,
    };

    return render(
      <AuthContext.Provider value={authValue}>
        <SocketContext.Provider value={socketValue}>
          <Dashboard />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );
  };

  it('renders root layout with Dynamic Viewport Height (100dvh)', async () => {
    const { container } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    const rootContainer = container.firstElementChild;
    expect(rootContainer).toHaveClass('h-[100dvh]');
  });

  it('renders Sidebar full-width on mobile and hides ChatArea when no chat is active', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    const sidebar = screen.getByRole('complementary');
    expect(sidebar.className).toMatch(/w-full/);
    expect(sidebar.className).toMatch(/md:w-88/);

    const chatAreaContainer = screen.getByTestId('chat-area-container');
    expect(chatAreaContainer.className).toMatch(/hidden\s+md:flex/);
  });

  it('hides Sidebar on mobile and displays ChatArea full-width when a chat is selected', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    // Select Bob's chat
    const chatItem = screen.getByText('bob').closest('div[role="button"]') || screen.getByText('bob');
    fireEvent.click(chatItem);

    await waitFor(() => {
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.className).toMatch(/hidden\s+md:flex/);

      const chatAreaContainer = screen.getByTestId('chat-area-container');
      expect(chatAreaContainer.className).not.toMatch(/hidden\s+md:flex/);
      expect(chatAreaContainer.className).toMatch(/flex/);
    });

    // Click mobile Back button
    const backBtn = screen.getByRole('button', { name: /back to chats/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.className).toMatch(/md:hidden/);
    fireEvent.click(backBtn);

    await waitFor(() => {
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.className).toMatch(/w-full/);
      const chatAreaContainer = screen.getByTestId('chat-area-container');
      expect(chatAreaContainer.className).toMatch(/hidden\s+md:flex/);
    });
  });

  it('hides Sidebar on mobile and displays RoomChatArea when a room is selected, then returns on Back click', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/direct-chats')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/api/rooms')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'room-1',
              name: 'General Discussion',
              description: 'General chat room',
              ownerId: 'user-alice',
              role: 'OWNER',
              memberCount: 2,
              unreadCount: 0,
            },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderDashboard();

    const roomsTab = screen.getByRole('button', { name: /rooms/i });
    fireEvent.click(roomsTab);

    await waitFor(() => {
      expect(screen.getByText('General Discussion')).toBeInTheDocument();
    });

    const roomItem = screen.getByText('General Discussion').closest('div[role="button"]') || screen.getByText('General Discussion');
    fireEvent.click(roomItem);

    await waitFor(() => {
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.className).toMatch(/hidden\s+md:flex/);

      const chatAreaContainer = screen.getByTestId('chat-area-container');
      expect(chatAreaContainer.className).toMatch(/flex/);
    });

    const backBtn = screen.getByRole('button', { name: /back to chats/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.className).toMatch(/md:hidden/);
    fireEvent.click(backBtn);

    await waitFor(() => {
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.className).toMatch(/w-full/);
    });
  });
});

describe('Desktop Dual-Pane Layout & Fixed Sidebar Width (Ticket 01)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/direct-chats')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'chat-1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              partner: {
                id: 'user-bob',
                username: 'bob',
                email: 'bob@example.com',
                isOnline: true,
              },
              unreadCount: 0,
            },
          ],
        });
      }
      if (url.includes('/api/rooms')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'room-1',
              name: 'General Discussion',
              description: 'General chat room',
              ownerId: 'user-alice',
              role: 'OWNER',
              memberCount: 2,
              unreadCount: 0,
            },
          ],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  const renderDashboard = () => {
    const authValue: any = {
      currentUser: mockUser,
      token: 'token-xyz',
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    };

    const socketValue: any = {
      socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
      isConnected: true,
      isConnecting: false,
      isReconnecting: false,
      connectionError: null,
    };

    return render(
      <AuthContext.Provider value={authValue}>
        <SocketContext.Provider value={socketValue}>
          <Dashboard />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );
  };

  it('configures 88 spacing scale (22rem / 352px) in Tailwind CSS config', async () => {
    // @ts-expect-error tailwind.config.js has no type declarations
    const tailwindConfig = await import('../../../tailwind.config.js');
    expect(tailwindConfig.default.theme?.extend?.spacing?.['88']).toBe('22rem');
  });

  it('renders dual-pane layout on initial desktop load with fixed 352px sidebar and idle Direct Chat placeholder', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    const sidebar = screen.getByRole('complementary');
    // On desktop, md:w-88 enforces 352px fixed width
    expect(sidebar.className).toMatch(/md:w-88/);
    // On mobile, w-full ensures full-width list
    expect(sidebar.className).toMatch(/w-full/);

    // Detail pane is rendered side-by-side (flex on md:)
    const chatAreaContainer = screen.getByTestId('chat-area-container');
    expect(chatAreaContainer.className).toMatch(/md:flex/);

    // Displays the idle Direct Chat placeholder
    expect(
      screen.getByRole('heading', { name: /real-time direct messaging/i })
    ).toBeInTheDocument();
  });

  it('keeps sidebar fixed at 352px width (md:w-88) without collapsing or layout shift when selecting chat or room', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    const sidebar = screen.getByRole('complementary');
    expect(sidebar.className).toMatch(/md:w-88/);

    // Click Bob's chat
    const chatItem = screen.getByText('bob').closest('div[role="button"]') || screen.getByText('bob');
    fireEvent.click(chatItem);

    await waitFor(() => {
      // Sidebar maintains md:w-88 on desktop
      expect(sidebar.className).toMatch(/md:w-88/);
    });

    // Back to master list
    const backBtn = screen.getByRole('button', { name: /back to chats/i });
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(sidebar.className).toMatch(/md:w-88/);
      expect(sidebar.className).toMatch(/w-full/);
    });
  });
});

