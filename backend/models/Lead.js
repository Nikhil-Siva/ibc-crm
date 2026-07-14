const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Lead = sequelize.define('Lead', {
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
  mobile: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(100),
  },
  age: {
    type: DataTypes.INTEGER,
  },
  occupation: {
    type: DataTypes.STRING(100),
  },
  city: {
    type: DataTypes.STRING(100),
  },
  source: {
    type: DataTypes.ENUM('Facebook', 'Google', 'WhatsApp', 'Referral', 'Walk-in', 'Instagram', 'Cold Call', 'Other'),
    defaultValue: 'Other',
  },
  insurance_interest: {
    type: DataTypes.ENUM('Life', 'Health', 'Motor', 'Term', 'Investment', 'ULIP', 'Other'),
  },
  status: {
    type: DataTypes.ENUM('New', 'Interested', 'Follow-up', 'Proposal Sent', 'Document Collection', 'Payment Pending', 'Closed Won', 'Closed Lost', 'Not Interested'),
    defaultValue: 'New',
  },
  priority: {
    type: DataTypes.ENUM('Hot', 'Warm', 'Cold'),
    defaultValue: 'Warm',
  },
  assigned_to: {
    type: DataTypes.INTEGER,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  notes: {
    type: DataTypes.TEXT,
  },
  last_contacted_at: {
    type: DataTypes.DATE,
  },
  campaign_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'campaigns',
      key: 'id',
    },
  },
  pipeline_stage_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'pipeline_stages',
      key: 'id',
    },
  },
}, {
  tableName: 'leads',
  timestamps: true,
  // destroy() sets deletedAt instead of deleting the row; default queries
  // exclude soft-deleted records. Use paranoid:false to include them.
  paranoid: true,
});

module.exports = Lead;
