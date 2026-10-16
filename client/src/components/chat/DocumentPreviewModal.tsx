import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Loader2, AlertCircle } from 'lucide-react';
import { formatFileSize } from '../../utils/format';

export interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  documentName?: string | null;
  documentSize?: number | null;
}

export function getDocType(filename?: string | null): 'pdf' | 'text' | 'binary' {
  if (!filename) return 'binary';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['txt', 'md', 'csv', 'json', 'xml'].includes(ext)) return 'text';
  return 'binary';
}

export function getFileExtension(filename?: string | null): string {
  if (!filename) return 'FILE';
  const parts = filename.split('.');
  if (parts.length > 1) return parts.pop()!.toUpperCase();
  return 'FILE';
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  documentUrl,
  documentName,
  documentSize,
}) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const docType = getDocType(documentName);
  const fileExt = getFileExtension(documentName);

  // Close on Escape key
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

  // Fetch text content if text document
  useEffect(() => {
    if (!isOpen || docType !== 'text' || !documentUrl) {
      setTextContent(null);
      setIsLoadingText(false);
      setErrorText(null);
      return;
    }

    let isMounted = true;
    setIsLoadingText(true);
    setErrorText(null);

    fetch(documentUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load document (${res.status})`);
        }
        return res.text();
      })
      .then((text) => {
        if (isMounted) {
          setTextContent(text);
          setIsLoadingText(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorText(err.message || 'Failed to load preview');
          setIsLoadingText(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, docType, documentUrl]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="document-preview-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-google-grey200 max-w-4xl w-full max-h-[90dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-google-grey200 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-google-blue-subtle text-google-blue flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-google-grey900 truncate max-w-xs sm:max-w-md md:max-w-lg">
                {documentName || 'Document Preview'}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-google-grey700 mt-0.5">
                <span className="font-semibold text-google-blue">{fileExt}</span>
                {documentSize && (
                  <>
                    <span>•</span>
                    <span>{formatFileSize(documentSize)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={documentUrl}
              download={documentName || 'document'}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full text-google-grey700 hover:text-google-blue hover:bg-google-grey100 transition cursor-pointer"
              title="Download file"
              aria-label="Download file"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-google-grey700 hover:text-google-grey900 hover:bg-google-grey100 transition cursor-pointer"
              title="Close document preview"
              aria-label="Close document preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto bg-google-grey50 flex flex-col items-center justify-center min-h-[350px]">
          {docType === 'pdf' && (
            <div className="w-full h-[70vh] min-h-[450px]">
              <iframe
                src={documentUrl}
                title={documentName || 'PDF Document'}
                data-testid="pdf-preview-frame"
                className="w-full h-full border-0 bg-white"
              />
            </div>
          )}

          {docType === 'text' && (
            <div className="w-full h-full p-4 flex flex-col">
              {isLoadingText && (
                <div className="flex flex-col items-center justify-center p-12 gap-3 m-auto">
                  <Loader2 className="w-8 h-8 animate-spin text-google-blue" />
                  <p className="text-xs text-google-grey700 font-medium">Loading document preview...</p>
                </div>
              )}

              {errorText && (
                <div className="flex flex-col items-center justify-center p-8 gap-3 text-center m-auto">
                  <AlertCircle className="w-8 h-8 text-google-red" />
                  <p className="text-sm font-semibold text-google-grey900">{errorText}</p>
                  <a
                    href={documentUrl}
                    download={documentName || 'document'}
                    className="mt-2 px-4 py-2 bg-google-blue hover:bg-google-blue-hover text-white rounded-xl text-xs font-semibold shadow-xs transition"
                  >
                    Download instead
                  </a>
                </div>
              )}

              {!isLoadingText && !errorText && (
                <pre
                  data-testid="text-preview-content"
                  className="w-full flex-1 overflow-auto font-mono text-xs text-google-grey900 bg-white p-4 rounded-xl border border-google-grey300 max-h-[70vh] whitespace-pre-wrap break-words leading-relaxed select-text"
                >
                  {textContent}
                </pre>
              )}
            </div>
          )}

          {docType === 'binary' && (
            <div
              data-testid="binary-preview-card"
              className="flex flex-col items-center justify-center p-8 sm:p-12 text-center gap-4 m-auto"
            >
              <div className="w-16 h-16 rounded-2xl bg-google-blue-subtle text-google-blue flex items-center justify-center shadow-xs">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-google-grey900 break-all max-w-md">
                  {documentName || 'Document'}
                </h4>
                <div className="flex items-center justify-center gap-2 mt-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-google-grey200 text-google-grey700 text-[11px] font-bold tracking-wide">
                    {fileExt}
                  </span>
                  {documentSize && (
                    <span className="text-xs text-google-grey700">
                      {formatFileSize(documentSize)}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-google-grey700 max-w-sm leading-relaxed">
                This file format cannot be viewed directly inside the browser. Download the file to view it on your device.
              </p>
              <a
                href={documentUrl}
                download={documentName || 'document'}
                className="mt-2 px-6 py-2.5 bg-google-blue hover:bg-google-blue-hover text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download to view</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
