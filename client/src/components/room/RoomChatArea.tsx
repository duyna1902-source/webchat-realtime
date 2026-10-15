import React, { useState, useRef, useEffect } from 'react';
import {
  RoomListItemDto,
  RoomReceiveMessagePayload,
  RoomDetailDto,
  RoomRole,
  MessageType,
} from '@webchat/shared';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { RoomMembersModal } from './RoomMembersModal';
import { EmojiPickerPopover } from '../media/EmojiPickerPopover';
import { GifSearchModal } from '../media/GifSearchModal';
import { AttachmentPreview } from '../chat/AttachmentPreview';
import { MessageItemContent } from '../chat/MessageItemContent';
import { ImageLightboxModal } from '../chat/ImageLightboxModal';
import { SendRoomMessageOptions } from '../../hooks/useRoomMessages';
import { useRoomTyping } from '../../hooks/useRoomTyping';
import {
  Hash,
  Users,
  Send,
  Loader2,
  MessageSquare,
  Check,
  CheckCheck,
  Smile,
  Sparkles,
  Paperclip,
  AlertCircle,
  X,
  ChevronLeft,
} from 'lucide-react';

interface RoomChatAreaProps {
  activeRoom: RoomListItemDto | null;
  roomDetails: RoomDetailDto | null;
  messages: RoomReceiveMessagePayload[];
  isLoadingMessages: boolean;
  hasMore?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlderMessages?: () => Promise<void> | void;
  onSendMessage: (content: string, optionsOrType?: MessageType | SendRoomMessageOptions) => void;
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
  const { currentUser, token } = useAuth();
  const { isConnected } = useSocket();
  const [inputText, setInputText] = useState('');
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifModal, setShowGifModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string | null } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPrependRef = useRef(false);
  const prevMessagesLengthRef = useRef(messages.length);

  const { isTyping, typingText, handleTyping, stopTyping } = useRoomTyping(activeRoom?.id ?? null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;

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

  if (!activeRoom) {
    return (
      <main className="flex-1 bg-slate-50 flex flex-col items-center justify-center p-8 text-center text-gray-500">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4 shadow-sm">
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
    <main className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Active Room Header */}
      <header className="px-4 sm:px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to chats"
              className="md:hidden -ml-1 p-2 rounded-xl text-gray-600 hover:text-indigo-600 hover:bg-gray-100 active:bg-gray-200 transition flex items-center gap-0.5 min-w-[40px] min-h-[40px] justify-center cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-xs font-semibold hidden xs:inline">Chats</span>
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-base shadow-sm shrink-0">
            <Hash className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900 truncate">
              {activeRoom.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
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
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer"
        >
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Manage Members</span>
        </button>
      </header>

      {/* Message Thread */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        data-testid="room-messages-container"
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3"
      >
        {isLoadingOlder && (
          <div data-testid="load-older-indicator" className="py-2 flex items-center justify-center gap-1.5 text-xs text-indigo-600">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading older room messages...</span>
          </div>
        )}

        {isLoadingMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <p className="text-xs">Loading room messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center mb-2">
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
                className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Sender Avatar */}
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-semibold flex items-center justify-center text-xs shrink-0 self-end mb-1">
                  {msg.sender.username.slice(0, 2).toUpperCase()}
                </div>

                <div className={`flex flex-col max-w-[85%] sm:max-w-md ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name (shown above bubble for other users) */}
                  {!isMe && (
                    <span className="text-[11px] font-semibold text-gray-500 mb-1 ml-1">
                      {msg.sender.username}
                    </span>
                  )}

                  <div
                    className={`px-4 py-2.5 rounded-2xl shadow-xs text-sm break-words whitespace-pre-wrap ${
                      isGif
                        ? isMe
                          ? 'bg-indigo-600/95 text-white p-1 rounded-2xl rounded-br-xs shadow-xs'
                          : 'bg-white text-gray-900 border border-gray-200 p-1 rounded-2xl rounded-bl-xs shadow-xs'
                        : isMe
                        ? 'bg-indigo-600 text-white rounded-br-xs'
                        : 'bg-white text-gray-900 border border-gray-200 rounded-bl-xs'
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
                    />
                    <div
                      className={`flex items-center gap-1.5 text-[10px] mt-1 ${isGif ? 'px-2 pb-1' : ''} ${
                        isMe ? 'text-indigo-200 justify-end' : 'text-gray-400 justify-start'
                      }`}
                    >
                      <span>{formatMessageTime(msg.createdAt)}</span>
                      {isMe && <Check className="w-3 h-3 text-indigo-200" />}
                      {readers.length > 0 && (
                        <span
                          data-testid="room-message-read-indicator"
                          className={`flex items-center gap-0.5 font-medium ml-1 ${
                            isMe ? 'text-sky-300' : 'text-sky-600'
                          }`}
                          title={`Read by: ${readers.map((r) => r.user?.username || r.userId).join(', ')}`}
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>{readers.length}</span>
                        </span>
                      )}
                    </div>
                  </div>
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
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-xs">
              <span className="font-medium text-gray-700">{typingText}</span>
              <span className="flex gap-0.5 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Footer */}
      <footer className="p-3 sm:p-4 bg-white border-t border-gray-200">
        {/* Error Alert */}
        {errorMessage && (
          <div
            data-testid="room-upload-error-alert"
            className="max-w-4xl mx-auto mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between shadow-xs animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:bg-rose-100 rounded-lg text-rose-500 hover:text-rose-700 transition cursor-pointer"
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
              data-testid="room-file-upload-input"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Paperclip Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-xl transition cursor-pointer disabled:opacity-50"
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
                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
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
              className="px-2.5 py-1 text-xs font-bold text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition cursor-pointer flex items-center gap-1 shrink-0"
              title="Search animated GIFs"
              aria-label="Search animated GIFs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>GIF</span>
            </button>
          </div>

          <div className="flex-1 bg-gray-50 border border-gray-300 focus-within:border-indigo-500 focus-within:bg-white rounded-2xl transition px-4 py-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                handleTyping();
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedFile
                  ? 'Add a caption (optional)...'
                  : `Message #${activeRoom.name}...`
              }
              className="w-full bg-transparent resize-none outline-none text-sm text-gray-900 placeholder-gray-400 max-h-32"
            />
          </div>

          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedFile) || !isConnected || isUploading}
            className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0 cursor-pointer shadow-sm flex items-center justify-center"
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
        imageUrl={lightboxImage?.url || ''}
        imageName={lightboxImage?.name}
        onClose={() => setLightboxImage(null)}
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
