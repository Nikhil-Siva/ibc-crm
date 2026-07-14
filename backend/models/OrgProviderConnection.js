const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const { encryptedField } = require('../utils/encryption');

const OrgProviderConnection = sequelize.define('org_provider_connection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  provider_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // Encrypted at rest — these are live third-party credentials, and a database
  // dump should not hand them over. TEXT because ciphertext is much longer
  // than the plaintext these columns used to hold.
  api_key: {
    type: DataTypes.TEXT,
    allowNull: true,
    ...encryptedField('api_key'),
  },
  api_secret: {
    type: DataTypes.TEXT,
    allowNull: true,
    ...encryptedField('api_secret'),
  },
  extra_config: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  connected_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'org_provider_connections',
  timestamps: true,
});

module.exports = OrgProviderConnection;
