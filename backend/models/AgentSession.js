const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const AgentSession = sequelize.define('agent_session', {
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
  agent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  login_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  logout_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  breaks: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  total_break_seconds: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('active', 'on_break', 'offline'),
    defaultValue: 'active',
  },
}, {
  tableName: 'agent_sessions',
  timestamps: true,
});

module.exports = AgentSession;
