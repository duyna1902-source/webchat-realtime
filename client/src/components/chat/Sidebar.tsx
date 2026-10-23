import React, { useState, useEffect } from 'react';
import { DirectChatListItemDto, RoomListItemDto, UserDto, RoomRole, MessageStatus, MessageType } from '@webchat/shared';
import { useAuth } from '../../context/AuthContext';
import { CreateRoomModal } from '../room/CreateRoomModal';
import { getAvatarColorClass } from '../../utils/avatarColor';

export function formatSidebarPreview(
  lastMsg: { senderId: string; type?: string | MessageType; content: string; attachmentName?: string | null } | null,
  currentUserId: string
): string {
  if (!lastMsg) return 'No messages yet';
  const prefix = currentUserId && lastMsg.senderId === currentUserId ? 'You: ' : '';
  if (lastMsg.type === MessageType.EMOJI_GIF || lastMsg.type === 'EMOJI_GIF') return prefix + '✨ Sent a GIF';
  if (lastMsg.content && lastMsg.content.trim()) return prefix + lastMsg.content;
  if (lastMsg.type === MessageType.IMAGE || lastMsg.type === 'IMAGE') return prefix + '📷 Sent an image';
  if (lastMsg.type === MessageType.DOCUMENT || lastMsg.type === 'DOCUMENT') return prefix + '📎 ' + (lastMsg.attachmentName || 'Document');
  return prefix + (lastMsg.content || '');
}

export function formatUnreadBadgeCount(count?: number): string | null {
  if (!count || count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}
import {
  Search,
  Plus,
  MessageSquare,
  Hash,
  X,
  Loader2,
  Users,
  ShieldCheck,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';

interface SidebarProps {
  chats: DirectChatListItemDto[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onStartChat: (targetUserId: string) => Promise<void>;
  isLoadingChats: boolean;
  // Room props (optional with graceful defaults)
  rooms?: RoomListItemDto[];
  activeRoomId?: string | null;
  onSelectRoom?: (roomId: string) => void;
  onCreateRoom?: (name: string, description?: string) => Promise<string>;
  isLoadingRooms?: boolean;
  activeTab?: 'direct' | 'room';
  onTabChange?: (tab: 'direct' | 'room') => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  onStartChat,
  isLoadingChats,
  rooms = [],
  activeRoomId = null,
  onSelectRoom,
  onCreateRoom,
  isLoadingRooms = false,
  activeTab: externalActiveTab,
  onTabChange,
  className = '',
}) => {
  const { currentUser } = useAuth();

  const [internalTab, setInternalTab] = useState<'direct' | 'room'>('direct');
  const activeTab = externalActiveTab ?? internalTab;

  const handleTabClick = (tab: 'direct' | 'room') => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserDto[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showUserSearchModal, setShowUserSearchModal] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);

  // Search users via /api/users for direct chats
  useEffect(() => {
    if (!currentUser || !searchQuery.trim() || activeTab !== 'direct') {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingUsers(true);
        const res = await apiFetch(`/api/users?q=${encodeURIComponent(searchQuery.trim())}`);
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
  }, [searchQuery, currentUser, activeTab]);

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

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <aside className={`bg-white border-r border-google-grey300 flex flex-col h-full shrink-0 ${className || 'w-80 md:w-88'}`}>
      {/* Tabs: Direct Chats vs Rooms & Search Bar (Redundant profile header eliminated) */}
      <div className="p-2.5 border-b border-google-grey200 bg-google-grey50">
        <div className="flex gap-1 p-0.5 bg-google-grey100 rounded-full border border-google-grey200 mb-2">
          <button
            onClick={() => {
              handleTabClick('direct');
              setSearchQuery('');
            }}
            className={`flex-1 py-1.5 px-3 rounded-full text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'direct'
                ? 'bg-white text-google-blue shadow-xs'
                : 'text-google-grey700 hover:text-google-grey900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Direct Chats</span>
          </button>
          <button
            onClick={() => {
              handleTabClick('room');
              setSearchQuery('');
            }}
            className={`flex-1 py-1.5 px-3 rounded-full text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'room'
                ? 'bg-white text-google-blue shadow-xs'
                : 'text-google-grey700 hover:text-google-grey900'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Rooms</span>
          </button>
        </div>

        {/* Action / Search Bar */}
        <div className="relative flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-google-grey700 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeTab === 'direct' ? 'Search or start new chat...' : 'Filter rooms...'}
              value={searchQuery}
              onFocus={() => {
                if (activeTab === 'direct') setShowUserSearchModal(true);
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeTab === 'direct') setShowUserSearchModal(true);
              }}
              className="w-full pl-7 pr-3 py-1 bg-white rounded-full text-xs text-google-grey900 placeholder-google-grey700 focus:outline-none focus:ring-1 focus:ring-google-blue focus:border-google-blue border border-google-grey300 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-google-grey700 hover:text-google-grey900"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {activeTab === 'direct' ? (
            <button
              onClick={() => setShowUserSearchModal(true)}
              className="p-1.5 bg-google-blue-subtle text-google-blue hover:bg-google-blue-subtle/80 rounded-full transition flex items-center justify-center shrink-0 cursor-pointer"
              title="Start new direct chat"
              aria-label="Start new direct chat"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setShowCreateRoomModal(true)}
              className="p-1.5 bg-google-blue-subtle text-google-blue hover:bg-google-blue-subtle/80 rounded-full transition flex items-center justify-center shrink-0 cursor-pointer"
              title="Create new room"
              aria-label="Create new room"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* User Search Overlay / Dropdown (Direct Chats only) */}
      {activeTab === 'direct' && showUserSearchModal && (
        <div className="bg-google-blue-subtle/50 border-b border-google-grey200 p-3 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-google-grey200">
            <span className="text-xs font-semibold text-google-grey900 uppercase tracking-wider">
              {searchQuery ? 'Search Results' : 'Find Users to Message'}
            </span>
            <button
              onClick={() => setShowUserSearchModal(false)}
              className="text-xs text-google-grey700 hover:text-google-grey900 cursor-pointer"
            >
              Close
            </button>
          </div>

          {isSearchingUsers ? (
            <div className="py-4 flex items-center justify-center gap-2 text-xs text-google-blue">
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
                  className="w-full flex items-center gap-3 p-2 hover:bg-google-blue-subtle rounded-lg text-left transition cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shadow-xs ${getAvatarColorClass(user.username)}`}>
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

      {/* Conversation List (Direct Chats OR Rooms) */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {activeTab === 'direct' ? (
          /* Direct Chats */
          <>
            <div className="px-4 py-2 bg-gray-50/60 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Direct Chats
            </div>

            {isLoadingChats ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin text-google-blue" />
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
                        ? 'bg-google-blue-subtle/80 border-r-4 border-google-blue'
                        : 'hover:bg-google-grey100'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm shadow-xs ${getAvatarColorClass(chat.partner.username)}`}>
                        {chat.partner.username.slice(0, 2).toUpperCase()}
                      </div>
                      <span
                        data-testid={`presence-dot-${chat.partner.id}`}
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          chat.partner.isOnline ? 'bg-google-green' : 'bg-gray-300'
                        }`}
                        title={chat.partner.isOnline ? 'Online' : 'Offline'}
                        aria-label={chat.partner.isOnline ? 'Online' : 'Offline'}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm truncate ${chat.unreadCount && chat.unreadCount > 0 ? 'font-bold text-google-grey900' : 'font-semibold text-gray-900'}`}>
                          {chat.partner.username}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className="text-[11px] text-gray-400">
                            {formatMessageTime(chat.lastMessage?.createdAt || chat.updatedAt)}
                          </span>
                          {chat.unreadCount && chat.unreadCount > 0 ? (
                            <span
                              data-testid={`unread-badge-${chat.id}`}
                              className="px-1.5 py-0.5 rounded-full bg-google-blue text-white text-[10px] font-bold shadow-xs min-w-4 text-center"
                            >
                              {formatUnreadBadgeCount(chat.unreadCount)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1 text-xs text-gray-500">
                        <p className={`truncate flex-1 ${chat.unreadCount && chat.unreadCount > 0 ? 'font-bold text-google-grey900' : 'text-gray-500'}`}>
                          {chat.lastMessage ? (
                            formatSidebarPreview(chat.lastMessage, currentUser?.id || '')
                          ) : (
                            <span className="italic text-gray-400">No messages yet</span>
                          )}
                        </p>
                        {chat.lastMessage && chat.lastMessage.senderId === currentUser?.id && (
                          <div className="shrink-0 flex items-center ml-1">
                            {chat.lastMessage.status === MessageStatus.READ ? (
                              <span
                                className={`w-3.5 h-3.5 rounded-full ${getAvatarColorClass(chat.partner.username)} text-[7px] font-bold flex items-center justify-center shrink-0 text-white shadow-2xs`}
                                title={`Seen by ${chat.partner.username}`}
                              >
                                {chat.partner.username.slice(0, 2).toUpperCase()}
                              </span>
                            ) : chat.lastMessage.status === MessageStatus.DELIVERED ? (
                              <span className="text-[10px] font-semibold text-google-grey700 shrink-0">
                                Delivered
                              </span>
                            ) : (
                              <span className="text-[10px] text-google-grey700/80 shrink-0">
                                Sent
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </>
        ) : (
          /* Rooms */
          <>
            <div className="px-4 py-2 bg-gray-50/60 text-[11px] font-semibold tracking-wider text-gray-500 uppercase flex items-center justify-between">
              <span>Rooms</span>
              <button
                onClick={() => setShowCreateRoomModal(true)}
                className="text-google-blue hover:text-google-blue-hover text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            {isLoadingRooms ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin text-google-blue" />
                <span className="text-xs">Loading rooms...</span>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="py-12 px-6 text-center text-gray-400 flex flex-col items-center gap-2">
                <Hash className="w-8 h-8 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">
                  {searchQuery ? `No rooms match "${searchQuery}"` : 'No rooms joined yet'}
                </p>
                <p className="text-xs text-gray-400">
                  {searchQuery ? 'Try a different filter' : 'Create a room to start Room Chat!'}
                </p>
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = room.id === activeRoomId;
                const isOwner = room.role === RoomRole.OWNER;
                const isAdmin = room.role === RoomRole.ADMIN;

                return (
                  <button
                    key={room.id}
                    onClick={() => onSelectRoom && onSelectRoom(room.id)}
                    className={`w-full p-3.5 flex items-start gap-3 text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-google-blue-subtle/80 border-r-4 border-google-blue'
                        : 'hover:bg-google-grey100'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-google-blue-subtle text-google-blue font-bold flex items-center justify-center text-sm shrink-0">
                      <Hash className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm truncate ${room.unreadCount && room.unreadCount > 0 ? 'font-extrabold text-google-grey900' : 'font-bold text-gray-900'}`}>
                          {room.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className="text-[11px] text-gray-400">
                            {formatMessageTime(room.lastMessage?.createdAt || room.updatedAt)}
                          </span>
                          {room.unreadCount && room.unreadCount > 0 ? (
                            <span
                              data-testid={`unread-badge-${room.id}`}
                              className="px-1.5 py-0.5 rounded-full bg-google-blue text-white text-[10px] font-bold shadow-xs min-w-4 text-center"
                            >
                              {formatUnreadBadgeCount(room.unreadCount)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Users className="w-3 h-3" />
                          <span>{room.memberCount}</span>
                        </span>
                        {isOwner ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-google-yellow-subtle text-google-grey900 rounded border border-google-yellow/40">
                            Owner
                          </span>
                        ) : isAdmin ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-google-blue-subtle text-google-blue rounded border border-google-blue/30">
                            Admin
                          </span>
                        ) : null}
                      </div>

                      <p className={`text-xs truncate ${room.unreadCount && room.unreadCount > 0 ? 'font-bold text-google-grey900' : 'text-gray-500'}`}>
                        {room.lastMessage ? (
                          <>
                            <span className="font-medium text-gray-700">
                              {room.lastMessage.senderId === currentUser?.id ? 'You: ' : `${room.lastMessage.sender.username}: `}
                            </span>
                            {formatSidebarPreview(room.lastMessage, '')}
                          </>
                        ) : (
                          <span className="italic text-gray-400">No messages yet</span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Create Room Modal */}
      {onCreateRoom && (
        <CreateRoomModal
          isOpen={showCreateRoomModal}
          onClose={() => setShowCreateRoomModal(false)}
          onCreateRoom={async (name, desc) => {
            const newId = await onCreateRoom(name, desc);
            if (onSelectRoom) {
              onSelectRoom(newId);
            }
            return newId;
          }}
        />
      )}

      {/* Mobile Floating Action Button (FAB) */}
      <button
        type="button"
        data-testid="mobile-fab-button"
        onClick={() => {
          if (activeTab === 'direct') {
            setShowUserSearchModal(true);
          } else {
            setShowCreateRoomModal(true);
          }
        }}
        aria-label={activeTab === 'direct' ? 'Start new direct chat' : 'Create new room'}
        className="md:hidden fixed bottom-6 right-6 z-30 w-14 h-14 bg-google-blue hover:bg-google-blue-hover active:scale-95 text-white rounded-full shadow-2xl flex items-center justify-center transition cursor-pointer border-2 border-white focus:outline-none"
      >
        <Plus className="w-7 h-7" />
      </button>
    </aside>
  );
};
