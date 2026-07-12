import ExcelJS from 'exceljs';

/** Converts an array of flat row objects into an .xlsx workbook buffer (one sheet, bold header row). */
export async function toExcelBuffer(sheetName: string, rows: Record<string, unknown>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  sheet.columns = headers.map((key) => ({ header: key, key }));

  if (rows.length > 0) {
    sheet.addRows(rows);
  }

  sheet.getRow(1).font = { bold: true };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
