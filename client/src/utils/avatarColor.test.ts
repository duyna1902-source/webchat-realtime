import { describe, it, expect } from 'vitest';
import {
  getDeterministicAvatarColor,
  getAvatarColorClass,
  GOOGLE_AVATAR_COLORS,
} from './avatarColor';

describe('Deterministic Avatar Color Utility (Ticket 04)', () => {
  it('defines the 4 canonical Google brand colors (Blue, Red, Yellow, Green)', () => {
    expect(GOOGLE_AVATAR_COLORS).toHaveLength(4);
    const names = GOOGLE_AVATAR_COLORS.map((c) => c.name);
    expect(names).toEqual(['blue', 'red', 'yellow', 'green']);

    const hexCodes = GOOGLE_AVATAR_COLORS.map((c) => c.hex);
    expect(hexCodes).toEqual(['#4285F4', '#EA4335', '#FBBC04', '#34A853']);

    const bgClasses = GOOGLE_AVATAR_COLORS.map((c) => c.bg);
    expect(bgClasses).toEqual([
      'bg-google-blue',
      'bg-google-red',
      'bg-google-yellow',
      'bg-google-green',
    ]);
  });

  it('deterministically returns the same color for the same input string', () => {
    const color1 = getDeterministicAvatarColor('Hoang Long');
    const color2 = getDeterministicAvatarColor('Hoang Long');
    expect(color1).toEqual(color2);

    const class1 = getAvatarColorClass('Hoang Long');
    const class2 = getAvatarColorClass('Hoang Long');
    expect(class1).toBe(class2);
  });

  it('cycles across different Google brand colors for different inputs', () => {
    const inputs = ['HL', 'MN', 'DK', 'PT', 'alice', 'bob', 'charlie', 'david'];
    const assignedColors = new Set(inputs.map((input) => getDeterministicAvatarColor(input).name));
    // Verify that across multiple inputs, multiple Google brand colors are used
    expect(assignedColors.size).toBeGreaterThanOrEqual(3);
  });

  it('returns valid Tailwind classes including high-contrast text typography', () => {
    const yellowColor = GOOGLE_AVATAR_COLORS.find((c) => c.name === 'yellow')!;
    expect(yellowColor.text).toBe('text-google-grey900');

    const blueColor = GOOGLE_AVATAR_COLORS.find((c) => c.name === 'blue')!;
    expect(blueColor.text).toBe('text-white');

    const colorClass = getAvatarColorClass('HL');
    expect(colorClass).toMatch(/^bg-google-(blue|red|yellow|green)\s+text-(white|google-grey900)$/);
  });

  it('handles null, undefined, and empty string without throwing', () => {
    const fallbackNull = getDeterministicAvatarColor(null);
    expect(fallbackNull).toBeDefined();
    expect(GOOGLE_AVATAR_COLORS).toContainEqual(fallbackNull);

    const fallbackUndefined = getDeterministicAvatarColor(undefined);
    expect(fallbackUndefined).toBeDefined();
    expect(GOOGLE_AVATAR_COLORS).toContainEqual(fallbackUndefined);

    const fallbackEmpty = getDeterministicAvatarColor('');
    expect(fallbackEmpty).toBeDefined();
    expect(GOOGLE_AVATAR_COLORS).toContainEqual(fallbackEmpty);
  });
});
