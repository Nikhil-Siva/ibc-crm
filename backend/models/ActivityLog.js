const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const ActivityLog = sequelize.define('activity_log', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // Tenant boundary. Injected and enforced by services/tenancy.js.
  // Nullable here only: pre-auth events (failed logins) have no known tenant.
  org_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'organizations',
      key: 'id',
    },
  },
  // Null for anonymous events, e.g. a failed login against an unknown email.
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  entity_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  details: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
}, {
  tableName: 'activity_logs',
  timestamps: true,
});

module.exports = ActivityLog;
