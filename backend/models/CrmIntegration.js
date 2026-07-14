const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const CrmIntegration = sequelize.define('integration', {
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
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM(
      'facebook_lead_ads',
      'google_sheets',
      'justdial',
      'indiamart',
      'magicbricks',
      '99acres',
      'housing_com',
      'webhook_generic'
    ),
    allowNull: false,
  },
  config: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  target_campaign_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  last_synced_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  webhook_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'integrations',
  timestamps: true,
});

module.exports = CrmIntegration;
