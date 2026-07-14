const multer = require('multer');
const path = require('path');

/**
 * Memory storage: the controller decides where the bytes end up (Cloudinary
 * or local disk — see services/fileStorage.js), rather than multer writing
 * straight to a local path that may not survive a redeploy.
 */
const storage = multer.memoryStorage();

// File filter – allow only Excel and CSV
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/csv',
  ];

  // .xls is intentionally absent: the parser (exceljs) cannot read legacy BIFF
  // files, so accepting them would only fail later with a confusing error.
  const allowedExtensions = ['.csv', '.xlsx'];
  const ext = path.extname(file.originalname).toLowerCase();

  // The extension is authoritative. The old check passed on mimetype OR
  // extension, so a spoofed 'text/csv' header smuggled through any extension.
  // Browsers mislabel spreadsheets as octet-stream, so tolerate that one.
  const typeOk = allowedTypes.includes(file.mimetype) || file.mimetype === 'application/octet-stream';

  if (allowedExtensions.includes(ext) && typeOk) {
    cb(null, true);
  } else {
    // A fileFilter rejection isn't a MulterError (that's only for multer's own
    // internal errors), so the global handler's MulterError branch never
    // catches it — it fell through to the generic 500 branch even though this
    // is squarely a client error. statusCode is a generic convention the
    // global handler checks for any thrown error.
    const error = new Error('Invalid file type. Only .xlsx and .csv files are allowed.');
    error.statusCode = 400;
    cb(error, false);
  }
};

// Configured multer instance for spreadsheet imports
const importUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for large spreadsheets
  },
});

module.exports = importUpload;
