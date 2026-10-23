export enum RoomRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  EMOJI_GIF = 'EMOJI_GIF',
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

export enum AttachmentKind {
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
}
