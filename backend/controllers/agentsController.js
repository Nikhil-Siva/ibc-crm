const { Op } = require('sequelize');
const { Agent, User } = require('../models');
const { pick, escapeLike, AGENT_WRITABLE } = require('../utils/validation');

/**
 * GET /api/agents
 * Filters: interview_status, training_status, activation_status, irda_exam_status
 * Include referrer
 */
const getAllAgents = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { search, interview_status, training_status, activation_status, irda_exam_status } = req.query;

    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${escapeLike(search)}%` } },
        { mobile: { [Op.like]: `%${escapeLike(search)}%` } },
      ];
    }

    if (interview_status) where.interview_status = interview_status;
    if (training_status) where.training_status = training_status;
    if (activation_status) where.activation_status = activation_status;
    if (irda_exam_status) where.irda_exam_status = irda_exam_status;

    const { rows, count } = await Agent.findAndCountAll({
      where,
      include: [
        { model: User, as: 'referrer', attributes: ['id', 'name', 'email'] },
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
    console.error('getAllAgents error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/agents/:id
 */
const getAgentById = async (req, res) => {
  try {
    const agent = await Agent.findByPk(req.params.id, {
      include: [
        { model: User, as: 'referrer', attributes: ['id', 'name', 'email', 'mobile'] },
      ],
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found.' });
    }

    return res.status(200).json({ success: true, data: agent });
  } catch (error) {
    console.error('getAgentById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/agents
 */
const createAgent = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }

    const agent = await Agent.create({
      ...pick(req.body, AGENT_WRITABLE),
      referred_by: req.body.referred_by || req.user.id,
    });

    return res.status(201).json({ success: true, data: agent });
  } catch (error) {
    console.error('createAgent error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/agents/:id
 */
const updateAgent = async (req, res) => {
  try {
    const agent = await Agent.findByPk(req.params.id);

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found.' });
    }

    await agent.update(pick(req.body, AGENT_WRITABLE));

    return res.status(200).json({ success: true, data: agent });
  } catch (error) {
    console.error('updateAgent error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/agents/:id
 */
const deleteAgent = async (req, res) => {
  try {
    const agent = await Agent.findByPk(req.params.id);

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found.' });
    }

    await agent.destroy();

    return res.status(200).json({ success: true, message: 'Agent deleted successfully.' });
  } catch (error) {
    console.error('deleteAgent error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/agents/stats
 * Counts grouped by interview_status, training_status, activation_status
 */
const getAgentStats = async (req, res) => {
  try {
    const { sequelize } = require('../models');

    const interviewStats = await Agent.findAll({
      attributes: [
        'interview_status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['interview_status'],
      raw: true,
    });

    const trainingStats = await Agent.findAll({
      attributes: [
        'training_status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['training_status'],
      raw: true,
    });

    const activationStats = await Agent.findAll({
      attributes: [
        'activation_status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['activation_status'],
      raw: true,
    });

    const irdaStats = await Agent.findAll({
      attributes: [
        'irda_exam_status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['irda_exam_status'],
      raw: true,
    });

    const totalAgents = await Agent.count();

    return res.status(200).json({
      success: true,
      data: {
        total: totalAgents,
        interview_status: interviewStats,
        training_status: trainingStats,
        activation_status: activationStats,
        irda_exam_status: irdaStats,
      },
    });
  } catch (error) {
    console.error('getAgentStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentStats,
};
