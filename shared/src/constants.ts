export const MESSAGE_LIMITS = {
  DIRECT: 4000,
  ROOM_LEADER: 4000, // OWNER and ADMIN
  ROOM_MEMBER: 2000, // MEMBER
} as const;

/**
 * File name extensions of the upload allowlist, for the file picker's `accept`. Only a hint:
 * the server detects the real type from the file content and rejects anything else with `415`.
 */
export const UPLOAD_ACCEPT_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt',
  '.txt', '.csv', '.md', '.json',
] as const;

/** Value of the `accept` attribute of attachment file inputs. */
export const UPLOAD_ACCEPT = UPLOAD_ACCEPT_EXTENSIONS.join(',');
