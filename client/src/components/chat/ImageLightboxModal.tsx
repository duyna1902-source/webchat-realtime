import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

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
          <a
            href={imageUrl}
            download={imageName || 'image'}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition cursor-pointer"
            title="Download full image"
            aria-label="Download full image"
          >
            <Download className="w-5 h-5" />
          </a>
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
        <img
          src={imageUrl}
          alt={imageName || 'Full size view'}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />

        {imageName && (
          <p className="mt-2 text-xs text-white/80 font-medium truncate max-w-md">
            {imageName}
          </p>
        )}
      </div>
    </div>
  );
};
