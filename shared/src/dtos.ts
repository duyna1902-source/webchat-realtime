import { RoomRole } from './enums.js';
import { AttachmentDto, DirectReceiveMessagePayload, RoomReceiveMessagePayload } from './events.js';

// ==========================================
// AUTH DTOs
// ==========================================

export interface UserDto {
  id: string;
  username: string;
  email: string;
  isOnline: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRequestDto {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequestDto {
  emailOrUsername: string;
  password: string;
}

export interface AuthResponseDto {
  token: string;
  user: UserDto;
}

// ==========================================
// DIRECT CHAT DTOs
// ==========================================

export interface DirectChatDto {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
  updatedAt: string;
  partner?: UserDto;
}

export interface DirectChatListItemDto {
  id: string;
  partner: UserDto;
  lastMessage?: DirectReceiveMessagePayload | null;
  unreadCount: number;
  lastReadMessageId?: string | null;
  partnerLastReadMessageId?: string | null;
  updatedAt: string;
}

export interface CreateDirectChatRequestDto {
  targetUserId: string;
}

// ==========================================
// ROOM CHAT DTOs
// ==========================================

export interface RoomDto {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomListItemDto {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  role: RoomRole;
  lastMessage?: RoomReceiveMessagePayload | null;
  unreadCount: number;
  memberCount: number;
  updatedAt: string;
}

export interface CreateRoomRequestDto {
  name: string;
  description?: string;
}

export interface RoomMemberDto {
  id: string;
  roomId: string;
  userId: string;
  role: RoomRole;
  lastReadMessageId?: string | null;
  joinedAt: string;
  user: UserDto;
}

export interface RoomDetailDto extends RoomDto {
  members: RoomMemberDto[];
  role?: RoomRole;
  memberCount: number;
}

export interface AddRoomMemberRequestDto {
  userId: string;
}

export interface ChangeRoomMemberRoleRequestDto {
  role: RoomRole.ADMIN | RoomRole.MEMBER;
}

// ==========================================
// PAGINATION & MEDIA DTOs
// ==========================================

export interface PaginatedMessagesDto<T> {
  messages: T[];
  nextCursor?: string | null;
  hasMore: boolean;
}

/** `201` answer of `POST /api/upload`: the new, not yet sent Attachment. */
export interface UploadResponseDto {
  attachment: AttachmentDto;
}

/** Answer of `GET /api/attachments/:id/url`. */
export interface AttachmentUrlDto {
  url: string;
  expiresAt: string; // ISO String
}

export interface GifItemDto {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
}

// ==========================================
// INVARIANT HELPERS
// ==========================================

/**
 * Normalizes two user IDs so user1Id < user2Id lexicographically.
 * Guarantees direct chat pair uniqueness in DB (ADR 0001).
 */
export function normalizeDirectChatPair(userIdA: string, userIdB: string): [string, string] {
  return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
}
