const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const SmsAutomation = sequelize.define('sms_automation', {
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
  campaign_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  trigger_event: {
    type: DataTypes.ENUM(
      'lead_created',
      'lead_stage_changed',
      'call_connected',
      'call_not_answered',
      'form_submitted',
      'lead_assigned_to_agent',
      'custom_field_value_changed'
    ),
    allowNull: false,
  },
  trigger_conditions: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  sms_template: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  sms_provider_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  delay_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'sms_automations',
  timestamps: true,
});

module.exports = SmsAutomation;
