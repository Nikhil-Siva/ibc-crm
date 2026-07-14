const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Agent = sequelize.define('Agent', {
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
  },
  email: {
    type: DataTypes.STRING(100),
  },
  city: {
    type: DataTypes.STRING(100),
  },
  age: {
    type: DataTypes.INTEGER,
  },
  occupation: {
    type: DataTypes.STRING(100),
  },
  education: {
    type: DataTypes.STRING(100),
  },
  referred_by: {
    type: DataTypes.INTEGER,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  interview_status: {
    type: DataTypes.ENUM('Not Scheduled', 'Scheduled', 'Appeared', 'Passed', 'Failed', 'Joined', 'Dropped'),
    defaultValue: 'Not Scheduled',
  },
  interview_date: {
    type: DataTypes.DATEONLY,
  },
  training_status: {
    type: DataTypes.ENUM('Not Started', 'In Progress', 'Completed'),
    defaultValue: 'Not Started',
  },
  irda_exam_status: {
    type: DataTypes.ENUM('Not Registered', 'Registered', 'Passed', 'Failed'),
    defaultValue: 'Not Registered',
  },
  activation_status: {
    type: DataTypes.ENUM('Inactive', 'Active'),
    defaultValue: 'Inactive',
  },
  notes: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'agents',
  timestamps: true,
  paranoid: true,
});

module.exports = Agent;
