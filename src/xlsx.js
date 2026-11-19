// ZledgerCraft - minimal dependency-free XLSX reader.
// Reads the first worksheet, or a sheet named Ledgers/Vouchers, into rows of text.
// It supports stored and deflated ZIP entries, shared/inline strings, cached
// numeric/formula values and date-styled cells. It does not read formulas,
// charts, merged cells, hidden-sheet semantics or old binary .xls files.

const MAX_WORKBOOK_BYTES = 50 * 1024 * 1024;
const MAX_ENTRY_BYTES = 25 * 1024 * 1024;
const MAX_COLUMNS = 16_384;
const MAX_ROWS = 1_048_576;
const MAX_CELLS = 5_000_000;

const BUILTIN_DATE_FORMATS = new Set([
  14,
  15,
  16,
  17,
  22,
  ...Array.from({ length: 10 }, (_, index) => index + 27),
  ...Array.from({ length: 9 }, (_, index) => index + 50),
]);

function decodeXml(value) {
  return String(value ?? '').replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi,
    (match, hex, decimal, named) => {
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (decimal) return String.fromCodePoint(parseInt(decimal, 10));
      switch ((named || '').toLowerCase()) {
        case 'amp':
          return '&';
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'quot':
          return '"';
        case 'apos':
          return "'";
        default:
          return match;
      }
    },
  );
}

function attrValue(raw, name) {
  for (const match of String(raw).matchAll(/([:\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    if (match[1].toLowerCase() === name.toLowerCase()) return decodeXml(match[2] ?? match[3] ?? '');
  }
  return '';
}

function textValue(xml, tag) {
  const match = String(xml).match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}\\s*>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function normalizeZipPath(target) {
  let path = String(target ?? '').replace(/\\/g, '/').trim();
  if (!path) return '';
  if (path.startsWith('/')) path = path.slice(1);
  else path = `xl/${path}`;
  const parts = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot decompress Excel workbooks. Use the CSV import instead.');
  }
  let stream;
  try {
    stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  } catch {
    throw new Error('This browser cannot decompress Excel workbooks. Use the CSV import instead.');
  }
  try {
    const output = await new Response(stream).arrayBuffer();
    return new Uint8Array(output);
  } catch {
    throw new Error('The workbook has a damaged compressed entry.');
  }
}

/** Unpacks the small subset of ZIP needed by an XLSX workbook. */
async function unzipWorkbook(bytes) {
  if (bytes.length < 22) throw new Error('That file is not a valid .xlsx workbook.');
  if (bytes.length > MAX_WORKBOOK_BYTES) throw new Error('The workbook is larger than 50 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const stop = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= stop; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('That file is not a valid .xlsx workbook.');
  if (view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0) {
    throw new Error('Multi-volume Excel workbooks are not supported.');
  }
  const count = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || centralOffset === 0xffffffff) {
    throw new Error('ZIP64 Excel workbooks are not supported. Re-save the file as a standard .xlsx.');
  }

  const decoder = new TextDecoder();
  const files = new Map();
  let offset = centralOffset;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('The workbook ZIP directory is damaged.');
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (offset + 46 + nameLength + extraLength + commentLength > bytes.length) {
      throw new Error('The workbook ZIP directory is damaged.');
    }
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    if (flags & 0x1) throw new Error('Password-protected Excel workbooks are not supported.');
    if (method !== 0 && method !== 8) {
      throw new Error(`The workbook uses an unsupported ZIP compression method for ${name}.`);
    }
    if (compressedSize > MAX_ENTRY_BYTES || uncompressedSize > MAX_ENTRY_BYTES) {
      throw new Error('A workbook entry is larger than the 25 MB import limit.');
    }
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error('The workbook ZIP entry is damaged.');
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > bytes.length) {
      throw new Error('The workbook ZIP entry is truncated.');
    }
    const localName = decoder.decode(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength));
    if (localName !== name) throw new Error('The workbook ZIP directory is inconsistent.');
    if (files.has(name)) throw new Error(`The workbook contains a duplicate ZIP entry for ${name}.`);
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : await inflateRaw(compressed);
    total += data.length;
    if (total > MAX_WORKBOOK_BYTES) throw new Error('The unpacked workbook is larger than 50 MB.');
    files.set(name, data);
  }
  return files;
}

function readSharedStrings(xml) {
  if (!xml) return [];
  const strings = [];
  for (const match of String(xml).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si\s*>/gi)) {
    const parts = [];
    for (const text of match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t\s*>/gi)) {
      parts.push(decodeXml(text[1]));
    }
    strings.push(parts.join(''));
  }
  return strings;
}

function isDateFormat(code) {
  const cleaned = String(code ?? '')
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '');
  return /[ymd]/i.test(cleaned);
}

function readStyles(xml) {
  const dateStyles = new Set();
  if (!xml) return dateStyles;
  const customDates = new Set();
  for (const match of String(xml).matchAll(/<numFmt\b([^>]*)\/?>/gi)) {
    if (isDateFormat(attrValue(match[1], 'formatCode'))) {
      customDates.add(attrValue(match[1], 'numFmtId'));
    }
  }
  const cellXfs = String(xml).match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs\s*>/i);
  if (!cellXfs) return dateStyles;
  let index = 0;
  for (const match of cellXfs[1].matchAll(/<xf\b([^>]*)\/?>/gi)) {
    const formatId = attrValue(match[1], 'numFmtId');
    if (BUILTIN_DATE_FORMATS.has(Number(formatId)) || customDates.has(formatId)) {
      dateStyles.add(index);
    }
    index += 1;
  }
  return dateStyles;
}

function columnIndex(reference) {
  const letters = String(reference ?? '').match(/^[A-Z]+/i)?.[0];
  if (!letters) return 0;
  let value = 0;
  for (const letter of letters.toUpperCase()) {
    value = value * 26 + (letter.charCodeAt(0) - 64);
    if (value > MAX_COLUMNS) return -1;
  }
  return Math.max(0, value - 1);
}

function excelDate(serial) {
  const value = Number(serial);
  if (!Number.isFinite(value) || value < 1 || value > 2958465) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function readCell(attrs, body, sharedStrings, dateStyles) {
  const type = attrValue(attrs, 't');
  let value = textValue(body, 'v');
  if (type === 'inlineStr') {
    const inline = body.match(/<is\b[^>]*>([\s\S]*?)<\/is\s*>/i);
    if (!inline) return '';
    return [...inline[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t\s*>/gi)]
      .map((entry) => decodeXml(entry[1]))
      .join('');
  }
  if (type === 's') {
    const index = Number(value);
    return Number.isInteger(index) && index >= 0 ? sharedStrings[index] ?? '' : '';
  }
  if (type === 'b') return value === '1' ? 'TRUE' : value === '0' ? 'FALSE' : value;
  if (type === 'e' || type === 'str' || type === 'd') return value;
  if (value === '') return '';
  const style = Number(attrValue(attrs, 's'));
  if (dateStyles.has(style)) {
    const date = excelDate(value);
    if (date) return date;
  }
  return value;
}

function readSheet(xml, sharedStrings, dateStyles) {
  const rows = [];
  let cellCount = 0;
  for (const row of String(xml).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row\s*>/gi)) {
    if (rows.length >= MAX_ROWS) throw new Error('The worksheet has more than 1,048,576 rows.');
    const cells = [];
    let nextColumn = 0;
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c\s*>)/gi)) {
      const reference = attrValue(cell[1], 'r');
      const column = reference ? columnIndex(reference) : nextColumn;
      if (column < 0 || column >= MAX_COLUMNS) {
        throw new Error('The worksheet has a cell outside Excel\'s 16,384-column limit.');
      }
      nextColumn = column + 1;
      cellCount += 1;
      if (cellCount > MAX_CELLS) throw new Error('The worksheet has more than 5 million cells.');
      cells[column] = readCell(cell[1], cell[2] ?? '', sharedStrings, dateStyles);
    }
    while (cells.length && String(cells[cells.length - 1] ?? '').trim() === '') cells.pop();
    if (cells.some((cell) => String(cell ?? '').trim() !== '')) rows.push(cells);
  }
  return rows;
}

function readSheets(workbookXml, relationshipsXml, files) {
  const relationships = new Map();
  for (const match of String(relationshipsXml ?? '').matchAll(/<Relationship\b([^>]*)\/?>/gi)) {
    const id = attrValue(match[1], 'Id');
    const target = attrValue(match[1], 'Target');
    if (id && target) relationships.set(id, normalizeZipPath(target));
  }
  const sheets = [];
  for (const match of String(workbookXml).matchAll(/<sheet\b([^>]*)\/?>/gi)) {
    const name = attrValue(match[1], 'name') || `Sheet ${sheets.length + 1}`;
    const relationId = attrValue(match[1], 'r:id') || attrValue(match[1], 'id');
    let path = '';
    if (relationId && relationships.has(relationId)) {
      path = relationships.get(relationId);
      // Chart sheets and external targets have no worksheet XML file.
      if (!path || !files.has(path)) continue;
    } else {
      const fallback = `xl/worksheets/sheet${sheets.length + 1}.xml`;
      if (!files.has(fallback)) continue;
      path = fallback;
    }
    sheets.push({ name, path });
  }
  return sheets;
}

/**
 * Reads an .xlsx ArrayBuffer into `{ sheets: [{ name, rows }] }`.
 * Throws a user-facing Error for damaged, encrypted or unsupported workbooks.
 */
export async function parseXlsxWorkbook(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const files = await unzipWorkbook(bytes);
  const decoder = new TextDecoder();
  const workbookXml = files.get('xl/workbook.xml');
  if (!workbookXml) throw new Error('That workbook has no xl/workbook.xml and cannot be read.');
  const workbookText = decoder.decode(workbookXml);
  const relationships = files.get('xl/_rels/workbook.xml.rels');
  const sheets = readSheets(workbookText, relationships ? decoder.decode(relationships) : '', files);
  if (!sheets.length) throw new Error('The workbook has no readable worksheets.');
  const sharedStrings = readSharedStrings(
    files.has('xl/sharedStrings.xml') ? decoder.decode(files.get('xl/sharedStrings.xml')) : '',
  );
  const dateStyles = readStyles(files.has('xl/styles.xml') ? decoder.decode(files.get('xl/styles.xml')) : '');
  const parsed = [];
  for (const sheet of sheets) {
    const xml = decoder.decode(files.get(sheet.path));
    parsed.push({ name: sheet.name, rows: readSheet(xml, sharedStrings, dateStyles) });
  }
  return { sheets: parsed };
}

/** Find a preferred sheet by exact name, then prefix, then the first sheet. */
export function pickSheet(workbook, preferredName) {
  const sheets = workbook?.sheets ?? [];
  if (!sheets.length) return null;
  const target = String(preferredName ?? '').trim().toLowerCase();
  if (target) {
    const exact = sheets.find((sheet) => sheet.name.toLowerCase() === target);
    if (exact) return exact;
    const prefix = sheets.find((sheet) => sheet.name.toLowerCase().startsWith(target));
    if (prefix) return prefix;
  }
  return sheets[0];
}

/** Converts worksheet rows to the CSV text accepted by the existing importers. */
export function rowsToCsv(rows) {
  return (rows ?? [])
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? '');
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(','),
    )
    .join('\n');
}

function xmlEscape(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index) {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function sheetXml(rows) {
  const body = (rows ?? [])
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          if (value === null || value === undefined || value === '') return '';
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
          if (typeof value === 'number' && Number.isFinite(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          const text = String(value).slice(0, 32767);
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function sheetName(name, index, used) {
  let base = String(name ?? '').replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || `Sheet${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const tail = ` (${suffix})`;
    candidate = `${base.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

let crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[index] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function zipStore(entries) {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    const directory = new Uint8Array(46 + name.length);
    const directoryView = new DataView(directory.buffer);
    directoryView.setUint32(0, 0x02014b50, true);
    directoryView.setUint16(4, 20, true);
    directoryView.setUint16(6, 20, true);
    directoryView.setUint16(8, 0x0800, true);
    directoryView.setUint16(12, dosTime, true);
    directoryView.setUint16(14, dosDate, true);
    directoryView.setUint32(16, crc, true);
    directoryView.setUint32(20, data.length, true);
    directoryView.setUint32(24, data.length, true);
    directoryView.setUint16(28, name.length, true);
    directoryView.setUint32(42, offset, true);
    directory.set(name, 46);
    central.push(directory);
    offset += local.length;
  }
  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, directorySize, true);
  endView.setUint32(16, offset, true);
  return concatBytes([...locals, ...central, end]);
}

/**
 * Builds a small dependency-free .xlsx workbook from `[{ name, rows }]`.
 * Values become numbers when numeric and inline strings otherwise; no styles,
 * formulas, charts or merged cells are written.
 */
export function buildXlsx(sheets) {
  const source = Array.isArray(sheets) && sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }];
  const used = new Set();
  const named = source.map((sheet, index) => ({
    name: sheetName(sheet.name, index, used),
    rows: Array.isArray(sheet.rows) ? sheet.rows : [],
  }));
  const worksheetOverrides = named
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('');
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${named
    .map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('')}</sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${named
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('')}</Relationships>`;
  const entries = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${worksheetOverrides}</Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    ...named.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheetXml(sheet.rows) })),
  ];
  return zipStore(entries);
}

/** Read an .xlsx file into reviewed CSV text for one of the existing importers. */
export async function xlsxToCsv(buffer, preferredName) {
  const workbook = await parseXlsxWorkbook(buffer);
  const sheet = pickSheet(workbook, preferredName);
  if (!sheet) throw new Error('The workbook has no readable worksheets.');
  return {
    csv: rowsToCsv(sheet.rows),
    sheetName: sheet.name,
    rows: Math.max(0, sheet.rows.length - 1),
  };
}
