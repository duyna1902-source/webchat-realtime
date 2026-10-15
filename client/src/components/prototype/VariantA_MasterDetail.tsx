import React, { useState } from 'react';
import {
  MessageSquare,
  Hash,
  Search,
  Plus,
  ChevronLeft,
  Send,
  Smile,
  Paperclip,
  Sparkles,
  Users,
  CheckCheck,
} from 'lucide-react';
import { INITIAL_MOCK_CHATS, INITIAL_MOCK_ROOMS, MockChat, MockRoom } from './mockData';

export const VariantA_MasterDetail: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'direct' | 'room'>('direct');
  const [chats, setChats] = useState<MockChat[]>(INITIAL_MOCK_CHATS);
  const [rooms, setRooms] = useState<MockRoom[]>(INITIAL_MOCK_ROOMS);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const activeChat = chats.find((c) => c.id === selectedChatId);
  const activeRoom = rooms.find((r) => r.id === selectedRoomId);
  const isDetailView = Boolean(activeChat || activeRoom);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      senderId: 'user-me',
      senderName: 'You',
      content: inputText.trim(),
      createdAt: new Date().toISOString(),
    };

    if (activeChat) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? {
                ...c,
                lastMessage: { content: newMsg.content, createdAt: newMsg.createdAt },
                messages: [...c.messages, newMsg],
              }
            : c
        )
      );
    } else if (activeRoom) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeRoom.id
            ? {
                ...r,
                lastMessage: { senderName: 'You', content: newMsg.content, createdAt: newMsg.createdAt },
                messages: [...r.messages, newMsg],
              }
            : r
        )
      );
    }

    setInputText('');
  };

  const handleBack = () => {
    setSelectedChatId(null);
    setSelectedRoomId(null);
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-100 text-gray-900 overflow-hidden font-sans select-none">
      {/* App Header */}
      {!isDetailView && (
        <header className="bg-white px-4 py-3 border-b border-gray-200 flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">WebChat Realtime</h1>
              <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            Variant A: Master-Detail
          </span>
        </header>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {!isDetailView ? (
          /* MASTER VIEW: List of Conversations */
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {/* Segmented Tab Controls */}
            <div className="p-3 bg-gray-50/70 border-b border-gray-200 flex gap-1">
              <button
                onClick={() => setActiveTab('direct')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'direct'
                    ? 'bg-white text-indigo-700 shadow-xs border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Direct Chats ({chats.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('room')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'room'
                    ? 'bg-white text-indigo-700 shadow-xs border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                <span>Rooms ({rooms.length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={activeTab === 'direct' ? 'Search messages or people...' : 'Search rooms...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-100 focus:bg-white pl-9 pr-4 py-2 rounded-xl text-xs outline-none border border-transparent focus:border-indigo-400 transition"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {activeTab === 'direct' ? (
                chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className="w-full p-3.5 flex items-start gap-3 hover:bg-indigo-50/40 text-left transition cursor-pointer active:bg-gray-100"
                  >
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shadow-xs">
                        {chat.partner.username.slice(0, 2).toUpperCase()}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                          chat.partner.isOnline ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-bold text-gray-900 truncate">
                          {chat.partner.username}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(chat.lastMessage.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{chat.lastMessage.content}</p>
                    </div>
                    {chat.unreadCount && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {chat.unreadCount}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className="w-full p-3.5 flex items-start gap-3 hover:bg-indigo-50/40 text-left transition cursor-pointer active:bg-gray-100"
                  >
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-base shrink-0 shadow-xs">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-bold text-gray-900 truncate">#{room.name}</span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(room.lastMessage.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-0.5">
                        <Users className="w-3 h-3" />
                        <span>{room.memberCount} members</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        <span className="font-semibold text-gray-700">{room.lastMessage.senderName}: </span>
                        {room.lastMessage.content}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Floating Action Button (FAB) */}
            <button
              onClick={() => alert('Start new chat / Create room modal')}
              className="absolute bottom-5 right-5 w-13 h-13 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl flex items-center justify-center transition active:scale-95 cursor-pointer z-10"
              title="New message or room"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        ) : (
          /* DETAIL VIEW: Full-screen Chat Workspace with Mobile Back Button */
          <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
            {/* Chat Header with Back Button */}
            <header className="px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between shadow-xs shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {/* Back button */}
                <button
                  onClick={handleBack}
                  className="p-1.5 -ml-1 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-xl transition cursor-pointer flex items-center gap-0.5"
                  title="Back to conversation list"
                  aria-label="Back"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-xs font-semibold">Chats</span>
                </button>

                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                  {activeChat ? activeChat.partner.username.slice(0, 2).toUpperCase() : <Hash className="w-4 h-4" />}
                </div>

                <div className="min-w-0">
                  <h2 className="text-xs font-bold text-gray-900 truncate">
                    {activeChat ? activeChat.partner.username : `#${activeRoom?.name}`}
                  </h2>
                  <p className="text-[10px] text-emerald-600 font-medium">
                    {activeChat ? 'Online' : `${activeRoom?.memberCount} members`}
                  </p>
                </div>
              </div>
            </header>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(activeChat?.messages || activeRoom?.messages || []).map((msg) => {
                const isMe = msg.senderId === 'user-me';
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div
                      className={`max-w-[82%] rounded-2xl px-3.5 py-2 shadow-xs ${
                        isMe
                          ? 'bg-indigo-600 text-white rounded-tr-xs'
                          : 'bg-white text-gray-900 border border-gray-200/80 rounded-tl-xs'
                      }`}
                    >
                      {!isMe && activeRoom && (
                        <p className="text-[10px] font-bold text-indigo-600 mb-0.5">{msg.senderName}</p>
                      )}
                      <p className="text-xs leading-relaxed break-words">{msg.content}</p>
                      <div
                        className={`text-[9px] mt-1 flex items-center gap-1 justify-end ${
                          isMe ? 'text-indigo-200' : 'text-gray-400'
                        }`}
                      >
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMe && <CheckCheck className="w-3 h-3 text-indigo-200" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-2.5 bg-white border-t border-gray-200 flex items-center gap-1.5 shrink-0"
            >
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-xl transition"
                title="Attach"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-xl transition"
                title="Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
              <div className="flex-1 bg-gray-100 rounded-xl px-3 py-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500 transition">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full bg-transparent text-xs text-gray-900 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
