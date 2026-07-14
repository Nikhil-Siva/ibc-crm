const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const Workflow = sequelize.define('workflow', {
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
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  trigger_type: {
    type: DataTypes.ENUM(
      'lead_created',
      'lead_stage_changed',
      'lead_assigned',
      'call_ended',
      'form_submitted',
      'scheduled',
      'webhook_received'
    ),
    allowNull: false,
  },
  trigger_config: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  steps: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  run_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  last_run_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'workflows',
  timestamps: true,
});

module.exports = Workflow;
