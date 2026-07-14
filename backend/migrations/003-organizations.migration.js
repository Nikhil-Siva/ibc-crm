/**
 * Multi-tenancy.
 *
 * Nothing in the app was tenant-scoped: every query read every row, so one
 * deployment could only ever serve one agency. This adds an organizations
 * table and an org_id to every tenant-owned table.
 *
 * Existing data is single-tenant, so we create one default organization and
 * backfill every row into it before making org_id NOT NULL. That ordering
 * matters — adding a NOT NULL column to a populated table fails otherwise.
 */

const { DataTypes } = require('sequelize');

// Tables that hold tenant-owned data. Reference tables (marketplace_providers)
// and the migration bookkeeping table are deliberately global.
const SCOPED_TABLES = [
  'users', 'leads', 'customers', 'policies', 'followups', 'documents', 'agents',
  'campaigns', 'pipelines', 'call_logs', 'agent_sessions', 'activity_logs',
  'contact_import_logs', 'integrations', 'engagement_forms', 'form_submissions',
  'sms_automations', 'workflows', 'reminder_logs',
];

const DEFAULT_ORG = { name: 'Invic Business Corp LLP', slug: 'default' };

const tableExists = async (queryInterface, table) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === 'string' ? t : t.tableName)).includes(table);
};

const up = async (queryInterface) => {
  const sequelize = queryInterface.sequelize;

  // ── organizations table ─────────────────────────────────────────────
  if (!(await tableExists(queryInterface, 'organizations'))) {
    await queryInterface.createTable('organizations', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    });
  }

  // ── the default tenant that existing rows belong to ─────────────────
  const [existing] = await sequelize.query(
    'SELECT id FROM organizations WHERE slug = ? LIMIT 1',
    { replacements: [DEFAULT_ORG.slug] }
  );

  let orgId;
  if (existing.length > 0) {
    orgId = existing[0].id;
  } else {
    await sequelize.query(
      'INSERT INTO organizations (name, slug, is_active, createdAt, updatedAt) VALUES (?, ?, 1, NOW(), NOW())',
      { replacements: [DEFAULT_ORG.name, DEFAULT_ORG.slug] }
    );
    const [inserted] = await sequelize.query('SELECT LAST_INSERT_ID() AS id');
    orgId = inserted[0].id;
  }

  // ── org_id on every scoped table ────────────────────────────────────
  for (const table of SCOPED_TABLES) {
    if (!(await tableExists(queryInterface, table))) continue;

    const columns = await queryInterface.describeTable(table);
    if (columns.org_id) continue;

    // Nullable first, so the backfill can run against existing rows.
    await queryInterface.addColumn(table, 'org_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });

    await sequelize.query(`UPDATE \`${table}\` SET org_id = ? WHERE org_id IS NULL`, {
      replacements: [orgId],
    });

    // Now that every row has a value, enforce it.
    await queryInterface.changeColumn(table, 'org_id', {
      type: DataTypes.INTEGER,
      allowNull: false,
    });

    // Every scoped query filters on org_id, so it must be indexed.
    await queryInterface.addIndex(table, ['org_id'], { name: `idx_${table}_org_id` });
  }
};

const down = async (queryInterface) => {
  for (const table of SCOPED_TABLES) {
    if (!(await tableExists(queryInterface, table))) continue;

    const columns = await queryInterface.describeTable(table);
    if (!columns.org_id) continue;

    try {
      await queryInterface.removeIndex(table, `idx_${table}_org_id`);
    } catch (error) {
      if (!/check that column\/key exists|doesn't exist|needed in a foreign key/i.test(error.message)) throw error;
    }

    await queryInterface.removeColumn(table, 'org_id');
  }

  if (await tableExists(queryInterface, 'organizations')) {
    await queryInterface.dropTable('organizations');
  }
};

module.exports = { up, down };
