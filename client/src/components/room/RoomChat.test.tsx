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
} from '@webchat/shared';

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
    sender: { id: 'user-admin-id', username: 'bob_admin', avatarUrl: null },
    content: 'Standup in 5 mins',
    type: MessageType.TEXT,
    attachmentUrl: null,
    attachmentName: null,
    attachmentSize: null,
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

function renderWithProviders(ui: React.ReactElement, socketConnected = true) {
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
    isConnected: socketConnected,
    isConnecting: false,
    connectionError: null,
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <SocketContext.Provider value={socketValue}>
        {ui}
      </SocketContext.Provider>
    </AuthContext.Provider>
  );
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
        sender: { id: 'user-admin-id', username: 'bob_admin', avatarUrl: null },
        content: 'Good morning everyone!',
        type: MessageType.TEXT,
        attachmentUrl: null,
        attachmentName: null,
        attachmentSize: null,
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
      sender: { id: 'user-admin-id', username: 'bob_admin', avatarUrl: null },
      content: 'Here is the sprint roadmap image',
      type: MessageType.IMAGE,
      attachmentUrl: '/uploads/roadmap.png',
      attachmentName: 'roadmap.png',
      attachmentSize: 1024 * 800,
      createdAt: new Date().toISOString(),
    };

    const docRoomMsg: RoomReceiveMessagePayload = {
      id: 'rmsg-doc-1',
      roomId: 'room-1',
      senderId: 'user-owner-id',
      sender: { id: 'user-owner-id', username: 'alice_owner', avatarUrl: null },
      content: 'Here is the sprint retro notes',
      type: MessageType.DOCUMENT,
      attachmentUrl: '/uploads/retro.docx',
      attachmentName: 'retro.docx',
      attachmentSize: 1024 * 350,
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
      token: 'token-xyz',
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
      <AuthContext.Provider value={{ currentUser: mockUser, token: 'tok' } as any}>
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
});
