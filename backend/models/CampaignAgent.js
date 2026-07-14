const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const CampaignAgent = sequelize.define('campaign_agent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  campaign_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  agent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  assigned_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'campaign_agents',
  timestamps: false,
});

module.exports = CampaignAgent;
