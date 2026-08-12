import PDFDocument from 'pdfkit';

const BRAND_COLOR = '#059669';
const HEADER_TEXT_COLOR = '#ffffff';
const ROW_STRIPE_COLOR = '#f3f4f6';
const BORDER_COLOR = '#e5e7eb';
const TEXT_COLOR = '#1f2937';
const MUTED_TEXT_COLOR = '#6b7280';

const PAGE_MARGIN = 30;
const TITLE_BAR_HEIGHT = 36;
const HEADER_ROW_HEIGHT = 32;
const ROW_HEIGHT = 20;
const FONT_SIZE = 9;
const HEADER_FONT_SIZE = 7.5;

function humanize(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Renders a styled landscape A4 PDF: a colored title bar, a colored header row, zebra-striped data rows, and grid lines — repeats the header on every page. */
export function toPdfBuffer(title: string, rows: Record<string, unknown>[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - PAGE_MARGIN * 2;

    function drawTitleBar() {
      doc.rect(PAGE_MARGIN, PAGE_MARGIN, pageWidth, TITLE_BAR_HEIGHT).fill(BRAND_COLOR);
      doc
        .fillColor(HEADER_TEXT_COLOR)
        .font('Helvetica-Bold')
        .fontSize(15)
        .text(humanize(title), PAGE_MARGIN + 12, PAGE_MARGIN + 10, { width: pageWidth - 220, lineBreak: false });
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(new Date().toLocaleString(), PAGE_MARGIN, PAGE_MARGIN + 13, {
          width: pageWidth - 12,
          align: 'right',
          lineBreak: false,
        });
    }

    drawTitleBar();
    let y = PAGE_MARGIN + TITLE_BAR_HEIGHT + 16;

    if (rows.length === 0) {
      doc.fillColor(TEXT_COLOR).font('Helvetica').fontSize(11).text('No data available.', PAGE_MARGIN, y);
      doc.end();
      return;
    }

    const headers = Object.keys(rows[0]);
    const colWidth = pageWidth / headers.length;

    function drawHeaderRow(yPos: number) {
      doc.rect(PAGE_MARGIN, yPos, pageWidth, HEADER_ROW_HEIGHT).fill(BRAND_COLOR);
      doc.fillColor(HEADER_TEXT_COLOR).font('Helvetica-Bold').fontSize(HEADER_FONT_SIZE);
      headers.forEach((header, i) => {
        // Headers wrap onto up to two lines instead of truncating — reports with many
        // columns (e.g. the Daily Sales Report) would otherwise be unreadable ("Calls…").
        doc.text(humanize(header), PAGE_MARGIN + i * colWidth + 4, yPos + 6, {
          width: colWidth - 8,
          height: HEADER_ROW_HEIGHT - 8,
          ellipsis: true,
        });
      });
    }

    drawHeaderRow(y);
    y += HEADER_ROW_HEIGHT;

    rows.forEach((row, index) => {
      if (y + ROW_HEIGHT > doc.page.height - PAGE_MARGIN) {
        doc.addPage();
        y = PAGE_MARGIN;
        drawHeaderRow(y);
        y += HEADER_ROW_HEIGHT;
      }

      if (index % 2 === 1) {
        doc.rect(PAGE_MARGIN, y, pageWidth, ROW_HEIGHT).fill(ROW_STRIPE_COLOR);
      }

      doc.fillColor(TEXT_COLOR).font('Helvetica').fontSize(FONT_SIZE);
      headers.forEach((header, i) => {
        doc.text(formatCell(row[header]), PAGE_MARGIN + i * colWidth + 4, y + 5, {
          width: colWidth - 8,
          height: ROW_HEIGHT - 4,
          ellipsis: true,
          lineBreak: false,
        });
      });

      doc
        .moveTo(PAGE_MARGIN, y + ROW_HEIGHT)
        .lineTo(PAGE_MARGIN + pageWidth, y + ROW_HEIGHT)
        .strokeColor(BORDER_COLOR)
        .lineWidth(0.5)
        .stroke();

      y += ROW_HEIGHT;
    });

    doc
      .fillColor(MUTED_TEXT_COLOR)
      .font('Helvetica')
      .fontSize(8)
      .text(`${rows.length} row${rows.length === 1 ? '' : 's'}`, PAGE_MARGIN, doc.page.height - PAGE_MARGIN + 8, {
        width: pageWidth,
      });

    doc.end();
  });
}
