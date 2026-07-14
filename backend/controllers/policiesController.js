const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { Policy, Customer, Document } = require('../models');
const { recordActivity, ACTIONS } = require('../services/auditLog');
const { pick, escapeLike, POLICY_WRITABLE } = require('../utils/validation');

/**
 * Calculate next due date from a given date and premium frequency
 */
const calculateNextDueDate = (fromDate, frequency) => {
  const date = dayjs(fromDate);
  switch (frequency) {
    case 'Monthly':
      return date.add(1, 'month').format('YYYY-MM-DD');
    case 'Quarterly':
      return date.add(3, 'month').format('YYYY-MM-DD');
    case 'Half-Yearly':
      return date.add(6, 'month').format('YYYY-MM-DD');
    case 'Yearly':
      return date.add(1, 'year').format('YYYY-MM-DD');
    case 'Single':
      return null;
    default:
      return null;
  }
};

/**
 * GET /api/policies
 * Pagination, filters (status, policy_type, insurer), include Customer
 */
const getAllPolicies = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { status, policy_type, insurer, search } = req.query;

    const where = {};

    if (status) where.status = status;
    if (policy_type) where.policy_type = policy_type;
    if (insurer) where.insurer = { [Op.like]: `%${escapeLike(insurer)}%` };
    if (search) {
      const term = `%${escapeLike(search)}%`;
      where[Op.or] = [
        { policy_number: { [Op.like]: term } },
        { insurer: { [Op.like]: term } },
        { plan_name: { [Op.like]: term } },
      ];
    }

    const { rows, count } = await Policy.findAndCountAll({
      where,
      include: [
        { model: Customer, attributes: ['id', 'name', 'mobile', 'email'] },
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
    console.error('getAllPolicies error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/policies/:id
 * Include Customer + Documents
 */
const getPolicyById = async (req, res) => {
  try {
    const policy = await Policy.findByPk(req.params.id, {
      include: [
        { model: Customer },
        { model: Document },
      ],
    });

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    return res.status(200).json({ success: true, data: policy });
  } catch (error) {
    console.error('getPolicyById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/policies
 * Validate customer_id exists, auto-calculate next_due_date
 */
const createPolicy = async (req, res) => {
  try {
    const { customer_id, insurer, premium_frequency, start_date, due_date } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, message: 'customer_id is required.' });
    }

    if (!insurer) {
      return res.status(400).json({ success: false, message: 'insurer is required.' });
    }

    // Verify customer exists
    const customer = await Customer.findByPk(customer_id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    // Auto-calculate next_due_date if not provided
    let next_due_date = req.body.next_due_date;
    if (!next_due_date && premium_frequency) {
      const baseDate = due_date || start_date || dayjs().format('YYYY-MM-DD');
      next_due_date = calculateNextDueDate(baseDate, premium_frequency);
    }

    const policy = await Policy.create({
      ...pick(req.body, POLICY_WRITABLE),
      next_due_date,
    });

    return res.status(201).json({ success: true, data: policy });
  } catch (error) {
    console.error('createPolicy error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/policies/:id
 */
const updatePolicy = async (req, res) => {
  try {
    const policy = await Policy.findByPk(req.params.id);

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    const updates = pick(req.body, POLICY_WRITABLE);

    // Recalculate next_due_date if premium_frequency or due_date changed
    if (updates.premium_frequency || updates.due_date) {
      const frequency = updates.premium_frequency || policy.premium_frequency;
      const baseDate = updates.due_date || policy.due_date || policy.start_date;
      if (frequency && baseDate) {
        updates.next_due_date = calculateNextDueDate(baseDate, frequency);
      }
    }

    await policy.update(updates);

    return res.status(200).json({ success: true, data: policy });
  } catch (error) {
    console.error('updatePolicy error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/policies/:id
 */
const deletePolicy = async (req, res) => {
  try {
    const policy = await Policy.findByPk(req.params.id);

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    await policy.destroy();

    await recordActivity({
      userId: req.user.id,
      action: ACTIONS.RECORD_DELETED,
      entityType: 'policy',
      entityId: policy.id,
      req,
      details: { policy_number: policy.policy_number, insurer: policy.insurer, customer_id: policy.customer_id },
    });

    return res.status(200).json({ success: true, message: 'Policy deleted successfully.' });
  } catch (error) {
    console.error('deletePolicy error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/policies/renewals-due
 * Policies with next_due_date in next N days (default 30), include Customer
 */
const getRenewalsDue = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const today = dayjs().format('YYYY-MM-DD');
    const futureDate = dayjs().add(days, 'day').format('YYYY-MM-DD');

    const policies = await Policy.findAll({
      where: {
        next_due_date: {
          [Op.between]: [today, futureDate],
        },
        status: 'Active',
      },
      include: [
        { model: Customer, attributes: ['id', 'name', 'mobile', 'email'] },
      ],
      order: [['next_due_date', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      data: policies,
      count: policies.length,
    });
  } catch (error) {
    console.error('getRenewalsDue error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getRenewalsDue,
};
