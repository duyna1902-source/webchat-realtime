/**
 * Detects the real type of an uploaded file from its bytes (magic numbers and inner structure).
 * The MIME type the client declared and the file name extension are never consulted.
 * Anything outside the attachment allowlist is reported as `null`.
 */

export type AttachmentKind = 'IMAGE' | 'DOCUMENT';

export interface DetectedFileType {
  kind: AttachmentKind;
  /** The `Content-Type` the file is stored and served with. */
  mimeType: string;
}

/** Text documents (TXT, CSV, MD, JSON) are always stored and served as plain text. */
export const PLAIN_TEXT_MIME_TYPE = 'text/plain; charset=utf-8';

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

/** Markup (`<html`, `<svg`, `<?xml`, `<?php`...), RTF and scripts, checked after leading whitespace. */
const REJECTED_TEXT_PREFIXES = ['<', '{\\rtf', '#!'];

/**
 * Valid UTF-8 without NUL bytes is accepted as plain text, except content a browser would sniff
 * as markup (HTML, SVG, XML, PHP), RTF and executable scripts (`#!`): those are rejected even
 * though they are text. Binary executables never get here, since they contain NUL bytes.
 */
function detectText(data: Buffer): DetectedFileType | null {
  if (data.includes(0)) return null;

  let text: string;
  try {
    text = utf8Decoder.decode(data);
  } catch {
    return null;
  }

  const start = text.replace(/^﻿/, '').trimStart();
  if (REJECTED_TEXT_PREFIXES.some((prefix) => start.startsWith(prefix))) return null;

  return { kind: 'DOCUMENT', mimeType: PLAIN_TEXT_MIME_TYPE };
}

function startsWith(data: Buffer, signature: readonly number[], offset = 0): boolean {
  if (data.length < offset + signature.length) return false;
  return signature.every((byte, i) => data[offset + i] === byte);
}

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

/** Formats recognised by a fixed signature at the start of the file. */
const SIGNATURES: readonly { test: (data: Buffer) => boolean; type: DetectedFileType }[] = [
  { test: (d) => startsWith(d, [0xff, 0xd8, 0xff]), type: { kind: 'IMAGE', mimeType: 'image/jpeg' } },
  {
    test: (d) => startsWith(d, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    type: { kind: 'IMAGE', mimeType: 'image/png' },
  },
  {
    test: (d) => startsWith(d, ascii('RIFF')) && startsWith(d, ascii('WEBP'), 8),
    type: { kind: 'IMAGE', mimeType: 'image/webp' },
  },
  {
    test: (d) => startsWith(d, ascii('GIF87a')) || startsWith(d, ascii('GIF89a')),
    type: { kind: 'IMAGE', mimeType: 'image/gif' },
  },
  { test: (d) => startsWith(d, ascii('%PDF-')), type: { kind: 'DOCUMENT', mimeType: 'application/pdf' } },
];

// ---------- OOXML (DOCX, XLSX, PPTX): a ZIP package with the parts of one Office application ----------

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_ENTRY = 0x02014b50;

const OOXML_MAIN_PARTS: readonly [string, string][] = [
  ['word/document.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['xl/workbook.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['ppt/presentation.xml', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
];

/** Names of the entries in a ZIP's central directory, or `null` if it is not a readable ZIP. */
function readZipEntryNames(data: Buffer): string[] | null {
  // The end-of-central-directory record is 22 bytes plus a comment of up to 65535 bytes.
  const lowest = Math.max(0, data.length - 22 - 0xffff);
  let end = -1;
  for (let i = data.length - 22; i >= lowest; i--) {
    if (data.readUInt32LE(i) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;

  const count = data.readUInt16LE(end + 10);
  let offset = data.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || data.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_ENTRY) return null;
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    if (offset + 46 + nameLength > end) return null;
    names.push(data.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

/**
 * A ZIP is only accepted as an Office document when it has the OOXML package structure:
 * `[Content_Types].xml` plus the main part of Word, Excel or PowerPoint. Macro-enabled
 * documents (with a `vbaProject.bin`) and any other ZIP are rejected.
 */
function detectOoxml(data: Buffer): DetectedFileType | null {
  const names = readZipEntryNames(data);
  if (!names || !names.includes('[Content_Types].xml')) return null;
  if (names.some((name) => name.toLowerCase().endsWith('vbaproject.bin'))) return null;

  const main = OOXML_MAIN_PARTS.find(([part]) => names.includes(part));
  return main ? { kind: 'DOCUMENT', mimeType: main[1] } : null;
}

// ---------- Legacy Office (DOC, XLS, PPT): an OLE compound file with the application's stream ----------

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const OLE_END_OF_CHAIN = 0xfffffffe;
const OLE_HEADER_DIFAT_ENTRIES = 109;
const OLE_STREAM = 2;

const OLE_MAIN_STREAMS: readonly [string, string][] = [
  ['WordDocument', 'application/msword'],
  ['Workbook', 'application/vnd.ms-excel'],
  ['Book', 'application/vnd.ms-excel'],
  ['PowerPoint Document', 'application/vnd.ms-powerpoint'],
];

/** Names of the streams in an OLE compound file's directory, or `null` if it cannot be read. */
function readOleStreamNames(data: Buffer): string[] | null {
  if (data.length < 512) return null;
  const sectorShift = data.readUInt16LE(0x1e);
  if (sectorShift !== 9 && sectorShift !== 12) return null;
  const sectorSize = 1 << sectorShift;
  const sectorCount = Math.floor(data.length / sectorSize) - 1;
  const sectorOffset = (sector: number) => (sector + 1) * sectorSize;
  const isSector = (sector: number) => sector < sectorCount;

  // The FAT sectors are listed in the header, then in a chain of DIFAT sectors.
  const fatSectors: number[] = [];
  for (let i = 0; i < OLE_HEADER_DIFAT_ENTRIES; i++) {
    const sector = data.readUInt32LE(0x4c + i * 4);
    if (isSector(sector)) fatSectors.push(sector);
  }
  let difatSector = data.readUInt32LE(0x44);
  for (let guard = 0; isSector(difatSector) && guard < sectorCount; guard++) {
    const base = sectorOffset(difatSector);
    const entries = sectorSize / 4 - 1;
    for (let i = 0; i < entries; i++) {
      const sector = data.readUInt32LE(base + i * 4);
      if (isSector(sector)) fatSectors.push(sector);
    }
    difatSector = data.readUInt32LE(base + entries * 4);
  }

  const nextSector = (sector: number): number => {
    const perSector = sectorSize / 4;
    const fatSector = fatSectors[Math.floor(sector / perSector)];
    if (fatSector === undefined) return OLE_END_OF_CHAIN;
    return data.readUInt32LE(sectorOffset(fatSector) + (sector % perSector) * 4);
  };

  const names: string[] = [];
  let sector = data.readUInt32LE(0x30);
  for (let guard = 0; sector !== OLE_END_OF_CHAIN; guard++) {
    if (!isSector(sector) || guard >= sectorCount) return null;
    const base = sectorOffset(sector);
    for (let entry = base; entry < base + sectorSize; entry += 128) {
      const nameLength = data.readUInt16LE(entry + 0x40);
      if (data[entry + 0x42] !== OLE_STREAM || nameLength < 2 || nameLength > 64) continue;
      names.push(data.toString('utf16le', entry, entry + nameLength - 2));
    }
    sector = nextSector(sector);
  }
  return names;
}

function detectOle(data: Buffer): DetectedFileType | null {
  const names = readOleStreamNames(data);
  if (!names) return null;
  const main = OLE_MAIN_STREAMS.find(([stream]) => names.includes(stream));
  return main ? { kind: 'DOCUMENT', mimeType: main[1] } : null;
}

export function detectFileType(data: Buffer): DetectedFileType | null {
  for (const { test, type } of SIGNATURES) {
    if (test(data)) return type;
  }
  if (startsWith(data, ZIP_SIGNATURE)) return detectOoxml(data);
  if (startsWith(data, OLE_SIGNATURE)) return detectOle(data);
  return detectText(data);
}
