const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { encryptedField } = require('../utils/encryption');

const Customer = sequelize.define('Customer', {
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
    references: {
      model: 'leads',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  mobile: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  alternate_mobile: {
    type: DataTypes.STRING(15),
  },
  email: {
    type: DataTypes.STRING(100),
  },
  dob: {
    type: DataTypes.DATEONLY,
  },
  gender: {
    type: DataTypes.ENUM('Male', 'Female', 'Other'),
  },
  occupation: {
    type: DataTypes.STRING(100),
  },
  annual_income: {
    type: DataTypes.DECIMAL(12, 2),
  },
  address: {
    type: DataTypes.TEXT,
  },
  city: {
    type: DataTypes.STRING(100),
  },
  pincode: {
    type: DataTypes.STRING(10),
  },
  // Government identifiers, encrypted at rest. Under India's DPDP Act these
  // should not sit in plaintext in a table that gets backed up and copied.
  pan_number: {
    type: DataTypes.TEXT,
    ...encryptedField('pan_number'),
  },
  aadhaar_number: {
    type: DataTypes.TEXT,
    ...encryptedField('aadhaar_number'),
  },
  nominee_name: {
    type: DataTypes.STRING(100),
  },
  nominee_relation: {
    type: DataTypes.STRING(50),
  },
  nominee_dob: {
    type: DataTypes.DATEONLY,
  },
  assigned_to: {
    type: DataTypes.INTEGER,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  tableName: 'customers',
  timestamps: true,
  paranoid: true,
});

module.exports = Customer;
