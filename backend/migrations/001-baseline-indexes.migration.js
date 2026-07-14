/**
 * Drop the redundant UNIQUE indexes that sync({ alter: true }) accumulated on
 * users.email, and add indexes for the query paths the app actually uses.
 *
 * Before this, the only non-PK indexes were foreign-key side effects — every
 * lead list, pipeline board, renewal sweep and call report was a table scan.
 */

/** Index names, keyed by table, that this migration owns. */
const INDEXES = [
  { table: 'leads', name: 'idx_leads_assigned_to', fields: ['assigned_to'] },
  { table: 'leads', name: 'idx_leads_status', fields: ['status'] },
  { table: 'leads', name: 'idx_leads_campaign_id', fields: ['campaign_id'] },
  { table: 'leads', name: 'idx_leads_pipeline_stage_id', fields: ['pipeline_stage_id'] },
  { table: 'leads', name: 'idx_leads_mobile', fields: ['mobile'] },
  // Kanban: filter by status for one agent, order by recency.
  { table: 'leads', name: 'idx_leads_assigned_status', fields: ['assigned_to', 'status'] },
  { table: 'leads', name: 'idx_leads_created_at', fields: ['createdAt'] },

  { table: 'customers', name: 'idx_customers_assigned_to', fields: ['assigned_to'] },
  { table: 'customers', name: 'idx_customers_mobile', fields: ['mobile'] },

  // Renewal sweeps filter on status + next_due_date together.
  { table: 'policies', name: 'idx_policies_status_next_due', fields: ['status', 'next_due_date'] },
  { table: 'policies', name: 'idx_policies_customer_id', fields: ['customer_id'] },

  { table: 'followups', name: 'idx_followups_scheduled_done', fields: ['scheduled_at', 'is_done'] },
  { table: 'followups', name: 'idx_followups_created_by', fields: ['created_by'] },
  { table: 'followups', name: 'idx_followups_lead_id', fields: ['lead_id'] },

  // Call reports group by agent over a date range.
  { table: 'call_logs', name: 'idx_call_logs_agent_created', fields: ['agent_id', 'createdAt'] },
  { table: 'call_logs', name: 'idx_call_logs_status', fields: ['status'] },
  { table: 'call_logs', name: 'idx_call_logs_lead_id', fields: ['lead_id'] },

  { table: 'agent_sessions', name: 'idx_agent_sessions_agent_login', fields: ['agent_id', 'login_at'] },
  { table: 'activity_logs', name: 'idx_activity_logs_created_at', fields: ['createdAt'] },
  { table: 'activity_logs', name: 'idx_activity_logs_user_id', fields: ['user_id'] },
];

const tableExists = async (queryInterface, table) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === 'string' ? t : t.tableName)).includes(table);
};

const up = async (queryInterface) => {
  const sequelize = queryInterface.sequelize;

  // ── Drop duplicate UNIQUE indexes on users.email ────────────────────
  // sync({alter:true}) added one per boot: email, email_2, email_3, ...
  // Keep exactly one and drop the rest.
  const [emailIndexes] = await sequelize.query(`
    SELECT DISTINCT index_name
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'email'
      AND index_name != 'PRIMARY'
  `);

  const names = emailIndexes.map((r) => r.index_name || r.INDEX_NAME);
  // Prefer keeping the plainly-named one if present.
  const keep = names.includes('email') ? 'email' : names[0];

  for (const name of names) {
    if (name === keep) continue;
    await sequelize.query(`ALTER TABLE \`users\` DROP INDEX \`${name}\``);
  }

  // ── Add the indexes the query paths need ────────────────────────────
  for (const { table, name, fields } of INDEXES) {
    if (!(await tableExists(queryInterface, table))) continue;
    try {
      await queryInterface.addIndex(table, fields, { name });
    } catch (error) {
      // Re-running against a partially migrated DB shouldn't fail the deploy.
      if (!/Duplicate key name/i.test(error.message)) throw error;
    }
  }
};

const down = async (queryInterface) => {
  // The duplicate email indexes are deliberately NOT recreated — they were a
  // bug, and restoring them would only re-approach MySQL's 64-key limit.
  for (const { table, name } of INDEXES) {
    if (!(await tableExists(queryInterface, table))) continue;
    try {
      await queryInterface.removeIndex(table, name);
    } catch (error) {
      // Already gone — fine.
      if (/check that column\/key exists|doesn't exist/i.test(error.message)) continue;

      // MySQL requires every FK column to keep a usable index. Once one of
      // these replaces the constraint's auto-created index, it can no longer be
      // dropped while the FK exists. Leaving a surplus index behind is harmless
      // (unlike leaving a column), so skip rather than wedge the rollback
      // half-applied.
      if (/needed in a foreign key constraint/i.test(error.message)) {
        console.warn(`[migration] Keeping ${name} — a foreign key still requires it.`);
        continue;
      }

      throw error;
    }
  }
};

module.exports = { up, down };
