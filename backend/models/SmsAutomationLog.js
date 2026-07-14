const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const SmsAutomationLog = sequelize.define('sms_automation_log', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  automation_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  lead_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  message_sent: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('sent', 'failed', 'pending'),
    defaultValue: 'pending',
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sent_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'sms_automation_logs',
  timestamps: false,
});

module.exports = SmsAutomationLog;
