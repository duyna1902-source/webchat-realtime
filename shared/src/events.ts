import { MessageType, MessageStatus, RoomRole, AttachmentKind } from './enums.js';
import type { PublicUserDto } from './dtos.js';

// ==========================================
// SOCKET EVENT NAMES
// ==========================================
export const SOCKET_EVENTS = {
  // Direct Chat
  DIRECT_SEND: 'direct:send',
  DIRECT_RECEIVE: 'direct:receive',
  DIRECT_DELIVERED: 'direct:delivered',
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

  // Session: sent just before the server cuts off a socket whose Session ended
  SESSION_ENDED: 'session:ended',
} as const;

// ==========================================
// ATTACHMENTS (ADR 0009)
// ==========================================

/**
 * An Attachment as clients see it. `url` is a signed URL that stops working at `urlExpiresAt`;
 * ask `GET /api/attachments/:id/url` for a fresh one.
 */
export interface AttachmentDto {
  id: string;
  kind: AttachmentKind;
  mimeType: string;
  size: number;
  name: string;
  url: string;
  urlExpiresAt: string; // ISO String
}

/**
 * What a client may send with a message, exactly one of: text; text with an uploaded
 * `attachmentId` (the server fills in the file metadata and the message type); or a Giphy `gifUrl`.
 */
export interface SendMessageFields {
  content?: string;
  attachmentId?: string;
  gifUrl?: string;
}

// ==========================================
// DIRECT CHAT PAYLOADS
// ==========================================

export interface DirectSendMessagePayload extends SendMessageFields {
  directChatId: string;
}

export interface DirectReceiveMessagePayload {
  id: string;
  directChatId: string;
  senderId: string;
  sender: PublicUserDto;
  content: string;
  type: MessageType;
  status: MessageStatus;
  /** The message's Attachment with a freshly signed URL; null (or absent) when it has none. */
  attachment?: AttachmentDto | null;
  createdAt: string; // ISO String
}

export interface DirectDeliveredPayload {
  directChatId: string;
  deliveredToUserId: string;
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
  userId?: string;
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

export interface RoomSendMessagePayload extends SendMessageFields {
  roomId: string;
}

export interface RoomReceiveMessagePayload {
  id: string;
  roomId: string;
  senderId: string;
  sender: PublicUserDto;
  content: string;
  type: MessageType;
  /** The message's Attachment with a freshly signed URL; null (or absent) when it has none. */
  attachment?: AttachmentDto | null;
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
  userId?: string;
}

export interface RoomMemberChangePayload {
  roomId: string;
  action: 'JOIN' | 'LEAVE' | 'KICK' | 'ROLE_CHANGE' | 'DELETE';
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

// ==========================================
// SESSION PAYLOADS
// ==========================================

/** Why the server ended a socket's Session: it was revoked (logout, logout everywhere, operator) or reached its absolute expiry. */
export interface SessionEndedPayload {
  reason: 'revoked' | 'expired';
}
