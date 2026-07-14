/**
 * Session revocation.
 *
 * JWTs are stateless and last 7 days, so deactivating a user or changing their
 * role left their existing token fully valid until expiry — is_active was only
 * ever checked at login. token_version fixes that without adding a Redis
 * dependency: it is embedded in the token and compared against the database on
 * every request. Bumping the column invalidates every token that user holds.
 */

const { DataTypes } = require('sequelize');

const up = async (queryInterface) => {
  const columns = await queryInterface.describeTable('users');

  if (!columns.token_version) {
    await queryInterface.addColumn('users', 'token_version', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  }

  // A failed login from an unknown email has no actor and no tenant, but it is
  // exactly the event worth auditing (credential stuffing). Both columns must
  // therefore admit NULL for system/anonymous events.
  await queryInterface.changeColumn('activity_logs', 'user_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
  });

  await queryInterface.changeColumn('activity_logs', 'org_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
  });

  // Cron reminders run as system across every tenant. Per-policy and per-
  // customer reminders carry an org_id; the org-wide digests genuinely have
  // none, so this column has to admit NULL too.
  await queryInterface.changeColumn('reminder_logs', 'org_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
  });

  // Audit entries are queried by entity and by actor; both need indexes.
  try {
    await queryInterface.addIndex('activity_logs', ['entity_type', 'entity_id'], {
      name: 'idx_activity_logs_entity',
    });
  } catch (error) {
    if (!/Duplicate key name/i.test(error.message)) throw error;
  }

  try {
    await queryInterface.addIndex('activity_logs', ['action'], {
      name: 'idx_activity_logs_action',
    });
  } catch (error) {
    if (!/Duplicate key name/i.test(error.message)) throw error;
  }
};

const down = async (queryInterface) => {
  const columns = await queryInterface.describeTable('users');

  for (const name of ['idx_activity_logs_entity', 'idx_activity_logs_action']) {
    try {
      await queryInterface.removeIndex('activity_logs', name);
    } catch (error) {
      if (!/check that column\/key exists|doesn't exist/i.test(error.message)) throw error;
    }
  }

  if (columns.token_version) {
    await queryInterface.removeColumn('users', 'token_version');
  }

  // Restoring NOT NULL would fail against any anonymous rows written while this
  // migration was applied, so clear those first.
  await queryInterface.sequelize.query('DELETE FROM activity_logs WHERE user_id IS NULL OR org_id IS NULL');

  await queryInterface.changeColumn('activity_logs', 'user_id', {
    type: DataTypes.INTEGER,
    allowNull: false,
  });

  await queryInterface.changeColumn('activity_logs', 'org_id', {
    type: DataTypes.INTEGER,
    allowNull: false,
  });

  await queryInterface.sequelize.query('DELETE FROM reminder_logs WHERE org_id IS NULL');
  await queryInterface.changeColumn('reminder_logs', 'org_id', {
    type: DataTypes.INTEGER,
    allowNull: false,
  });
};

module.exports = { up, down };
