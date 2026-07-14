const { Op } = require('sequelize');
const { Customer, User, Policy, Document, Followup, Lead } = require('../models');
const { recordActivity, ACTIONS } = require('../services/auditLog');
const { pick, escapeLike, CUSTOMER_WRITABLE } = require('../utils/validation');

/**
 * Agents may only touch customers assigned to them; admins/managers see everything.
 */
const canAccess = (user, customer) => user.role !== 'agent' || customer.assigned_to === user.id;

/**
 * GET /api/customers
 * Pagination, search (name/mobile/email), filter (assigned_to, city)
 */
const getAllCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { search, assigned_to, city } = req.query;

    const where = {};

    if (search) {
      const term = `%${escapeLike(search)}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { mobile: { [Op.like]: term } },
        { email: { [Op.like]: term } },
      ];
    }

    if (assigned_to) where.assigned_to = assigned_to;
    if (city) where.city = { [Op.like]: `%${escapeLike(city)}%` };

    // Agents (telecallers) only ever see their own book, same rule as leads.
    if (req.user.role === 'agent') {
      where.assigned_to = req.user.id;
    }

    const { rows, count } = await Customer.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignedAgent', attributes: ['id', 'name', 'email', 'mobile'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: {
        rows,
        count,
        page,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('getAllCustomers error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/customers/:id
 * Include policies, documents, followups, assignedAgent
 */
const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: [
        { model: User, as: 'assignedAgent', attributes: ['id', 'name', 'email', 'mobile'] },
        { model: Policy },
        { model: Document },
        {
          model: Followup,
          include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }],
        },
      ],
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (!canAccess(req.user, customer)) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own customers.' });
    }

    return res.status(200).json({ success: true, data: customer });
  } catch (error) {
    console.error('getCustomerById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/customers
 */
const createCustomer = async (req, res) => {
  try {
    const { name, mobile } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Name and mobile are required.',
      });
    }

    const canAssign = req.user.role !== 'agent';

    const customer = await Customer.create({
      ...pick(req.body, CUSTOMER_WRITABLE),
      assigned_to: (canAssign && req.body.assigned_to) || req.user.id,
    });

    return res.status(201).json({ success: true, data: customer });
  } catch (error) {
    console.error('createCustomer error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/customers/:id
 */
const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (!canAccess(req.user, customer)) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only update your own customers.' });
    }

    const updates = pick(req.body, CUSTOMER_WRITABLE);
    if (req.user.role !== 'agent' && req.body.assigned_to !== undefined) {
      updates.assigned_to = req.body.assigned_to;
    }

    await customer.update(updates);

    return res.status(200).json({ success: true, data: customer });
  } catch (error) {
    console.error('updateCustomer error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/customers/:id
 */
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    await customer.destroy();

    await recordActivity({
      userId: req.user.id,
      action: ACTIONS.RECORD_DELETED,
      entityType: 'customer',
      entityId: customer.id,
      req,
      details: { name: customer.name || null },
    });

    return res.status(200).json({ success: true, message: 'Customer deleted successfully.' });
  } catch (error) {
    console.error('deleteCustomer error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/customers/:id/policies
 */
const getCustomerPolicies = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (!canAccess(req.user, customer)) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own customers.' });
    }

    const policies = await Policy.findAll({
      where: { customer_id: req.params.id },
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({ success: true, data: policies });
  } catch (error) {
    console.error('getCustomerPolicies error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/customers/:id/documents
 */
const getCustomerDocuments = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (!canAccess(req.user, customer)) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own customers.' });
    }

    const documents = await Document.findAll({
      where: { customer_id: req.params.id },
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({ success: true, data: documents });
  } catch (error) {
    console.error('getCustomerDocuments error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerPolicies,
  getCustomerDocuments,
};
