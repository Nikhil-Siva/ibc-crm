const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const PipelineStage = sequelize.define('pipeline_stage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  pipeline_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  color: {
    type: DataTypes.STRING(7),
    defaultValue: '#1890ff',
  },
  order_index: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  is_terminal_won: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_terminal_lost: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'pipeline_stages',
  timestamps: true,
});

module.exports = PipelineStage;
