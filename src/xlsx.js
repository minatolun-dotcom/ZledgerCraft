// ZledgerCraft - minimal dependency-free XLSX reader.
// Reads the first worksheet, or a sheet named Ledgers/Vouchers, into rows of text.
// It supports stored and deflated ZIP entries, shared/inline strings, cached
// numeric/formula values and date-styled cells. It does not read formulas,
// charts, merged cells, hidden-sheet semantics or old binary .xls files.

const MAX_WORKBOOK_BYTES = 50 * 1024 * 1024;
const MAX_ENTRY_BYTES = 25 * 1024 * 1024;

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
  const output = await new Response(stream).arrayBuffer();
  return new Uint8Array(output);
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
  for (const letter of letters.toUpperCase()) value = value * 26 + (letter.charCodeAt(0) - 64);
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
  for (const row of String(xml).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row\s*>/gi)) {
    const cells = [];
    let nextColumn = 0;
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c\s*>)/gi)) {
      const reference = attrValue(cell[1], 'r');
      const column = reference ? columnIndex(reference) : nextColumn;
      nextColumn = column + 1;
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
