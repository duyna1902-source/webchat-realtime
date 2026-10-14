import React, { useState, useRef, useEffect } from 'react';
import { DirectChatListItemDto, DirectReceiveMessagePayload, MessageType } from '@webchat/shared';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useTyping } from '../../hooks/useTyping';
import { EmojiPickerPopover } from '../media/EmojiPickerPopover';
import { GifSearchModal } from '../media/GifSearchModal';
import { AttachmentPreview } from './AttachmentPreview';
import { MessageItemContent } from './MessageItemContent';
import { ImageLightboxModal } from './ImageLightboxModal';
import { SendDirectMessageOptions } from '../../hooks/useDirectMessages';
import {
  Send,
  MessageSquare,
  Loader2,
  Check,
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
  onSendMessage: (content: string, optionsOrType?: MessageType | SendDirectMessageOptions) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  activeChat,
  messages,
  isLoadingMessages,
  onSendMessage,
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isPartnerTyping, handleTyping, stopTyping } = useTyping(activeChat?.id ?? null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPartnerTyping]);

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
      <main className="flex-1 bg-slate-50 flex flex-col items-center justify-center p-8 text-center text-gray-500">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4 shadow-sm">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Real-Time Direct Messaging</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Select an existing conversation from the sidebar or find users with the search bar to start chatting 1-1.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Active Chat Header */}
      <header className="px-6 py-3.5 bg-white border-b border-gray-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
              {activeChat.partner.username.slice(0, 2).toUpperCase()}
            </div>
            <span
              data-testid="chat-header-presence-dot"
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                activeChat.partner.isOnline ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">{activeChat.partner.username}</h2>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              {activeChat.partner.isOnline ? (
                <span className="text-emerald-600 font-medium">Online</span>
              ) : (
                <span>{formatLastSeen(activeChat.partner.lastSeenAt)}</span>
              )}
            </p>
          </div>
        </div>
      </header>

      {/* Message Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
        {isLoadingMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <p className="text-xs">Loading message history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center mb-2">
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
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-md ${
                    isGif
                      ? isMe
                        ? 'bg-indigo-600/95 text-white p-1 rounded-2xl rounded-br-xs shadow-xs'
                        : 'bg-white text-gray-900 border border-gray-200 p-1 rounded-2xl rounded-bl-xs shadow-xs'
                      : isMe
                      ? 'bg-indigo-600 text-white px-4 py-2.5 rounded-2xl rounded-br-xs shadow-xs text-sm break-words whitespace-pre-wrap'
                      : 'bg-white text-gray-900 border border-gray-200 px-4 py-2.5 rounded-2xl rounded-bl-xs shadow-xs text-sm break-words whitespace-pre-wrap'
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
                    className={`flex items-center gap-1 text-[10px] mt-1 ${isGif ? 'px-2 pb-1' : ''} ${
                      isMe ? 'text-indigo-200 justify-end' : 'text-gray-400 justify-start'
                    }`}
                  >
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {isMe && <Check className="w-3 h-3 text-indigo-200" />}
                  </div>
                </div>
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
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-xs">
              <span className="font-medium text-gray-700">{activeChat.partner.username} is typing</span>
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
            data-testid="upload-error-alert"
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
              data-testid="file-upload-input"
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
                  : `Message @${activeChat.partner.username}...`
              }
              className="w-full bg-transparent resize-none outline-none text-sm text-gray-900 placeholder-gray-400 max-h-32"
            />
          </div>

          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedFile) || !isConnected || isUploading}
            className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0 cursor-pointer shadow-sm flex items-center justify-center"
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

      {/* GIF Search Modal */}
      <GifSearchModal
        isOpen={showGifModal}
        onClose={() => setShowGifModal(false)}
        onSelectGif={handleSelectGif}
      />
    </main>
  );
};
