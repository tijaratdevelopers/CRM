import ExcelJS from 'exceljs';

const BRAND_FILL = 'FF059669';
const STRIPE_FILL = 'FFF3F4F6';
const BORDER_ARGB = 'FFE5E7EB';
const THIN_BORDER = { style: 'thin' as const, color: { argb: BORDER_ARGB } };

function humanize(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatCellValue(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value;
}

/** Converts an array of flat row objects into a styled .xlsx workbook: colored header, zebra-striped rows, borders, auto-sized columns, frozen header, and an auto-filter. */
export async function toExcelBuffer(sheetName: string, rows: Record<string, unknown>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(humanize(sheetName).slice(0, 31) || 'Report');

  if (rows.length === 0) {
    sheet.getCell('A1').value = 'No data available.';
    sheet.getCell('A1').font = { italic: true, color: { argb: 'FF6B7280' } };
    const emptyBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(emptyBuffer);
  }

  const keys = Object.keys(rows[0]);
  sheet.columns = keys.map((key) => ({
    header: humanize(key),
    key,
    width: Math.min(40, Math.max(12, key.length + 2, ...rows.map((row) => String(row[key] ?? '').length + 2))),
  }));

  sheet.addRows(rows.map((row) => Object.fromEntries(keys.map((key) => [key, formatCellValue(row[key])]))));

  const headerRow = sheet.getRow(1);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_FILL } };
    cell.alignment = { vertical: 'middle' };
    cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE_FILL } };
      }
      cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
    });
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
