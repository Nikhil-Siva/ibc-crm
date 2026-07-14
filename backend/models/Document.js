const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Document = sequelize.define('Document', {
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
  customer_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'customers',
      key: 'id',
    },
  },
  policy_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'policies',
      key: 'id',
    },
  },
  doc_type: {
    type: DataTypes.ENUM('Aadhaar', 'PAN', 'Photo', 'Proposal Form', 'Policy Bond', 'Bank Statement', 'Income Proof', 'Medical Report', 'Claim Form', 'Other'),
  },
  file_name: {
    type: DataTypes.STRING(255),
  },
  file_path: {
    type: DataTypes.STRING(500),
  },
  uploaded_by: {
    type: DataTypes.INTEGER,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  tableName: 'documents',
  timestamps: true,
  updatedAt: false,
});

module.exports = Document;
