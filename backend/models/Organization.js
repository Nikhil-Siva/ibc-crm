const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * A tenant. Every user, lead, customer, policy and campaign belongs to exactly
 * one organization, and no query may cross that boundary.
 *
 * Existing deployments are single-tenant, so the migration creates one default
 * organization and backfills every existing row into it.
 */
const Organization = sequelize.define('Organization', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(80),
    allowNull: false,
    unique: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'organizations',
  timestamps: true,
  paranoid: true,
});

module.exports = Organization;
