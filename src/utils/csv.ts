type CsvCell = string | number | null | undefined;

/**
 * One cell shape for every CSV this app hands out. A value holding a comma, a quote or a newline
 * has to be wrapped and its quotes doubled, or the row lands in the wrong columns of whatever opens
 * it; a value the server left null is an empty cell, not the word `null`.
 *
 * Rows join with CRLF because that is what RFC 4180 describes and what a spreadsheet expects. The
 * page that shows the same row can format it however it likes -- a money column written here has to
 * stay the flat two-decimal text, because `1,234.00` reads back as `1`.
 */
function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/**
 * Save a file the way the operator's spreadsheet opens it: a UTF-8 BOM first, because Excel reads a
 * bare UTF-8 csv in its own legacy codepage and every Chinese header arrives as mojibake.
 */
export function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
