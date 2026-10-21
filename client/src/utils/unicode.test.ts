import { describe, it, expect } from 'vitest';
import { truncateUnicodeSafe } from './unicode';

describe('truncateUnicodeSafe', () => {
  it('returns original string if length is within maxLength', () => {
    expect(truncateUnicodeSafe('hello', 10)).toBe('hello');
    expect(truncateUnicodeSafe('hello', 5)).toBe('hello');
    expect(truncateUnicodeSafe('', 5)).toBe('');
  });

  it('returns empty string if maxLength <= 0', () => {
    expect(truncateUnicodeSafe('hello', 0)).toBe('');
    expect(truncateUnicodeSafe('hello', -1)).toBe('');
  });

  it('truncates standard ASCII text at exact maxLength', () => {
    expect(truncateUnicodeSafe('hello world', 5)).toBe('hello');
  });

  it('does not split a surrogate pair emoji when cut falls on high surrogate', () => {
    // '😀' is \uD83D\uDE00 (length 2)
    // 'abc😀' has length 5: 'a'(0), 'b'(1), 'c'(2), '\uD83D'(3), '\uDE00'(4)
    const text = 'abc😀';
    expect(text.length).toBe(5);

    // If maxLength is 4, standard slice(0, 4) would be 'abc\uD83D', splitting the emoji.
    // truncateUnicodeSafe must back off by 1 and return 'abc' (length 3).
    const result = truncateUnicodeSafe(text, 4);
    expect(result).toBe('abc');
    expect(result.length).toBe(3);

    // If maxLength is 5, it includes the full emoji.
    expect(truncateUnicodeSafe(text, 5)).toBe('abc😀');
  });

  it('handles complex multi-codepoint emojis safely without splitting surrogate pairs', () => {
    // Family emoji: 👨‍👩‍👧‍👦
    // Composed of:
    // 👨 (\uD83D\uDC68, len 2)
    // \u200D (len 1)
    // 👩 (\uD83D\uDC69, len 2)
    // \u200D (len 1)
    // 👧 (\uD83D\uDC67, len 2)
    // \u200D (len 1)
    // 👦 (\uD83D\uDC66, len 2)
    // Total length = 11
    const family = '👨‍👩‍👧‍👦';
    expect(family.length).toBe(11);

    // Cutting at 1 (inside the first surrogate pair \uD83D\uDC68) backs off to 0
    expect(truncateUnicodeSafe(family, 1)).toBe('');

    // Cutting at 2 includes 👨 completely
    expect(truncateUnicodeSafe(family, 2)).toBe('👨');

    // Cutting at 3 includes 👨 + ZWJ
    expect(truncateUnicodeSafe(family, 3)).toBe('👨\u200D');

    // Cutting at 4 (inside 👩's surrogate pair \uD83D\uDC69) backs off to 3
    expect(truncateUnicodeSafe(family, 4)).toBe('👨\u200D');

    // Cutting at 5 includes 👨‍👩
    expect(truncateUnicodeSafe(family, 5)).toBe('👨‍👩');
  });

  it('preserves boundary with skin tone modifiers', () => {
    // 👍🏽 is 👍 (\uD83D\uDC4D, len 2) + 🏽 (\uD83C\uDFFD, len 2) = len 4
    const thumbsUpTone = '👍🏽';
    expect(thumbsUpTone.length).toBe(4);

    // Cutting at 1 backs off to 0
    expect(truncateUnicodeSafe(thumbsUpTone, 1)).toBe('');
    // Cutting at 2 includes 👍
    expect(truncateUnicodeSafe(thumbsUpTone, 2)).toBe('👍');
    // Cutting at 3 backs off to 2 (protecting skin tone surrogate pair)
    expect(truncateUnicodeSafe(thumbsUpTone, 3)).toBe('👍');
    // Cutting at 4 includes whole 👍🏽
    expect(truncateUnicodeSafe(thumbsUpTone, 4)).toBe('👍🏽');
  });
});
