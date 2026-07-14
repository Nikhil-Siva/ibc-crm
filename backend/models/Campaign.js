const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const Campaign = sequelize.define('campaign', {
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
  pipeline_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  manager_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'completed'),
    defaultValue: 'active',
  },
  lead_distribution_type: {
    type: DataTypes.ENUM('equal', 'conditional', 'ai'),
    defaultValue: 'equal',
  },
  conditional_distribution_rules: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  duplicacy_action: {
    type: DataTypes.ENUM('ignore', 'create', 'merge'),
    defaultValue: 'ignore',
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'campaigns',
  timestamps: true,
  paranoid: true,
});

module.exports = Campaign;
