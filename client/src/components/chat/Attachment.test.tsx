import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ChatArea } from './ChatArea';
import { RoomChatArea } from '../room/RoomChatArea';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import {
  DirectChatListItemDto,
  DirectReceiveMessagePayload,
  MessageType,
  MessageStatus,
  RoomListItemDto,
  RoomDetailDto,
  RoomRole,
  MESSAGE_LIMITS,
} from '@webchat/shared';

const mockUser = {
  id: 'current-user-id',
  username: 'alice',
  email: 'alice@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockPartner = {
  id: 'partner-user-id',
  username: 'bob',
  email: 'bob@example.com',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockChat: DirectChatListItemDto = {
  id: 'chat-1',
  partner: mockPartner,
  unreadCount: 0,
  updatedAt: new Date().toISOString(),
};

function renderWithProviders(ui: React.ReactElement) {
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

describe('File Attachments, Image Preview & Message Cards', () => {
  it('renders the Paperclip attachment button in the input bar', () => {
    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const attachButton = screen.getByRole('button', { name: /attach file/i });
    expect(attachButton).toBeInTheDocument();
  });

  it('rejects file larger than 10MB and displays friendly error alert', async () => {
    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement;

    // Create 11MB file
    const largeFile = new File(['x'.repeat(100)], 'huge-file.pdf', { type: 'application/pdf' });
    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(await screen.findByText(/exceeds 10mb limit/i)).toBeInTheDocument();
    expect(screen.queryByTestId('attachment-preview')).not.toBeInTheDocument();
  });

  it('displays image preview thumbnail card when an image file <= 10MB is selected', async () => {
    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId('file-upload-input');
    const imageFile = new File(['image-bytes'], 'test-image.png', { type: 'image/png' });
    Object.defineProperty(imageFile, 'size', { value: 1024 * 500 }); // 500KB

    fireEvent.change(fileInput, { target: { files: [imageFile] } });

    const preview = await screen.findByTestId('attachment-preview');
    expect(preview).toBeInTheDocument();
    expect(screen.getByText('test-image.png')).toBeInTheDocument();
    expect(screen.getByAltText('test-image.png')).toBeInTheDocument();

    // Verify Cancel button clears the preview
    const cancelButton = screen.getByRole('button', { name: /cancel attachment/i });
    fireEvent.click(cancelButton);

    expect(screen.queryByTestId('attachment-preview')).not.toBeInTheDocument();
  });

  it('displays document preview card when a document file <= 10MB is selected', async () => {
    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId('file-upload-input');
    const docFile = new File(['pdf-bytes'], 'report.pdf', { type: 'application/pdf' });
    Object.defineProperty(docFile, 'size', { value: 1024 * 1024 * 2 }); // 2MB

    fireEvent.change(fileInput, { target: { files: [docFile] } });

    const preview = await screen.findByTestId('attachment-preview');
    expect(preview).toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel attachment/i })).toBeInTheDocument();
  });

  it('renders IMAGE message with thumbnail and opens click-to-expand lightbox modal', async () => {
    const imageMessage: DirectReceiveMessagePayload = {
      id: 'img-msg-1',
      directChatId: 'chat-1',
      senderId: 'partner-user-id',
      sender: { id: 'partner-user-id', username: 'bob', avatarUrl: null },
      content: 'Look at this photo',
      type: MessageType.IMAGE,
      status: MessageStatus.SENT,
      attachmentUrl: '/uploads/sample.jpg',
      attachmentName: 'sample.jpg',
      attachmentSize: 1024 * 250,
      createdAt: new Date().toISOString(),
    };

    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[imageMessage]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    const thumbnail = screen.getByRole('img', { name: /sample\.jpg|image attachment/i });
    expect(thumbnail).toBeInTheDocument();

    // Click to open lightbox zoom modal
    fireEvent.click(thumbnail);

    const lightbox = await screen.findByTestId('image-lightbox-modal');
    expect(lightbox).toBeInTheDocument();

    // Close lightbox
    const closeBtn = screen.getByRole('button', { name: /close lightbox/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('image-lightbox-modal')).not.toBeInTheDocument();
  });

  it('renders DOCUMENT message with icon, filename, size, and download button', () => {
    const docMessage: DirectReceiveMessagePayload = {
      id: 'doc-msg-1',
      directChatId: 'chat-1',
      senderId: 'partner-user-id',
      sender: { id: 'partner-user-id', username: 'bob', avatarUrl: null },
      content: 'Annual Report Document',
      type: MessageType.DOCUMENT,
      status: MessageStatus.SENT,
      attachmentUrl: '/uploads/annual-report.pdf',
      attachmentName: 'annual-report.pdf',
      attachmentSize: 1024 * 1024 * 3, // 3MB
      createdAt: new Date().toISOString(),
    };

    renderWithProviders(
      <ChatArea
        activeChat={mockChat}
        messages={[docMessage]}
        isLoadingMessages={false}
        onSendMessage={vi.fn()}
      />
    );

    expect(screen.getByText('annual-report.pdf')).toBeInTheDocument();
    const downloadLink = screen.getByRole('link', { name: /download annual-report\.pdf|download file/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute('href', '/uploads/annual-report.pdf');
  });

  describe('In-App Document Preview Modal (Ticket 03)', () => {
    it('clicking a PDF document opens DocumentPreviewModal with inline iframe and dismisses on close button', async () => {
      const pdfMessage: DirectReceiveMessagePayload = {
        id: 'doc-pdf-1',
        directChatId: 'chat-1',
        senderId: 'partner-user-id',
        sender: { id: 'partner-user-id', username: 'bob', avatarUrl: null },
        content: 'Project Specification',
        type: MessageType.DOCUMENT,
        status: MessageStatus.SENT,
        attachmentUrl: '/uploads/spec.pdf',
        attachmentName: 'spec.pdf',
        attachmentSize: 1024 * 1024 * 1.5,
        createdAt: new Date().toISOString(),
      };

      renderWithProviders(
        <ChatArea
          activeChat={mockChat}
          messages={[pdfMessage]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      // Document card should be rendered
      const docCard = screen.getByTestId('document-attachment-card');
      expect(docCard).toBeInTheDocument();

      // Click card to open modal
      fireEvent.click(docCard);

      const modal = await screen.findByTestId('document-preview-modal');
      expect(modal).toBeInTheDocument();
      expect(screen.getByTestId('pdf-preview-frame')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-preview-frame')).toHaveAttribute('src', '/uploads/spec.pdf');

      // Close modal
      const closeButton = screen.getByRole('button', { name: /close document preview/i });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('document-preview-modal')).not.toBeInTheDocument();
    });

    it('fetches and displays text document in monospace pre container', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => 'Hello Antigravity Text Preview\nLine 2 of notes',
      } as any);

      const textMessage: DirectReceiveMessagePayload = {
        id: 'doc-txt-1',
        directChatId: 'chat-1',
        senderId: 'partner-user-id',
        sender: { id: 'partner-user-id', username: 'bob', avatarUrl: null },
        content: 'Notes file',
        type: MessageType.DOCUMENT,
        status: MessageStatus.SENT,
        attachmentUrl: '/uploads/notes.txt',
        attachmentName: 'notes.txt',
        attachmentSize: 1024 * 5,
        createdAt: new Date().toISOString(),
      };

      renderWithProviders(
        <ChatArea
          activeChat={mockChat}
          messages={[textMessage]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('document-attachment-card'));

      const preElement = await screen.findByTestId('text-preview-content');
      expect(preElement).toBeInTheDocument();
      expect(preElement.textContent).toContain('Hello Antigravity Text Preview');
      expect(preElement.textContent).toContain('Line 2 of notes');

      fetchSpy.mockRestore();
    });

    it('renders binary metadata summary card with "Download to view" for docx/zip', async () => {
      const zipMessage: DirectReceiveMessagePayload = {
        id: 'doc-zip-1',
        directChatId: 'chat-1',
        senderId: 'partner-user-id',
        sender: { id: 'partner-user-id', username: 'bob', avatarUrl: null },
        content: 'Release archive',
        type: MessageType.DOCUMENT,
        status: MessageStatus.SENT,
        attachmentUrl: '/uploads/release-v1.zip',
        attachmentName: 'release-v1.zip',
        attachmentSize: 1024 * 1024 * 5,
        createdAt: new Date().toISOString(),
      };

      renderWithProviders(
        <ChatArea
          activeChat={mockChat}
          messages={[zipMessage]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('document-attachment-card'));

      const binaryCard = await screen.findByTestId('binary-preview-card');
      expect(binaryCard).toBeInTheDocument();
      expect(within(binaryCard).getByText('release-v1.zip')).toBeInTheDocument();
      expect(within(binaryCard).getByText('ZIP')).toBeInTheDocument();
      expect(within(binaryCard).getByRole('link', { name: /download to view/i })).toBeInTheDocument();

      // Dismiss via Escape key
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('document-preview-modal')).not.toBeInTheDocument();
    });

    it('closes modal on backdrop click', async () => {
      const docMessage: DirectReceiveMessagePayload = {
        id: 'doc-pdf-2',
        directChatId: 'chat-1',
        senderId: 'partner-user-id',
        sender: { id: 'partner-user-id', username: 'bob', avatarUrl: null },
        content: 'Agreement',
        type: MessageType.DOCUMENT,
        status: MessageStatus.SENT,
        attachmentUrl: '/uploads/contract.pdf',
        attachmentName: 'contract.pdf',
        attachmentSize: 1024 * 200,
        createdAt: new Date().toISOString(),
      };

      renderWithProviders(
        <ChatArea
          activeChat={mockChat}
          messages={[docMessage]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('document-attachment-card'));
      const modalBackdrop = await screen.findByTestId('document-preview-modal');

      fireEvent.click(modalBackdrop);
      expect(screen.queryByTestId('document-preview-modal')).not.toBeInTheDocument();
    });
  });

  describe('Attachment Captions Character Limit & Counter Integration (Ticket 05)', () => {
    const mockRoomForAttachment: RoomListItemDto = {
      id: 'room-1',
      name: 'Engineering',
      description: 'Discuss all things engineering',
      ownerId: 'user-owner-id',
      role: RoomRole.OWNER,
      memberCount: 2,
      unreadCount: 0,
      lastMessage: null,
      updatedAt: new Date().toISOString(),
    };

    const mockRoomDetailForAttachment: RoomDetailDto = {
      id: 'room-1',
      name: 'Engineering',
      description: 'Discuss all things engineering',
      ownerId: 'user-owner-id',
      role: RoomRole.OWNER,
      memberCount: 2,
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
          userId: 'user-member-id',
          role: RoomRole.MEMBER,
          joinedAt: new Date().toISOString(),
          user: {
            id: 'user-member-id',
            username: 'charlie_member',
            email: 'charlie@example.com',
            isOnline: false,
            lastSeenAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      ],
    };

    it('displays live counter 0/4000 when file is selected and caption input is empty in Direct Chat', async () => {
      renderWithProviders(
        <ChatArea
          activeChat={mockChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const fileInput = screen.getByTestId('file-upload-input');
      const imageFile = new File(['image-bytes'], 'vacation.png', { type: 'image/png' });
      Object.defineProperty(imageFile, 'size', { value: 1024 * 500 });
      fireEvent.change(fileInput, { target: { files: [imageFile] } });

      expect(await screen.findByTestId('attachment-preview')).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText('Add a caption (optional)...');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('maxLength', String(MESSAGE_LIMITS.DIRECT));

      const counter = screen.getByTestId('char-counter');
      expect(counter).toHaveTextContent('0/' + MESSAGE_LIMITS.DIRECT);
      expect(counter).toHaveClass('text-google-grey700');
    });

    it('updates counter and adheres to Google Palette color thresholds (<90% grey, >=90% yellow, 100% red) for attachment caption in Direct Chat', async () => {
      renderWithProviders(
        <ChatArea
          activeChat={mockChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const fileInput = screen.getByTestId('file-upload-input');
      const docFile = new File(['pdf-bytes'], 'proposal.pdf', { type: 'application/pdf' });
      Object.defineProperty(docFile, 'size', { value: 1024 * 300 });
      fireEvent.change(fileInput, { target: { files: [docFile] } });

      expect(await screen.findByTestId('attachment-preview')).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText('Add a caption (optional)...');
      const counter = screen.getByTestId('char-counter');

      // 1. Under 90% (< 3600 characters) -> Google Grey
      fireEvent.change(textarea, { target: { value: 'Short caption' } });
      expect(counter).toHaveTextContent('13/' + MESSAGE_LIMITS.DIRECT);
      expect(counter).toHaveClass('text-google-grey700');
      expect(counter).not.toHaveClass('text-google-yellow');
      expect(counter).not.toHaveClass('text-google-red');

      // 2. At 90% (3600 characters) -> Google Yellow
      const text90 = 'A'.repeat(3600);
      fireEvent.change(textarea, { target: { value: text90 } });
      expect(counter).toHaveTextContent('3600/' + MESSAGE_LIMITS.DIRECT);
      expect(counter).toHaveClass('text-google-yellow');
      expect(counter).not.toHaveClass('text-google-red');

      // 3. At 100% (4000 characters) -> Google Red
      const text100 = 'A'.repeat(4000);
      fireEvent.change(textarea, { target: { value: text100 } });
      expect(counter).toHaveTextContent('4000/' + MESSAGE_LIMITS.DIRECT);
      expect(counter).toHaveClass('text-google-red');
    });

    it('enforces maxLength and trims pasted text exceeding the remaining limit when captioning an attachment', async () => {
      renderWithProviders(
        <ChatArea
          activeChat={mockChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const fileInput = screen.getByTestId('file-upload-input');
      const imageFile = new File(['image'], 'diagram.png', { type: 'image/png' });
      Object.defineProperty(imageFile, 'size', { value: 1024 * 100 });
      fireEvent.change(fileInput, { target: { files: [imageFile] } });

      const textarea = await screen.findByPlaceholderText('Add a caption (optional)...');

      // Initial 3990 characters
      fireEvent.change(textarea, { target: { value: 'x'.repeat(3990) } });
      expect(screen.getByTestId('char-counter')).toHaveTextContent('3990/' + MESSAGE_LIMITS.DIRECT);

      // Paste 20 characters when only 10 remain
      fireEvent.paste(textarea, {
        clipboardData: {
          getData: (type: string) => (type === 'text' ? '1234567890EXTRAWORDS' : ''),
        },
      });

      // Should only have allowed 10 characters pasted -> exactly 4000 total
      expect(screen.getByTestId('char-counter')).toHaveTextContent('4000/' + MESSAGE_LIMITS.DIRECT);
      expect((textarea as HTMLTextAreaElement).value.length).toBe(MESSAGE_LIMITS.DIRECT);
    });

    it('enables send button when file is selected with empty caption, but disables send button if caption exceeds limit', async () => {
      renderWithProviders(
        <ChatArea
          activeChat={mockChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeDisabled();

      // Attach file
      const fileInput = screen.getByTestId('file-upload-input');
      const docFile = new File(['doc'], 'spec.pdf', { type: 'application/pdf' });
      Object.defineProperty(docFile, 'size', { value: 1024 * 200 });
      fireEvent.change(fileInput, { target: { files: [docFile] } });

      expect(await screen.findByTestId('attachment-preview')).toBeInTheDocument();

      // Enabled with empty caption
      expect(sendButton).not.toBeDisabled();

      // Valid caption at 4000 characters
      const textarea = screen.getByPlaceholderText('Add a caption (optional)...');
      fireEvent.change(textarea, { target: { value: 'A'.repeat(4000) } });
      expect(sendButton).not.toBeDisabled();

      // Direct input overflow (> 4000) is clamped to 4000
      fireEvent.change(textarea, { target: { value: 'A'.repeat(4001) } });
      expect(sendButton).not.toBeDisabled();
      expect(textarea).toHaveValue('A'.repeat(4000));
    });

    it('displays role-aware counter (X/2000 for MEMBER, X/4000 for OWNER/ADMIN) when an attachment is selected in Room Chat', async () => {
      // 1. As MEMBER (2000 quota)
      const memberAuthValue = {
        currentUser: { id: 'user-member-id', username: 'charlie_member', email: 'charlie@example.com' },
        token: 'token-xyz',
        isLoading: false,
      };

      const { rerender } = render(
        <AuthContext.Provider value={memberAuthValue as any}>
          <SocketContext.Provider value={{ socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() }, isConnected: true } as any}>
            <RoomChatArea
              activeRoom={{ ...mockRoomForAttachment, role: RoomRole.MEMBER }}
              roomDetails={mockRoomDetailForAttachment as any}
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

      const roomFileInput = screen.getByTestId('room-file-upload-input');
      const imageFile = new File(['img'], 'room-img.png', { type: 'image/png' });
      Object.defineProperty(imageFile, 'size', { value: 1024 * 50 });
      fireEvent.change(roomFileInput, { target: { files: [imageFile] } });

      expect(await screen.findByTestId('attachment-preview')).toBeInTheDocument();

      const memberCounter = screen.getByTestId('char-counter');
      expect(memberCounter).toHaveTextContent('0/' + MESSAGE_LIMITS.ROOM_MEMBER);
      expect(memberCounter).toHaveClass('text-google-grey700');

      const memberTextarea = screen.getByPlaceholderText('Add a caption (optional)...');
      expect(memberTextarea).toHaveAttribute('maxLength', String(MESSAGE_LIMITS.ROOM_MEMBER));

      // 90% of 2000 is 1800 -> yellow
      fireEvent.change(memberTextarea, { target: { value: 'A'.repeat(1800) } });
      expect(memberCounter).toHaveTextContent('1800/' + MESSAGE_LIMITS.ROOM_MEMBER);
      expect(memberCounter).toHaveClass('text-google-yellow');

      // 100% of 2000 is 2000 -> red
      fireEvent.change(memberTextarea, { target: { value: 'A'.repeat(2000) } });
      expect(memberCounter).toHaveTextContent('2000/' + MESSAGE_LIMITS.ROOM_MEMBER);
      expect(memberCounter).toHaveClass('text-google-red');

      // 2. Now render as OWNER (4000 quota) and draft 2001 chars
      const ownerAuthValue = {
        currentUser: { id: 'user-owner-id', username: 'alice_owner', email: 'alice@example.com' },
        token: 'token-xyz',
        isLoading: false,
      };

      rerender(
        <AuthContext.Provider value={ownerAuthValue as any}>
          <SocketContext.Provider value={{ socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() }, isConnected: true } as any}>
            <RoomChatArea
              activeRoom={{ ...mockRoomForAttachment, role: RoomRole.OWNER }}
              roomDetails={mockRoomDetailForAttachment as any}
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

      const roomSendBtn = screen.getByRole('button', { name: /send room message/i });
      const leaderTextarea = screen.getByPlaceholderText('Add a caption (optional)...');

      // As OWNER (4000 quota), drafting 2001 characters is permitted and enabled
      fireEvent.change(leaderTextarea, { target: { value: 'A'.repeat(2001) } });
      const leaderCounter = screen.getByTestId('char-counter');
      expect(leaderCounter).toHaveTextContent('2001/' + MESSAGE_LIMITS.ROOM_LEADER);
      expect(roomSendBtn).not.toBeDisabled();

      // 3. Demoted to MEMBER (2000 quota): draft 2001 is preserved but exceeds quota -> send button disabled
      rerender(
        <AuthContext.Provider value={memberAuthValue as any}>
          <SocketContext.Provider value={{ socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() }, isConnected: true } as any}>
            <RoomChatArea
              activeRoom={{ ...mockRoomForAttachment, role: RoomRole.MEMBER }}
              roomDetails={mockRoomDetailForAttachment as any}
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

      expect(memberCounter).toHaveTextContent('2001/' + MESSAGE_LIMITS.ROOM_MEMBER);
      expect(roomSendBtn).toBeDisabled();

      // 4. Promoted back to OWNER (4000 quota) -> send button re-enables
      rerender(
        <AuthContext.Provider value={ownerAuthValue as any}>
          <SocketContext.Provider value={{ socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() }, isConnected: true } as any}>
            <RoomChatArea
              activeRoom={{ ...mockRoomForAttachment, role: RoomRole.OWNER }}
              roomDetails={mockRoomDetailForAttachment as any}
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

      expect(leaderCounter).toHaveTextContent('2001/' + MESSAGE_LIMITS.ROOM_LEADER);
      expect(roomSendBtn).not.toBeDisabled();
      expect(leaderTextarea).toHaveAttribute('maxLength', String(MESSAGE_LIMITS.ROOM_LEADER));
      // Reset text to empty -> 0/4000
      fireEvent.change(leaderTextarea, { target: { value: '' } });
      expect(leaderCounter).toHaveTextContent('0/' + MESSAGE_LIMITS.ROOM_LEADER);
    });

    it('maintains touch targets (minimum 40px) on attachment preview and caption input area', async () => {
      renderWithProviders(
        <ChatArea
          activeChat={mockChat}
          messages={[]}
          isLoadingMessages={false}
          onSendMessage={vi.fn()}
        />
      );

      const fileInput = screen.getByTestId('file-upload-input');
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 1024 * 10 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(await screen.findByTestId('attachment-preview')).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: /cancel attachment/i });
      expect(cancelButton.className).toContain('min-w-[40px]');
      expect(cancelButton.className).toContain('min-h-[40px]');

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton.className).toContain('min-w-[40px]');
      expect(sendButton.className).toContain('min-h-[40px]');
    });
  });
});
