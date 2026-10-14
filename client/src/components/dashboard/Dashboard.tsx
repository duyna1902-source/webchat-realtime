import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useDirectChats } from '../../hooks/useDirectChats';
import { useDirectMessages } from '../../hooks/useDirectMessages';
import { useRooms } from '../../hooks/useRooms';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { Sidebar } from '../chat/Sidebar';
import { ChatArea } from '../chat/ChatArea';
import { RoomChatArea } from '../room/RoomChatArea';
import { MessageSquare, LogOut } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { isConnected, isConnecting } = useSocket();

  // Active navigation mode
  const [activeTab, setActiveTab] = useState<'direct' | 'room'>('direct');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Direct Chats hooks
  const {
    chats,
    isLoading: isLoadingChats,
    createOrOpenChat,
  } = useDirectChats();

  const {
    messages: directMessages,
    isLoading: isLoadingDirectMessages,
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
    sendMessage: sendRoomMessage,
    addMember,
    removeMember,
    changeRole,
    leaveRoom,
    deleteRoom,
  } = useRoomMessages(activeRoomId);

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

        <div className="flex items-center gap-3">
          {/* Socket Connection Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-gray-200 bg-gray-50">
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700 hidden sm:inline">Socket Connected</span>
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
            onSendMessage={sendDirectMessage}
          />
        )}
      </div>
    </div>
  );
};
