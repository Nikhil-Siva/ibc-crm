const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Policy = sequelize.define('Policy', {
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
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id',
    },
  },
  policy_number: {
    type: DataTypes.STRING(50),
  },
  insurer: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  policy_type: {
    type: DataTypes.ENUM('Life', 'Health', 'Term', 'Motor', 'ULIP', 'Endowment', 'Money Back', 'Pension', 'Other'),
  },
  plan_name: {
    type: DataTypes.STRING(150),
  },
  sum_assured: {
    type: DataTypes.DECIMAL(14, 2),
  },
  premium_amount: {
    type: DataTypes.DECIMAL(10, 2),
  },
  premium_frequency: {
    type: DataTypes.ENUM('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'Single'),
  },
  payment_mode: {
    type: DataTypes.ENUM('Online', 'Cheque', 'Cash', 'NEFT', 'ECS'),
  },
  start_date: {
    type: DataTypes.DATEONLY,
  },
  maturity_date: {
    type: DataTypes.DATEONLY,
  },
  due_date: {
    type: DataTypes.DATEONLY,
  },
  next_due_date: {
    type: DataTypes.DATEONLY,
  },
  policy_term_years: {
    type: DataTypes.INTEGER,
  },
  status: {
    type: DataTypes.ENUM('Active', 'Lapsed', 'Surrendered', 'Matured', 'Claimed', 'Pending'),
    defaultValue: 'Active',
  },
  commission_earned: {
    type: DataTypes.DECIMAL(10, 2),
  },
  notes: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'policies',
  timestamps: true,
  paranoid: true,
});

module.exports = Policy;
