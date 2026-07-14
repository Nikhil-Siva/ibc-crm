/**
 * Soft delete for the records that represent customer data.
 *
 * DELETE /customers/:id used to call destroy() and hard-delete the row. With
 * ON DELETE CASCADE on policies and documents, deleting one customer silently
 * took their policy history with it and left nothing to restore from — in a
 * regulated insurance context that is unacceptable.
 *
 * Only the entities worth recovering get this. Log tables (call_logs,
 * activity_logs, integration_logs) are append-only and deliberately excluded.
 */

const { DataTypes } = require('sequelize');

const TABLES = ['leads', 'customers', 'policies', 'followups', 'agents', 'campaigns', 'pipelines'];

const tableExists = async (queryInterface, table) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === 'string' ? t : t.tableName)).includes(table);
};

const up = async (queryInterface) => {
  for (const table of TABLES) {
    if (!(await tableExists(queryInterface, table))) continue;

    const columns = await queryInterface.describeTable(table);
    if (columns.deletedAt) continue;

    await queryInterface.addColumn(table, 'deletedAt', {
      type: DataTypes.DATE,
      allowNull: true,
    });

    // Every default query filters on deletedAt IS NULL, so it needs an index.
    await queryInterface.addIndex(table, ['deletedAt'], { name: `idx_${table}_deleted_at` });
  }
};

const down = async (queryInterface) => {
  for (const table of TABLES) {
    if (!(await tableExists(queryInterface, table))) continue;

    const columns = await queryInterface.describeTable(table);
    if (!columns.deletedAt) continue;

    try {
      await queryInterface.removeIndex(table, `idx_${table}_deleted_at`);
    } catch (error) {
      if (!/check that column\/key exists|doesn't exist/i.test(error.message)) throw error;
    }

    // Note: this discards the soft-deleted rows' tombstones. Rows soft-deleted
    // while this migration was applied become visible again on rollback.
    await queryInterface.removeColumn(table, 'deletedAt');
  }
};

module.exports = { up, down };
