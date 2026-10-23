import { AttachmentDto, AttachmentKind } from '@webchat/shared';

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  csv: 'text/plain; charset=utf-8',
  json: 'text/plain; charset=utf-8',
};

/** An Attachment as the server sends it, signed for an hour unless overridden. */
export function attachmentFixture(overrides: Partial<AttachmentDto> & { name: string; url: string }): AttachmentDto {
  const extension = overrides.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
  return {
    id: `att-${overrides.name}`,
    kind: mimeType.startsWith('image/') ? AttachmentKind.IMAGE : AttachmentKind.DOCUMENT,
    mimeType,
    size: 1024,
    urlExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}
