const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Records every reminder the cron jobs send, so a restart or a second process
 * doesn't re-send messages customers have already received. The unique index on
 * dedupe_key is what actually enforces "once per recipient per day" — two
 * workers racing on the same key will have one insert fail rather than both send.
 */
const ReminderLog = sequelize.define('reminder_log', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // Tenant boundary. Injected and enforced by services/tenancy.js.
  // Nullable: org-wide digests sent by cron belong to no single tenant.
  org_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'organizations',
      key: 'id',
    },
  },
  dedupe_key: {
    type: DataTypes.STRING(190),
    allowNull: false,
    unique: true,
  },
  reminder_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  entity_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  sent_on: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
}, {
  tableName: 'reminder_logs',
  timestamps: true,
});

module.exports = ReminderLog;
