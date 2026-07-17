const { Op } = require('sequelize');
const { sequelize } = require('../models');
const { ContactImportLog, Lead, User } = require('../models');
const { pick, LEAD_WRITABLE } = require('../utils/validation');
const path = require('path');
const { readRows, UnsupportedFormatError } = require('../utils/spreadsheet');
const fileStorage = require('../services/fileStorage');

// The client marks columns it does not want imported with this sentinel.
const SKIP_FIELD = '__skip__';

const uploadContacts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Memory storage (middleware/importUpload.js) — nothing is written to disk
    // until validation passes, so a rejected upload never leaves a stray file.
    const buffer = req.file.buffer;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();

    if (!['.xlsx', '.csv'].includes(ext)) {
      return res.status(400).json({
        success: false,
        message: ext === '.xls'
          ? 'Legacy .xls files are not supported. Please re-save as .xlsx or .csv.'
          : 'Only .xlsx and .csv files are supported',
      });
    }

    let jsonData;
    try {
      jsonData = await readRows(buffer, ext);
    } catch (parseError) {
      if (parseError instanceof UnsupportedFormatError) {
        return res.status(400).json({ success: false, message: parseError.message });
      }
      return res.status(400).json({ success: false, message: 'File could not be parsed as a spreadsheet.' });
    }

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty or unreadable' });
    }

    if (!Array.isArray(jsonData[0])) {
      return res.status(400).json({ success: false, message: 'First row must be a header row' });
    }

    const headers = jsonData[0].map(h => (h ? String(h).trim() : ''));
    const totalRows = jsonData.length - 1;

    // Sample rows for the mapping preview, keyed by header so the client can
    // render them against the columns it already knows about.
    const PREVIEW_ROWS = 5;
    const preview = jsonData.slice(1, 1 + PREVIEW_ROWS).map((row) =>
      Object.fromEntries(
        headers.map((header, i) => [header, row[i] === undefined || row[i] === null ? '' : String(row[i])])
      )
    );

    // Only now — after the file has proven parseable — is it persisted, so
    // processImport (a later, separate request) can read it back. On a host
    // with an ephemeral filesystem (e.g. Render's free tier) this goes to
    // Cloudinary when CLOUDINARY_URL is set; otherwise it falls back to local
    // disk, unchanged from before.
    const { location } = await fileStorage.storeBuffer(buffer, { filename: originalName, folder: 'imports' });

    // error_log and headers are JSON columns — Sequelize serialises them.
    const importLog = await ContactImportLog.create({
      filename: originalName,
      file_path: location,
      total_rows: totalRows,
      success_rows: 0,
      failed_rows: 0,
      status: 'processing',
      headers,
      uploaded_by: req.user.id,
      error_log: []
    });

    return res.json({
      success: true,
      data: {
        id: importLog.id,
        filename: importLog.filename,
        total_rows: totalRows,
        headers,
        preview,
        status: importLog.status
      }
    });
  } catch (error) {
    console.error('uploadContacts error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const processImport = async (req, res) => {
  try {
    const { importId, mapping, campaignId } = req.body;

    if (!importId || !mapping) {
      return res.status(400).json({ success: false, message: 'importId and mapping are required' });
    }

    // Reject unknown targets rather than letting `pick` drop them silently.
    // A client that mapped a column to a non-column (e.g. 'phone' instead of
    // 'mobile') otherwise got "row is missing a mapped mobile number" on every
    // row — a whole failed import that blamed the user's file, not the mapping.
    const unknownFields = [...new Set(Object.values(mapping))].filter(
      (field) => field !== SKIP_FIELD && !LEAD_WRITABLE.includes(field)
    );
    if (unknownFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot map to unknown field(s): ${unknownFields.join(', ')}. Allowed: ${LEAD_WRITABLE.join(', ')}.`,
      });
    }

    const importLog = await ContactImportLog.findByPk(importId);
    if (!importLog) {
      return res.status(404).json({ success: false, message: 'Import log not found' });
    }

    if (importLog.status === 'completed') {
      return res.status(400).json({ success: false, message: 'This import has already been processed' });
    }

    if (!importLog.file_path) {
      return res.status(404).json({ success: false, message: 'Uploaded file not found.' });
    }

    let buffer;
    try {
      buffer = await fileStorage.fetchBuffer(importLog.file_path);
    } catch (fetchError) {
      console.error('processImport fetchBuffer error:', fetchError.message);
      return res.status(404).json({ success: false, message: 'Uploaded file could not be retrieved.' });
    }

    // The stored location may be a Cloudinary URL, which carries no reliable
    // file extension — the original filename is the source of truth for that.
    const ext = path.extname(importLog.filename || '').toLowerCase();

    let jsonData;
    try {
      jsonData = await readRows(buffer, ext);
    } catch (parseError) {
      return res.status(400).json({ success: false, message: 'File could not be parsed as a spreadsheet.' });
    }

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty or unreadable' });
    }

    const headers = jsonData[0];
    const rows = jsonData.slice(1);

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    // Build the rows first, then insert in batches. The previous version awaited
    // one INSERT per row, which timed out long before a real import finished.
    const pending = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        // Only real Lead columns may be targeted — the mapping comes from the client.
        const leadData = pick(
          Object.fromEntries(
            Object.entries(mapping)
              .map(([fileColumn, crmField]) => {
                const colIndex = headers.indexOf(fileColumn);
                if (colIndex === -1) return null;
                const cell = row[colIndex];
                if (cell === undefined || cell === null || String(cell).trim() === '') return null;
                return [crmField, String(cell).trim()];
              })
              .filter(Boolean)
          ),
          LEAD_WRITABLE
        );

        if (campaignId) {
          leadData.campaign_id = campaignId;
        }

        // 'source' is an ENUM; imported rows are recorded as 'Other'.
        leadData.source = 'Other';

        if (!leadData.name) {
          throw new Error('Row is missing a mapped name.');
        }
        if (!leadData.mobile) {
          throw new Error('Row is missing a mapped mobile number.');
        }

        pending.push({ rowNumber: i + 2, raw: row, data: leadData });
      } catch (rowError) {
        failedCount++;
        errors.push({
          row: i + 2,
          data: rows[i],
          error: rowError.message
        });
      }
    }

    const BATCH_SIZE = 500;
    for (let start = 0; start < pending.length; start += BATCH_SIZE) {
      const batch = pending.slice(start, start + BATCH_SIZE);
      try {
        await Lead.bulkCreate(batch.map((entry) => entry.data), { validate: true });
        successCount += batch.length;
      } catch (batchError) {
        // A batch insert is all-or-nothing — fall back to per-row so one bad
        // row doesn't discard the other 499.
        for (const entry of batch) {
          try {
            await Lead.create(entry.data);
            successCount++;
          } catch (rowError) {
            failedCount++;
            errors.push({ row: entry.rowNumber, data: entry.raw, error: rowError.message });
          }
        }
      }
    }

    await importLog.update({
      success_rows: successCount,
      failed_rows: failedCount,
      status: 'completed',
      error_log: errors,
      campaign_id: campaignId || null
    });

    return res.json({
      success: true,
      data: {
        id: importLog.id,
        total_rows: importLog.total_rows,
        success_rows: successCount,
        failed_rows: failedCount,
        status: 'completed',
        errors_count: errors.length
      }
    });
  } catch (error) {
    console.error('processImport error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getImportHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await ContactImportLog.findAndCountAll({
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return res.json({
      success: true,
      data: {
        imports: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('getImportHistory error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getImportById = async (req, res) => {
  try {
    const { id } = req.params;

    const importLog = await ContactImportLog.findByPk(id, {
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!importLog) {
      return res.status(404).json({ success: false, message: 'Import log not found' });
    }

    return res.json({ success: true, data: importLog });
  } catch (error) {
    console.error('getImportById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getImportErrors = async (req, res) => {
  try {
    const { id } = req.params;

    const importLog = await ContactImportLog.findByPk(id);
    if (!importLog) {
      return res.status(404).json({ success: false, message: 'Import log not found' });
    }

    let errors = [];
    if (importLog.error_log) {
      errors = typeof importLog.error_log === 'string'
        ? JSON.parse(importLog.error_log)
        : importLog.error_log;
    }

    return res.json({ success: true, data: errors });
  } catch (error) {
    console.error('getImportErrors error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  uploadContacts,
  processImport,
  getImportHistory,
  getImportById,
  getImportErrors
};
