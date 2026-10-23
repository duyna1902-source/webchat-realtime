import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  AttachmentDto,
  UploadResponseDto,
  RoomListItemDto,
  RoomReceiveMessagePayload,
  RoomDetailDto,
  RoomRole,
  MessageType,
  MESSAGE_LIMITS,
  UPLOAD_ACCEPT,
} from '@webchat/shared';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { RoomMembersModal } from './RoomMembersModal';
import { EmojiPickerPopover } from '../media/EmojiPickerPopover';
import { GifSearchModal } from '../media/GifSearchModal';
import { AttachmentPreview } from '../chat/AttachmentPreview';
import { MessageItemContent } from '../chat/MessageItemContent';
import { ImageLightboxModal } from '../chat/ImageLightboxModal';
import { DocumentPreviewModal } from '../chat/DocumentPreviewModal';
import { SendRoomMessageOptions } from '../../hooks/useRoomMessages';
import { useRoomTyping } from '../../hooks/useRoomTyping';
import { MobileBackButton } from '../common/MobileBackButton';
import { getAvatarColorClass } from '../../utils/avatarColor';
import { truncateUnicodeSafe } from '../../utils/unicode';
import { rateLimitNoticeFromAck, SendMessageAck } from '../../utils/rateLimit';
import { describeUploadError } from '../../utils/uploadErrors';
import {
  Hash,
  Users,
  Send,
  Loader2,
  MessageSquare,
  Smile,
  Sparkles,
  Paperclip,
  AlertCircle,
  X,
} from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';

interface RoomChatAreaProps {
  activeRoom: RoomListItemDto | null;
  roomDetails: RoomDetailDto | null;
  messages: RoomReceiveMessagePayload[];
  isLoadingMessages: boolean;
  hasMore?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlderMessages?: () => Promise<void> | void;
  /** May resolve with the server's ack; a `RATE_LIMITED` ack keeps the draft and shows the wait time. */
  onSendMessage: (content: string, options?: SendRoomMessageOptions) => Promise<SendMessageAck> | void;
  onAddMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onChangeRole: (userId: string, role: RoomRole.ADMIN | RoomRole.MEMBER) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onDeleteRoom: () => Promise<void>;
  onBack?: () => void;
}

export const RoomChatArea: React.FC<RoomChatAreaProps> = ({
  activeRoom,
  roomDetails,
  messages,
  isLoadingMessages,
  hasMore = false,
  isLoadingOlder = false,
  onLoadOlderMessages,
  onSendMessage,
  onAddMember,
  onRemoveMember,
  onChangeRole,
  onLeaveRoom,
  onDeleteRoom,
  onBack,
}) => {
  const { currentUser } = useAuth();
  const { isConnected } = useSocket();
  const [inputText, setInputText] = useState('');
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifModal, setShowGifModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWarningDismissed, setIsWarningDismissed] = useState(false);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showErrorMessage = (msg: string) => {
    setErrorMessage(msg);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMessage(null);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);
  const [lightboxImage, setLightboxImage] = useState<AttachmentDto | null>(null);
  const [previewDoc, setPreviewDoc] = useState<AttachmentDto | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPrependRef = useRef(false);
  const prevMessagesLengthRef = useRef(messages.length);

  const { isTyping, typingText, handleTyping, stopTyping } = useRoomTyping(activeRoom?.id ?? null);

  const lastOutgoingRoomMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === currentUser?.id) {
        return messages[i].id;
      }
    }
    return null;
  }, [messages, currentUser?.id]);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isPrependRef.current) {
      return;
    }
    if (messages.length > prevMessagesLengthRef.current || prevMessagesLengthRef.current === 0) {
      scrollToBottom();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isTyping]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (!inputText) {
      textarea.style.height = 'auto';
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }, [inputText]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (
      container.scrollTop < 40 &&
      hasMore &&
      !isLoadingOlder &&
      !isLoadingMessages &&
      typeof onLoadOlderMessages === 'function'
    ) {
      const prevScrollHeight = container.scrollHeight;
      const prevScrollTop = container.scrollTop;
      isPrependRef.current = true;

      Promise.resolve(onLoadOlderMessages()).finally(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight;
            scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
          }
          isPrependRef.current = false;
        });
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict client-side 10MB limit check
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds 10MB limit. Please choose a smaller file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleCancelAttachment = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /** Uploads the file; the server answers with the new, not yet sent Attachment. */
  const uploadAttachment = async (file: File): Promise<AttachmentDto> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiFetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error(await describeUploadError(res));
    }

    const body: UploadResponseDto = await res.json();
    return body.attachment;
  };

  const currentMemberRole = useMemo(() => {
    if (roomDetails?.members && currentUser?.id) {
      const member = roomDetails.members.find((m) => m.userId === currentUser.id);
      if (member) return member.role;
      if (roomDetails.role) return roomDetails.role;
    }
    if (activeRoom?.role) return activeRoom.role;
    if (activeRoom?.ownerId && currentUser?.id === activeRoom.ownerId) return RoomRole.OWNER;
    return RoomRole.MEMBER;
  }, [roomDetails, activeRoom, currentUser?.id]);

  const isLeader = currentMemberRole === RoomRole.OWNER || currentMemberRole === RoomRole.ADMIN;
  const maxLimit = isLeader ? MESSAGE_LIMITS.ROOM_LEADER : MESSAGE_LIMITS.ROOM_MEMBER;
  const charCount = inputText.length;
  let counterColorClass = 'text-google-grey700';
  if (charCount >= maxLimit) {
    counterColorClass = 'text-google-red font-semibold';
  } else if (charCount >= maxLimit * 0.9) {
    counterColorClass = 'text-google-yellow font-semibold';
  }

  useEffect(() => {
    if (inputText.length <= maxLimit && isWarningDismissed) {
      setIsWarningDismissed(false);
    }
  }, [inputText.length, maxLimit, isWarningDismissed]);

  useEffect(() => {
    setIsWarningDismissed(false);
  }, [currentMemberRole]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData?.getData('text') ?? '';
    if (!pastedText) return;

    const textarea = textareaRef.current;
    const current = inputText;
    const selectionStart = textarea?.selectionStart ?? current.length;
    const selectionEnd = textarea?.selectionEnd ?? current.length;
    const selectedLength = selectionEnd - selectionStart;

    const remainingLimit = maxLimit - (current.length - selectedLength);

    if (remainingLimit <= 0) {
      e.preventDefault();
      showErrorMessage('Character limit reached');
      return;
    }

    e.preventDefault();
    const allowedText = truncateUnicodeSafe(pastedText, remainingLimit);
    const newText = current.slice(0, selectionStart) + allowedText + current.slice(selectionEnd);
    setInputText(newText);
    handleTyping();

    requestAnimationFrame(() => {
      if (textarea) {
        const newCursor = selectionStart + allowedText.length;
        textarea.setSelectionRange(newCursor, newCursor);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;
    if (inputText.length > maxLimit) return;

    stopTyping();

    if (selectedFile) {
      try {
        setIsUploading(true);
        const uploaded = await uploadAttachment(selectedFile);
        // The server fills in the file details and the message type from the Attachment.
        const ack = await onSendMessage(inputText.trim(), { attachmentId: uploaded.id });
        const rateLimitNotice = rateLimitNoticeFromAck(ack);
        if (rateLimitNotice) {
          // Not sent: keep the caption and the attachment so the User can retry.
          showErrorMessage(rateLimitNotice);
          return;
        }

        handleCancelAttachment();
        setInputText('');
      } catch (err: any) {
        setErrorMessage(err.message || 'Error uploading file');
      } finally {
        setIsUploading(false);
      }
    } else {
      const draft = inputText;
      const pendingAck = onSendMessage(draft);
      setInputText('');
      const rateLimitNotice = rateLimitNoticeFromAck(await pendingAck);
      if (rateLimitNotice) {
        // Not sent: give the draft back, unless the User has already typed something new.
        setInputText((current) => (current === '' ? draft : current));
        showErrorMessage(rateLimitNotice);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const current = inputText;
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    const replacedLength = end - start;

    if (current.length - replacedLength + emoji.length > maxLimit) {
      showErrorMessage('Character limit reached');
      return;
    }

    if (errorMessage) {
      setErrorMessage(null);
    }

    if (!textarea) {
      setInputText((prev) => prev + emoji);
      handleTyping();
      return;
    }

    const newText = current.substring(0, start) + emoji + current.substring(end);
    setInputText(newText);
    handleTyping();

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + emoji.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handleSelectGif = async (gifUrl: string) => {
    const pendingAck = onSendMessage('', { gifUrl });
    setShowGifModal(false);
    const rateLimitNotice = rateLimitNoticeFromAck(await pendingAck);
    if (rateLimitNotice) showErrorMessage(rateLimitNotice);
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!activeRoom) {
    return (
      <main className="flex-1 bg-google-grey50 flex flex-col items-center justify-center p-8 text-center text-gray-500">
        <div className="w-16 h-16 rounded-2xl bg-google-blue-subtle text-google-blue flex items-center justify-center mb-4 shadow-xs">
          <Hash className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Room Chat</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Select a room from the sidebar or create a new room to collaborate with your team!
        </p>
      </main>
    );
  }

  const memberCount = roomDetails?.members?.length ?? activeRoom.memberCount;

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full bg-google-grey50/50 overflow-hidden">
      {/* Active Room Header (Slim 42px h-11, total mobile chrome ~84px per spec lines 33 & 37) */}
      <header className="h-11 px-3 sm:px-4 py-1 bg-white border-b border-google-grey300 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {onBack && <MobileBackButton onClick={onBack} label="Chats" />}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-google-blue text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
            <Hash className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900 truncate leading-tight">
              {activeRoom.name}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 truncate leading-tight">
              <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
              {activeRoom.description && (
                <>
                  <span>•</span>
                  <span className="truncate">{activeRoom.description}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Manage Members Button */}
        <button
          onClick={() => setShowMembersModal(true)}
          className="flex items-center gap-1 px-2.5 py-1 bg-google-blue-subtle hover:bg-google-blue-subtle/80 text-google-blue rounded-full text-[11px] sm:text-xs font-semibold transition shrink-0 cursor-pointer"
        >
          <Users className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Manage Members</span>
        </button>
      </header>

      {/* Message Thread */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        data-testid="room-messages-container"
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-3"
      >
        {isLoadingOlder && (
          <div data-testid="load-older-indicator" className="py-2 flex items-center justify-center gap-1.5 text-xs text-google-blue">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading older room messages...</span>
          </div>
        )}

        {isLoadingMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-google-blue" />
            <p className="text-xs">Loading room messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
            <div className="w-12 h-12 rounded-full bg-google-blue-subtle text-google-blue flex items-center justify-center mb-2">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-600">No messages in #{activeRoom.name} yet</p>
            <p className="text-xs text-gray-400 mt-1">Start the conversation by sending the first message below!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.id;
            const isGif = msg.type === MessageType.EMOJI_GIF;
            const readers = (roomDetails?.members || []).filter(
              (m) => m.userId !== msg.senderId && m.lastReadMessageId === msg.id
            );

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 min-w-0 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Sender Avatar (hidden on outgoing messages) */}
                {!isMe && (
                  <div className={`w-8 h-8 rounded-full font-semibold flex items-center justify-center text-xs shrink-0 self-end mb-1 shadow-xs ${getAvatarColorClass(msg.sender.username)}`}>
                    {msg.sender.username.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className={`flex flex-col min-w-0 max-w-[min(85%,28rem)] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name (shown above bubble for other users) */}
                  {!isMe && (
                    <span className="text-[11px] font-semibold text-google-grey700 mb-1 ml-1">
                      {msg.sender.username}
                    </span>
                  )}

                  <div
                    className={`max-w-full min-w-0 px-4 py-2.5 rounded-2xl shadow-xs text-sm break-words [overflow-wrap:anywhere] whitespace-pre-wrap ${
                      isGif
                        ? isMe
                          ? 'bg-google-blue text-white p-1 rounded-2xl rounded-br-xs shadow-xs'
                          : 'bg-google-grey100 text-google-grey900 border border-google-grey200 p-1 rounded-2xl rounded-bl-xs shadow-xs'
                        : isMe
                        ? 'bg-google-blue text-white rounded-br-xs'
                        : 'bg-google-grey100 text-google-grey900 border border-google-grey200 rounded-bl-xs'
                    }`}
                  >
                    <MessageItemContent
                      content={msg.content}
                      type={msg.type}
                      attachment={msg.attachment}
                      attachmentUnavailable={msg.attachmentUnavailable}
                      isMe={isMe}
                      onImageClick={setLightboxImage}
                      onDocumentClick={setPreviewDoc}
                    />
                    <div
                      className={`flex items-center gap-1.5 text-[10px] mt-1 ${isGif ? 'px-2 pb-1' : ''} ${
                        isMe ? 'text-white/80 justify-end' : 'text-google-grey700 justify-start'
                      }`}
                    >
                      <span>{formatMessageTime(msg.createdAt)}</span>
                    </div>
                  </div>

                  {/* Room Delivery & Read Indicators below bubble */}
                  {readers.length === 0 && isMe && msg.id === lastOutgoingRoomMsgId && (
                    <div data-testid="status-sent" title="Sent" className="mt-0.5 text-[11px] text-google-grey700/80">
                      Sent
                    </div>
                  )}
                  {readers.length > 0 && (
                    <div
                      data-testid="room-message-read-indicator"
                      title={`Seen by: ${readers.map((r) => r.user?.username || r.userId).join(', ')}`}
                      className="mt-1 flex items-center justify-end gap-1.5 text-[11px] font-semibold text-google-blue"
                    >
                      <span>Seen by {readers.length}</span>
                      <div className="flex -space-x-1">
                        {readers.slice(0, 3).map((r) => {
                          const uName = r.user?.username || 'User';
                          return (
                            <span
                              key={r.userId}
                              className={`w-4 h-4 rounded-full ${getAvatarColorClass(uName)} text-[8px] font-bold flex items-center justify-center ring-1 ring-white shadow-2xs text-white`}
                            >
                              {uName.slice(0, 2).toUpperCase()}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Animated Typing Indicator */}
        {isTyping && (
          <div
            data-testid="room-typing-indicator"
            className="flex items-center gap-2 text-xs text-gray-500 italic px-2 py-1"
          >
            <div className="flex items-center gap-1.5 bg-white border border-google-grey200 rounded-full px-3 py-1.5 shadow-xs">
              <span className="font-medium text-google-grey900">{typingText}</span>
              <span className="flex gap-0.5 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-google-blue animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-google-blue animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-google-blue animate-bounce" />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Footer */}
      <footer className="p-3 sm:p-4 bg-white border-t border-google-grey300">
        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            data-testid="room-upload-error-alert"
            className="max-w-4xl mx-auto mb-2 p-2.5 bg-google-red-subtle border border-google-red/20 rounded-xl text-google-red text-xs flex items-center justify-between shadow-xs animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-google-red" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:bg-google-red-subtle/80 rounded-lg text-google-red transition cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Role Demotion / Exceeded Limit Alert */}
        {inputText.length > maxLimit && !isWarningDismissed && (
          <div
            data-testid="draft-demotion-warning"
            className="max-w-4xl mx-auto mb-2 p-2.5 bg-google-red-subtle border border-google-red/20 rounded-xl text-google-red text-xs flex items-center justify-between shadow-xs animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-google-red" />
              <span>
                Your draft exceeds the member limit of {MESSAGE_LIMITS.ROOM_MEMBER} characters. Please shorten your message to send.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsWarningDismissed(true)}
              className="p-1 hover:bg-google-red-subtle/80 rounded-lg text-google-red transition cursor-pointer"
              aria-label="Dismiss warning"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Selected Attachment Preview Card */}
        {selectedFile && (
          <div className="max-w-4xl mx-auto">
            <AttachmentPreview
              file={selectedFile}
              previewUrl={previewUrl}
              isUploading={isUploading}
              onCancel={handleCancelAttachment}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-4xl mx-auto">
          {/* Action Buttons: Paperclip Attachment, Emoji Picker & GIF Search */}
          <div className="flex items-center gap-1 pb-1 shrink-0">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              data-testid="room-file-upload-input"
              accept={UPLOAD_ACCEPT}
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Paperclip Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 text-google-grey700 hover:text-google-blue hover:bg-google-grey100 rounded-full transition cursor-pointer disabled:opacity-50 min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Attach file"
              aria-label="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Emoji Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="p-2 text-google-grey700 hover:text-google-blue hover:bg-google-grey100 rounded-full transition cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
                title="Choose emoji"
                aria-label="Choose emoji"
              >
                <Smile className="w-5 h-5" />
              </button>
              <EmojiPickerPopover
                isOpen={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onSelectEmoji={handleSelectEmoji}
              />
            </div>

            {/* GIF Button */}
            <button
              type="button"
              onClick={() => setShowGifModal(true)}
              className="px-2.5 py-1 text-xs font-bold text-google-grey700 hover:text-google-blue hover:bg-google-grey100 rounded-full border border-google-grey300 transition cursor-pointer flex items-center justify-center gap-1 shrink-0 min-w-[40px] min-h-[40px]"
              title="Search animated GIFs"
              aria-label="Search animated GIFs"
            >
              <Sparkles className="w-3.5 h-3.5 text-google-blue" />
              <span>GIF</span>
            </button>
          </div>

          <div className="flex-1 min-w-0 bg-google-grey100 border border-google-grey300 focus-within:border-google-blue focus-within:ring-2 focus-within:ring-google-blue/20 focus-within:bg-white rounded-2xl transition px-4 pt-2.5 pb-1.5 flex flex-col justify-between">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              maxLength={Math.max(inputText.length, maxLimit)}
              onChange={(e) => {
                if (errorMessage) setErrorMessage(null);
                const val = e.target.value;
                let nextVal = val;
                if (inputText.length <= maxLimit && val.length > maxLimit) {
                  nextVal = truncateUnicodeSafe(val, maxLimit);
                } else if (inputText.length > maxLimit && val.length > inputText.length) {
                  nextVal = truncateUnicodeSafe(val, inputText.length);
                }
                setInputText(nextVal);
                handleTyping();
              }}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedFile
                  ? 'Add a caption (optional)...'
                  : `Message #${activeRoom.name}...`
              }
              className="w-full bg-transparent resize-none outline-none text-base sm:text-sm text-google-grey900 placeholder-google-grey700 max-h-24 overflow-y-auto break-words [overflow-wrap:anywhere]"
            />
            <div className="flex items-center justify-between pt-1 border-t border-transparent text-right">
              <span className="text-[10px] text-google-grey700 italic hidden sm:inline">Shift+Enter for new line</span>
              <span
                data-testid="char-counter"
                className={`ml-auto text-[11px] font-medium leading-none tracking-tight select-none ${counterColorClass}`}
              >
                {charCount}/{maxLimit}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              (!inputText.trim() && !selectedFile) ||
              inputText.length > maxLimit ||
              !isConnected ||
              isUploading
            }
            className="p-3 rounded-full bg-google-blue text-white hover:bg-google-blue-hover disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0 cursor-pointer shadow-md flex items-center justify-center min-w-[40px] min-h-[40px]"
            title="Send room message"
            aria-label="Send room message"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </footer>

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxImage)}
        attachment={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        attachment={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {/* GIF Search Modal */}
      <GifSearchModal
        isOpen={showGifModal}
        onClose={() => setShowGifModal(false)}
        onSelectGif={handleSelectGif}
      />

      {/* Members Management Modal */}
      <RoomMembersModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        roomDetails={roomDetails}
        onAddMember={onAddMember}
        onRemoveMember={onRemoveMember}
        onChangeRole={onChangeRole}
        onLeaveRoom={onLeaveRoom}
        onDeleteRoom={onDeleteRoom}
      />
    </main>
  );
};
