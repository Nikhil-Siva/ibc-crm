const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const { SmsAutomation, SmsAutomationLog, Campaign } = require('../models');
const { pick, SMS_AUTOMATION_WRITABLE } = require('../utils/validation');

const VALID_TRIGGER_EVENTS = [
  'lead_created',
  'lead_assigned',
  'lead_status_changed',
  'followup_due',
  'policy_expiry',
  'payment_due',
  'birthday',
  'custom',
];

/**
 * GET /api/sms-automations
 * Get all SmsAutomation records. Include Campaign name if linked.
 * Add sent_count from SmsAutomationLog. Paginate.
 */
const getAllAutomations = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const { rows, count } = await SmsAutomation.findAndCountAll({
      include: [
        { model: Campaign, attributes: ['id', 'name'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    // Get sent counts for all automations in a single query
    const automationIds = rows.map((r) => r.id);
    let sentCountMap = {};

    if (automationIds.length > 0) {
      const sentCounts = await SmsAutomationLog.findAll({
        where: { automation_id: { [Op.in]: automationIds } },
        attributes: [
          'automation_id',
          [fn('COUNT', col('id')), 'sent_count'],
        ],
        group: ['automation_id'],
        raw: true,
      });

      for (const sc of sentCounts) {
        sentCountMap[sc.automation_id] = parseInt(sc.sent_count, 10) || 0;
      }
    }

    const data = rows.map((row) => {
      const plain = row.get({ plain: true });
      return {
        ...plain,
        sent_count: sentCountMap[plain.id] || 0,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        rows: data,
        count,
        page,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('getAllAutomations error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/sms-automations/:id
 * Single automation with recent logs.
 */
const getAutomationById = async (req, res) => {
  try {
    const automation = await SmsAutomation.findByPk(req.params.id, {
      include: [
        { model: Campaign, attributes: ['id', 'name'], required: false },
      ],
    });

    if (!automation) {
      return res.status(404).json({ success: false, message: 'SMS automation not found.' });
    }

    const recentLogs = await SmsAutomationLog.findAll({
      where: { automation_id: automation.id },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    const data = {
      ...automation.get({ plain: true }),
      recent_logs: recentLogs.map((l) => l.get({ plain: true })),
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getAutomationById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/sms-automations
 * Create SmsAutomation. Validate trigger_event. Set created_by from req.user.id.
 */
const createAutomation = async (req, res) => {
  try {
    const { name, trigger_event, template, campaign_id, delay_minutes, is_active } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required.' });
    }

    if (!trigger_event) {
      return res.status(400).json({ success: false, message: 'trigger_event is required.' });
    }

    if (!VALID_TRIGGER_EVENTS.includes(trigger_event)) {
      return res.status(400).json({
        success: false,
        message: `Invalid trigger_event. Must be one of: ${VALID_TRIGGER_EVENTS.join(', ')}`,
      });
    }

    if (!template) {
      return res.status(400).json({ success: false, message: 'template is required.' });
    }

    const automation = await SmsAutomation.create({
      name,
      trigger_event,
      template,
      campaign_id: campaign_id || null,
      delay_minutes: delay_minutes || 0,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user.id,
    });

    return res.status(201).json({ success: true, data: automation });
  } catch (error) {
    console.error('createAutomation error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/sms-automations/:id
 * Update automation fields.
 */
const updateAutomation = async (req, res) => {
  try {
    const automation = await SmsAutomation.findByPk(req.params.id);

    if (!automation) {
      return res.status(404).json({ success: false, message: 'SMS automation not found.' });
    }

    // Validate trigger_event if being updated
    if (req.body.trigger_event && !VALID_TRIGGER_EVENTS.includes(req.body.trigger_event)) {
      return res.status(400).json({
        success: false,
        message: `Invalid trigger_event. Must be one of: ${VALID_TRIGGER_EVENTS.join(', ')}`,
      });
    }

    await automation.update(pick(req.body, SMS_AUTOMATION_WRITABLE));

    return res.status(200).json({ success: true, data: automation });
  } catch (error) {
    console.error('updateAutomation error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/sms-automations/:id
 * Delete automation and its logs.
 */
const deleteAutomation = async (req, res) => {
  try {
    const automation = await SmsAutomation.findByPk(req.params.id);

    if (!automation) {
      return res.status(404).json({ success: false, message: 'SMS automation not found.' });
    }

    // Delete related logs first
    await SmsAutomationLog.destroy({ where: { automation_id: automation.id } });

    await automation.destroy();

    return res.status(200).json({ success: true, message: 'SMS automation deleted successfully.' });
  } catch (error) {
    console.error('deleteAutomation error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PATCH /api/sms-automations/:id/toggle
 * Toggle is_active.
 */
const toggleAutomation = async (req, res) => {
  try {
    const automation = await SmsAutomation.findByPk(req.params.id);

    if (!automation) {
      return res.status(404).json({ success: false, message: 'SMS automation not found.' });
    }

    await automation.update({ is_active: !automation.is_active });

    return res.status(200).json({
      success: true,
      data: automation,
      message: `Automation ${automation.is_active ? 'activated' : 'deactivated'} successfully.`,
    });
  } catch (error) {
    console.error('toggleAutomation error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/sms-automations/:id/logs
 * Get SmsAutomationLog for an automation. Filter by date_from, date_to, status. Paginate.
 */
const getAutomationLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { date_from, date_to, status } = req.query;

    const automation = await SmsAutomation.findByPk(id);
    if (!automation) {
      return res.status(404).json({ success: false, message: 'SMS automation not found.' });
    }

    const where = { automation_id: id };

    if (status) {
      where.status = status;
    }

    if (date_from && date_to) {
      where.createdAt = {
        [Op.between]: [
          dayjs(date_from).startOf('day').toDate(),
          dayjs(date_to).endOf('day').toDate(),
        ],
      };
    } else if (date_from) {
      where.createdAt = { [Op.gte]: dayjs(date_from).startOf('day').toDate() };
    } else if (date_to) {
      where.createdAt = { [Op.lte]: dayjs(date_to).endOf('day').toDate() };
    }

    const { rows, count } = await SmsAutomationLog.findAndCountAll({
      where,
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
    console.error('getAutomationLogs error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/sms-automations/test-send
 * Body: { automation_id, phone_number }
 * Create a SmsAutomationLog with status 'sent'. Replace merge tags with sample values.
 */
const testSendSms = async (req, res) => {
  try {
    const { automation_id, phone_number } = req.body;

    if (!automation_id) {
      return res.status(400).json({ success: false, message: 'automation_id is required.' });
    }

    if (!phone_number) {
      return res.status(400).json({ success: false, message: 'phone_number is required.' });
    }

    const automation = await SmsAutomation.findByPk(automation_id);
    if (!automation) {
      return res.status(404).json({ success: false, message: 'SMS automation not found.' });
    }

    // Replace merge tags with sample values
    const sampleValues = {
      '{{name}}': 'John Doe',
      '{{first_name}}': 'John',
      '{{last_name}}': 'Doe',
      '{{phone}}': phone_number,
      '{{email}}': 'john.doe@example.com',
      '{{company}}': 'Acme Insurance',
      '{{agent_name}}': 'Agent Smith',
      '{{policy_number}}': 'POL-SAMPLE-001',
      '{{premium_amount}}': '₹25,000',
      '{{due_date}}': dayjs().add(7, 'day').format('DD-MMM-YYYY'),
      '{{campaign_name}}': 'Sample Campaign',
    };

    let resolvedText = automation.template;
    for (const [tag, value] of Object.entries(sampleValues)) {
      resolvedText = resolvedText.replace(new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    console.log(`[SMS Test] To: ${phone_number} | Message: ${resolvedText}`);

    const log = await SmsAutomationLog.create({
      automation_id,
      phone_number,
      message_text: resolvedText,
      status: 'sent',
      sent_at: new Date(),
      is_test: true,
    });

    return res.status(201).json({
      success: true,
      data: log,
      message: 'Test SMS logged successfully (not actually sent).',
    });
  } catch (error) {
    console.error('testSendSms error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllAutomations,
  getAutomationById,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  toggleAutomation,
  getAutomationLogs,
  testSendSms,
};
