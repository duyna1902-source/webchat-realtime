import React, { useState, useRef, useEffect } from 'react';
import {
  RoomListItemDto,
  RoomReceiveMessagePayload,
  RoomDetailDto,
  RoomRole,
} from '@webchat/shared';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { RoomMembersModal } from './RoomMembersModal';
import { Hash, Users, Send, Loader2, MessageSquare, Check } from 'lucide-react';

interface RoomChatAreaProps {
  activeRoom: RoomListItemDto | null;
  roomDetails: RoomDetailDto | null;
  messages: RoomReceiveMessagePayload[];
  isLoadingMessages: boolean;
  onSendMessage: (content: string) => void;
  onAddMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onChangeRole: (userId: string, role: RoomRole.ADMIN | RoomRole.MEMBER) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onDeleteRoom: () => Promise<void>;
}

export const RoomChatArea: React.FC<RoomChatAreaProps> = ({
  activeRoom,
  roomDetails,
  messages,
  isLoadingMessages,
  onSendMessage,
  onAddMember,
  onRemoveMember,
  onChangeRole,
  onLeaveRoom,
  onDeleteRoom,
}) => {
  const { currentUser } = useAuth();
  const { isConnected } = useSocket();
  const [inputText, setInputText] = useState('');
  const [showMembersModal, setShowMembersModal] = useState(false);
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

  if (!activeRoom) {
    return (
      <main className="flex-1 bg-slate-50 flex flex-col items-center justify-center p-8 text-center text-gray-500">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4 shadow-sm">
          <Hash className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Room Conversations</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Select a room from the sidebar or create a new room to collaborate with your team!
        </p>
      </main>
    );
  }

  const memberCount = roomDetails?.members.length ?? activeRoom.memberCount;

  return (
    <main className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Active Room Header */}
      <header className="px-6 py-3.5 bg-white border-b border-gray-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
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
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Sender Avatar */}
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-semibold flex items-center justify-center text-xs shrink-0 self-end mb-1">
                  {msg.sender.username.slice(0, 2).toUpperCase()}
                </div>

                <div className={`flex flex-col max-w-[78%] sm:max-w-md ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name (shown above bubble for other users) */}
                  {!isMe && (
                    <span className="text-[11px] font-semibold text-gray-500 mb-1 ml-1">
                      {msg.sender.username}
                    </span>
                  )}

                  <div
                    className={`px-4 py-2.5 rounded-2xl shadow-xs text-sm break-words whitespace-pre-wrap ${
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
              placeholder={`Message #${activeRoom.name}...`}
              className="w-full bg-transparent resize-none outline-none text-sm text-gray-900 placeholder-gray-400 max-h-32"
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || !isConnected}
            className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0 cursor-pointer shadow-sm"
            title="Send room message"
            aria-label="Send room message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>

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
