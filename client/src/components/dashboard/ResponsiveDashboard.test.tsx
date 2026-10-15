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

const defaultMockChats = [
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
];

const defaultMockRooms = [
  {
    id: 'room-1',
    name: 'General Discussion',
    description: 'General chat room',
    ownerId: 'user-alice',
    role: 'OWNER',
    memberCount: 2,
    unreadCount: 0,
  },
];

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

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();

  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/direct-chats')) {
      return Promise.resolve({
        ok: true,
        json: async () => defaultMockChats,
      });
    }
    if (url.includes('/api/rooms')) {
      return Promise.resolve({
        ok: true,
        json: async () => defaultMockRooms,
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    });
  });
});

describe('Responsive Master-Detail Navigation (Ticket 01)', () => {
  it('renders root layout with Dynamic Viewport Height (100dvh)', async () => {
    const { container } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/alice/i)).toBeInTheDocument();
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

describe('Persistent Detail View Across Sidebar Tab Navigation (Ticket 02)', () => {
  it('toggles placeholder between Direct Chat and Room Chat when switching tabs without an active conversation', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    // Initially in Direct Chats tab -> Direct Chat placeholder
    expect(
      screen.getByRole('heading', { name: /real-time direct messaging/i })
    ).toBeInTheDocument();

    // Switch to Rooms tab in sidebar
    const roomsTab = screen.getByRole('button', { name: /rooms/i });
    fireEvent.click(roomsTab);

    // Detail workspace now shows Room Chat placeholder
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /room chat/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /real-time direct messaging/i })
      ).not.toBeInTheDocument();
    });

    // Switch back to Direct Chats tab in sidebar
    const directTab = screen.getByRole('button', { name: /direct chats/i });
    fireEvent.click(directTab);

    // Detail workspace returns to Direct Chat placeholder
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /real-time direct messaging/i })
      ).toBeInTheDocument();
    });
  });

  it('preserves open Direct Chat in detail workspace when clicking Rooms tab to browse rooms', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    // Select Bob's chat
    const chatItem = screen.getByText('bob').closest('div[role="button"]') || screen.getByText('bob');
    fireEvent.click(chatItem);

    // Bob's active chat header is rendered in detail workspace
    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { name: 'bob' });
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    // User clicks Rooms tab to browse rooms in sidebar
    const roomsTab = screen.getByRole('button', { name: /rooms/i });
    fireEvent.click(roomsTab);

    // Rooms list appears in sidebar
    await waitFor(() => {
      expect(screen.getByText('General Discussion')).toBeInTheDocument();
    });

    // Persistent detail view: Bob's chat is STILL displayed in detail workspace!
    const headingsAfterTab = screen.getAllByRole('heading', { name: 'bob' });
    expect(headingsAfterTab.length).toBeGreaterThanOrEqual(1);
    // Neither placeholder should be rendered
    expect(screen.queryByRole('heading', { name: /room chat/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /real-time direct messaging/i })).not.toBeInTheDocument();

    // Switch back to Direct Chats tab
    const directTab = screen.getByRole('button', { name: /direct chats/i });
    fireEvent.click(directTab);

    // Bob's chat remains visible and selected
    await waitFor(() => {
      const headingsAfterReturn = screen.getAllByRole('heading', { name: 'bob' });
      expect(headingsAfterReturn.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('switches detail workspace to Room Chat when a specific room is clicked while Direct Chat was open', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    // Open Bob's direct chat
    const chatItem = screen.getByText('bob').closest('div[role="button"]') || screen.getByText('bob');
    fireEvent.click(chatItem);

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'bob' }).length).toBeGreaterThanOrEqual(1);
    });

    // Click Rooms tab in sidebar
    const roomsTab = screen.getByRole('button', { name: /rooms/i });
    fireEvent.click(roomsTab);

    await waitFor(() => {
      expect(screen.getByText('General Discussion')).toBeInTheDocument();
    });

    // Select General Discussion room
    const roomItem = screen.getByText('General Discussion').closest('div[role="button"]') || screen.getByText('General Discussion');
    fireEvent.click(roomItem);

    // Workspace transitions to General Discussion Room Chat
    await waitFor(() => {
      const roomHeading = screen.getByRole('heading', { name: 'General Discussion' });
      expect(roomHeading).toBeInTheDocument();
    });
  });

  it('preserves open Room Chat in detail workspace when clicking Direct Chats tab until a direct chat is clicked', async () => {
    renderDashboard();

    // Switch to Rooms and select General Discussion
    const roomsTab = screen.getByRole('button', { name: /rooms/i });
    fireEvent.click(roomsTab);

    await waitFor(() => {
      expect(screen.getByText('General Discussion')).toBeInTheDocument();
    });

    const roomItem = screen.getByText('General Discussion').closest('div[role="button"]') || screen.getByText('General Discussion');
    fireEvent.click(roomItem);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'General Discussion' })).toBeInTheDocument();
    });

    // Click Direct Chats tab in sidebar
    const directTab = screen.getByRole('button', { name: /direct chats/i });
    fireEvent.click(directTab);

    // Direct Chats list appears in sidebar
    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    // Room Chat remains visible in detail workspace
    expect(screen.getByRole('heading', { name: 'General Discussion' })).toBeInTheDocument();

    // Now click Bob's chat
    const chatItem = screen.getByText('bob').closest('div[role="button"]') || screen.getByText('bob');
    fireEvent.click(chatItem);

    // Switches to Bob's direct chat
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'General Discussion' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('heading', { name: 'bob' }).length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Mobile Master-Detail Regression & Floating Action Button (Ticket 03)', () => {
  it('renders mobile floating action button (FAB) on master conversation list with md:hidden constraint', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    const fab = screen.getByTestId('mobile-fab-button');
    expect(fab).toBeInTheDocument();
    expect(fab.className).toMatch(/md:hidden/);

    // Switch to rooms tab
    const roomsTab = screen.getByRole('button', { name: /rooms/i });
    fireEvent.click(roomsTab);

    await waitFor(() => {
      expect(screen.getByText('General Discussion')).toBeInTheDocument();
    });

    const roomFab = screen.getByTestId('mobile-fab-button');
    expect(roomFab).toBeInTheDocument();
    expect(roomFab.className).toMatch(/md:hidden/);
  });

  it('maintains mobile master-detail navigation with full-width chat and working Back button', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    // Sidebar is full-width when no chat active
    const sidebar = screen.getByRole('complementary');
    expect(sidebar.className).toMatch(/w-full/);

    // Click chat
    const chatItem = screen.getByText('bob').closest('div[role="button"]') || screen.getByText('bob');
    fireEvent.click(chatItem);

    // On mobile, detail container takes full width and sidebar is hidden
    await waitFor(() => {
      expect(sidebar.className).toMatch(/hidden\s+md:flex/);
      const chatAreaContainer = screen.getByTestId('chat-area-container');
      expect(chatAreaContainer.className).toMatch(/w-full\s+flex/);
    });

    // Mobile back button is present and marked md:hidden
    const backBtn = screen.getByRole('button', { name: /back to chats/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.className).toMatch(/md:hidden/);

    // Click back button to return to master list
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(sidebar.className).toMatch(/w-full/);
      const chatAreaContainer = screen.getByTestId('chat-area-container');
      expect(chatAreaContainer.className).toMatch(/hidden\s+md:flex/);
    });
  });
});

describe('Ultra-Compact Dashboard Header and Maximal Chat Workspace (Ticket 03)', () => {
  it('constrains top navigation header to slim 42px height (h-11) with GDG-HUST brand lockup', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('GDG-HUST')).toBeInTheDocument();
    });

    // Header has slim height h-11
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('h-11');

    // GDG logo is rendered with 28x28px mark
    const logoImg = screen.getByAltText('GDG Logo');
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveAttribute('src', '/assets/brand/logo-gdg-clean.webp');
    expect(logoImg.parentElement).toHaveClass('w-7', 'h-7');

    // Title GDG-HUST has whitespace-nowrap and font-bold
    const title = screen.getByText('GDG-HUST');
    expect(title.className).toMatch(/whitespace-nowrap/);
    expect(title.className).toMatch(/font-bold/);
    expect(title.className).toMatch(/text-sm/);

    // Welcome greeting is styled in Google Blue and hidden on narrow mobile screens
    const greeting = screen.getByText(/Welcome, alice!/i);
    expect(greeting).toBeInTheDocument();
    expect(greeting.className).toMatch(/text-google-blue/);
    expect(greeting.className).toMatch(/hidden\s+(md|sm):/);
  });

  it('renders compact 8px pulsing green socket connection indicator and 24px user avatar in header', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('GDG-HUST')).toBeInTheDocument();
    });

    // Socket connection status badge
    const statusBadge = screen.getByTestId('socket-connection-badge');
    expect(statusBadge).toBeInTheDocument();

    // Contains 8px pulsing green dot (w-2 h-2 rounded-full bg-google-green animate-pulse)
    const dot = statusBadge.querySelector('span.w-2.h-2');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('rounded-full', 'bg-google-green', 'animate-pulse');

    // Text label is hidden on mobile
    const statusText = screen.getByText('Connected');
    expect(statusText).toHaveClass('hidden', 'sm:inline');

    // Header displays 24px avatar circle (w-6 h-6 rounded-full bg-google-blue)
    const avatar = screen.getByTestId('header-user-avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveClass('w-6', 'h-6', 'rounded-full', 'bg-google-blue');
    expect(avatar).toHaveTextContent('AL');
  });

  it('renders logout button with Google Red hover styling and clean icon on mobile', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('GDG-HUST')).toBeInTheDocument();
    });

    const logoutBtn = screen.getByRole('button', { name: /sign out/i });
    expect(logoutBtn).toBeInTheDocument();
    expect(logoutBtn.className).toMatch(/hover:text-google-red/);
    expect(logoutBtn.className).toMatch(/hover:bg-google-red-subtle/);
  });

  it('eliminates duplicate user profile header from Sidebar so tabs start directly at top', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('GDG-HUST')).toBeInTheDocument();
    });

    const sidebar = screen.getByRole('complementary');

    // Sidebar should NOT contain a duplicate user profile header or duplicate logout button
    const sidebarButtons = sidebar.querySelectorAll('button');
    const sidebarLogoutBtn = Array.from(sidebarButtons).find(btn =>
      btn.getAttribute('aria-label')?.toLowerCase() === 'log out' ||
      btn.getAttribute('title')?.toLowerCase() === 'log out'
    );
    expect(sidebarLogoutBtn).toBeUndefined();

    // Verify Direct Chats and Rooms tabs are in the sidebar
    expect(screen.getByRole('button', { name: /direct chats/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rooms/i })).toBeInTheDocument();
  });
});
