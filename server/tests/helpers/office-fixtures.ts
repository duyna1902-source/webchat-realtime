import zlib from 'node:zlib';

/** Builds a ZIP archive with the given entries, stored without compression. */
export function buildZip(entries: Record<string, string | Buffer>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const fileName = Buffer.from(name);
    const crc = zlib.crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    locals.push(local, fileName, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(fileName.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, fileName);

    offset += local.length + fileName.length + data.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralDirectory, end]);
}

const CONTENT_TYPES = (mainPart: string, mainType: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/${mainPart}" ContentType="${mainType}"/>
</Types>`;

const ROOT_RELS = (mainPart: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${mainPart}"/>
</Relationships>`;

function buildOoxml(mainPart: string, mainType: string, mainXml: string): Buffer {
  return buildZip({
    '[Content_Types].xml': CONTENT_TYPES(mainPart, mainType),
    '_rels/.rels': ROOT_RELS(mainPart),
    [mainPart]: mainXml,
  });
}

/** A minimal Word document with one paragraph. */
export function buildDocx(): Buffer {
  return buildOoxml(
    'word/document.xml',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>'
  );
}

export function buildXlsx(): Buffer {
  return buildOoxml(
    'xl/workbook.xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>'
  );
}

export function buildPptx(): Buffer {
  return buildOoxml(
    'ppt/presentation.xml',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
    '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>'
  );
}

const SECTOR_SIZE = 512;
const END_OF_CHAIN = 0xfffffffe;
const FREE_SECTOR = 0xffffffff;
const FAT_SECTOR = 0xfffffffd;

function directoryEntry(name: string, type: number): Buffer {
  const entry = Buffer.alloc(128);
  entry.write(name, 0, 'utf16le');
  entry.writeUInt16LE((name.length + 1) * 2, 0x40);
  entry.writeUInt8(type, 0x42);
  entry.writeUInt32LE(FREE_SECTOR, 0x44); // left sibling
  entry.writeUInt32LE(FREE_SECTOR, 0x48); // right sibling
  entry.writeUInt32LE(FREE_SECTOR, 0x4c); // child
  entry.writeUInt32LE(END_OF_CHAIN, 0x74); // starting sector
  return entry;
}

/**
 * Builds a minimal OLE compound file (the legacy Office container) whose root holds one empty
 * stream, e.g. `WordDocument` for a .doc file.
 */
export function buildOleFile(streamName: string): Buffer {
  const header = Buffer.alloc(SECTOR_SIZE);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0);
  header.writeUInt16LE(0x3e, 0x18); // minor version
  header.writeUInt16LE(3, 0x1a); // major version: 512-byte sectors
  header.writeUInt16LE(0xfffe, 0x1c); // byte order
  header.writeUInt16LE(9, 0x1e); // sector shift
  header.writeUInt16LE(6, 0x20); // mini sector shift
  header.writeUInt32LE(1, 0x2c); // number of FAT sectors
  header.writeUInt32LE(1, 0x30); // first directory sector
  header.writeUInt32LE(4096, 0x38); // mini stream cutoff
  header.writeUInt32LE(END_OF_CHAIN, 0x3c); // first mini FAT sector
  header.writeUInt32LE(END_OF_CHAIN, 0x44); // first DIFAT sector
  for (let i = 0; i < 109; i++) {
    header.writeUInt32LE(i === 0 ? 0 : FREE_SECTOR, 0x4c + i * 4);
  }

  const fat = Buffer.alloc(SECTOR_SIZE, 0xff);
  fat.writeUInt32LE(FAT_SECTOR, 0); // sector 0 holds the FAT
  fat.writeUInt32LE(END_OF_CHAIN, 4); // sector 1 holds the directory

  const root = directoryEntry('Root Entry', 5);
  root.writeUInt32LE(1, 0x4c); // child: the stream
  const directory = Buffer.concat([root, directoryEntry(streamName, 2), Buffer.alloc(128), Buffer.alloc(128)]);

  return Buffer.concat([header, fat, directory]);
}
