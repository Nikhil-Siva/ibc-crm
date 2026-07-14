const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { Followup, Lead, Customer, User } = require('../models');
const { recordActivity, ACTIONS } = require('../services/auditLog');
const { pick, FOLLOWUP_WRITABLE } = require('../utils/validation');

/**
 * GET /api/followups
 * Filter by date range (from/to), type, is_done, created_by. Include Lead + Customer + creator
 */
const getAllFollowups = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { from, to, type, is_done, created_by } = req.query;

    const where = {};

    if (from && to) {
      where.scheduled_at = { [Op.between]: [new Date(from), new Date(to)] };
    } else if (from) {
      where.scheduled_at = { [Op.gte]: new Date(from) };
    } else if (to) {
      where.scheduled_at = { [Op.lte]: new Date(to) };
    }

    if (type) where.type = type;
    if (is_done !== undefined) where.is_done = is_done === 'true';
    if (created_by) where.created_by = created_by;

    const { rows, count } = await Followup.findAndCountAll({
      where,
      include: [
        { model: Lead, attributes: ['id', 'name', 'mobile', 'status'] },
        { model: Customer, attributes: ['id', 'name', 'mobile'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
      ],
      order: [['scheduled_at', 'ASC']],
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
    console.error('getAllFollowups error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/followups/today
 * Scheduled for today, not done. Include Lead + Customer
 */
const getTodayFollowups = async (req, res) => {
  try {
    const todayStart = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();

    const followups = await Followup.findAll({
      where: {
        scheduled_at: { [Op.between]: [todayStart, todayEnd] },
        is_done: false,
      },
      include: [
        { model: Lead, attributes: ['id', 'name', 'mobile', 'status'] },
        { model: Customer, attributes: ['id', 'name', 'mobile'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
      ],
      order: [['scheduled_at', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      data: followups,
      count: followups.length,
    });
  } catch (error) {
    console.error('getTodayFollowups error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/followups/:id
 */
const getFollowupById = async (req, res) => {
  try {
    const followup = await Followup.findByPk(req.params.id, {
      include: [
        { model: Lead },
        { model: Customer },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (!followup) {
      return res.status(404).json({ success: false, message: 'Followup not found.' });
    }

    return res.status(200).json({ success: true, data: followup });
  } catch (error) {
    console.error('getFollowupById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/followups
 */
const createFollowup = async (req, res) => {
  try {
    const { type, scheduled_at } = req.body;

    if (!type) {
      return res.status(400).json({ success: false, message: 'type is required.' });
    }

    if (!scheduled_at) {
      return res.status(400).json({ success: false, message: 'scheduled_at is required.' });
    }

    const followup = await Followup.create({
      ...pick(req.body, FOLLOWUP_WRITABLE),
      created_by: req.user.id,
    });

    return res.status(201).json({ success: true, data: followup });
  } catch (error) {
    console.error('createFollowup error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/followups/:id
 */
const updateFollowup = async (req, res) => {
  try {
    const followup = await Followup.findByPk(req.params.id);

    if (!followup) {
      return res.status(404).json({ success: false, message: 'Followup not found.' });
    }

    await followup.update(pick(req.body, FOLLOWUP_WRITABLE));

    return res.status(200).json({ success: true, data: followup });
  } catch (error) {
    console.error('updateFollowup error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/followups/:id/done
 * Mark followup as done, set done_at = now, save outcome from body
 */
const markDone = async (req, res) => {
  try {
    const followup = await Followup.findByPk(req.params.id);

    if (!followup) {
      return res.status(404).json({ success: false, message: 'Followup not found.' });
    }

    await followup.update({
      is_done: true,
      done_at: new Date(),
      outcome: req.body.outcome || followup.outcome,
    });

    return res.status(200).json({
      success: true,
      data: followup,
      message: 'Followup marked as done.',
    });
  } catch (error) {
    console.error('markDone error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/followups/:id
 */
const deleteFollowup = async (req, res) => {
  try {
    const followup = await Followup.findByPk(req.params.id);

    if (!followup) {
      return res.status(404).json({ success: false, message: 'Followup not found.' });
    }

    await followup.destroy();

    await recordActivity({
      userId: req.user.id,
      action: ACTIONS.RECORD_DELETED,
      entityType: 'followup',
      entityId: followup.id,
      req,
      details: { type: followup.type, lead_id: followup.lead_id, customer_id: followup.customer_id },
    });

    return res.status(200).json({ success: true, message: 'Followup deleted successfully.' });
  } catch (error) {
    console.error('deleteFollowup error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllFollowups,
  getTodayFollowups,
  getFollowupById,
  createFollowup,
  updateFollowup,
  markDone,
  deleteFollowup,
};
