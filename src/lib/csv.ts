// CSV that opens safely in Excel, Numbers and Google Sheets.

/**
 * One cell. Text that a spreadsheet would run as a formula (=, +, -, @, tab, CR at the start)
 * gets a leading apostrophe; numbers are written as they are.
 */
export function csvCell(v: string | number): string {
    if (typeof v === 'number') return String(v);
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
}

/** Rows to CSV text, CRLF line ends (the CSV standard, and what Excel expects) */
export function toCsv(rows: (string | number)[][]): string {
    return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
