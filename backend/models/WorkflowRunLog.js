const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const WorkflowRunLog = sequelize.define('workflow_run_log', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  workflow_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  lead_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  trigger_data: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  steps_executed: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  status: {
    type: DataTypes.ENUM('running', 'completed', 'failed'),
    defaultValue: 'running',
  },
  started_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'workflow_run_logs',
  timestamps: true,
});

module.exports = WorkflowRunLog;
