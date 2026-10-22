import React from 'react';
import { MessageType } from '@webchat/shared';
import { FileText, Download, FileX } from 'lucide-react';
import { formatFileSize } from '../../utils/format';
import { safeUrl } from '../../utils/safeUrl';

export const ATTACHMENT_UNAVAILABLE_TEXT = 'Tệp đính kèm không còn khả dụng';

const UnavailableAttachment: React.FC<{ caption?: string | null; isMe: boolean }> = ({ caption, isMe }) => (
  <div className="flex flex-col gap-2">
    <div
      data-testid="attachment-unavailable"
      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs italic ${
        isMe
          ? 'bg-blue-700/40 border-blue-400/40 text-blue-100'
          : 'bg-google-grey50 border-google-grey200 text-google-grey700'
      }`}
    >
      <FileX className="w-4 h-4 shrink-0" />
      <span>{ATTACHMENT_UNAVAILABLE_TEXT}</span>
    </div>
    {caption && (
      <p className="text-sm break-words [overflow-wrap:anywhere] whitespace-pre-wrap">{caption}</p>
    )}
  </div>
);

interface MessageItemContentProps {
  content: string;
  type?: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  isMe?: boolean;
  onImageClick?: (url: string, name?: string | null) => void;
  onDocumentClick?: (url: string, name?: string | null, size?: number | null) => void;
}

export const MessageItemContent: React.FC<MessageItemContentProps> = ({
  content,
  type,
  attachmentUrl,
  attachmentName,
  attachmentSize,
  isMe = false,
  onImageClick,
  onDocumentClick,
}) => {
  const isImage = type === MessageType.IMAGE;
  const isDocument = type === MessageType.DOCUMENT;
  const isGif = type === MessageType.EMOJI_GIF;

  if (isGif) {
    const gifUrl = safeUrl(content);
    if (!gifUrl) {
      return <UnavailableAttachment isMe={isMe} />;
    }
    return (
      <div className="overflow-hidden rounded-xl">
        <img
          src={gifUrl}
          alt="GIF message"
          loading="lazy"
          className="rounded-xl max-w-full sm:max-w-xs md:max-w-sm max-h-64 object-cover cursor-pointer hover:opacity-95 transition"
          onClick={() => window.open(gifUrl, '_blank', 'noopener,noreferrer')}
        />
      </div>
    );
  }

  if (isImage && attachmentUrl) {
    const hasDistinctContent = content && content.trim() !== '' && content !== attachmentName;
    const imageUrl = safeUrl(attachmentUrl);
    if (!imageUrl) {
      return <UnavailableAttachment caption={hasDistinctContent ? content : null} isMe={isMe} />;
    }
    return (
      <div className="flex flex-col gap-1.5">
        <img
          src={imageUrl}
          alt={attachmentName || 'Image attachment'}
          onClick={() => onImageClick?.(imageUrl, attachmentName)}
          className="rounded-xl max-h-60 max-w-full sm:max-w-xs object-cover cursor-pointer hover:opacity-95 transition shadow-xs border border-black/5"
        />
        {hasDistinctContent && (
          <p className="text-sm break-words [overflow-wrap:anywhere] whitespace-pre-wrap">{content}</p>
        )}
      </div>
    );
  }

  if (isDocument && attachmentUrl) {
    const hasDistinctContent = content && content.trim() !== '' && content !== attachmentName;
    const documentUrl = safeUrl(attachmentUrl);
    if (!documentUrl) {
      return <UnavailableAttachment caption={hasDistinctContent ? content : null} isMe={isMe} />;
    }
    return (
      <div className="flex flex-col gap-2">
        <div
          data-testid="document-attachment-card"
          onClick={() => onDocumentClick?.(documentUrl, attachmentName, attachmentSize)}
          className={`flex items-center gap-3 p-2.5 rounded-xl border transition cursor-pointer ${
            isMe
              ? 'bg-blue-700/40 border-blue-400/40 text-white hover:bg-blue-700/50'
              : 'bg-google-grey50 border-google-grey200 text-google-grey900 hover:bg-google-grey100'
          }`}
        >
          <div
            className={`p-2 rounded-lg shrink-0 ${
              isMe ? 'bg-blue-800 text-white' : 'bg-white text-google-blue shadow-xs'
            }`}
          >
            <FileText className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate max-w-[160px] sm:max-w-[200px]">
              {attachmentName || 'document'}
            </p>
            <p className={`text-[10px] mt-0.5 ${isMe ? 'text-blue-200' : 'text-google-grey700'}`}>
              {formatFileSize(attachmentSize)}
            </p>
          </div>

          <a
            href={documentUrl}
            download={attachmentName || 'document'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Download ${attachmentName || 'file'}`}
            className={`p-2 rounded-lg transition shrink-0 cursor-pointer ${
              isMe ? 'hover:bg-blue-600 text-white' : 'hover:bg-google-grey200 text-google-grey700'
            }`}
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>

        {hasDistinctContent && (
          <p className="text-sm break-words [overflow-wrap:anywhere] whitespace-pre-wrap">{content}</p>
        )}
      </div>
    );
  }

  return <p className="break-words [overflow-wrap:anywhere] whitespace-pre-wrap">{content}</p>;
};
