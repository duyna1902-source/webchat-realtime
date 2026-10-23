export interface GoogleAvatarColor {
  name: 'blue' | 'red' | 'yellow' | 'green';
  bg: string;
  text: string;
  hex: string;
}

export const GOOGLE_AVATAR_COLORS: readonly GoogleAvatarColor[] = [
  {
    name: 'blue',
    bg: 'bg-google-blue',
    text: 'text-white',
    hex: '#4285F4',
  },
  {
    name: 'red',
    bg: 'bg-google-red',
    text: 'text-white',
    hex: '#EA4335',
  },
  {
    name: 'yellow',
    bg: 'bg-google-yellow',
    text: 'text-google-grey900',
    hex: '#FBBC04',
  },
  {
    name: 'green',
    bg: 'bg-google-green',
    text: 'text-white',
    hex: '#34A853',
  },
] as const;

/**
 * Deterministically maps an identifier (such as a username, user ID, or initials)
 * to one of the four canonical Google brand colors (Blue, Red, Yellow, Green).
 */
export function getDeterministicAvatarColor(identifier?: string | null): GoogleAvatarColor {
  if (!identifier || identifier.trim().length === 0) {
    return GOOGLE_AVATAR_COLORS[0];
  }

  const str = identifier.trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }

  const index = Math.abs(hash) % GOOGLE_AVATAR_COLORS.length;
  return GOOGLE_AVATAR_COLORS[index];
}

/**
 * Returns the combined background and text Tailwind CSS classes for the given identifier.
 */
export function getAvatarColorClass(identifier?: string | null): string {
  const color = getDeterministicAvatarColor(identifier);
  return `${color.bg} ${color.text}`;
}

const avatarIconUrls = new Map<string, string>();

/**
 * A Deterministic 4-Color Avatar as an image URL, for places that need one (the browser
 * Notification icon). It is a local `blob:` SVG, never a URL taken from a User, and is cached
 * per letter and color so repeated notifications create no new object URLs.
 */
export function getAvatarIconUrl(identifier?: string | null): string {
  const color = getDeterministicAvatarColor(identifier);
  const initial = (identifier?.trim().charAt(0) || '?').toUpperCase();
  const key = `${initial}:${color.name}`;
  const cached = avatarIconUrls.get(key);
  if (cached) return cached;

  const textColor = color.name === 'yellow' ? '#202124' : '#FFFFFF';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
    `<circle cx="48" cy="48" r="48" fill="${color.hex}"/>` +
    `<text x="48" y="48" dy=".35em" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="600" fill="${textColor}">${escapeXml(initial)}</text>` +
    '</svg>';
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  avatarIconUrls.set(key, url);
  return url;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}
