const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const FormSubmission = sequelize.define('form_submission', {
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
  form_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  lead_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  agent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  responses: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  submitted_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'form_submissions',
  timestamps: false,
});

module.exports = FormSubmission;
