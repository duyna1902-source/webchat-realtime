import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Sidebar } from '../chat/Sidebar';
import { RoomChatArea } from './RoomChatArea';
import { CreateRoomModal } from './CreateRoomModal';
import { RoomMembersModal } from './RoomMembersModal';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import {
  RoomListItemDto,
  RoomDetailDto,
  RoomReceiveMessagePayload,
  RoomRole,
  MessageType,
  SOCKET_EVENTS,
  MESSAGE_LIMITS,
} from '@webchat/shared';
import { attachmentFixture } from '../../test/attachmentFixtures';

const mockUser = {
  id: 'user-owner-id',
  username: 'alice_owner',
  email: 'alice@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAdminUser = {
  id: 'user-admin-id',
  username: 'bob_admin',
  email: 'bob@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockMemberUser = {
  id: 'user-member-id',
  username: 'charlie_member',
  email: 'charlie@example.com',
  isOnline: false,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockRoom: RoomListItemDto = {
  id: 'room-1',
  name: 'Engineering',
  description: 'Discuss all things engineering',
  ownerId: 'user-owner-id',
  role: RoomRole.OWNER,
  memberCount: 3,
  unreadCount: 0,
  lastMessage: {
    id: 'rmsg-1',
    roomId: 'room-1',
    senderId: 'user-admin-id',
    sender: { id: 'user-admin-id', username: 'bob_admin' },
    content: 'Standup in 5 mins',
    type: MessageType.TEXT,
    attachment: null,
    createdAt: new Date().toISOString(),
  },
  updatedAt: new Date().toISOString(),
};

const mockRoomDetail: RoomDetailDto = {
  id: 'room-1',
  name: 'Engineering',
  description: 'Discuss all things engineering',
  ownerId: 'user-owner-id',
  role: RoomRole.OWNER,
  memberCount: 3,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  members: [
    {
      id: 'mem-1',
      roomId: 'room-1',
      userId: 'user-owner-id',
      role: RoomRole.OWNER,
      joinedAt: new Date().toISOString(),
      user: mockUser,
    },
    {
      id: 'mem-2',
      roomId: 'room-1',
      userId: 'user-admin-id',
      role: RoomRole.ADMIN,
      joinedAt: new Date().toISOString(),
      user: mockAdminUser,
    },
    {
      id: 'mem-3',
      roomId: 'room-1',
      userId: 'user-member-id',
      role: RoomRole.MEMBER,
      joinedAt: new Date().toISOString(),
      user: mockMemberUser,
    },
  ],
};

function renderWithProviders(ui: React.ReactElement, socketConnected = true, user = mockUser) {
  const authValue: any = {
    currentUser: user,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };

  const socketValue: any = {
    socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
    isConnected: socketConnected,
    isConnecting: false,
    connectionError: null,
  };

  const AllTheProviders = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={authValue}>
      <SocketContext.Provider value={socketValue}>
        {children}
      </SocketContext.Provider>
    </AuthContext.Provider>
  );

  return render(ui, { wrapper: AllTheProviders });
}

describe('Room Chat Client Components', () => {
  it('switches to Rooms tab in Sidebar and lists joined rooms', () => {
    const onSelectRoom = vi.fn();
    const onTabChange = vi.fn();

    renderWithProviders(
      <Sidebar
        chats={[]}
        activeChatId={null}
        onSelectChat={vi.fn()}
        onStartChat={vi.fn()}
        isLoadingChats={false}
        rooms={[mockRoom]}
        activeRoomId={null}
        onSelectRoom={onSelectRoom}
        activeTab="room"
        onTabChange={onTabChange}
      />
    );

    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText(/standup in 5 mins/i)).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Engineering'));
    expect(onSelectRoom).toHaveBeenCalledWith('room-1');
  });

  it('renders RoomChatArea with messages and sends room message', () => {
    const onSendMessage = vi.fn();
    const messages: RoomReceiveMessagePayload[] = [
      {
        id: 'rmsg-1',
        roomId: 'room-1',
        senderId: 'user-admin-id',
        sender: { id: 'user-admin-id', username: 'bob_admin' },
        content: 'Good morning everyone!',
        type: MessageType.TEXT,
        attachment: null,
        createdAt: new Date().toISOString(),
      },
    ];

    renderWithProviders(
      <RoomChatArea
        activeRoom={mockRoom}
        roomDetails={mockRoomDetail}
        messages={messages}
        isLoadingMessages={false}
        onSendMessage={onSendMessage}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />
    );

    expect(screen.getByText('Good morning everyone!')).toBeInTheDocument();
    expect(screen.getByText('bob_admin')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/message #engineering\.\.\./i);
    fireEvent.change(textarea, { target: { value: 'Good morning Bob!' } });

    const sendBtn = screen.getByRole('button', { name: /send room message/i });
    fireEvent.click(sendBtn);

    expect(onSendMessage).toHaveBeenCalledWith('Good morning Bob!');
  });

  it('submits room creation modal', async () => {
    const onCreateRoom = vi.fn().mockResolvedValue('new-room-id');
    const onClose = vi.fn();

    render(
      <CreateRoomModal
        isOpen={true}
        onClose={onClose}
        onCreateRoom={onCreateRoom}
      />
    );

    const nameInput = screen.getByPlaceholderText(/e\.g\. engineering-team/i);
    fireEvent.change(nameInput, { target: { value: 'frontend-devs' } });

    const descInput = screen.getByPlaceholderText(/what is this room about\?/i);
    fireEvent.change(descInput, { target: { value: 'Frontend engineering talks' } });

    fireEvent.click(screen.getByRole('button', { name: /create room/i }));

    await waitFor(() => {
      expect(onCreateRoom).toHaveBeenCalledWith('frontend-devs', 'Frontend engineering talks');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('displays member roster with roles and handles Owner administrative actions in RoomMembersModal', async () => {
    const onRemoveMember = vi.fn().mockResolvedValue(undefined);
    const onChangeRole = vi.fn().mockResolvedValue(undefined);
    const onLeaveRoom = vi.fn().mockResolvedValue(undefined);
    const onDeleteRoom = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <RoomMembersModal
        isOpen={true}
        onClose={vi.fn()}
        roomDetails={mockRoomDetail}
        onAddMember={vi.fn()}
        onRemoveMember={onRemoveMember}
        onChangeRole={onChangeRole}
        onLeaveRoom={onLeaveRoom}
        onDeleteRoom={onDeleteRoom}
      />
    );

    // Verify all members rendered with correct names and roles
    expect(screen.getByText('alice_owner')).toBeInTheDocument();
    expect(screen.getByText('bob_admin')).toBeInTheDocument();
    expect(screen.getByText('charlie_member')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();

    // Owner should see Delete Room button
    expect(screen.getByRole('button', { name: /delete room/i })).toBeInTheDocument();

    // Demote Admin button should be visible for bob_admin
    const demoteBtn = screen.getByTitle('Demote to Member');
    fireEvent.click(demoteBtn);
    await waitFor(() => {
      expect(onChangeRole).toHaveBeenCalledWith('user-admin-id', RoomRole.MEMBER);
    });

    // Promote Member button should be visible for charlie_member
    const promoteBtn = screen.getByTitle('Promote to Admin');
    fireEvent.click(promoteBtn);
    await waitFor(() => {
      expect(onChangeRole).toHaveBeenCalledWith('user-member-id', RoomRole.ADMIN);
    });
  });

  it('handles room attachments: paperclip button, 10MB size validation, and rendering IMAGE/DOCUMENT messages', async () => {
    const onSendMessage = vi.fn();
    const imageRoomMsg: RoomReceiveMessagePayload = {
      id: 'rmsg-img-1',
      roomId: 'room-1',
      senderId: 'user-admin-id',
      sender: { id: 'user-admin-id', username: 'bob_admin' },
      content: 'Here is the sprint roadmap image',
      type: MessageType.IMAGE,
      attachment: attachmentFixture({ url: '/uploads/roadmap.png', name: 'roadmap.png', size: 1024 * 800 }),
      createdAt: new Date().toISOString(),
    };

    const docRoomMsg: RoomReceiveMessagePayload = {
      id: 'rmsg-doc-1',
      roomId: 'room-1',
      senderId: 'user-owner-id',
      sender: { id: 'user-owner-id', username: 'alice_owner' },
      content: 'Here is the sprint retro notes',
      type: MessageType.DOCUMENT,
      attachment: attachmentFixture({ url: '/uploads/retro.docx', name: 'retro.docx', size: 1024 * 350 }),
      createdAt: new Date().toISOString(),
    };

    renderWithProviders(
      <RoomChatArea
        activeRoom={mockRoom}
        roomDetails={mockRoomDetail}
        messages={[imageRoomMsg, docRoomMsg]}
        isLoadingMessages={false}
        onSendMessage={onSendMessage}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />
    );

    // Verify paperclip button
    expect(screen.getByRole('button', { name: /attach file/i })).toBeInTheDocument();

    // Verify image message rendered with thumbnail
    const imgThumbnail = screen.getByRole('img', { name: /roadmap\.png|image attachment/i });
    expect(imgThumbnail).toBeInTheDocument();

    // Verify document message rendered with name and download link
    expect(screen.getByText('retro.docx')).toBeInTheDocument();
    const downloadLink = screen.getByRole('link', { name: /download retro\.docx|download file/i });
    expect(downloadLink).toHaveAttribute('href', '/uploads/retro.docx');

    // Test 10MB limit validation
    const fileInput = screen.getByTestId('room-file-upload-input');
    const oversizeFile = new File(['x'], 'too-big.zip', { type: 'application/zip' });
    Object.defineProperty(oversizeFile, 'size', { value: 12 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [oversizeFile] } });
    expect(await screen.findByText(/exceeds 10mb limit/i)).toBeInTheDocument();
  });

  it('emits room:typing on keystroke and displays incoming room:typing animated banner', async () => {
    let typingHandler: ((payload: any) => void) | undefined;
    const mockEmit = vi.fn();
    const mockOn = vi.fn().mockImplementation((event: string, handler: any) => {
      if (event === SOCKET_EVENTS.ROOM_TYPING) {
        typingHandler = handler;
      }
    });

    const authValue: any = {
      currentUser: mockUser,
      isLoading: false,
    };

    const socketValue: any = {
      socket: { emit: mockEmit, on: mockOn, off: vi.fn() },
      isConnected: true,
      isConnecting: false,
      connectionError: null,
    };

    render(
      <AuthContext.Provider value={authValue}>
        <SocketContext.Provider value={socketValue}>
          <RoomChatArea
            activeRoom={mockRoom}
            roomDetails={mockRoomDetail}
            messages={[]}
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

    const textarea = screen.getByPlaceholderText(/message #engineering\.\.\./i);
    fireEvent.change(textarea, { target: { value: 'H' } });

    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.ROOM_TYPING, {
      roomId: 'room-1',
      isTyping: true,
    });

    // Simulate incoming room:typing event from Bob
    expect(typingHandler).toBeDefined();
    act(() => {
      typingHandler?.({
        roomId: 'room-1',
        userId: 'user-admin-id',
        username: 'bob_admin',
        isTyping: true,
      });
    });

    expect(await screen.findByText(/bob_admin is typing\.\.\./i)).toBeInTheDocument();
  });

  it('renders a mobile Back button in RoomChatArea when onBack is provided, hidden on desktop, and invokes callback on click', () => {
    const onBack = vi.fn();

    render(
      <AuthContext.Provider value={{ currentUser: mockUser } as any}>
        <SocketContext.Provider value={{ socket: null, isConnected: true } as any}>
          <RoomChatArea
            activeRoom={mockRoom}
            roomDetails={null}
            messages={[]}
            isLoadingMessages={false}
            onSendMessage={vi.fn()}
            onAddMember={vi.fn()}
            onRemoveMember={vi.fn()}
            onChangeRole={vi.fn()}
            onLeaveRoom={vi.fn()}
            onDeleteRoom={vi.fn()}
            onBack={onBack}
          />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    const backButton = screen.getByRole('button', { name: /back to chats/i });
    expect(backButton).toBeInTheDocument();
    expect(backButton.className).toMatch(/md:hidden/);

    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('displays character counter reflecting role quota and enforces maxLength attribute', () => {
    // 1. Member sees 0/2000 and maxLength=2000
    const memberRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.MEMBER };
    const { unmount } = renderWithProviders(
      <RoomChatArea
        activeRoom={memberRoom}
        roomDetails={mockRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockMemberUser
    );

    const memberTextarea = screen.getByPlaceholderText(/message #engineering\.\.\./i) as HTMLTextAreaElement;
    const memberCounter = screen.getByTestId('char-counter');
    expect(memberCounter.textContent).toBe(`0/${MESSAGE_LIMITS.ROOM_MEMBER}`);
    expect(memberTextarea.getAttribute('maxlength')).toBe(String(MESSAGE_LIMITS.ROOM_MEMBER));
    unmount();

    // 2. Owner sees 0/4000 and maxLength=4000
    const { unmount: unmountOwner } = renderWithProviders(
      <RoomChatArea
        activeRoom={mockRoom}
        roomDetails={mockRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockUser
    );

    const ownerTextarea = screen.getByPlaceholderText(/message #engineering\.\.\./i) as HTMLTextAreaElement;
    const ownerCounter = screen.getByTestId('char-counter');
    expect(ownerCounter.textContent).toBe(`0/${MESSAGE_LIMITS.ROOM_LEADER}`);
    expect(ownerTextarea.getAttribute('maxlength')).toBe(String(MESSAGE_LIMITS.ROOM_LEADER));
    unmountOwner();

    // 3. Admin sees 0/4000 and maxLength=4000
    const adminRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.ADMIN };
    renderWithProviders(
      <RoomChatArea
        activeRoom={adminRoom}
        roomDetails={mockRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockAdminUser
    );

    const adminTextarea = screen.getByPlaceholderText(/message #engineering\.\.\./i) as HTMLTextAreaElement;
    const adminCounter = screen.getByTestId('char-counter');
    expect(adminCounter.textContent).toBe(`0/${MESSAGE_LIMITS.ROOM_LEADER}`);
    expect(adminTextarea.getAttribute('maxlength')).toBe(String(MESSAGE_LIMITS.ROOM_LEADER));
  });

  it('updates counter color to yellow at 90% and red at 100% based on role quota', () => {
    // 1. Member: 2000 limit (90% = 1800, 100% = 2000)
    const memberRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.MEMBER };
    const { unmount } = renderWithProviders(
      <RoomChatArea
        activeRoom={memberRoom}
        roomDetails={mockRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockMemberUser
    );

    const memberTextarea = screen.getByPlaceholderText(/message #engineering\.\.\./i);
    const memberCounter = screen.getByTestId('char-counter');

    // < 90%
    fireEvent.change(memberTextarea, { target: { value: 'a'.repeat(100) } });
    expect(memberCounter.textContent).toBe('100/2000');
    expect(memberCounter.className).toContain('text-google-grey700');

    // 90% (1800) -> yellow
    fireEvent.change(memberTextarea, { target: { value: 'a'.repeat(1800) } });
    expect(memberCounter.textContent).toBe('1800/2000');
    expect(memberCounter.className).toContain('text-google-yellow');

    // 1999 (< 100%) -> yellow
    fireEvent.change(memberTextarea, { target: { value: 'a'.repeat(1999) } });
    expect(memberCounter.textContent).toBe('1999/2000');
    expect(memberCounter.className).toContain('text-google-yellow');

    // 100% (2000) -> red
    fireEvent.change(memberTextarea, { target: { value: 'a'.repeat(2000) } });
    expect(memberCounter.textContent).toBe('2000/2000');
    expect(memberCounter.className).toContain('text-google-red');

    // Exceeding limit (2001) -> clamped to 2000
    fireEvent.change(memberTextarea, { target: { value: 'a'.repeat(2001) } });
    expect(memberCounter.textContent).toBe('2000/2000');
    expect(memberCounter.className).toContain('text-google-red');

    unmount();

    // 2. Leader (Owner/Admin): 4000 limit (90% = 3600, 100% = 4000)
    renderWithProviders(
      <RoomChatArea
        activeRoom={mockRoom}
        roomDetails={mockRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockUser
    );

    const leaderTextarea = screen.getByPlaceholderText(/message #engineering\.\.\./i);
    const leaderCounter = screen.getByTestId('char-counter');

    // 3599 (< 90%)
    fireEvent.change(leaderTextarea, { target: { value: 'a'.repeat(3599) } });
    expect(leaderCounter.textContent).toBe('3599/4000');
    expect(leaderCounter.className).toContain('text-google-grey700');

    // 3600 (90%) -> yellow
    fireEvent.change(leaderTextarea, { target: { value: 'a'.repeat(3600) } });
    expect(leaderCounter.textContent).toBe('3600/4000');
    expect(leaderCounter.className).toContain('text-google-yellow');

    // 4000 (100%) -> red
    fireEvent.change(leaderTextarea, { target: { value: 'a'.repeat(4000) } });
    expect(leaderCounter.textContent).toBe('4000/4000');
    expect(leaderCounter.className).toContain('text-google-red');
  });

  it('disables send button when input is empty, whitespace-only, or exceeding active role limit', () => {
    const memberRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.MEMBER };
    renderWithProviders(
      <RoomChatArea
        activeRoom={memberRoom}
        roomDetails={mockRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockMemberUser
    );

    const textarea = screen.getByPlaceholderText(/message #engineering\.\.\./i);
    const sendBtn = screen.getByRole('button', { name: /send room message/i });

    // Empty -> disabled
    expect(sendBtn).toBeDisabled();

    // Whitespace only -> disabled
    fireEvent.change(textarea, { target: { value: '     ' } });
    expect(sendBtn).toBeDisabled();

    // At limit 2000 -> enabled
    fireEvent.change(textarea, { target: { value: 'm'.repeat(2000) } });
    expect(sendBtn).not.toBeDisabled();

    // Exceeding limit 2001 -> clamped to 2000, send button remains enabled
    fireEvent.change(textarea, { target: { value: 'm'.repeat(2001) } });
    expect(sendBtn).not.toBeDisabled();
  });

  it('automatically trims pasted clipboard text to fit active role character quota', () => {
    // 1. Member: trims to 2000
    const memberRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.MEMBER };
    const { unmount } = renderWithProviders(
      <RoomChatArea
        activeRoom={memberRoom}
        roomDetails={mockRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockMemberUser
    );

    const memberTextarea = screen.getByPlaceholderText(/message #engineering\.\.\./i) as HTMLTextAreaElement;
    const memberCounter = screen.getByTestId('char-counter');

    // Paste 3000 chars into empty textarea
    const oversizedClip = 'x'.repeat(3000);
    fireEvent.paste(memberTextarea, {
      clipboardData: {
        getData: (format: string) => (format === 'text' ? oversizedClip : ''),
      },
    });

    expect(memberTextarea.value.length).toBe(2000);
    expect(memberCounter.textContent).toBe('2000/2000');

    // Type 1800, paste 500 -> trimmed to remaining 200 chars
    fireEvent.change(memberTextarea, { target: { value: 'a'.repeat(1800) } });
    memberTextarea.selectionStart = 1800;
    memberTextarea.selectionEnd = 1800;

    fireEvent.paste(memberTextarea, {
      clipboardData: {
        getData: (format: string) => (format === 'text' ? 'b'.repeat(500) : ''),
      },
    });

    expect(memberTextarea.value.length).toBe(2000);
    expect(memberTextarea.value).toBe('a'.repeat(1800) + 'b'.repeat(200));
    expect(memberCounter.textContent).toBe('2000/2000');

    unmount();

    // 2. Leader (Admin): trims to 4000
    const adminRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.ADMIN };
    renderWithProviders(
      <RoomChatArea
        activeRoom={adminRoom}
        roomDetails={mockRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockAdminUser
    );

    const adminTextarea = screen.getByPlaceholderText(/message #engineering\.\.\./i) as HTMLTextAreaElement;
    const adminCounter = screen.getByTestId('char-counter');

    // Paste 5000 chars into empty textarea
    fireEvent.paste(adminTextarea, {
      clipboardData: {
        getData: (format: string) => (format === 'text' ? 'z'.repeat(5000) : ''),
      },
    });

    expect(adminTextarea.value.length).toBe(4000);
    expect(adminCounter.textContent).toBe('4000/4000');
  });

  it('preserves draft and displays demotion warning and disabled send button when demoted from ADMIN to MEMBER', () => {
    const adminRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.ADMIN };
    const adminRoomDetail: RoomDetailDto = {
      ...mockRoomDetail,
      members: mockRoomDetail.members.map((m) =>
        m.userId === mockAdminUser.id ? { ...m, role: RoomRole.ADMIN } : m
      ),
    };

    const { rerender } = renderWithProviders(
      <RoomChatArea
        activeRoom={adminRoom}
        roomDetails={adminRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockAdminUser
    );

    const textarea = screen.getByPlaceholderText(/message #engineering\.\.\./i) as HTMLTextAreaElement;
    const counter = screen.getByTestId('char-counter');
    const sendBtn = screen.getByRole('button', { name: /send room message/i });

    // 1. Admin drafts a 2450-character message
    const draft2450 = 'a'.repeat(2450);
    fireEvent.change(textarea, { target: { value: draft2450 } });

    expect(textarea.value).toBe(draft2450);
    expect(counter.textContent).toBe('2450/4000');
    expect(sendBtn).not.toBeDisabled();
    expect(screen.queryByTestId('draft-demotion-warning')).not.toBeInTheDocument();

    // 2. Real-time demotion to MEMBER
    const memberRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.MEMBER };
    const memberRoomDetail: RoomDetailDto = {
      ...mockRoomDetail,
      members: mockRoomDetail.members.map((m) =>
        m.userId === mockAdminUser.id ? { ...m, role: RoomRole.MEMBER } : m
      ),
    };

    rerender(
      <RoomChatArea
        activeRoom={memberRoom}
        roomDetails={memberRoomDetail}
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

    // Draft is preserved intact without loss or silent truncation
    expect(textarea.value).toBe(draft2450);
    expect(textarea.value.length).toBe(2450);

    // Counter shows exceeded ratio styled in Google Red
    expect(counter.textContent).toBe('2450/2000');
    expect(counter.className).toContain('text-google-red');

    // Textarea maxLength allows existing draft without cutting, preventing more typing
    expect(Number(textarea.getAttribute('maxlength'))).toBe(2450);

    // Demotion warning is displayed informing user of 2000 limit
    const warning = screen.getByTestId('draft-demotion-warning');
    expect(warning).toBeInTheDocument();
    expect(warning.textContent).toContain('2000');

    // Send button is disabled
    expect(sendBtn).toBeDisabled();
  });

  it('clears demotion warning and enables send button when user edits draft down to <= 2000 chars', () => {
    const adminRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.ADMIN };
    const adminRoomDetail: RoomDetailDto = {
      ...mockRoomDetail,
      members: mockRoomDetail.members.map((m) =>
        m.userId === mockAdminUser.id ? { ...m, role: RoomRole.ADMIN } : m
      ),
    };

    const { rerender } = renderWithProviders(
      <RoomChatArea
        activeRoom={adminRoom}
        roomDetails={adminRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockAdminUser
    );

    const textarea = screen.getByPlaceholderText(/message #engineering\.\.\./i) as HTMLTextAreaElement;
    const counter = screen.getByTestId('char-counter');
    const sendBtn = screen.getByRole('button', { name: /send room message/i });

    // Draft 2450 chars as Admin
    fireEvent.change(textarea, { target: { value: 'a'.repeat(2450) } });

    // Demote to Member
    const memberRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.MEMBER };
    const memberRoomDetail: RoomDetailDto = {
      ...mockRoomDetail,
      members: mockRoomDetail.members.map((m) =>
        m.userId === mockAdminUser.id ? { ...m, role: RoomRole.MEMBER } : m
      ),
    };

    rerender(
      <RoomChatArea
        activeRoom={memberRoom}
        roomDetails={memberRoomDetail}
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

    expect(screen.getByTestId('draft-demotion-warning')).toBeInTheDocument();
    expect(sendBtn).toBeDisabled();

    // Edit down to exactly 2000 chars
    fireEvent.change(textarea, { target: { value: 'a'.repeat(2000) } });

    // Warning is gone
    expect(screen.queryByTestId('draft-demotion-warning')).not.toBeInTheDocument();
    // Send button is enabled
    expect(sendBtn).not.toBeDisabled();
    // Counter shows 2000/2000 (red)
    expect(counter.textContent).toBe('2000/2000');
    expect(counter.className).toContain('text-google-red');

    // Edit down to 1800 chars (90% threshold)
    fireEvent.change(textarea, { target: { value: 'a'.repeat(1800) } });
    expect(counter.textContent).toBe('1800/2000');
    expect(counter.className).toContain('text-google-yellow');
    expect(sendBtn).not.toBeDisabled();
  });

  it('allows manually dismissing the draft demotion warning without altering the draft', () => {
    const adminRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.ADMIN };
    const adminRoomDetail: RoomDetailDto = {
      ...mockRoomDetail,
      members: mockRoomDetail.members.map((m) =>
        m.userId === mockAdminUser.id ? { ...m, role: RoomRole.ADMIN } : m
      ),
    };

    const { rerender } = renderWithProviders(
      <RoomChatArea
        activeRoom={adminRoom}
        roomDetails={adminRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockAdminUser
    );

    const textarea = screen.getByPlaceholderText(/message #engineering\.\.\./i) as HTMLTextAreaElement;
    const sendBtn = screen.getByRole('button', { name: /send room message/i });

    // Draft 2200 chars as Admin
    fireEvent.change(textarea, { target: { value: 'x'.repeat(2200) } });

    // Demote to Member
    const memberRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.MEMBER };
    const memberRoomDetail: RoomDetailDto = {
      ...mockRoomDetail,
      members: mockRoomDetail.members.map((m) =>
        m.userId === mockAdminUser.id ? { ...m, role: RoomRole.MEMBER } : m
      ),
    };

    rerender(
      <RoomChatArea
        activeRoom={memberRoom}
        roomDetails={memberRoomDetail}
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
    expect(screen.getByTestId('draft-demotion-warning')).toBeInTheDocument();
    expect(sendBtn).toBeDisabled();

    // Click dismiss button on warning
    const dismissBtn = screen.getByRole('button', { name: /dismiss warning/i });
    fireEvent.click(dismissBtn);

    // Warning banner is now dismissed
    expect(screen.queryByTestId('draft-demotion-warning')).not.toBeInTheDocument();

    // Draft is untouched, send button remains disabled because length still > 2000
    expect(textarea.value.length).toBe(2200);
    expect(sendBtn).toBeDisabled();
  });

  it('seamlessly scales up counter to /4000 when promoted from MEMBER to ADMIN without page reload', () => {
    const memberRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.MEMBER };
    const memberRoomDetail: RoomDetailDto = {
      ...mockRoomDetail,
      members: mockRoomDetail.members.map((m) =>
        m.userId === mockAdminUser.id ? { ...m, role: RoomRole.MEMBER } : m
      ),
    };

    const { rerender } = renderWithProviders(
      <RoomChatArea
        activeRoom={memberRoom}
        roomDetails={memberRoomDetail}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
        onAddMember={vi.fn()}
        onRemoveMember={vi.fn()}
        onChangeRole={vi.fn()}
        onLeaveRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
      true,
      mockAdminUser
    );

    const textarea = screen.getByPlaceholderText(/message #engineering\.\.\./i) as HTMLTextAreaElement;
    const counter = screen.getByTestId('char-counter');
    const sendBtn = screen.getByRole('button', { name: /send room message/i });

    // Member drafts 1500 chars (quota: 2000)
    const draft1500 = 'b'.repeat(1500);
    fireEvent.change(textarea, { target: { value: draft1500 } });

    expect(counter.textContent).toBe('1500/2000');
    expect(Number(textarea.getAttribute('maxlength'))).toBe(2000);
    expect(sendBtn).not.toBeDisabled();

    // Promoted to ADMIN in real-time
    const adminRoom: RoomListItemDto = { ...mockRoom, role: RoomRole.ADMIN };
    const adminRoomDetail: RoomDetailDto = {
      ...mockRoomDetail,
      members: mockRoomDetail.members.map((m) =>
        m.userId === mockAdminUser.id ? { ...m, role: RoomRole.ADMIN } : m
      ),
    };

    rerender(
      <RoomChatArea
        activeRoom={adminRoom}
        roomDetails={adminRoomDetail}
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

    // Counter immediately switches to /4000 without reload
    expect(counter.textContent).toBe('1500/4000');
    expect(Number(textarea.getAttribute('maxlength'))).toBe(4000);
    expect(sendBtn).not.toBeDisabled();
    expect(textarea.value).toBe(draft1500);
    expect(screen.queryByTestId('draft-demotion-warning')).not.toBeInTheDocument();
  });
});
