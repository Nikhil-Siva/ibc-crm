const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const MarketplaceProvider = sequelize.define('marketplace_provider', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM('cloud_telephony', 'softphone', 'bulk_sms', 'bulk_whatsapp'),
    allowNull: false,
  },
  logo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  website_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  integration_key: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'marketplace_providers',
  timestamps: true,
});

module.exports = MarketplaceProvider;
