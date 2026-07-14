const crypto = require('crypto');

/**
 * Field-level encryption at rest.
 *
 * Used for values that are sensitive even to someone holding a database dump:
 * provider API credentials, and the PAN/Aadhaar identifiers on Customer. Under
 * India's DPDP Act these identifiers are exactly the kind of data that should
 * not sit in plaintext in a table.
 *
 * AES-256-GCM: authenticated, so a tampered ciphertext fails to decrypt rather
 * than silently returning garbage.
 *
 * Format: enc:v1:<iv-b64>:<tag-b64>:<ciphertext-b64>
 * The version prefix lets the key be rotated later without guessing at what
 * any given row was encrypted with.
 */

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce, the GCM standard

let cachedKey;

/**
 * Derive the 32-byte key from ENCRYPTION_KEY.
 *
 * Accepts a 64-char hex string (preferred) or any passphrase, which is then
 * stretched with scrypt. Throws when unset — silently falling back to plaintext
 * would defeat the entire point.
 */
const getKey = () => {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (/^[0-9a-f]{64}$/i.test(raw)) {
    cachedKey = Buffer.from(raw, 'hex');
  } else {
    // Fixed salt: the key must derive identically on every process/host, and
    // the passphrase itself is the secret.
    cachedKey = crypto.scryptSync(raw, 'insurance-crm-field-encryption', 32);
  }

  return cachedKey;
};

const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

/** Encrypt a string. Null/undefined/'' pass through untouched. */
const encrypt = (plaintext) => {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;
  // Never double-encrypt on re-save.
  if (isEncrypted(plaintext)) return plaintext;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
};

/**
 * Decrypt a value produced by encrypt(). Values that aren't encrypted are
 * returned as-is, so rows written before this shipped keep reading correctly.
 */
const decrypt = (value) => {
  if (!isEncrypted(value)) return value;

  try {
    const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch (error) {
    // Wrong key or tampered data. Surfacing null beats returning corrupt text.
    console.error('[encryption] Failed to decrypt a field:', error.message);
    return null;
  }
};

/**
 * Sequelize getter/setter pair for an encrypted column.
 * Usage: api_key: { type: DataTypes.TEXT, ...encryptedField('api_key') }
 */
const encryptedField = (columnName) => ({
  set(value) {
    this.setDataValue(columnName, encrypt(value));
  },
  get() {
    return decrypt(this.getDataValue(columnName));
  },
});

/** Mask a decrypted secret for display: sk_live_abc123 -> ****c123 */
const mask = (value, visible = 4) => {
  if (!value) return null;
  const str = String(value);
  return str.length <= visible ? '****' : `****${str.slice(-visible)}`;
};

module.exports = { encrypt, decrypt, isEncrypted, encryptedField, mask };
