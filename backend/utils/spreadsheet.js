const { Readable } = require('stream');
const ExcelJS = require('exceljs');

/**
 * Spreadsheet reading/writing, backed by exceljs.
 *
 * Replaces the `xlsx` package, which carries known prototype-pollution and
 * ReDoS advisories and is not published to the public npm registry. That
 * mattered here specifically because contact import parses files uploaded by
 * users — untrusted input straight into the parser.
 *
 * TRADEOFF: exceljs cannot read legacy .xls (Excel 97-2003 BIFF); `xlsx` could.
 * .xls uploads are now rejected with a message telling the user to re-save as
 * .xlsx, rather than being silently mis-parsed.
 */

const SUPPORTED_EXTENSIONS = ['.xlsx', '.csv'];
const LEGACY_EXTENSIONS = ['.xls'];

class UnsupportedFormatError extends Error {}

/**
 * Normalise a cell into a plain string/number.
 * exceljs returns rich objects for formulas, hyperlinks and rich text.
 */
const cellToPrimitive = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object') {
    // Formula cells: prefer the computed result.
    if ('result' in value) return cellToPrimitive(value.result);
    // Rich text: concatenate the runs.
    if ('richText' in value) return value.richText.map((r) => r.text).join('');
    // Hyperlinks: the visible text is what a human meant.
    if ('text' in value) return value.text;
    if ('hyperlink' in value) return value.hyperlink;
    return String(value);
  }

  return value;
};

/**
 * Read a spreadsheet into an array-of-arrays (row 0 = headers), matching the
 * shape the old XLSX.utils.sheet_to_json(sheet, { header: 1 }) produced.
 *
 * Takes an in-memory Buffer, not a file path — contact-import files may live
 * on local disk (dev/VPS) or in cloud storage (see services/fileStorage.js),
 * and reading from a Buffer works identically either way with zero temp-file
 * handling. `ext` is required because a Buffer carries no filename.
 */
const readRows = async (buffer, ext) => {
  const normalizedExt = (ext || '').toLowerCase();

  if (LEGACY_EXTENSIONS.includes(normalizedExt)) {
    throw new UnsupportedFormatError(
      'Legacy .xls files are not supported. Please re-save the file as .xlsx or .csv and upload again.'
    );
  }

  if (!SUPPORTED_EXTENSIONS.includes(normalizedExt)) {
    throw new UnsupportedFormatError('Only .xlsx and .csv files are supported.');
  }

  const workbook = new ExcelJS.Workbook();

  if (normalizedExt === '.csv') {
    // csv.read wants a stream, not a Buffer.
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    // row.values is 1-indexed with a leading hole; drop it.
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    rows.push(values.map(cellToPrimitive));
  });

  return rows;
};

/**
 * Build a CSV buffer from an array of plain objects. Column order follows the
 * union of keys in insertion order.
 */
const toCsvBuffer = async (records, sheetName = 'Sheet1') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (!records || records.length === 0) {
    return workbook.csv.writeBuffer();
  }

  const headers = [...new Set(records.flatMap((r) => Object.keys(r)))];
  worksheet.addRow(headers);
  for (const record of records) {
    worksheet.addRow(headers.map((h) => record[h] ?? ''));
  }

  return workbook.csv.writeBuffer();
};

/** Build an .xlsx buffer from an array of plain objects. */
const toXlsxBuffer = async (records, sheetName = 'Sheet1') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (records && records.length > 0) {
    const headers = [...new Set(records.flatMap((r) => Object.keys(r)))];
    worksheet.addRow(headers);
    for (const record of records) {
      worksheet.addRow(headers.map((h) => record[h] ?? ''));
    }
    worksheet.getRow(1).font = { bold: true };
  }

  return workbook.xlsx.writeBuffer();
};

module.exports = {
  readRows,
  toCsvBuffer,
  toXlsxBuffer,
  UnsupportedFormatError,
  SUPPORTED_EXTENSIONS,
};
