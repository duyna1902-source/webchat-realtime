import React, { useState, useRef, useEffect } from 'react';
import { DirectChatListItemDto, DirectReceiveMessagePayload } from '@webchat/shared';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Send, MessageSquare, Loader2, Check } from 'lucide-react';

interface ChatAreaProps {
  activeChat: DirectChatListItemDto | null;
  messages: DirectReceiveMessagePayload[];
  isLoadingMessages: boolean;
  onSendMessage: (content: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  activeChat,
  messages,
  isLoadingMessages,
  onSendMessage,
}) => {
  const { currentUser } = useAuth();
  const { isConnected } = useSocket();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                activeChat.partner.isOnline ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">{activeChat.partner.username}</h2>
            <p className="text-xs text-gray-500">{activeChat.partner.email}</p>
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
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[78%] sm:max-w-md px-4 py-2.5 rounded-2xl shadow-xs text-sm break-words whitespace-pre-wrap ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-xs'
                  }`}
                >
                  <p>{msg.content}</p>
                  <div
                    className={`flex items-center gap-1 text-[10px] mt-1 ${
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
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Footer */}
      <footer className="p-3 sm:p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="flex-1 bg-gray-50 border border-gray-300 focus-within:border-indigo-500 focus-within:bg-white rounded-2xl transition px-4 py-2">
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message @${activeChat.partner.username}...`}
              className="w-full bg-transparent resize-none outline-none text-sm text-gray-900 placeholder-gray-400 max-h-32"
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || !isConnected}
            className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0 cursor-pointer shadow-sm"
            title="Send message"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </main>
  );
};
