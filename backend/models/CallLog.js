const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const CallLog = sequelize.define('call_log', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // Tenant boundary. Injected and enforced by services/tenancy.js.
  org_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'organizations',
      key: 'id',
    },
  },
  lead_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  agent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  campaign_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  call_type: {
    type: DataTypes.ENUM('outbound', 'inbound'),
    defaultValue: 'outbound',
  },
  status: {
    type: DataTypes.ENUM('connected', 'not_connected', 'busy', 'no_answer', 'voicemail'),
    allowNull: false,
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  ended_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'call_logs',
  timestamps: true,
});

module.exports = CallLog;
