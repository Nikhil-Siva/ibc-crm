/**
 * Client-side CSV export.
 *
 * Replaces the `xlsx` package, which carried known advisories and added ~429 kB
 * (gzipped: 143 kB) to the bundle purely to write export files. Exports are now
 * .csv rather than .xlsx — Excel, Sheets and Numbers all open them natively.
 */

/**
 * Escape a single CSV field.
 *
 * The leading apostrophe on =, +, -, @ is deliberate: without it, a lead whose
 * name is `=HYPERLINK(...)` becomes a live formula when the export is opened
 * in Excel (CSV injection). The value stays readable; it just isn't executable.
 */
const escapeField = (value) => {
  if (value === null || value === undefined) return '';

  let str = String(value);

  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};

/**
 * Build a CSV string from an array of plain objects.
 * Columns follow the union of keys, in first-seen order.
 */
export const toCsv = (records) => {
  if (!records || records.length === 0) return '';

  const headers = [...new Set(records.flatMap((r) => Object.keys(r)))];
  const lines = [headers.map(escapeField).join(',')];

  for (const record of records) {
    lines.push(headers.map((h) => escapeField(record[h])).join(','));
  }

  return lines.join('\r\n');
};

/**
 * Trigger a browser download of `records` as a .csv file.
 * `filename` may omit the extension.
 */
export const downloadCsv = (records, filename) => {
  const csv = toCsv(records);
  // BOM so Excel reads UTF-8 (₹, names with accents) rather than mojibake.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
