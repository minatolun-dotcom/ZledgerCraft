// ZledgerCraft - dependency-free branded PDF for the daily management summary.
// Uses the standard Helvetica fonts, so the output stays small and needs no
// native library in the Neon Function runtime.

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const TABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;
const COLUMNS = [145, 63, 63, 63, 63, 63, 63];
const BRAND = '0.122 0.435 0.361';
const INK = '0.09 0.125 0.165';
const MUTED = '0.365 0.427 0.494';
const RULE = '0.855 0.878 0.902';
const ZEBRA = '0.965 0.973 0.98';

function clean(value) {
  return String(value ?? '')
    .replace(/₹/g, 'INR ')
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

function escapePdf(value) {
  return clean(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function number(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function money(value) {
  return `INR ${number(value)}`;
}

function dateLabel(value) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return String(value || '');
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function textWidth(value, size) {
  let units = 0;
  for (const char of clean(value)) {
    if ('ilI.,:;!|'.includes(char)) units += 0.28;
    else if ('mwMW@'.includes(char)) units += 0.86;
    else if ('fjrt'.includes(char)) units += 0.36;
    else units += 0.54;
  }
  return units * size;
}

function fit(value, size, width) {
  const cleanValue = clean(value);
  if (textWidth(cleanValue, size) <= width) return cleanValue;
  let result = cleanValue;
  while (result.length > 1 && textWidth(`${result}...`, size) > width) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
}

export function buildReportPdf(report) {
  const pages = [];
  let operations = [];
  let top = 0;
  let pageNumber = 0;

  const text = (value, x, y, { size = 9, font = 'F1', color = INK, align = 'left', width = 0 } = {}) => {
    const label = fit(value, size, width || PAGE_WIDTH);
    const offset = align === 'right' ? width - textWidth(label, size) : align === 'center' ? (width - textWidth(label, size)) / 2 : 0;
    operations.push(
      `BT /${font} ${size} Tf ${color} rg ${(x + offset).toFixed(2)} ${(PAGE_HEIGHT - y).toFixed(2)} Td (${escapePdf(label)}) Tj ET`,
    );
  };
  const rect = (x, y, width, height, color) => {
    operations.push(`${color} rg ${x.toFixed(2)} ${(PAGE_HEIGHT - y - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  };
  const line = (x1, y1, x2, y2, color = RULE, width = 0.5) => {
    operations.push(
      `${color} RG ${width} w ${x1.toFixed(2)} ${(PAGE_HEIGHT - y1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_HEIGHT - y2).toFixed(2)} l S`,
    );
  };
  const header = () => {
    pageNumber += 1;
    const first = pageNumber === 1;
    rect(0, 0, PAGE_WIDTH, first ? 78 : 48, BRAND);
    text('ZledgerCraft', MARGIN, first ? 34 : 24, { size: first ? 22 : 13, font: 'F2', color: '1 1 1' });
    text(
      first ? 'Daily management summary' : `Daily management summary · page ${pageNumber}`,
      MARGIN,
      first ? 52 : 39,
      { size: first ? 10 : 8, color: '0.92 0.97 0.95' },
    );
    if (first) {
      text(dateLabel(report.generatedDate), MARGIN, 68, { size: 8.5, color: '0.92 0.97 0.95' });
    } else {
      text(dateLabel(report.generatedDate), PAGE_WIDTH - MARGIN - 130, 39, {
        size: 8,
        color: '0.92 0.97 0.95',
        align: 'right',
        width: 130,
      });
    }
    top = first ? 100 : 72;
  };
  const finishPage = () => {
    pages.push(operations);
    operations = [];
  };
  const newPage = () => {
    header();
  };
  const ensure = (space) => {
    if (top + space > PAGE_HEIGHT - 54) {
      finishPage();
      newPage();
    }
  };

  newPage();
  const cards = [
    ['Sales this month', money(report.totals.sales)],
    ['Purchases this month', money(report.totals.purchases)],
    ['Cash & bank', money(report.totals.cashBank)],
    ['Receivables', money(report.totals.receivables)],
    ['Payables', money(report.totals.payables)],
    ['Vouchers today', String(report.totals.vouchersToday)],
  ];
  const cardWidth = 168.3;
  const cardGap = 9;
  for (let index = 0; index < cards.length; index += 1) {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const x = MARGIN + column * (cardWidth + cardGap);
    const y = top + row * 54;
    rect(x, y, cardWidth, 44, '1 1 1');
    line(x, y, x + cardWidth, y);
    text(cards[index][0], x + 10, y + 15, { size: 7.2, color: MUTED });
    text(cards[index][1], x + 10, y + 32, { size: 10.5, font: 'F2' });
  }
  top += 118;
  text('Company position', MARGIN, top, { size: 12, font: 'F2' });
  top += 8;
  line(MARGIN, top, PAGE_WIDTH - MARGIN, top, BRAND, 1);
  top += 14;

  const tableHeader = () => {
    rect(MARGIN, top - 2, TABLE_WIDTH, 20, '0.93 0.96 0.95');
    const labels = ['Company', 'Sales MTD', 'Purchases', 'Cash & bank', 'Receivable', 'Payable', 'Trial balance'];
    let x = MARGIN;
    labels.forEach((label, index) => {
      text(label, x + 5, top + 12, {
        size: 6.8,
        font: 'F2',
        color: MUTED,
        align: index === 0 ? 'left' : 'right',
        width: COLUMNS[index] - 10,
      });
      x += COLUMNS[index];
    });
    top += 24;
  };
  tableHeader();

  if (!report.companies.length) {
    text('No companies are set up yet.', MARGIN + 5, top + 14, { size: 9, color: MUTED });
    top += 30;
  }

  report.companies.forEach((company, index) => {
    if (top + 30 > PAGE_HEIGHT - 54) {
      finishPage();
      newPage();
      tableHeader();
    }
    if (index % 2 === 1) rect(MARGIN, top - 4, TABLE_WIDTH, 26, ZEBRA);
    let x = MARGIN;
    text(company.name, x + 5, top + 9, { size: 8, font: 'F2', width: COLUMNS[0] - 10 });
    text(`As on ${dateLabel(company.asOn)}`, x + 5, top + 19, { size: 6.5, color: MUTED, width: COLUMNS[0] - 10 });
    x += COLUMNS[0];
    const values = [
      money(company.sales),
      money(company.purchases),
      money(company.cashBank),
      money(company.receivables),
      money(company.payables),
      company.balanced ? 'Tallies' : `Out by ${money(Math.abs(company.difference))}`,
    ];
    values.forEach((value, column) => {
      text(value, x + 5, top + 14, {
        size: column === 5 ? 6.6 : 7,
        align: 'right',
        width: COLUMNS[column + 1] - 10,
      });
      x += COLUMNS[column + 1];
    });
    top += 26;
    line(MARGIN, top, PAGE_WIDTH - MARGIN, top, RULE, 0.35);
  });

  ensure(34);
  rect(MARGIN, top - 3, TABLE_WIDTH, 22, '0.95 0.97 0.96');
  let x = MARGIN;
  text('Total', x + 5, top + 11, { size: 7.5, font: 'F2' });
  x += COLUMNS[0];
  const totals = [
    money(report.totals.sales),
    money(report.totals.purchases),
    money(report.totals.cashBank),
    money(report.totals.receivables),
    money(report.totals.payables),
    report.totals.unbalanced ? `${report.totals.unbalanced} unbalanced` : 'All tally',
  ];
  totals.forEach((value, column) => {
    text(value, x + 5, top + 11, {
      size: column === 5 ? 6.6 : 7.2,
      font: 'F2',
      align: 'right',
      width: COLUMNS[column + 1] - 10,
    });
    x += COLUMNS[column + 1];
  });
  top += 40;

  ensure(62);
  text('Latest backup', MARGIN, top, { size: 8, font: 'F2', color: MUTED });
  top += 12;
  text(
    report.backup
      ? `${report.backup.name} (${report.backup.createdAt || 'time unknown'})${report.backup.offsite ? ' - offsite copy available' : ''}`
      : 'No backup was created today.',
    MARGIN,
    top,
    { size: 8.5, width: TABLE_WIDTH },
  );
  top += 22;
  text('Open the signed read-only report from the email. This PDF is a management summary, not a statutory report or tax filing.', MARGIN, top, {
    size: 7.2,
    color: MUTED,
    width: TABLE_WIDTH,
  });
  finishPage();

  pages.forEach((page, index) => {
    page.push(
      `BT /F1 7 Tf ${MUTED} rg ${MARGIN} 22 Td (Management summary, not a statutory report.) Tj ET`,
    );
    page.push(
      `BT /F1 7 Tf ${MUTED} rg ${(PAGE_WIDTH - MARGIN - 70).toFixed(2)} 22 Td (Page ${index + 1} of ${pages.length}) Tj ET`,
    );
  });

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  const pageIds = pages.map((_, index) => 6 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  pages.forEach((page, index) => {
    const content = page.join('\n');
    const contentId = 5 + index * 2;
    const pageId = 6 + index * 2;
    objects[contentId] = `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
  });

  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let offset = chunks[0].length;
  const offsets = [0];
  const maxObject = 4 + pages.length * 2;
  for (let id = 1; id <= maxObject; id += 1) {
    const object = Buffer.from(`${id} 0 obj\n${objects[id]}\nendobj\n`, 'latin1');
    offsets[id] = offset;
    chunks.push(object);
    offset += object.length;
  }
  const xrefOffset = offset;
  let xref = `xref\n0 ${maxObject + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxObject; id += 1) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}
