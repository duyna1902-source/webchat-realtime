import React, { useState, useEffect, useRef } from 'react';
import { GifItemDto } from '@webchat/shared';
import { useAuth } from '../../context/AuthContext';
import { Search, X, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface GifSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string) => void;
}

export const GifSearchModal: React.FC<GifSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectGif,
}) => {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch GIFs (either trending or search query)
  const fetchGifs = async (searchQuery: string) => {
    if (!token) return;

    try {
      setIsLoading(true);
      setError(null);

      const endpoint = searchQuery.trim()
        ? `/api/gifs/search?q=${encodeURIComponent(searchQuery.trim())}`
        : '/api/gifs/trending';

      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load GIFs from server');
      }

      const data: GifItemDto[] = await res.json();
      setGifs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching GIFs:', err);
      setError(err.message || 'Error fetching GIFs');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      fetchGifs('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    }
  }, [isOpen, token]);

  // Handle live search with debounce
  const handleQueryChange = (val: string) => {
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchGifs(val);
    }, 350);
  };

  const handleClearQuery = () => {
    setQuery('');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    fetchGifs('');
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="GIF Search"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90dvh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <header className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-google-blue-subtle text-google-blue flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 leading-tight">Search Animated GIFs</h3>
              <p className="text-[11px] text-gray-500">Pick an animated GIF to send directly</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
            title="Close modal"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Search Input Bar */}
        <div className="p-3 bg-gray-50 border-b border-gray-200">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search GIFs on Tenor/Giphy..."
              className="w-full bg-white border border-gray-300 focus:border-google-blue rounded-xl pl-9 pr-9 py-2 text-base sm:text-xs text-gray-900 placeholder-gray-400 outline-none transition shadow-xs"
            />
            {query && (
              <button
                type="button"
                onClick={handleClearQuery}
                className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* GIFs Grid Area */}
        <div className="flex-1 overflow-y-auto p-3 min-h-[300px]">
          {isLoading && gifs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-google-blue" />
              <p className="text-xs">Finding GIFs...</p>
            </div>
          ) : error && gifs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-rose-500 gap-2 text-center p-4">
              <AlertCircle className="w-6 h-6" />
              <p className="text-xs font-medium">{error}</p>
              <button
                onClick={() => fetchGifs(query)}
                className="px-3 py-1 bg-google-blue-subtle text-google-blue hover:bg-google-blue/10 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : gifs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-center p-4">
              <p className="text-sm font-medium text-gray-600">No GIFs found</p>
              <p className="text-xs text-gray-400 mt-1">Try searching for other keywords like "dance", "happy", or "cat"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => {
                    onSelectGif(gif.url);
                    onClose();
                  }}
                  title={gif.title}
                  className="group relative rounded-xl overflow-hidden aspect-video bg-gray-100 hover:ring-2 hover:ring-google-blue transition cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-google-blue"
                >
                  <img
                    src={gif.previewUrl || gif.url}
                    alt={gif.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-2">
                    <span className="text-[11px] text-white font-medium truncate drop-shadow">
                      {gif.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
          <span>Powered by Tenor / Giphy Media Service</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg font-medium transition cursor-pointer"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
};
