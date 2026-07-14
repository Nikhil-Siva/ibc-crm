const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const ContactImportLog = sequelize.define('contact_import_log', {
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
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  // Upload and process are two separate requests, so the parsed file has to be
  // findable again between them.
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  headers: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  uploaded_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  total_rows: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  success_rows: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  failed_rows: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('processing', 'completed', 'failed'),
    defaultValue: 'processing',
  },
  error_log: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  campaign_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'contact_import_logs',
  timestamps: true,
});

module.exports = ContactImportLog;
