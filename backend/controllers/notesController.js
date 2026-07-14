const { Note, Lead, Customer, User } = require('../models');
const { recordActivity, ACTIONS } = require('../services/auditLog');

/**
 * Notes against a lead or a customer.
 *
 * Agents may only touch notes on records assigned to them — the same rule the
 * lead and customer endpoints enforce. Without this check, notes would be a
 * side door onto records an agent can't otherwise read.
 */
const assertSubjectAccess = async (req, { lead_id, customer_id }) => {
  if (lead_id) {
    const lead = await Lead.findByPk(lead_id);
    if (!lead) return { error: { status: 404, message: 'Lead not found.' } };
    if (req.user.role === 'agent' && lead.assigned_to !== req.user.id) {
      return { error: { status: 403, message: 'Access denied. You can only access your own leads.' } };
    }
    return { subject: lead };
  }

  const customer = await Customer.findByPk(customer_id);
  if (!customer) return { error: { status: 404, message: 'Customer not found.' } };
  if (req.user.role === 'agent' && customer.assigned_to !== req.user.id) {
    return { error: { status: 403, message: 'Access denied. You can only access your own customers.' } };
  }
  return { subject: customer };
};

/**
 * GET /api/notes?lead_id=1  |  ?customer_id=1
 */
const getNotes = async (req, res) => {
  try {
    const lead_id = req.query.lead_id ? parseInt(req.query.lead_id, 10) : null;
    const customer_id = req.query.customer_id ? parseInt(req.query.customer_id, 10) : null;

    if (!lead_id && !customer_id) {
      return res.status(400).json({ success: false, message: 'lead_id or customer_id is required.' });
    }
    if (lead_id && customer_id) {
      return res.status(400).json({ success: false, message: 'Provide only one of lead_id or customer_id.' });
    }

    const { error } = await assertSubjectAccess(req, { lead_id, customer_id });
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const { rows, count } = await Note.findAndCountAll({
      where: lead_id ? { lead_id } : { customer_id },
      include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    return res.status(200).json({
      success: true,
      data: { rows, count, page, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) {
    console.error('getNotes error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/notes
 * Body: { lead_id | customer_id, body }
 */
const createNote = async (req, res) => {
  try {
    const { lead_id, customer_id, body } = req.body;

    if (!body || !String(body).trim()) {
      return res.status(400).json({ success: false, message: 'body is required.' });
    }
    if (Boolean(lead_id) === Boolean(customer_id)) {
      return res.status(400).json({ success: false, message: 'Provide exactly one of lead_id or customer_id.' });
    }

    const { error } = await assertSubjectAccess(req, { lead_id, customer_id });
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const note = await Note.create({
      lead_id: lead_id || null,
      customer_id: customer_id || null,
      body: String(body).trim(),
      kind: 'manual',
      created_by: req.user.id,
    });

    return res.status(201).json({ success: true, data: note });
  } catch (error) {
    console.error('createNote error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/notes/:id
 */
const updateNote = async (req, res) => {
  try {
    const note = await Note.findByPk(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    // Only the author may edit their own note; admins/managers may edit any.
    if (req.user.role === 'agent' && note.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own notes.' });
    }

    const { body } = req.body;
    if (!body || !String(body).trim()) {
      return res.status(400).json({ success: false, message: 'body is required.' });
    }

    await note.update({ body: String(body).trim() });

    return res.status(200).json({ success: true, data: note });
  } catch (error) {
    console.error('updateNote error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/notes/:id
 */
const deleteNote = async (req, res) => {
  try {
    const note = await Note.findByPk(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    if (req.user.role === 'agent' && note.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only delete your own notes.' });
    }

    await note.destroy();

    await recordActivity({
      userId: req.user.id,
      action: ACTIONS.RECORD_DELETED,
      entityType: 'note',
      entityId: note.id,
      req,
      details: { lead_id: note.lead_id, customer_id: note.customer_id },
    });

    return res.status(200).json({ success: true, message: 'Note deleted successfully.' });
  } catch (error) {
    console.error('deleteNote error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { getNotes, createNote, updateNote, deleteNote };
