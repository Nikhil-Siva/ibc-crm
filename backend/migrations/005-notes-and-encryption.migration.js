/**
 * 1. Promote notes from a TEXT blob on leads to their own table, backfilling
 *    what's already there so no history is lost.
 * 2. Widen the columns that now hold ciphertext, and encrypt existing values.
 *
 * The encryption step is data migration, not just DDL: rows written before this
 * are plaintext, and decrypt() passes non-prefixed values through unchanged, so
 * the app keeps working either way. This migration converts them properly.
 */

const { DataTypes } = require('sequelize');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

const ENCRYPTED_COLUMNS = [
  { table: 'org_provider_connections', columns: ['api_key', 'api_secret'] },
  { table: 'customers', columns: ['pan_number', 'aadhaar_number'] },
];

const tableExists = async (queryInterface, table) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === 'string' ? t : t.tableName)).includes(table);
};

const up = async (queryInterface) => {
  const sequelize = queryInterface.sequelize;

  // ── notes table ─────────────────────────────────────────────────────
  if (!(await tableExists(queryInterface, 'notes'))) {
    await queryInterface.createTable('notes', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      org_id: { type: DataTypes.INTEGER, allowNull: false },
      lead_id: { type: DataTypes.INTEGER, allowNull: true },
      customer_id: { type: DataTypes.INTEGER, allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: false },
      kind: { type: DataTypes.ENUM('manual', 'call', 'system'), defaultValue: 'manual' },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    });

    await queryInterface.addIndex('notes', ['lead_id'], { name: 'idx_notes_lead_id' });
    await queryInterface.addIndex('notes', ['customer_id'], { name: 'idx_notes_customer_id' });
    await queryInterface.addIndex('notes', ['org_id'], { name: 'idx_notes_org_id' });
    await queryInterface.addIndex('notes', ['deletedAt'], { name: 'idx_notes_deleted_at' });
  }

  // ── backfill from leads.notes ───────────────────────────────────────
  // Copy rather than parse: the blob has no reliable structure (free text mixed
  // with "[timestamp] (outcome) body" lines appended by addCallNote), and
  // guessing at boundaries risks mangling what an agent actually wrote. One
  // note per lead preserves the text verbatim; new notes are properly separate.
  const [leadsWithNotes] = await sequelize.query(`
    SELECT id, org_id, notes, assigned_to
    FROM leads
    WHERE notes IS NOT NULL AND TRIM(notes) != ''
  `);

  for (const lead of leadsWithNotes) {
    const [existing] = await sequelize.query(
      "SELECT id FROM notes WHERE lead_id = ? AND kind = 'system' LIMIT 1",
      { replacements: [lead.id] }
    );
    if (existing.length > 0) continue;

    await sequelize.query(
      `INSERT INTO notes (org_id, lead_id, body, kind, created_by, createdAt, updatedAt)
       VALUES (?, ?, ?, 'system', ?, NOW(), NOW())`,
      { replacements: [lead.org_id, lead.id, lead.notes, lead.assigned_to || null] }
    );
  }

  // leads.notes is intentionally left in place. Dropping it would make this
  // migration lossy and un-rollbackable; the application now writes to notes.

  // ── widen + encrypt sensitive columns ───────────────────────────────
  for (const { table, columns } of ENCRYPTED_COLUMNS) {
    if (!(await tableExists(queryInterface, table))) continue;

    const described = await queryInterface.describeTable(table);

    for (const column of columns) {
      if (!described[column]) continue;

      // Ciphertext is far longer than the plaintext these columns were sized
      // for (pan_number was VARCHAR(20); an encrypted value is ~120 chars).
      await queryInterface.changeColumn(table, column, {
        type: DataTypes.TEXT,
        allowNull: true,
      });

      const [rows] = await sequelize.query(
        `SELECT id, \`${column}\` AS value FROM \`${table}\` WHERE \`${column}\` IS NOT NULL AND \`${column}\` != ''`
      );

      for (const row of rows) {
        if (isEncrypted(row.value)) continue;
        await sequelize.query(`UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ?`, {
          replacements: [encrypt(row.value), row.id],
        });
      }
    }
  }
};

const down = async (queryInterface) => {
  const sequelize = queryInterface.sequelize;

  // Decrypt back to plaintext before narrowing the columns again, or the data
  // becomes unreadable to the previous version of the code.
  for (const { table, columns } of ENCRYPTED_COLUMNS) {
    if (!(await tableExists(queryInterface, table))) continue;

    const described = await queryInterface.describeTable(table);

    for (const column of columns) {
      if (!described[column]) continue;

      const [rows] = await sequelize.query(
        `SELECT id, \`${column}\` AS value FROM \`${table}\` WHERE \`${column}\` IS NOT NULL`
      );

      for (const row of rows) {
        if (!isEncrypted(row.value)) continue;
        await sequelize.query(`UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ?`, {
          replacements: [decrypt(row.value), row.id],
        });
      }
    }
  }

  // The notes table is dropped, but leads.notes was never removed, so the
  // original text survives the rollback.
  if (await tableExists(queryInterface, 'notes')) {
    await queryInterface.dropTable('notes');
  }
};

module.exports = { up, down };
