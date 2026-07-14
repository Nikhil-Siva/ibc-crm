const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    dialect: 'mysql',
    dialectModule: require('mysql2'),
    // SQL goes to the structured logger at debug level rather than stdout.
    // It used to print every statement via console.log in development, which
    // buried the messages that actually mattered.
    logging: (sql) => {
      // Required lazily: services/logger pulls in config indirectly.
      const { logger } = require('../services/logger');
      logger.debug({ sql }, 'sequelize');
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    },
    timezone: '+05:30',
  }
);

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    return false;
  }
};

module.exports = { sequelize, testConnection };
