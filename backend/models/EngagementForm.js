const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const EngagementForm = sequelize.define('engagement_form', {
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
  campaign_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  fields: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'engagement_forms',
  timestamps: true,
});

module.exports = EngagementForm;
