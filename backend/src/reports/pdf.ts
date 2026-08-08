import PDFDocument from 'pdfkit';

const MAX_CELL_LENGTH = 25;

function truncate(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return str.length > MAX_CELL_LENGTH ? `${str.slice(0, MAX_CELL_LENGTH - 3)}...` : str;
}

/**
 * Renders a simple landscape A4 PDF: an 18pt title followed by a bold header
 * row and one text line per row. Not pixel-aligned columns — a functional
 * export, not a polished report.
 */
export function toPdfBuffer(title: string, rows: Record<string, unknown>[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text(title);
    doc.moveDown();

    if (rows.length === 0) {
      doc.fontSize(11).font('Helvetica').text('No data available.');
      doc.end();
      return;
    }

    const headers = Object.keys(rows[0]);

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(headers.map(truncate).join('  |  '));
    doc.moveDown(0.5);

    doc.font('Helvetica');
    for (const row of rows) {
      doc.text(headers.map((header) => truncate(row[header])).join('  |  '));
    }

    doc.end();
  });
}
