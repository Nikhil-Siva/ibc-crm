/**
 * Baseline schema.
 *
 * database/schema.sql only ever defined 8 of the application's tables; the
 * other 19 (campaigns, pipelines, call_logs, workflows, …) existed solely
 * because sync({ alter: true }) conjured them at boot. This migration creates
 * whatever is missing so a fresh database matches the models, and every schema
 * change after this point is an explicit migration.
 *
 * sync() here is CREATE TABLE IF NOT EXISTS — it is NOT the alter form that
 * accumulated duplicate indexes. It never modifies an existing table.
 */

const up = async () => {
  // Required lazily: loading models pulls in config/database, and the runner
  // already owns the connection.
  const { sequelize } = require('../models');
  await sequelize.sync();
};

const down = async () => {
  // Deliberately a no-op. The reverse of "create the entire schema" is
  // "drop every table", which is not something a rollback should ever do to a
  // database holding customer records. Drop the database by hand if that is
  // genuinely what you want.
  console.warn('[migration] 000-baseline-schema down() is intentionally a no-op — it will not drop your tables.');
};

module.exports = { up, down };
