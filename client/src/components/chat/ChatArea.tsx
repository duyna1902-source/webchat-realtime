import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DirectChatListItemDto, DirectReceiveMessagePayload, MessageType, MessageStatus, MESSAGE_LIMITS } from '@webchat/shared';

function getDirectStatusWatermark(messages: Array<{ id: string; senderId: string; status: string }>, currentUserId: string) {
  let lastReadOutgoingId: string | null = null;
  let lastOutgoingId: string | null = null;
  for (const m of messages) {
    if (m.senderId === currentUserId) {
      lastOutgoingId = m.id;
      if (m.status === MessageStatus.READ) {
        lastReadOutgoingId = m.id;
      }
    }
  }
  return { lastReadOutgoingId, lastOutgoingId };
}
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useTyping } from '../../hooks/useTyping';
import { EmojiPickerPopover } from '../media/EmojiPickerPopover';
import { GifSearchModal } from '../media/GifSearchModal';
import { AttachmentPreview } from './AttachmentPreview';
import { MessageItemContent } from './MessageItemContent';
import { ImageLightboxModal } from './ImageLightboxModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { SendDirectMessageOptions } from '../../hooks/useDirectMessages';
import { MobileBackButton } from '../common/MobileBackButton';
import { getAvatarColorClass } from '../../utils/avatarColor';
import {
  Send,
  MessageSquare,
  Loader2,
  Smile,
  Sparkles,
  Paperclip,
  AlertCircle,
  X,
} from 'lucide-react';

interface ChatAreaProps {
  activeChat: DirectChatListItemDto | null;
  messages: DirectReceiveMessagePayload[];
  isLoadingMessages: boolean;
  hasMore?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlderMessages?: () => Promise<void> | void;
  onSendMessage: (content: string, optionsOrType?: MessageType | SendDirectMessageOptions) => void;
  onBack?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  activeChat,
  messages,
  isLoadingMessages,
  hasMore = false,
  isLoadingOlder = false,
  onLoadOlderMessages,
  onSendMessage,
  onBack,
}) => {
  const { currentUser, token } = useAuth();
  const { isConnected } = useSocket();
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifModal, setShowGifModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string | null } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name?: string | null; size?: number | null } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPrependRef = useRef(false);
  const prevMessagesLengthRef = useRef(messages.length);

  const { isPartnerTyping, handleTyping, stopTyping } = useTyping(activeChat?.id ?? null);

  const watermark = useMemo(
    () => getDirectStatusWatermark(messages, currentUser?.id || ''),
    [messages, currentUser?.id]
  );

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
  }, [messages, isPartnerTyping]);

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

  const uploadAttachment = async (file: File): Promise<{ url: string; name: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'File upload failed');
    }

    return res.json();
  };

  const maxLimit = MESSAGE_LIMITS.DIRECT;
  const charCount = inputText.length;
  let counterColorClass = 'text-google-grey700';
  if (charCount >= maxLimit) {
    counterColorClass = 'text-google-red font-semibold';
  } else if (charCount >= maxLimit * 0.9) {
    counterColorClass = 'text-amber-500 font-semibold';
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData?.getData('text') ?? '';
    if (!pastedText) return;

    const textarea = textareaRef.current;
    const current = inputText;
    const selectionStart = textarea?.selectionStart ?? current.length;
    const selectionEnd = textarea?.selectionEnd ?? current.length;
    const selectedLength = selectionEnd - selectionStart;

    const remainingQuota = maxLimit - (current.length - selectedLength);

    if (remainingQuota <= 0) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    const allowedText = pastedText.slice(0, remainingQuota);
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
        const isImage = selectedFile.type.startsWith('image/');
        const type = isImage ? MessageType.IMAGE : MessageType.DOCUMENT;

        onSendMessage(inputText.trim(), {
          type,
          attachmentUrl: uploaded.url,
          attachmentName: uploaded.name,
          attachmentSize: uploaded.size,
        });

        handleCancelAttachment();
        setInputText('');
      } catch (err: any) {
        setErrorMessage(err.message || 'Error uploading file');
      } finally {
        setIsUploading(false);
      }
    } else {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    if (inputText.length + emoji.length > maxLimit) {
      return;
    }
    if (!textareaRef.current) {
      setInputText((prev) => prev + emoji);
      handleTyping();
      return;
    }
    const textarea = textareaRef.current;
    const start = textarea.selectionStart ?? inputText.length;
    const end = textarea.selectionEnd ?? inputText.length;
    const newText = inputText.substring(0, start) + emoji + inputText.substring(end);
    setInputText(newText);
    handleTyping();

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + emoji.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handleSelectGif = (gifUrl: string) => {
    onSendMessage(gifUrl, MessageType.EMOJI_GIF);
    setShowGifModal(false);
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (dateStr?: string) => {
    if (!dateStr) return 'Offline';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Last seen today at ${timeStr}`;
    }
    return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
  };

  if (!activeChat) {
    return (
      <main className="flex-1 bg-google-grey50 flex flex-col items-center justify-center p-8 text-center text-gray-500">
        <div className="w-16 h-16 rounded-2xl bg-google-blue-subtle text-google-blue flex items-center justify-center mb-4 shadow-xs">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Real-Time Direct Messaging</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Select an existing Direct Chat from the sidebar or find users with the search bar to start Direct Chat.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full bg-google-grey50/50 overflow-hidden">
      {/* Active Chat Header (Slim 42px h-11, total mobile chrome ~84px per spec lines 33 & 37) */}
      <header className="h-11 px-3 sm:px-4 py-1 bg-white border-b border-google-grey300 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {onBack && <MobileBackButton onClick={onBack} label="Chats" />}
          <div className="relative shrink-0">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full font-bold flex items-center justify-center text-xs shadow-xs ${getAvatarColorClass(activeChat.partner.username)}`}>
              {activeChat.partner.username.slice(0, 2).toUpperCase()}
            </div>
            <span
              data-testid="chat-header-presence-dot"
              className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${
                activeChat.partner.isOnline ? 'bg-google-green' : 'bg-gray-300'
              }`}
            />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900 leading-tight truncate">{activeChat.partner.username}</h2>
            <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 leading-tight">
              {activeChat.partner.isOnline ? (
                <span className="text-google-green font-medium">Online</span>
              ) : (
                <span className="truncate">{formatLastSeen(activeChat.partner.lastSeenAt)}</span>
              )}
            </p>
          </div>
        </div>
      </header>

      {/* Message Thread */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        data-testid="chat-messages-container"
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-3"
      >
        {isLoadingOlder && (
          <div data-testid="load-older-indicator" className="py-2 flex items-center justify-center gap-1.5 text-xs text-google-blue">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading older messages...</span>
          </div>
        )}

        {isLoadingMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-google-blue" />
            <p className="text-xs">Loading message history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
            <div className="w-12 h-12 rounded-full bg-google-blue-subtle text-google-blue flex items-center justify-center mb-2">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-600">No messages here yet</p>
            <p className="text-xs text-gray-400 mt-1">Say hello to {activeChat.partner.username} to break the ice!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.id;
            const isGif = msg.type === MessageType.EMOJI_GIF;
            return (
              <div
                key={msg.id}
                className={`flex flex-col min-w-0 ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[min(85%,28rem)] min-w-0 ${
                    isGif
                      ? isMe
                        ? 'bg-google-blue text-white p-1 rounded-2xl rounded-br-xs shadow-xs'
                        : 'bg-google-grey100 text-google-grey900 border border-google-grey200 p-1 rounded-2xl rounded-bl-xs shadow-xs'
                      : isMe
                      ? 'bg-google-blue text-white px-4 py-2.5 rounded-2xl rounded-br-xs shadow-xs text-sm break-words [overflow-wrap:anywhere] whitespace-pre-wrap'
                      : 'bg-google-grey100 text-google-grey900 border border-google-grey200 px-4 py-2.5 rounded-2xl rounded-bl-xs shadow-xs text-sm break-words [overflow-wrap:anywhere] whitespace-pre-wrap'
                  }`}
                >
                  <MessageItemContent
                    content={msg.content}
                    type={msg.type}
                    attachmentUrl={msg.attachmentUrl}
                    attachmentName={msg.attachmentName}
                    attachmentSize={msg.attachmentSize}
                    isMe={isMe}
                    onImageClick={(url, name) => setLightboxImage({ url, name })}
                    onDocumentClick={(url, name, size) => setPreviewDoc({ url, name, size })}
                  />
                  <div
                    className={`flex items-center gap-1 text-[10px] mt-1 ${isGif ? 'px-2 pb-1' : ''} ${
                      isMe ? 'text-white/80 justify-end' : 'text-google-grey700 justify-start'
                    }`}
                  >
                    <span>{formatMessageTime(msg.createdAt)}</span>
                  </div>
                </div>

                {/* Delivery Status below bubble on light canvas */}
                {isMe && (
                  <>
                    {msg.status === MessageStatus.READ && msg.id === watermark.lastReadOutgoingId && (
                      <div
                        data-testid="status-read"
                        title="Đã xem"
                        aria-label="Đã xem"
                        className="mt-1 flex items-center justify-end gap-1 text-[11px] font-semibold text-google-blue"
                      >
                        <span>Seen</span>
                        {activeChat?.partner?.username && (
                          <span
                            className={`w-4 h-4 rounded-full ${getAvatarColorClass(activeChat.partner.username)} text-[8px] font-bold flex items-center justify-center text-white shadow-xs`}
                          >
                            {activeChat.partner.username.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}

                    {msg.status === MessageStatus.DELIVERED && msg.id === watermark.lastOutgoingId && (
                      <div
                        data-testid="status-delivered"
                        title="Delivered"
                        aria-label="Delivered"
                        className="mt-0.5 text-[11px] font-semibold text-google-grey700"
                      >
                        Delivered
                      </div>
                    )}

                    {msg.status === MessageStatus.SENT && msg.id === watermark.lastOutgoingId && (
                      <div
                        data-testid="status-sent"
                        title="Sent"
                        aria-label="Sent"
                        className="mt-0.5 text-[11px] text-google-grey700/80"
                      >
                        Sent
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}

        {/* Animated Typing Indicator */}
        {isPartnerTyping && (
          <div
            data-testid="typing-indicator"
            className="flex items-center gap-2 text-xs text-gray-500 italic px-2 py-1"
          >
            <div className="flex items-center gap-1.5 bg-white border border-google-grey200 rounded-full px-3 py-1.5 shadow-xs">
              <span className="font-medium text-google-grey900">{activeChat.partner.username} is typing</span>
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
            data-testid="upload-error-alert"
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
              data-testid="file-upload-input"
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
              className="px-2.5 py-1 text-xs font-bold text-google-grey700 hover:text-google-blue hover:bg-google-grey100 rounded-full border border-google-grey300 transition cursor-pointer flex items-center gap-1 shrink-0 min-h-[40px]"
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
              maxLength={maxLimit}
              onChange={(e) => {
                setInputText(e.target.value);
                handleTyping();
              }}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedFile
                  ? 'Add a caption (optional)...'
                  : `Message @${activeChat.partner.username}...`
              }
              className="w-full bg-transparent resize-none outline-none text-base sm:text-sm text-google-grey900 placeholder-google-grey700 max-h-24 break-words [overflow-wrap:anywhere]"
            />
            <div className="flex items-center justify-between pt-1 border-t border-transparent text-right">
              <span className="text-[10px] text-google-grey700 italic hidden sm:inline">Shift+Enter for new line</span>
              <span
                data-testid="char-counter"
                className={`ml-auto text-[11px] font-medium leading-none tracking-tight select-none ${counterColorClass}`}
              >
                {inputText.length}/{maxLimit}
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
            title="Send message"
            aria-label="Send message"
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
        imageUrl={lightboxImage?.url || ''}
        imageName={lightboxImage?.name}
        onClose={() => setLightboxImage(null)}
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        documentUrl={previewDoc?.url || ''}
        documentName={previewDoc?.name}
        documentSize={previewDoc?.size}
        onClose={() => setPreviewDoc(null)}
      />

      {/* GIF Search Modal */}
      <GifSearchModal
        isOpen={showGifModal}
        onClose={() => setShowGifModal(false)}
        onSelectGif={handleSelectGif}
      />
    </main>
  );
};
