const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Followup = sequelize.define('Followup', {
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
  customer_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'customers',
      key: 'id',
    },
  },
  type: {
    type: DataTypes.ENUM('Call', 'WhatsApp', 'Meeting', 'Email', 'Site Visit'),
    allowNull: false,
  },
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  notes: {
    type: DataTypes.TEXT,
  },
  outcome: {
    type: DataTypes.TEXT,
  },
  is_done: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  done_at: {
    type: DataTypes.DATE,
  },
  created_by: {
    type: DataTypes.INTEGER,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  tableName: 'followups',
  timestamps: true,
  updatedAt: false,
  paranoid: true,
});

module.exports = Followup;
