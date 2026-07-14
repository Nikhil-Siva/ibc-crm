const { Op } = require('sequelize');
const { sequelize, Lead, User, Customer, Followup, CallLog, ActivityLog, Note } = require('../models');
const { recordActivity, ACTIONS } = require('../services/auditLog');
const { pick, escapeLike, LEAD_WRITABLE, CUSTOMER_WRITABLE } = require('../utils/validation');

/**
 * GET /api/leads
 * Pagination, search (name/mobile), filters (status, source, priority, assigned_to)
 */
const getAllLeads = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { search, status, source, priority, assigned_to } = req.query;

    const where = {};

    if (search) {
      const term = `%${escapeLike(search)}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { mobile: { [Op.like]: term } },
      ];
    }

    if (status) where.status = status;
    if (source) where.source = source;
    if (priority) where.priority = priority;
    if (assigned_to) where.assigned_to = assigned_to;

    // If user is 'agent' (telecaller), restrict to their assigned leads only
    if (req.user.role === 'agent') {
      where.assigned_to = req.user.id;
    }

    const { rows, count } = await Lead.findAndCountAll({
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
    console.error('getAllLeads error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/leads/:id
 */
const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        { model: User, as: 'assignedAgent', attributes: ['id', 'name', 'email', 'mobile'] },
        {
          model: Followup,
          include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }],
        },
      ],
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    // Ownership check for agents
    if (req.user.role === 'agent' && lead.assigned_to !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own leads.' });
    }

    return res.status(200).json({ success: true, data: lead });
  } catch (error) {
    console.error('getLeadById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/leads
 */
const createLead = async (req, res) => {
  try {
    const { name, mobile } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Name and mobile are required.',
      });
    }

    // Only admins/managers may assign a lead to someone else; agents always own what they create.
    const canAssign = req.user.role !== 'agent';

    const lead = await Lead.create({
      ...pick(req.body, LEAD_WRITABLE),
      assigned_to: (canAssign && req.body.assigned_to) || req.user.id,
    });

    return res.status(201).json({ success: true, data: lead });
  } catch (error) {
    console.error('createLead error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/leads/:id
 */
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    // Ownership check for agents
    if (req.user.role === 'agent' && lead.assigned_to !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only update your own leads.' });
    }

    const updates = pick(req.body, LEAD_WRITABLE);
    // Reassignment is an admin/manager action, never something an agent can do to itself.
    if (req.user.role !== 'agent' && req.body.assigned_to !== undefined) {
      updates.assigned_to = req.body.assigned_to;
    }

    await lead.update(updates);

    return res.status(200).json({ success: true, data: lead });
  } catch (error) {
    console.error('updateLead error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/leads/:id
 */
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    await lead.destroy();

    await recordActivity({
      userId: req.user.id,
      action: ACTIONS.RECORD_DELETED,
      entityType: 'lead',
      entityId: lead.id,
      req,
      details: { name: lead.name || null },
    });

    return res.status(200).json({ success: true, message: 'Lead deleted successfully.' });
  } catch (error) {
    console.error('deleteLead error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/leads/convert/:id
 * Convert lead to customer, set lead status to 'Closed Won'
 */
const convertToCustomer = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    // Check if already converted
    const existingCustomer = await Customer.findOne({ where: { lead_id: lead.id } });
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Lead has already been converted to a customer.',
      });
    }

    // Both writes must land together, or the lead stays open with no customer behind it.
    const customer = await sequelize.transaction(async (t) => {
      const created = await Customer.create({
        name: lead.name,
        mobile: lead.mobile,
        email: lead.email,
        occupation: lead.occupation,
        city: lead.city,
        // Extra profile fields (dob, gender, address…) may come from the body,
        // but lead_id and assigned_to are derived from the lead, never the client.
        ...pick(req.body, CUSTOMER_WRITABLE),
        lead_id: lead.id,
        assigned_to: lead.assigned_to,
      }, { transaction: t });

      await lead.update({ status: 'Closed Won' }, { transaction: t });
      return created;
    });

    return res.status(201).json({
      success: true,
      data: customer,
      message: 'Lead converted to customer successfully.',
    });
  } catch (error) {
    console.error('convertToCustomer error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/leads/pipeline
 * Group leads by status with counts – for kanban/pipeline view
 */
const getLeadsByStatus = async (req, res) => {
  try {
    const statuses = [
      'New', 'Interested', 'Follow-up', 'Proposal Sent',
      'Document Collection', 'Payment Pending', 'Closed Won', 'Closed Lost', 'Not Interested',
    ];

    // Cap the cards fetched per column — a kanban board never renders 50k leads,
    // and the previous version pulled every row of every status on each request.
    const perStage = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const scope = {};
    if (req.user.role === 'agent') {
      scope.assigned_to = req.user.id;
    }

    // One grouped COUNT for the column totals, instead of a COUNT per status.
    const counts = await Lead.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: scope,
      group: ['status'],
      raw: true,
    });
    const countByStatus = Object.fromEntries(counts.map((r) => [r.status, parseInt(r.count, 10)]));

    const pipeline = {};
    await Promise.all(statuses.map(async (status) => {
      const leads = await Lead.findAll({
        where: { ...scope, status },
        include: [
          { model: User, as: 'assignedAgent', attributes: ['id', 'name'] },
        ],
        order: [['updatedAt', 'DESC']],
        limit: perStage,
      });

      pipeline[status] = {
        count: countByStatus[status] || 0,
        leads,
      };
    }));

    return res.status(200).json({ success: true, data: pipeline });
  } catch (error) {
    console.error('getLeadsByStatus error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/leads/bulk-assign
 * Body: { leadIds: [1,2,3], agentId: 5 }
 */
const bulkAssign = async (req, res) => {
  try {
    const { leadIds, agentId } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'leadIds array is required.',
      });
    }

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'agentId is required.',
      });
    }

    // Verify agent exists
    const agent = await User.findByPk(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent (user) not found.' });
    }

    const [updatedCount] = await Lead.update(
      { assigned_to: agentId },
      { where: { id: { [Op.in]: leadIds } } }
    );

    return res.status(200).json({
      success: true,
      message: `${updatedCount} lead(s) assigned to ${agent.name}.`,
      data: { updatedCount },
    });
  } catch (error) {
    console.error('bulkAssign error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/leads/:id/call-notes
 * Accepts: { outcome, duration_seconds, notes, phone_number }
 */
const addCallNote = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    // Ownership check for agents
    if (req.user.role === 'agent' && lead.assigned_to !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only add notes to your own leads.' });
    }

    const { outcome, duration_seconds, notes, phone_number } = req.body;

    // CallLog requires a non-null status and phone_number — reject before writing
    // anything rather than half-applying the note and failing on the insert.
    const CALL_OUTCOMES = ['connected', 'not_connected', 'busy', 'no_answer', 'voicemail'];
    if (!CALL_OUTCOMES.includes(outcome)) {
      return res.status(400).json({
        success: false,
        message: `outcome must be one of: ${CALL_OUTCOMES.join(', ')}.`,
      });
    }

    const callNumber = phone_number || lead.mobile;
    if (!callNumber) {
      return res.status(400).json({ success: false, message: 'phone_number is required.' });
    }

    // The note, the call log, and the activity log are one logical event.
    await sequelize.transaction(async (t) => {
      lead.last_contacted_at = new Date();
      await lead.save({ transaction: t });

      // A real row per note, rather than appending to a TEXT blob: this one is
      // attributable, timestamped, editable and queryable.
      if (notes && String(notes).trim()) {
        await Note.create({
          lead_id: lead.id,
          body: String(notes).trim(),
          kind: 'call',
          created_by: req.user.id,
        }, { transaction: t });
      }

      await CallLog.create({
        lead_id: lead.id,
        agent_id: req.user.id,
        status: outcome,
        duration_seconds,
        notes,
        phone_number: callNumber,
        started_at: new Date(),
      }, { transaction: t });

      await ActivityLog.create({
        user_id: req.user.id,
        action: 'call_made',
        entity_type: 'lead',
        entity_id: lead.id,
        details: { outcome, duration_seconds },
      }, { transaction: t });
    });

    return res.status(200).json({ success: true, data: lead });
  } catch (error) {
    console.error('addCallNote error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  convertToCustomer,
  getLeadsByStatus,
  bulkAssign,
  addCallNote,
};
