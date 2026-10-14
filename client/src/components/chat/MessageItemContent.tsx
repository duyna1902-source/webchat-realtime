import React from 'react';
import { MessageType } from '@webchat/shared';
import { FileText, Download } from 'lucide-react';
import { formatFileSize } from '../../utils/format';

interface MessageItemContentProps {
  content: string;
  type?: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  isMe?: boolean;
  onImageClick?: (url: string, name?: string | null) => void;
}

export const MessageItemContent: React.FC<MessageItemContentProps> = ({
  content,
  type,
  attachmentUrl,
  attachmentName,
  attachmentSize,
  isMe = false,
  onImageClick,
}) => {
  const isImage = type === MessageType.IMAGE;
  const isDocument = type === MessageType.DOCUMENT;
  const isGif = type === MessageType.EMOJI_GIF;

  if (isGif) {
    return (
      <div className="overflow-hidden rounded-xl">
        <img
          src={content}
          alt="GIF message"
          loading="lazy"
          className="rounded-xl max-w-full sm:max-w-xs md:max-w-sm max-h-64 object-cover cursor-pointer hover:opacity-95 transition"
          onClick={() => window.open(content, '_blank', 'noopener,noreferrer')}
        />
      </div>
    );
  }

  if (isImage && attachmentUrl) {
    const hasDistinctContent = content && content.trim() !== '' && content !== attachmentName;
    return (
      <div className="flex flex-col gap-1.5">
        <img
          src={attachmentUrl}
          alt={attachmentName || 'Image attachment'}
          onClick={() => onImageClick?.(attachmentUrl, attachmentName)}
          className="rounded-xl max-h-60 max-w-full sm:max-w-xs object-cover cursor-pointer hover:opacity-95 transition shadow-xs border border-black/5"
        />
        {hasDistinctContent && (
          <p className="text-sm break-words whitespace-pre-wrap">{content}</p>
        )}
      </div>
    );
  }

  if (isDocument && attachmentUrl) {
    const hasDistinctContent = content && content.trim() !== '' && content !== attachmentName;
    return (
      <div className="flex flex-col gap-2">
        <div
          className={`flex items-center gap-3 p-2.5 rounded-xl border ${
            isMe
              ? 'bg-indigo-700/40 border-indigo-400/40 text-white'
              : 'bg-gray-50 border-gray-200 text-gray-900'
          }`}
        >
          <div
            className={`p-2 rounded-lg shrink-0 ${
              isMe ? 'bg-indigo-800 text-white' : 'bg-white text-indigo-600 shadow-xs'
            }`}
          >
            <FileText className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate max-w-[160px] sm:max-w-[200px]">
              {attachmentName || 'document'}
            </p>
            <p className={`text-[10px] mt-0.5 ${isMe ? 'text-indigo-200' : 'text-gray-500'}`}>
              {formatFileSize(attachmentSize)}
            </p>
          </div>

          <a
            href={attachmentUrl}
            download={attachmentName || 'document'}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Download ${attachmentName || 'file'}`}
            className={`p-2 rounded-lg transition shrink-0 cursor-pointer ${
              isMe ? 'hover:bg-indigo-600 text-white' : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>

        {hasDistinctContent && (
          <p className="text-sm break-words whitespace-pre-wrap">{content}</p>
        )}
      </div>
    );
  }

  return <p>{content}</p>;
};
