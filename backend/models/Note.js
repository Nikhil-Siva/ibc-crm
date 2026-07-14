const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * A note against a lead or a customer.
 *
 * Notes used to be a single TEXT column on Lead that addCallNote appended to
 * with string concatenation. That made them unqueryable, unattributable (no
 * author), individually un-editable, and unbounded — a lead worked for a year
 * carried one ever-growing blob.
 */
const Note = sequelize.define('note', {
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
  // Exactly one of lead_id / customer_id is set — enforced by validate below.
  lead_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'leads', key: 'id' },
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'customers', key: 'id' },
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Note body cannot be empty.' },
    },
  },
  // 'call' notes are written by addCallNote; 'manual' by a user.
  kind: {
    type: DataTypes.ENUM('manual', 'call', 'system'),
    defaultValue: 'manual',
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
}, {
  tableName: 'notes',
  timestamps: true,
  paranoid: true,
  validate: {
    exactlyOneSubject() {
      const hasLead = this.lead_id !== null && this.lead_id !== undefined;
      const hasCustomer = this.customer_id !== null && this.customer_id !== undefined;
      if (hasLead === hasCustomer) {
        throw new Error('A note must reference exactly one of lead_id or customer_id.');
      }
    },
  },
});

module.exports = Note;
