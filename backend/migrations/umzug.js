require('dotenv').config();

const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize } = require('../config/database');

/**
 * Migration runner.
 *
 * The schema used to be maintained by sequelize.sync({ alter: true }) on every
 * boot, which drifted from database/schema.sql and re-added a redundant UNIQUE
 * index to users.email on each start (8 had accumulated before this was caught;
 * MySQL caps a table at 64 keys). Migrations are now the only way the schema
 * changes.
 *
 * Every migration must implement both up() and down() so a bad deploy can be
 * rolled back.
 */
const umzug = new Umzug({
  migrations: {
    glob: ['*.migration.js', { cwd: __dirname }],
    resolve: ({ name, path: migrationPath, context }) => {
      const migration = require(migrationPath);
      return {
        name,
        up: async () => migration.up(context),
        down: async () => migration.down(context),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, modelName: 'schema_migrations' }),
  logger: console,
});

module.exports = { umzug, sequelize };

// CLI: node migrations/umzug.js up|down|pending|executed
if (require.main === module) {
  const command = process.argv[2] || 'up';

  const run = async () => {
    switch (command) {
      case 'up':
        await umzug.up();
        break;
      case 'down':
        // Roll back exactly one migration — safer default than reverting all.
        await umzug.down();
        break;
      case 'pending': {
        const pending = await umzug.pending();
        console.log(pending.length ? pending.map((m) => m.name).join('\n') : 'No pending migrations.');
        break;
      }
      case 'executed': {
        const executed = await umzug.executed();
        console.log(executed.length ? executed.map((m) => m.name).join('\n') : 'No migrations executed yet.');
        break;
      }
      default:
        console.error(`Unknown command "${command}". Use: up | down | pending | executed`);
        process.exit(1);
    }
  };

  run()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('❌ Migration failed:', error.message);
      try { await sequelize.close(); } catch { /* already closed */ }
      process.exit(1);
    });
}
