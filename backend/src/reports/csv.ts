/** Escapes a single CSV field: wraps in quotes if it contains a comma, quote, or newline. */
function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Converts an array of flat row objects into a CSV string (headers from the first row's keys). */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCsvField).join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvField(row[header])).join(','));
  }

  return lines.join('\r\n');
}
