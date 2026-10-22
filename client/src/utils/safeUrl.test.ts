import { describe, it, expect } from 'vitest';
import { safeUrl } from './safeUrl';

describe('safeUrl() (cyber-upgradation Ticket 06, SEC-03)', () => {
  it('allows https: URLs', () => {
    expect(safeUrl('https://media.giphy.com/media/abc/giphy.gif')).toBe(
      'https://media.giphy.com/media/abc/giphy.gif'
    );
  });

  it('allows blob: URLs used for local previews', () => {
    expect(safeUrl('blob:http://localhost:3000/1b2c3d4e')).toBe('blob:http://localhost:3000/1b2c3d4e');
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    '  javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://evil.example.com/file.pdf',
    'file:///etc/passwd',
    '//evil.example.com/file.pdf',
    '/\\evil.example.com/file.pdf',
  ])('rejects %j', (url) => {
    expect(safeUrl(url, { allowRelative: true })).toBeNull();
  });

  it.each([null, undefined, '', '   '])('rejects empty value %j', (url) => {
    expect(safeUrl(url)).toBeNull();
  });

  it('accepts same-origin relative URLs when relative URLs are allowed (dev)', () => {
    expect(safeUrl('/uploads/report.pdf', { allowRelative: true })).toBe('/uploads/report.pdf');
  });

  it('rejects relative URLs when relative URLs are not allowed (production)', () => {
    expect(safeUrl('/uploads/report.pdf', { allowRelative: false })).toBeNull();
  });
});
