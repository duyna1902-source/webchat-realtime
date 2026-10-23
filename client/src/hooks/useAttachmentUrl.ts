import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttachmentDto, AttachmentUrlDto } from '@webchat/shared';
import { apiFetch } from '../utils/apiFetch';
import { safeUrl } from '../utils/safeUrl';

// ==========================================
// SIGNED ATTACHMENT URLS (ADR 0009)
// ==========================================
// An Attachment's URL is signed for a limited time. When it has expired, or loading it fails
// (`<img>` error, preview `fetch` error), the client asks the server for a fresh one, exactly
// once per Attachment shown, and tries again with it.

/** A fresh signed URL for the Attachment, or null when the server refuses (e.g. `404`). */
export async function fetchAttachmentUrl(attachmentId: string): Promise<AttachmentUrlDto | null> {
  try {
    const res = await apiFetch(`/api/attachments/${encodeURIComponent(attachmentId)}/url`);
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<AttachmentUrlDto>;
    return typeof body.url === 'string' && typeof body.expiresAt === 'string'
      ? { url: body.url, expiresAt: body.expiresAt }
      : null;
  } catch {
    return null;
  }
}

function hasExpired(expiresAt: string): boolean {
  const time = Date.parse(expiresAt);
  return Number.isFinite(time) && time <= Date.now();
}

export interface AttachmentUrlState {
  /** The Attachment with its current URL, to hand on to a preview. Null without an Attachment. */
  attachment: AttachmentDto | null;
  /** The current URL once it passed `safeUrl`, or null when it must not be rendered. */
  url: string | null;
  /** True while the first refresh of an expired URL is pending (nothing to render yet). */
  isRefreshing: boolean;
  /** Call when loading `url` failed; refreshes it the first time, does nothing after. */
  onLoadError: () => void;
  /** True once the one refresh has been used. */
  hasRefreshed: boolean;
}

export function useAttachmentUrl(attachment: AttachmentDto | null | undefined): AttachmentUrlState {
  const [current, setCurrent] = useState<AttachmentDto | null>(attachment ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const refreshUsed = useRef(false);
  const attachmentId = attachment?.id ?? null;
  const givenUrl = attachment?.url ?? null;

  // Another Attachment, or a newly signed URL from the server, starts over with its own single refresh.
  useEffect(() => {
    setCurrent(attachment ?? null);
    refreshUsed.current = false;
    setHasRefreshed(false);
    setIsRefreshing(false);
  }, [attachmentId, givenUrl]);

  const refresh = useCallback(() => {
    if (!current || refreshUsed.current) return;
    refreshUsed.current = true;
    setHasRefreshed(true);
    setIsRefreshing(true);
    const id = current.id;
    void fetchAttachmentUrl(id).then((fresh) => {
      setIsRefreshing(false);
      if (fresh) {
        setCurrent((prev) => (prev && prev.id === id ? { ...prev, url: fresh.url, urlExpiresAt: fresh.expiresAt } : prev));
      }
    });
  }, [current]);

  useEffect(() => {
    if (current && hasExpired(current.urlExpiresAt)) refresh();
  }, [current, refresh]);

  return {
    attachment: current,
    url: current ? safeUrl(current.url) : null,
    isRefreshing,
    onLoadError: refresh,
    hasRefreshed,
  };
}
