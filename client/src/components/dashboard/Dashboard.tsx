import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useDirectChats } from '../../hooks/useDirectChats';
import { useDirectMessages } from '../../hooks/useDirectMessages';
import { useRooms } from '../../hooks/useRooms';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { Sidebar } from '../chat/Sidebar';
import { ChatArea } from '../chat/ChatArea';
import { RoomChatArea } from '../room/RoomChatArea';
import { MessageSquare, LogOut, Bell, BellOff } from 'lucide-react';
import {
  SOCKET_EVENTS,
  DirectReceiveMessagePayload,
  RoomReceiveMessagePayload,
  MessageType,
} from '@webchat/shared';
import { showBrowserNotification, playNotificationSound } from '../../utils/notifications';

export const Dashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { socket, isConnected, isConnecting, isReconnecting } = useSocket();

  // Active navigation mode
  const [activeTab, setActiveTab] = useState<'direct' | 'room'>('direct');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

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
  } = useDirectChats();

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
  } = useRooms();

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

  // Background audio ping and HTML5 Web Notifications listener
  useEffect(() => {
    if (!socket || !notificationsEnabled) return;

    const handleIncoming = (senderName: string, snippet: string, senderId: string, avatarUrl?: string | null) => {
      if (senderId === currentUser?.id) return;

      // Trigger notification and audio ping when document is hidden / tab inactive
      if (typeof document !== 'undefined' && document.hidden) {
        playNotificationSound();
        showBrowserNotification(senderName, {
          body: snippet || 'Sent a new message',
          icon: avatarUrl || undefined,
        });
      }
    };

    const handleDirectReceive = (msg: DirectReceiveMessagePayload) => {
      let snippet = msg.content;
      if (msg.type === MessageType.IMAGE) snippet = '📷 Sent an image';
      else if (msg.type === MessageType.DOCUMENT) snippet = '📎 Sent a document';
      else if (msg.type === MessageType.EMOJI_GIF) snippet = '✨ Sent a GIF';

      handleIncoming(msg.sender.username, snippet, msg.senderId, msg.sender.avatarUrl);
    };

    const handleRoomReceive = (msg: RoomReceiveMessagePayload) => {
      let snippet = msg.content;
      if (msg.type === MessageType.IMAGE) snippet = '📷 Sent an image';
      else if (msg.type === MessageType.DOCUMENT) snippet = '📎 Sent a document';
      else if (msg.type === MessageType.EMOJI_GIF) snippet = '✨ Sent a GIF';

      handleIncoming(msg.sender.username, snippet, msg.senderId, msg.sender.avatarUrl);
    };

    socket.on(SOCKET_EVENTS.DIRECT_RECEIVE, handleDirectReceive);
    socket.on(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);

    return () => {
      socket.off(SOCKET_EVENTS.DIRECT_RECEIVE, handleDirectReceive);
      socket.off(SOCKET_EVENTS.ROOM_RECEIVE, handleRoomReceive);
    };
  }, [socket, notificationsEnabled, currentUser?.id]);

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

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Web Chat Real-Time</h1>
            <p className="text-xs text-indigo-600 font-medium">Welcome, {currentUser.username}!</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notification Toggle Button */}
          <button
            type="button"
            data-testid="notification-toggle-btn"
            onClick={handleToggleNotifications}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
              notificationsEnabled
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
            title={notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled'}
            aria-label="Toggle notifications"
          >
            {notificationsEnabled ? (
              <Bell className="w-4 h-4 text-indigo-600" />
            ) : (
              <BellOff className="w-4 h-4 text-gray-400" />
            )}
            <span className="hidden md:inline">
              {notificationsEnabled ? 'Notifications On' : 'Notifications Off'}
            </span>
          </button>

          {/* Socket Connection Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-gray-200 bg-gray-50">
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700 hidden sm:inline">Socket Connected</span>
              </>
            ) : isReconnecting ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-700 hidden sm:inline">Reconnecting...</span>
              </>
            ) : isConnecting ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-700 hidden sm:inline">Connecting...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-rose-700 hidden sm:inline">Disconnected</span>
              </>
            )}
          </div>

          {/* User Sign Out Button */}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Real-Time Chat Workspace */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
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

        {activeTab === 'room' || activeRoomId ? (
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
          />
        )}
      </div>
    </div>
  );
};
