import React from 'react';
import { X, FileText, Send, Loader2 } from 'lucide-react';
import { formatFileSize } from '../../utils/format';

interface AttachmentPreviewProps {
  file: File;
  previewUrl: string | null;
  isUploading: boolean;
  onCancel: () => void;
  onSend?: () => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  file,
  previewUrl,
  isUploading,
  onCancel,
  onSend,
}) => {
  const isImage = file.type.startsWith('image/');

  return (
    <div
      data-testid="attachment-preview"
      className="p-3 bg-white border border-gray-200 rounded-xl shadow-xs flex items-center justify-between gap-3 mb-2"
    >
      <div className="flex items-center gap-3 min-w-0">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="w-14 h-14 object-cover rounded-lg border border-gray-200 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-google-blue-subtle text-google-blue flex items-center justify-center shrink-0 border border-google-blue/20">
            <FileText className="w-7 h-7" />
          </div>
        )}

        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-900 truncate max-w-xs sm:max-w-md">
            {file.name}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {formatFileSize(file.size)}
          </p>
          {isUploading && (
            <p className="text-[11px] text-google-blue font-medium flex items-center gap-1 mt-0.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Uploading...
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onSend && !isUploading && (
          <button
            type="button"
            onClick={onSend}
            className="p-2 rounded-lg bg-google-blue hover:bg-google-blue-hover text-white transition cursor-pointer"
            title="Send attachment"
            aria-label="Send attachment"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition cursor-pointer disabled:opacity-50"
          title="Cancel attachment"
          aria-label="Cancel attachment"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
