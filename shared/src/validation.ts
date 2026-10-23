import { z } from 'zod';
import { MessageType, RoomRole } from './enums.js';

// ==========================================
// INPUT VALIDATION (SEC-05, SEC-08)
// ==========================================
// One zod schema per REST body and socket payload. The client parses with them to show hints;
// the server parses with them before any input reaches Prisma. Every field accepts exactly its
// primitive type, so an object such as `{ "contains": "b" }` never reaches a query (A09).

export const ACCOUNT_RULES = {
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 32,
  /** Letters, digits, `_` and `.` only. */
  USERNAME_PATTERN: /^[a-zA-Z0-9_.]+$/,
  /** Measured in UTF-8 bytes: bcrypt ignores everything after byte 72. */
  PASSWORD_MIN_BYTES: 8,
  PASSWORD_MAX_BYTES: 72,
  EMAIL_MAX_LENGTH: 254,
} as const;

export const ROOM_RULES = {
  /** Counted in characters (code points) after trimming. */
  NAME_MAX_LENGTH: 64,
  DESCRIPTION_MAX_LENGTH: 500,
} as const;

/** Upper bound for ids sent by clients (UUIDs today). */
const ID_MAX_LENGTH = 128;
/** Upper bound for a login identifier or password; longer input is never a valid account. */
const LOGIN_FIELD_MAX_LENGTH = 1024;

const CONTROL_CHARACTER = /\p{Cc}/u;
const CONTROL_CHARACTERS = /\p{Cc}/gu;

/** Lowercase form of a username, used for case-insensitive uniqueness and lookup. */
export function normalizeUsername(username: string): string {
  return username.toLowerCase();
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Length in characters (code points), as PostgreSQL's `char_length` counts it. */
export function characterLength(value: string): number {
  return Array.from(value).length;
}

export function hasControlCharacter(value: string): boolean {
  return CONTROL_CHARACTER.test(value);
}

export function stripControlCharacters(value: string): string {
  return value.replace(CONTROL_CHARACTERS, '');
}

/** Cuts `value` to at most `max` code points without splitting a surrogate pair. */
export function truncateCharacters(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : chars.slice(0, max).join('');
}

export function isValidUsername(username: string): boolean {
  return (
    username.length >= ACCOUNT_RULES.USERNAME_MIN_LENGTH &&
    username.length <= ACCOUNT_RULES.USERNAME_MAX_LENGTH &&
    ACCOUNT_RULES.USERNAME_PATTERN.test(username)
  );
}

const idSchema = z.string().min(1, 'Required').max(ID_MAX_LENGTH, 'Invalid id');

// ------------------------------------------
// Account
// ------------------------------------------

export const usernameSchema = z
  .string()
  .min(ACCOUNT_RULES.USERNAME_MIN_LENGTH, `Username must be at least ${ACCOUNT_RULES.USERNAME_MIN_LENGTH} characters`)
  .max(ACCOUNT_RULES.USERNAME_MAX_LENGTH, `Username must be at most ${ACCOUNT_RULES.USERNAME_MAX_LENGTH} characters`)
  .regex(ACCOUNT_RULES.USERNAME_PATTERN, 'Username may only contain letters, digits, _ and .');

export const emailSchema = z
  .string()
  .trim()
  .max(ACCOUNT_RULES.EMAIL_MAX_LENGTH, 'Email is too long')
  .pipe(z.email('Enter a valid email address'))
  .transform((email) => email.toLowerCase());

export const passwordSchema = z
  .string()
  .refine((password) => utf8ByteLength(password) >= ACCOUNT_RULES.PASSWORD_MIN_BYTES, {
    message: `Password must be at least ${ACCOUNT_RULES.PASSWORD_MIN_BYTES} characters`,
  })
  .refine((password) => utf8ByteLength(password) <= ACCOUNT_RULES.PASSWORD_MAX_BYTES, {
    message: `Password must be at most ${ACCOUNT_RULES.PASSWORD_MAX_BYTES} bytes`,
  });

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  emailOrUsername: z
    .string()
    .trim()
    .min(1, 'Enter your username or email')
    .max(LOGIN_FIELD_MAX_LENGTH, 'Invalid credentials'),
  // No strength rule here: accounts created before the rules existed must still sign in.
  password: z.string().min(1, 'Enter your password').max(LOGIN_FIELD_MAX_LENGTH, 'Invalid credentials'),
});

/** Most users one search returns, so a search cannot list the whole directory (SEC-13). */
export const USER_SEARCH_MAX_RESULTS = 20;

/** `GET /api/users?q=`: a username fragment is required; email is never searched. */
export const userSearchQuerySchema = z.object({
  q: z
    .string('Enter a username to search')
    .trim()
    .min(1, 'Enter a username to search')
    .max(ACCOUNT_RULES.USERNAME_MAX_LENGTH, `Search must be at most ${ACCOUNT_RULES.USERNAME_MAX_LENGTH} characters`),
});

// ------------------------------------------
// Rooms
// ------------------------------------------

const roomNameSchema = z
  .string()
  .trim()
  .refine((name) => characterLength(name) >= 1, { message: 'Room name is required' })
  .refine((name) => characterLength(name) <= ROOM_RULES.NAME_MAX_LENGTH, {
    message: `Room name must be at most ${ROOM_RULES.NAME_MAX_LENGTH} characters`,
  })
  .refine((name) => !hasControlCharacter(name), { message: 'Room name contains invalid characters' });

/** An empty description is stored as `null`. */
const roomDescriptionSchema = z
  .string()
  .trim()
  .refine((description) => characterLength(description) <= ROOM_RULES.DESCRIPTION_MAX_LENGTH, {
    message: `Description must be at most ${ROOM_RULES.DESCRIPTION_MAX_LENGTH} characters`,
  })
  .refine((description) => !hasControlCharacter(description), {
    message: 'Description contains invalid characters',
  })
  .nullish()
  .transform((description) => description || null);

export const createRoomSchema = z.object({
  name: roomNameSchema,
  description: roomDescriptionSchema,
});

/** Same rules as creation; every field is optional. */
export const updateRoomSchema = z.object({
  name: roomNameSchema.optional(),
  description: roomDescriptionSchema.optional(),
});

export const addRoomMemberSchema = z.object({
  userId: idSchema,
});

export const changeRoomMemberRoleSchema = z.object({
  role: z.enum([RoomRole.ADMIN, RoomRole.MEMBER], 'Role must be ADMIN or MEMBER'),
});

// ------------------------------------------
// Direct Chat
// ------------------------------------------

export const createDirectChatSchema = z.object({
  targetUserId: idSchema,
});

// ------------------------------------------
// Socket payloads
// ------------------------------------------
// `content` length is checked by the handlers against the Message Character Limit of the
// sender's role (error MESSAGE_TOO_LONG); the 64KB packet cap bounds it before that.

const ATTACHMENT_URL_MAX_LENGTH = 2048;
const ATTACHMENT_NAME_MAX_LENGTH = 255;

const messageFields = {
  content: z.string().optional(),
  type: z.enum(MessageType).optional(),
  attachmentUrl: z.string().max(ATTACHMENT_URL_MAX_LENGTH).nullish(),
  attachmentName: z.string().max(ATTACHMENT_NAME_MAX_LENGTH).nullish(),
  attachmentSize: z.number().int().nonnegative().nullish(),
};

const hasContentOrAttachment = (payload: { content?: string; attachmentUrl?: string | null }) =>
  Boolean(payload.content || payload.attachmentUrl);
const CONTENT_OR_ATTACHMENT = { message: 'Message content or attachment is required', path: ['content'] };

export const directSendSchema = z
  .object({ directChatId: idSchema, ...messageFields })
  .refine(hasContentOrAttachment, CONTENT_OR_ATTACHMENT);

export const directTypingSchema = z.object({
  directChatId: idSchema,
  isTyping: z.boolean(),
});

export const directReadSchema = z.object({
  directChatId: idSchema,
  messageId: idSchema,
});

export const roomJoinSchema = z.object({ roomId: idSchema });

export const roomLeaveSchema = z.object({ roomId: idSchema });

export const roomSendSchema = z
  .object({ roomId: idSchema, ...messageFields })
  .refine(hasContentOrAttachment, CONTENT_OR_ATTACHMENT);

export const roomTypingSchema = z.object({
  roomId: idSchema,
  isTyping: z.boolean(),
});

export const roomReadSchema = z.object({
  roomId: idSchema,
  messageId: idSchema,
});

// ------------------------------------------
// Field errors
// ------------------------------------------

/** One invalid field: `field` is its dotted path (empty for the payload itself). */
export interface FieldError {
  field: string;
  message: string;
}

/** Maps a failed parse to one entry per invalid field (the first message of each). */
export function toFieldErrors(error: z.ZodError): FieldError[] {
  const fields: FieldError[] = [];
  const seen = new Set<string>();
  for (const issue of error.issues) {
    const field = issue.path.map(String).join('.');
    if (seen.has(field)) continue;
    seen.add(field);
    fields.push({ field, message: issue.message });
  }
  return fields;
}

export type InputSchema = z.ZodType;
export type ParsedInput<S extends InputSchema> = z.output<S>;
export type ParseResult<T> = { success: true; data: T } | { success: false; fields: FieldError[] };

/** Parses `input` with `schema`, reporting a failure as field errors. */
export function parseWithSchema<S extends InputSchema>(schema: S, input: unknown): ParseResult<ParsedInput<S>> {
  const result = schema.safeParse(input);
  return result.success ? { success: true, data: result.data } : { success: false, fields: toFieldErrors(result.error) };
}

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
