import React, { useEffect } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
import { safeUrl } from '../../utils/safeUrl';
import { ATTACHMENT_UNAVAILABLE_TEXT } from './MessageItemContent';

interface ImageLightboxModalProps {
  imageUrl: string;
  imageName?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  imageUrl,
  imageName,
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const safeImageUrl = safeUrl(imageUrl);

  return (
    <div
      data-testid="image-lightbox-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90dvh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
          {safeImageUrl && (
            <a
              href={safeImageUrl}
              download={imageName || 'image'}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition cursor-pointer"
              title="Download full image"
              aria-label="Download full image"
            >
              <Download className="w-5 h-5" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition cursor-pointer"
            title="Close lightbox"
            aria-label="Close lightbox"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Full Image */}
        {safeImageUrl ? (
          <img
            src={safeImageUrl}
            alt={imageName || 'Full size view'}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <div
            data-testid="attachment-unavailable"
            className="flex flex-col items-center justify-center gap-3 px-10 py-16 rounded-lg bg-black/60 text-white/90"
          >
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-semibold">{ATTACHMENT_UNAVAILABLE_TEXT}</p>
          </div>
        )}

        {imageName && (
          <p className="mt-2 text-xs text-white/80 font-medium truncate max-w-md">
            {imageName}
          </p>
        )}
      </div>
    </div>
  );
};
