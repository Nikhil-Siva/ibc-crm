const cloudinary = require('cloudinary').v2;

/**
 * The Cloudinary SDK auto-configures itself from CLOUDINARY_URL if that env
 * var is set (format: cloudinary://<api_key>:<api_secret>@<cloud_name>).
 * When it's unset — local dev, CI, or a VPS where uploads/ is already
 * durable — this module is required but never actually called; see
 * services/fileStorage.js's local-disk fallback.
 */

module.exports = { cloudinary };
