import { MessageType, MessageStatus, RoomRole } from './enums.js';

// ==========================================
// SOCKET EVENT NAMES
// ==========================================
export const SOCKET_EVENTS = {
  // Direct Chat
  DIRECT_SEND: 'direct:send',
  DIRECT_RECEIVE: 'direct:receive',
  DIRECT_TYPING: 'direct:typing',
  DIRECT_READ: 'direct:read',

  // Room Chat
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_SEND: 'room:send',
  ROOM_RECEIVE: 'room:receive',
  ROOM_TYPING: 'room:typing',
  ROOM_READ: 'room:read',
  ROOM_MEMBER_CHANGE: 'room:member_change',

  // Presence
  PRESENCE_UPDATE: 'presence:update',
} as const;

// ==========================================
// DIRECT CHAT PAYLOADS
// ==========================================

export interface DirectSendMessagePayload {
  directChatId: string;
  content: string;
  type?: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
}

export interface DirectReceiveMessagePayload {
  id: string;
  directChatId: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
  content: string;
  type: MessageType;
  status: MessageStatus;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  createdAt: string; // ISO String
}

export interface DirectTypingPayload {
  directChatId: string;
  isTyping: boolean;
  userId?: string;
}

export interface DirectReadPayload {
  directChatId: string;
  messageId: string;
  readByUserId?: string;
}

// ==========================================
// ROOM CHAT PAYLOADS
// ==========================================

export interface RoomJoinPayload {
  roomId: string;
}

export interface RoomLeavePayload {
  roomId: string;
}

export interface RoomSendMessagePayload {
  roomId: string;
  content: string;
  type?: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
}

export interface RoomReceiveMessagePayload {
  id: string;
  roomId: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
  content: string;
  type: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  createdAt: string; // ISO String
}

export interface RoomTypingPayload {
  roomId: string;
  isTyping: boolean;
  userId?: string;
  username?: string;
}

export interface RoomReadPayload {
  roomId: string;
  messageId: string;
  readByUserId?: string;
}

export interface RoomMemberChangePayload {
  roomId: string;
  action: 'JOIN' | 'LEAVE' | 'KICK' | 'ROLE_CHANGE';
  userId: string;
  username: string;
  role?: RoomRole;
}

// ==========================================
// PRESENCE PAYLOADS
// ==========================================

export interface PresenceUpdatePayload {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string; // ISO String
}
