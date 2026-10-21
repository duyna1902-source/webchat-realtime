/**
 * Safely truncates a string to at most maxLength UTF-16 code units,
 * ensuring that UTF-16 surrogate pairs are never split in half.
 *
 * If maxLength falls between a high surrogate (0xD800-0xDBFF) and
 * a low surrogate (0xDC00-0xDFFF), it backs off by 1 code unit so
 * an incomplete orphan surrogate is never generated.
 */
export function truncateUnicodeSafe(text: string, maxLength: number): string {
  if (maxLength <= 0) return '';
  if (text.length <= maxLength) return text;

  const prevCode = text.charCodeAt(maxLength - 1);
  const nextCode = text.charCodeAt(maxLength);

  // If prevCode is high surrogate and nextCode is low surrogate,
  // cutting at maxLength would split this pair.
  if (prevCode >= 0xd800 && prevCode <= 0xdbff && nextCode >= 0xdc00 && nextCode <= 0xdfff) {
    return text.slice(0, maxLength - 1);
  }

  return text.slice(0, maxLength);
}
