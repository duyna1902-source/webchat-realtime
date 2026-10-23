import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useDirectChats } from '../../hooks/useDirectChats';
import { useDirectMessages } from '../../hooks/useDirectMessages';
import { useRooms } from '../../hooks/useRooms';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { Sidebar, formatSidebarPreview } from '../chat/Sidebar';
import { ChatArea } from '../chat/ChatArea';
import { RoomChatArea } from '../room/RoomChatArea';
import { AccountInfoModal } from './AccountInfoModal';
import { LogOut, MonitorX, Bell, BellOff } from 'lucide-react';
import {
  SOCKET_EVENTS,
  DirectReceiveMessagePayload,
  RoomReceiveMessagePayload,
  RoomMemberChangePayload,
  MessageType,
} from '@webchat/shared';
import { showBrowserNotification, playNotificationSound } from '../../utils/notifications';
import { getAvatarColorClass, getAvatarIconUrl } from '../../utils/avatarColor';

export const Dashboard: React.FC = () => {
  const { currentUser, logout, logoutEverywhere } = useAuth();
  const { socket, isConnected, isConnecting, isReconnecting } = useSocket();

  // Active navigation mode
  const [activeTab, setActiveTab] = useState<'direct' | 'room'>('direct');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Account info popup state
  const [isAccountInfoOpen, setIsAccountInfoOpen] = useState<boolean>(false);
  const closeAccountInfo = useCallback(() => setIsAccountInfoOpen(false), []);

  // Notification state
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('webchat_notifications_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleNotifications = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        const nextState = !notificationsEnabled;
        setNotificationsEnabled(nextState);
        try {
          localStorage.setItem('webchat_notifications_enabled', String(nextState));
        } catch {}
      } else {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setNotificationsEnabled(true);
          try {
            localStorage.setItem('webchat_notifications_enabled', 'true');
          } catch {}
        } else {
          setNotificationsEnabled(false);
          try {
            localStorage.setItem('webchat_notifications_enabled', 'false');
          } catch {}
        }
      }
    }
  };

  // Direct Chats hooks
  const {
    chats,
    isLoading: isLoadingChats,
    createOrOpenChat,
  } = useDirectChats(activeChatId);

  const {
    messages: directMessages,
    isLoading: isLoadingDirectMessages,
    isLoadingOlder: isLoadingOlderDirect,
    hasMore: hasMoreDirect,
    loadOlderMessages: loadOlderDirectMessages,
    sendMessage: sendDirectMessage,
  } = useDirectMessages(activeChatId);

  // Rooms hooks
  const {
    rooms,
    isLoading: isLoadingRooms,
    createRoom,
    refreshRooms,
  } = useRooms(activeRoomId);

  const {
    messages: roomMessages,
    roomDetails,
    isLoadingMessages: isLoadingRoomMessages,
    isLoadingOlder: isLoadingOlderRoom,
    hasMore: hasMoreRoom,
    loadOlderMessages: loadOlderRoomMessages,
    sendMessage: sendRoomMessage,
    addMember,
    removeMember,
    changeRole,
    leaveRoom,
    deleteRoom,
  } = useRoomMessages(activeRoomId);

  // Close active room if deleted or current user is kicked
  useEffect(() => {
    if (!socket) return;
    const handleMemberChange = (payload: RoomMemberChangePayload) => {
      if (
        (payload.action === 'DELETE' && payload.roomId === activeRoomId) ||
        (payload.action === 'KICK' && payload.userId === currentUser?.id && payload.roomId === activeRoomId)
      ) {
        setActiveRoomId(null);
      }
    };
    socket.on(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, handleMemberChange);
    return () => {
      socket.off(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, handleMemberChange);
    };
  }, [socket, activeRoomId, currentUser?.id]);

  // Context-aware audio ping and HTML5 Web Notifications listener (Ticket 04)
  useEffect(() => {
    if (!socket || !notificationsEnabled) return;

    const handleIncoming = (
      senderName: string,
      snippet: string,
      senderId: string,
      isCurrentConversation: boolean
    ) => {
      if (senderId === currentUser?.id) return;

      const isHidden = typeof document !== 'undefined' && document.hidden;

      if (isHidden) {
        // Tab is hidden: play audio ping and trigger HTML5 browser notification
        playNotificationSound();
        showBrowserNotification(senderName, {
          body: snippet || 'Sent a new message',
          // Always the Deterministic 4-Color Avatar: never load an image URL a User controls.
          icon: getAvatarIconUrl(senderName),
        });
      } else if (!isCurrentConversation) {
        // Tab is visible, but incoming message is in an inactive conversation:
        // Play discreet audio notification ping without spawning OS popup
        playNotificationSound();
      }
      // If tab is visible and isCurrentConversation, do nothing
    };

    const handleDirectReceive = (msg: DirectReceiveMessagePayload) => {
      const snippet = formatSidebarPreview(msg, '');
      const isCurrent = activeChatId !== null && msg.directChatId === activeChatId;
      handleIncoming(msg.sender.username, snippet, msg.senderId, isCurrent);
    };

    const handleRoomReceive = (msg: RoomReceiveMessagePayload) => {
      const snippet = formatSidebarPreview(msg, '');
      const isCurrent = activeRoomId !== null && msg.roomId === activeRoomId;
      handleIncoming(msg.sender.username, snippet, msg.senderId, isCurrent);
    };

    socket.on(SOCKET_EVENTS.DIRECT_RECEIVE, handleDirectReceive);
    socket.on(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);

    return () => {
      socket.off(SOCKET_EVENTS.DIRECT_RECEIVE, handleDirectReceive);
      socket.off(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);
    };
  }, [socket, notificationsEnabled, currentUser?.id, activeChatId, activeRoomId]);

  const safeChats = Array.isArray(chats) ? chats : [];
  const activeChat = safeChats.find((c) => c.id === activeChatId) || null;

  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const activeRoom = safeRooms.find((r) => r.id === activeRoomId) || null;

  const handleStartChat = async (targetUserId: string) => {
    const chatId = await createOrOpenChat(targetUserId);
    setActiveChatId(chatId);
    setActiveRoomId(null);
    setActiveTab('direct');
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setActiveRoomId(null);
    setActiveTab('direct');
  };

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setActiveChatId(null);
    setActiveTab('room');
  };

  const handleLeaveRoom = async () => {
    await leaveRoom();
    setActiveRoomId(null);
    await refreshRooms();
  };

  const handleDeleteRoom = async () => {
    await deleteRoom();
    setActiveRoomId(null);
    await refreshRooms();
  };

  if (!currentUser) return null;

  const isChatActive = Boolean(activeChatId || activeRoomId);

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-100 overflow-hidden">
      {/* Top Navigation Bar (Slim 42px h-11, Single Line GDG-HUST Lockup) */}
      <header className="bg-white border-b border-google-grey300 px-3 sm:px-4 h-11 flex items-center justify-between shrink-0 z-20">
        {/* GDG-HUST Brand Lockup (Guaranteed never to wrap on mobile down to 320px) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-white border border-google-grey300 flex items-center justify-center p-0.5 shadow-xs shrink-0">
            <img
              src="/assets/brand/logo-gdg-clean.webp"
              alt="GDG Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-sm font-bold text-gray-900 tracking-tight whitespace-nowrap">
            GDG-HUST
          </span>
          <span className="hidden md:inline-block text-xs text-google-blue font-medium border-l border-google-grey300 pl-2.5 ml-0.5">
            Welcome, {currentUser.username}!
          </span>
        </div>

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Notification Toggle Button */}
          <button
            type="button"
            data-testid="notification-toggle-btn"
            onClick={handleToggleNotifications}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
              notificationsEnabled
                ? 'bg-google-blue-subtle text-google-blue hover:bg-google-blue-subtle/80'
                : 'text-google-grey700 hover:bg-google-grey100'
            }`}
            title={notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled'}
            aria-label="Toggle notifications"
          >
            {notificationsEnabled ? (
              <Bell className="w-4 h-4 shrink-0" />
            ) : (
              <BellOff className="w-4 h-4 shrink-0" />
            )}
          </button>

          {/* Socket Connection Badge: Compact 8px pulsing dot with text hidden on mobile */}
          <div
            data-testid="socket-connection-badge"
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              isConnected
                ? 'text-google-green bg-google-green-subtle border-google-green/30'
                : isReconnecting || isConnecting
                ? 'text-google-yellow bg-google-yellow-subtle border-google-yellow/30'
                : 'text-google-red bg-google-red-subtle border-google-red/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected
                  ? 'bg-google-green animate-pulse'
                  : isReconnecting || isConnecting
                  ? 'bg-google-yellow animate-pulse'
                  : 'bg-google-red'
              }`}
            />
            <span className="hidden sm:inline">
              {isConnected
                ? 'Connected'
                : isReconnecting
                ? 'Reconnecting...'
                : isConnecting
                ? 'Connecting...'
                : 'Disconnected'}
            </span>
          </div>

          {/* Current User 24px Avatar Circle: opens the account info popup */}
          <button
            type="button"
            onClick={() => setIsAccountInfoOpen(true)}
            className={`w-6 h-6 rounded-full ${getAvatarColorClass(currentUser.username)} text-[10px] font-bold flex items-center justify-center shadow-xs shrink-0 cursor-pointer`}
            title={`${currentUser.username} (Online)`}
            aria-label={`Account info: ${currentUser.username} (Online)`}
            data-testid="header-user-avatar"
          >
            {currentUser.username.slice(0, 2).toUpperCase()}
          </button>
          <AccountInfoModal user={currentUser} isOpen={isAccountInfoOpen} onClose={closeAccountInfo} />

          {/* User Sign Out Button: Clean icon button on mobile with Google Red hover */}
          <button
            onClick={logout}
            className="p-1.5 text-google-grey700 hover:text-google-red hover:bg-google-red-subtle rounded-lg transition cursor-pointer flex items-center gap-1"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline text-xs font-medium">Sign Out</span>
          </button>

          {/* Sign out of all devices: ends every Session of this User, on every device */}
          <button
            onClick={logoutEverywhere}
            className="p-1.5 text-google-grey700 hover:text-google-red hover:bg-google-red-subtle rounded-lg transition cursor-pointer flex items-center gap-1"
            title="Sign out of all devices"
            aria-label="Sign out of all devices"
          >
            <MonitorX className="w-4 h-4 shrink-0" />
            <span className="hidden lg:inline text-xs font-medium">All Devices</span>
          </button>
        </div>
      </header>

      {/* Main Real-Time Chat Workspace */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          className={isChatActive ? 'hidden md:flex md:w-88' : 'w-full md:w-88'}
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onStartChat={handleStartChat}
          isLoadingChats={isLoadingChats}
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={handleSelectRoom}
          onCreateRoom={createRoom}
          isLoadingRooms={isLoadingRooms}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div
          data-testid="chat-area-container"
          className={`flex-1 min-w-0 flex overflow-hidden ${!isChatActive ? 'hidden md:flex' : 'w-full flex'}`}
        >
          {Boolean(activeRoomId) || (!activeChatId && activeTab === 'room') ? (
            <RoomChatArea
              activeRoom={activeRoom}
              roomDetails={roomDetails}
              messages={roomMessages}
              isLoadingMessages={isLoadingRoomMessages}
              hasMore={hasMoreRoom}
              isLoadingOlder={isLoadingOlderRoom}
              onLoadOlderMessages={loadOlderRoomMessages}
              onSendMessage={sendRoomMessage}
              onAddMember={addMember}
              onRemoveMember={removeMember}
              onChangeRole={changeRole}
              onLeaveRoom={handleLeaveRoom}
              onDeleteRoom={handleDeleteRoom}
              onBack={() => {
                setActiveChatId(null);
                setActiveRoomId(null);
              }}
            />
          ) : (
            <ChatArea
              activeChat={activeChat}
              messages={directMessages}
              isLoadingMessages={isLoadingDirectMessages}
              hasMore={hasMoreDirect}
              isLoadingOlder={isLoadingOlderDirect}
              onLoadOlderMessages={loadOlderDirectMessages}
              onSendMessage={sendDirectMessage}
              onBack={() => {
                setActiveChatId(null);
                setActiveRoomId(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
