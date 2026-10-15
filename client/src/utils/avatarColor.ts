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
