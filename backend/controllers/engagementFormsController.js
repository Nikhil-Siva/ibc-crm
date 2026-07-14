const { Op } = require('sequelize');
const { EngagementForm, FormSubmission, Lead, User, Campaign } = require('../models');

/**
 * GET /api/engagement-forms/campaign/:campaignId
 * Get EngagementForm by campaign_id. Return the form or null.
 */
const getFormByCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const form = await EngagementForm.findOne({
      where: { campaign_id: campaignId },
    });

    return res.status(200).json({ success: true, data: form });
  } catch (error) {
    console.error('getFormByCampaign error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/engagement-forms
 * Upsert — if form exists for campaign_id, update it. If not, create it.
 * Body: { campaign_id, title, fields }
 */
const createOrUpdateForm = async (req, res) => {
  try {
    const { campaign_id, title, fields } = req.body;

    if (!campaign_id) {
      return res.status(400).json({ success: false, message: 'campaign_id is required.' });
    }
    if (!title) {
      return res.status(400).json({ success: false, message: 'title is required.' });
    }
    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({ success: false, message: 'fields must be a JSON array of field configs.' });
    }

    const existingForm = await EngagementForm.findOne({ where: { campaign_id } });

    let form;
    if (existingForm) {
      await existingForm.update({ title, fields });
      form = existingForm;
    } else {
      form = await EngagementForm.create({
        campaign_id,
        title,
        fields,
        created_by: req.user.id,
      });
    }

    return res.status(existingForm ? 200 : 201).json({ success: true, data: form });
  } catch (error) {
    console.error('createOrUpdateForm error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/engagement-forms/:id
 * Delete form by id.
 */
const deleteForm = async (req, res) => {
  try {
    const form = await EngagementForm.findByPk(req.params.id);

    if (!form) {
      return res.status(404).json({ success: false, message: 'Engagement form not found.' });
    }

    await form.destroy();

    return res.status(200).json({ success: true, message: 'Engagement form deleted successfully.' });
  } catch (error) {
    console.error('deleteForm error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/engagement-forms/submit
 * Create FormSubmission with form_id, lead_id, agent_id, responses.
 * Body: { form_id, lead_id, responses }
 */
const submitForm = async (req, res) => {
  try {
    const { form_id, lead_id, responses } = req.body;

    if (!form_id) {
      return res.status(400).json({ success: false, message: 'form_id is required.' });
    }

    const form = await EngagementForm.findByPk(form_id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Engagement form not found.' });
    }

    if (!lead_id) {
      return res.status(400).json({ success: false, message: 'lead_id is required.' });
    }

    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({ success: false, message: 'responses object is required.' });
    }

    const submission = await FormSubmission.create({
      form_id,
      lead_id,
      agent_id: req.user.id,
      responses,
    });

    return res.status(201).json({ success: true, data: submission });
  } catch (error) {
    console.error('submitForm error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/engagement-forms/:formId/submissions
 * Get submissions for a form. Include Lead (name, mobile), User/agent (name). Paginate.
 */
const getFormSubmissions = async (req, res) => {
  try {
    const { formId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const form = await EngagementForm.findByPk(formId);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Engagement form not found.' });
    }

    const { rows, count } = await FormSubmission.findAndCountAll({
      where: { form_id: formId },
      include: [
        { model: Lead, attributes: ['id', 'name', 'mobile'] },
        { model: User, as: 'agent', attributes: ['id', 'name'] },
      ],
      // FormSubmission sets timestamps: false — submitted_at is its only date.
      order: [['submitted_at', 'DESC']],
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
    console.error('getFormSubmissions error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/engagement-forms/submission/:id
 * Single submission with form fields for display.
 */
const getSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await FormSubmission.findByPk(id, {
      include: [
        {
          model: EngagementForm,
          attributes: ['id', 'title', 'fields', 'campaign_id'],
        },
        { model: Lead, attributes: ['id', 'name', 'mobile', 'email'] },
        { model: User, as: 'agent', attributes: ['id', 'name'] },
      ],
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    return res.status(200).json({ success: true, data: submission });
  } catch (error) {
    console.error('getSubmissionById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getFormByCampaign,
  createOrUpdateForm,
  deleteForm,
  submitForm,
  getFormSubmissions,
  getSubmissionById,
};
