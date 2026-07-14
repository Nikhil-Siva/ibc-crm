const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const IntegrationLog = sequelize.define('integration_log', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  integration_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  leads_fetched: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  leads_imported: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  synced_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'integration_logs',
  timestamps: true,
});

module.exports = IntegrationLog;
