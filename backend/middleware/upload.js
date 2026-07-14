const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // originalname is attacker-controlled and may contain path separators —
    // keep only the extension and generate the rest.
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

// File filter – allow only specific types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();

  // The extension is authoritative — it decides what lands on disk and how
  // /uploads later serves it. The old check passed on mimetype OR extension,
  // so a spoofed 'image/png' header smuggled through any extension at all.
  // Browsers mislabel .docx/.xlsx as octet-stream, so tolerate that one.
  const typeOk = allowedTypes.includes(file.mimetype) || file.mimetype === 'application/octet-stream';

  if (allowedExtensions.includes(ext) && typeOk) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, JPEG, PNG, DOC, and DOCX files are allowed.'), false);
  }
};

// Configured multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

module.exports = upload;
