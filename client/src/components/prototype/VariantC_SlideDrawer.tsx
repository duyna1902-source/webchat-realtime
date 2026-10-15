import React, { useState } from 'react';
import {
  Menu,
  X,
  MessageSquare,
  Hash,
  Users,
  Search,
  Plus,
  Send,
  Smile,
  Paperclip,
  CheckCheck,
} from 'lucide-react';
import { INITIAL_MOCK_CHATS, INITIAL_MOCK_ROOMS, MockChat, MockRoom } from './mockData';

export const VariantC_SlideDrawer: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chats, setChats] = useState<MockChat[]>(INITIAL_MOCK_CHATS);
  const [rooms, setRooms] = useState<MockRoom[]>(INITIAL_MOCK_ROOMS);
  const [selectedType, setSelectedType] = useState<'direct' | 'room'>('room');
  const [selectedId, setSelectedId] = useState<string>('room-1');
  const [inputText, setInputText] = useState('');

  const currentRoom = selectedType === 'room' ? rooms.find((r) => r.id === selectedId) || rooms[0] : null;
  const currentChat = selectedType === 'direct' ? chats.find((c) => c.id === selectedId) || chats[0] : null;

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

    if (selectedType === 'room' && currentRoom) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === currentRoom.id
            ? {
                ...r,
                lastMessage: { senderName: 'You', content: newMsg.content, createdAt: newMsg.createdAt },
                messages: [...r.messages, newMsg],
              }
            : r
        )
      );
    } else if (selectedType === 'direct' && currentChat) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === currentChat.id
            ? {
                ...c,
                lastMessage: { content: newMsg.content, createdAt: newMsg.createdAt },
                messages: [...c.messages, newMsg],
              }
            : c
        )
      );
    }

    setInputText('');
  };

  const handleSelectConversation = (type: 'direct' | 'room', id: string) => {
    setSelectedType(type);
    setSelectedId(id);
    setDrawerOpen(false); // Auto-close drawer
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-900 text-gray-100 overflow-hidden font-sans select-none relative">
      {/* Top Header with Hamburger Menu Button */}
      <header className="bg-slate-800 border-b border-slate-700/80 px-3.5 py-3 flex items-center justify-between shadow-md shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 -ml-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition cursor-pointer"
            title="Open navigation drawer"
            aria-label="Open navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xs font-bold text-white flex items-center gap-1.5 leading-tight">
              {selectedType === 'room' ? (
                <>
                  <Hash className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{currentRoom?.name}</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{currentChat?.partner.username}</span>
                </>
              )}
            </h1>
            <p className="text-[10px] text-slate-400">
              {selectedType === 'room' ? `${currentRoom?.memberCount} members` : 'Direct message'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700">
          Variant C: Slide Drawer
        </span>
      </header>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
        {/* Messages Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(selectedType === 'room' ? (currentRoom?.messages || []) : (currentChat?.messages || [])).map((msg) => {
            const isMe = msg.senderId === 'user-me';
            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-xs ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-xs'
                  }`}
                >
                  {!isMe && (
                    <p className="text-[10px] font-bold text-indigo-400 mb-0.5">{msg.senderName}</p>
                  )}
                  <p className="text-xs leading-relaxed break-words">{msg.content}</p>
                  <div
                    className={`text-[9px] mt-1 flex justify-end ${
                      isMe ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-1.5 shrink-0">
          <button type="button" className="p-2 text-slate-400 hover:text-white transition">
            <Paperclip className="w-4 h-4" />
          </button>
          <button type="button" className="p-2 text-slate-400 hover:text-white transition">
            <Smile className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${selectedType === 'room' ? '#' + currentRoom?.name : '@' + currentChat?.partner.username}...`}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Backdrop overlay when Drawer is open */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-xs z-30 transition-opacity"
        />
      )}

      {/* Slide-out Off-Canvas Drawer */}
      <aside
        className={`absolute top-0 bottom-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-40 transform transition-transform duration-200 ease-in-out flex flex-col shadow-2xl ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
              WC
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">WebChat Workspaces</p>
              <p className="text-[10px] text-emerald-400 font-semibold">● Connected</p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Channels / Rooms Section */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Rooms ({rooms.length})</span>
              <Plus className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
            </div>
            <div className="space-y-0.5">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleSelectConversation('room', room.id)}
                  className={`w-full px-2.5 py-2 rounded-xl text-left text-xs font-medium flex items-center gap-2 transition ${
                    selectedType === 'room' && selectedId === room.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Hash className="w-4 h-4 shrink-0 text-slate-400" />
                  <span className="truncate">{room.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Direct Messages</span>
              <Plus className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
            </div>
            <div className="space-y-0.5">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleSelectConversation('direct', chat.id)}
                  className={`w-full px-2.5 py-2 rounded-xl text-left text-xs font-medium flex items-center gap-2 transition ${
                    selectedType === 'direct' && selectedId === chat.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      chat.partner.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                    }`}
                  />
                  <span className="truncate">{chat.partner.username}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Drawer Footer User Profile */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
            ME
          </div>
          <div className="truncate flex-1">
            <p className="text-xs font-semibold text-white truncate">Alex Developer</p>
            <p className="text-[10px] text-slate-400 truncate">#Online</p>
          </div>
        </div>
      </aside>
    </div>
  );
};
