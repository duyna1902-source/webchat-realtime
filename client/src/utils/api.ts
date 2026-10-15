export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath;
}

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '/';

// When deployed cross-domain (e.g. Vercel frontend + Render backend),
// automatically prefix relative /api/ and /uploads/ requests with backend URL.
if (typeof window !== 'undefined' && API_BASE_URL) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string') {
      if (input.startsWith('/api/') || input.startsWith('/uploads/')) {
        input = `${API_BASE_URL}${input}`;
      }
    }
    return originalFetch(input, init);
  };
}
