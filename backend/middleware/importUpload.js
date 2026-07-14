const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure imports directory exists
const importsDir = path.join(__dirname, '..', 'uploads', 'imports');
if (!fs.existsSync(importsDir)) {
  fs.mkdirSync(importsDir, { recursive: true });
}

// Disk storage for imported files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, importsDir);
  },
  filename: (req, file, cb) => {
    // originalname is attacker-controlled and may contain path separators —
    // keep only the extension and generate the rest.
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

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
    cb(new Error('Invalid file type. Only .xlsx and .csv files are allowed.'), false);
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
