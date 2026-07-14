const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { cloudinary } = require('../config/cloudinary');

/**
 * File persistence, abstracted over two backends.
 *
 * Render's free tier (and most free PaaS tiers) has an ephemeral filesystem —
 * anything written to local disk is gone on the next restart or redeploy. This
 * module uploads to Cloudinary's free tier (25GB, no expiry) when configured,
 * and transparently falls back to local disk otherwise, so:
 *   - local dev and CI never need a Cloudinary account (CLOUDINARY_URL unset)
 *   - a VPS deployment can skip Cloudinary entirely (disk is already durable)
 *   - Render/other ephemeral-disk hosts just need one env var set
 *
 * Callers store the returned `location` string (a URL or a local path) and
 * pass it back to fetchBuffer()/remove() later — they don't need to know
 * which backend is in play.
 */

const isCloudConfigured = () => Boolean(process.env.CLOUDINARY_URL);

const LOCAL_ROOT = path.join(__dirname, '..', 'uploads');

const ensureLocalDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

/**
 * Persist a buffer. Returns { location, key }.
 *   location — where to read it back from (an https URL, or a local path)
 *   key      — what remove() needs (Cloudinary public_id, or the same path)
 */
const storeBuffer = async (buffer, { filename, folder = 'misc' } = {}) => {
  const ext = path.extname(filename || '').toLowerCase().slice(0, 10);

  if (isCloudConfigured()) {
    // public_id carries no original filename (which is attacker-controlled) —
    // only a generated name and the extension, same rule as the local path.
    const publicId = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'raw', // spreadsheets aren't images — 'raw' preserves bytes as-is
          folder: undefined, // already encoded in public_id
        },
        (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
      );
      stream.end(buffer);
    });
    return { location: result.secure_url, key: result.public_id };
  }

  const dir = path.join(LOCAL_ROOT, folder);
  ensureLocalDir(dir);
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  const fullPath = path.join(dir, name);
  fs.writeFileSync(fullPath, buffer);
  return { location: fullPath, key: fullPath };
};

/** Read a previously stored file back into a Buffer. */
const fetchBuffer = async (location) => {
  if (!location) throw new Error('No file location provided.');

  if (/^https?:\/\//i.test(location)) {
    const response = await axios.get(location, { responseType: 'arraybuffer', timeout: 15000 });
    return Buffer.from(response.data);
  }

  if (!fs.existsSync(location)) {
    throw new Error('Stored file not found on disk.');
  }
  return fs.readFileSync(location);
};

/**
 * Best-effort delete. Never throws — a cleanup failure shouldn't fail the
 * request it's cleaning up after.
 *
 * storeBuffer's local branch always returns an absolute filesystem path;
 * its cloud branch always returns a relative Cloudinary public_id (e.g.
 * "imports/171234-ab12"). That distinction is what tells the two apart here.
 */
const remove = async (key) => {
  if (!key) return;
  try {
    if (path.isAbsolute(key)) {
      if (fs.existsSync(key)) fs.unlinkSync(key);
    } else if (isCloudConfigured()) {
      await cloudinary.uploader.destroy(key, { resource_type: 'raw' });
    }
  } catch (error) {
    console.error('[fileStorage] Cleanup failed (non-fatal):', error.message);
  }
};

module.exports = { isCloudConfigured, storeBuffer, fetchBuffer, remove };
