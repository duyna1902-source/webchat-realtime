import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatArea } from './ChatArea';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { DirectChatListItemDto, DirectReceiveMessagePayload, MessageType, MessageStatus } from '@webchat/shared';

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
});
