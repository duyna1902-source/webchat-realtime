import React, { useState, useEffect } from 'react';
import { DirectChatListItemDto, UserDto } from '@webchat/shared';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Search, Plus, MessageSquare, LogOut, User, Wifi, WifiOff, X, Loader2 } from 'lucide-react';

interface SidebarProps {
  chats: DirectChatListItemDto[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onStartChat: (targetUserId: string) => Promise<void>;
  isLoadingChats: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  onStartChat,
  isLoadingChats,
}) => {
  const { currentUser, token, logout } = useAuth();
  const { isConnected, isConnecting } = useSocket();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserDto[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showUserSearchModal, setShowUserSearchModal] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);

  // Search users via /api/users
  useEffect(() => {
    if (!token || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingUsers(true);
        const res = await fetch(`/api/users?q=${encodeURIComponent(searchQuery.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: UserDto[] = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Error searching users:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  const handleSelectUser = async (targetUserId: string) => {
    try {
      setIsStartingChat(true);
      await onStartChat(targetUserId);
      setShowUserSearchModal(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to start chat:', err);
    } finally {
      setIsStartingChat(false);
    }
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <aside className="w-80 md:w-88 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
      {/* Current User Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center text-sm shadow-sm">
              {currentUser?.username.slice(0, 2).toUpperCase()}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                isConnected ? 'bg-emerald-500' : 'bg-rose-400'
              }`}
            />
          </div>
          <div className="truncate">
            <p className="text-sm font-bold text-gray-900 truncate">{currentUser?.username}</p>
            <p className="text-xs text-gray-500 truncate flex items-center gap-1">
              {isConnected ? (
                <span className="text-emerald-600 font-medium">Online</span>
              ) : isConnecting ? (
                <span className="text-amber-500 font-medium">Connecting...</span>
              ) : (
                <span className="text-gray-400">Offline</span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Action / Search Bar */}
      <div className="p-3 border-b border-gray-100 flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search or start new chat..."
            value={searchQuery}
            onFocus={() => setShowUserSearchModal(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowUserSearchModal(true);
            }}
            className="w-full pl-9 pr-4 py-2 bg-gray-100 focus:bg-white border border-transparent focus:border-indigo-400 rounded-xl text-sm transition outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowUserSearchModal(true)}
          className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition flex items-center justify-center shrink-0"
          title="Start new chat"
          aria-label="Start new direct chat"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* User Search Overlay / Dropdown */}
      {showUserSearchModal && (
        <div className="bg-indigo-50/50 border-b border-indigo-100 p-3 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-100/60">
            <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">
              {searchQuery ? 'Search Results' : 'Find Users to Message'}
            </span>
            <button
              onClick={() => setShowUserSearchModal(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>

          {isSearchingUsers ? (
            <div className="py-4 flex items-center justify-center gap-2 text-xs text-indigo-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Searching users...</span>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-1">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user.id)}
                  disabled={isStartingChat}
                  className="w-full flex items-center gap-3 p-2 hover:bg-indigo-100/70 rounded-lg text-left transition"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-800 font-bold flex items-center justify-center text-xs">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="truncate flex-1">
                    <p className="text-sm font-semibold text-gray-800">{user.username}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery ? (
            <p className="text-xs text-gray-500 py-2 text-center">No users found matching "{searchQuery}"</p>
          ) : (
            <p className="text-xs text-gray-500 py-2 text-center">Type a username or email to search</p>
          )}
        </div>
      )}

      {/* Direct Chats List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        <div className="px-4 py-2 bg-gray-50/60 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
          Direct Chats
        </div>

        {isLoadingChats ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <span className="text-xs">Loading conversations...</span>
          </div>
        ) : chats.length === 0 ? (
          <div className="py-12 px-6 text-center text-gray-400 flex flex-col items-center gap-2">
            <MessageSquare className="w-8 h-8 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">No conversations yet</p>
            <p className="text-xs text-gray-400">Search for users above to start chatting directly!</p>
          </div>
        ) : (
          chats.map((chat) => {
            const isSelected = chat.id === activeChatId;
            return (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full p-3.5 flex items-start gap-3 text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50/80 border-r-4 border-indigo-600'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-semibold flex items-center justify-center text-sm">
                    {chat.partner.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span
                    data-testid={`presence-dot-${chat.partner.id}`}
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      chat.partner.isOnline ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                    title={chat.partner.isOnline ? 'Online' : 'Offline'}
                    aria-label={chat.partner.isOnline ? 'Online' : 'Offline'}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {chat.partner.username}
                    </span>
                    <span className="text-[11px] text-gray-400 shrink-0 ml-1">
                      {formatMessageTime(chat.lastMessage?.createdAt || chat.updatedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {chat.lastMessage ? chat.lastMessage.content : <span className="italic text-gray-400">No messages yet</span>}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
