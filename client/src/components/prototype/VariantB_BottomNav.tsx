import React, { useState } from 'react';
import {
  MessageSquare,
  Hash,
  User,
  Search,
  ChevronLeft,
  Send,
  Smile,
  Paperclip,
  Bell,
  LogOut,
  Sparkles,
  CheckCheck,
} from 'lucide-react';
import { INITIAL_MOCK_CHATS, INITIAL_MOCK_ROOMS, MockChat, MockRoom } from './mockData';

export const VariantB_BottomNav: React.FC = () => {
  const [activeNav, setActiveNav] = useState<'direct' | 'rooms' | 'me'>('direct');
  const [chats, setChats] = useState<MockChat[]>(INITIAL_MOCK_CHATS);
  const [rooms, setRooms] = useState<MockRoom[]>(INITIAL_MOCK_ROOMS);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [myPresence, setMyPresence] = useState<'online' | 'away'>('online');

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
    <div className="h-full w-full flex flex-col bg-slate-50 text-gray-900 overflow-hidden font-sans select-none">
      {/* Top Header when not in detail view */}
      {!isDetailView && (
        <header className="bg-white/80 backdrop-blur-md px-4 py-3 border-b border-gray-200/80 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-extrabold text-gray-900 tracking-tight">
              {activeNav === 'direct' ? 'Messages' : activeNav === 'rooms' ? 'Rooms & Channels' : 'Settings'}
            </h1>
            <p className="text-[11px] text-gray-400">
              {activeNav === 'direct' ? 'Direct 1-1 Conversations' : activeNav === 'rooms' ? 'Team Rooms' : 'My Preferences'}
            </p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Variant B: Bottom Nav
          </span>
        </header>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isDetailView ? (
          /* Detail Chat View */
          <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
            {/* iOS-Style Navigation Bar */}
            <header className="px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between shadow-xs shrink-0">
              <button
                onClick={handleBack}
                className="flex items-center gap-0.5 text-indigo-600 font-semibold text-xs hover:text-indigo-800 transition"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>

              <div className="text-center min-w-0 px-2">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {activeChat ? activeChat.partner.username : `#${activeRoom?.name}`}
                </p>
                <p className="text-[10px] text-emerald-600 font-medium">
                  {activeChat ? 'Active now' : `${activeRoom?.memberCount} members`}
                </p>
              </div>

              <div className="w-12" />
            </header>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(activeChat?.messages || activeRoom?.messages || []).map((msg) => {
                const isMe = msg.senderId === 'user-me';
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-xs ${
                        isMe
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs'
                          : 'bg-white text-gray-800 border border-gray-200 rounded-tl-xs'
                      }`}
                    >
                      <p className="text-xs leading-relaxed break-words">{msg.content}</p>
                      <div className={`text-[9px] mt-1 flex justify-end ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Input Bar */}
            <form onSubmit={handleSendMessage} className="p-2.5 bg-white border-t border-gray-200 flex items-center gap-1.5">
              <button type="button" className="p-2 text-gray-400 hover:text-indigo-600 transition">
                <Paperclip className="w-4 h-4" />
              </button>
              <button type="button" className="p-2 text-gray-400 hover:text-indigo-600 transition">
                <Smile className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Message..."
                className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-xs text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:opacity-40 transition"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        ) : (
          /* Master Views depending on active bottom tab */
          <div className="flex-1 overflow-y-auto">
            {activeNav === 'direct' && (
              <div className="divide-y divide-gray-100 bg-white">
                <div className="p-3 bg-gray-50/50">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search direct chats..."
                      className="w-full bg-white pl-8 pr-3 py-1.5 rounded-xl text-xs border border-gray-200 outline-none"
                    />
                  </div>
                </div>
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className="w-full p-3.5 flex items-center gap-3 hover:bg-gray-50 text-left transition"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold flex items-center justify-center text-sm shadow-xs">
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
                        <span className="text-sm font-bold text-gray-900 truncate">{chat.partner.username}</span>
                        <span className="text-[10px] text-gray-400">10:45 AM</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{chat.lastMessage.content}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {activeNav === 'rooms' && (
              <div className="divide-y divide-gray-100 bg-white">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className="w-full p-3.5 flex items-center gap-3 hover:bg-gray-50 text-left transition"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-base shrink-0 shadow-xs">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-gray-900 block truncate">#{room.name}</span>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{room.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {activeNav === 'me' && (
              <div className="p-4 space-y-4">
                {/* Profile Card */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                    ME
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Current User</h3>
                    <p className="text-xs text-gray-500">alex_frontend@example.com</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Socket Connected
                    </span>
                  </div>
                </div>

                {/* Settings list */}
                <div className="bg-white rounded-2xl border border-gray-200/80 divide-y divide-gray-100 shadow-xs overflow-hidden">
                  <div className="p-3.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Presence Status</span>
                    <button
                      onClick={() => setMyPresence(myPresence === 'online' ? 'away' : 'online')}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer transition ${
                        myPresence === 'online'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {myPresence === 'online' ? '🟢 Online' : '🟡 Away'}
                    </button>
                  </div>
                  <div className="p-3.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Push Notifications</span>
                    <button
                      onClick={() => setNotificationsOn(!notificationsOn)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer transition ${
                        notificationsOn ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {notificationsOn ? '🔔 Enabled' : '🔕 Disabled'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Navigation Bar (Hidden when in Detail Chat View) */}
      {!isDetailView && (
        <nav aria-label="Bottom Navigation" className="bg-white border-t border-gray-200 px-6 py-2 flex items-center justify-around shrink-0 shadow-lg">
          <button
            onClick={() => setActiveNav('direct')}
            className={`flex flex-col items-center gap-1 transition ${
              activeNav === 'direct' ? 'text-indigo-600 scale-105 font-bold' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px]">Direct</span>
          </button>
          <button
            onClick={() => setActiveNav('rooms')}
            className={`flex flex-col items-center gap-1 transition ${
              activeNav === 'rooms' ? 'text-indigo-600 scale-105 font-bold' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Hash className="w-5 h-5" />
            <span className="text-[10px]">Rooms</span>
          </button>
          <button
            onClick={() => setActiveNav('me')}
            className={`flex flex-col items-center gap-1 transition ${
              activeNav === 'me' ? 'text-indigo-600 scale-105 font-bold' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Profile</span>
          </button>
        </nav>
      )}
    </div>
  );
};
