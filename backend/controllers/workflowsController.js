const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const { Workflow, WorkflowRunLog, Lead } = require('../models');
const { pick, WORKFLOW_WRITABLE } = require('../utils/validation');

const VALID_TRIGGER_TYPES = [
  'lead_created',
  'lead_status_changed',
  'lead_assigned',
  'followup_due',
  'form_submitted',
  'policy_expiry',
  'manual',
  'scheduled',
];

/**
 * GET /api/workflows
 * Get all Workflow records. Add run_count, last_run_at, steps count. Paginate.
 */
const getAllWorkflows = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const { rows, count } = await Workflow.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const workflowIds = rows.map((r) => r.id);
    let runCountMap = {};
    let lastRunMap = {};

    if (workflowIds.length > 0) {
      const runStats = await WorkflowRunLog.findAll({
        where: { workflow_id: { [Op.in]: workflowIds } },
        attributes: [
          'workflow_id',
          [fn('COUNT', col('id')), 'run_count'],
          [fn('MAX', col('createdAt')), 'last_run_at'],
        ],
        group: ['workflow_id'],
        raw: true,
      });

      for (const stat of runStats) {
        runCountMap[stat.workflow_id] = parseInt(stat.run_count, 10) || 0;
        lastRunMap[stat.workflow_id] = stat.last_run_at || null;
      }
    }

    const data = rows.map((row) => {
      const plain = row.get({ plain: true });
      const steps = plain.steps;
      const stepsCount = Array.isArray(steps) ? steps.length : 0;

      return {
        ...plain,
        steps_count: stepsCount,
        run_count: runCountMap[plain.id] || 0,
        last_run_at: lastRunMap[plain.id] || null,
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
    console.error('getAllWorkflows error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/workflows/:id
 * Single workflow with recent run logs (last 10).
 */
const getWorkflowById = async (req, res) => {
  try {
    const workflow = await Workflow.findByPk(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found.' });
    }

    const recentLogs = await WorkflowRunLog.findAll({
      where: { workflow_id: workflow.id },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    const data = {
      ...workflow.get({ plain: true }),
      recent_run_logs: recentLogs.map((l) => l.get({ plain: true })),
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getWorkflowById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/workflows
 * Create Workflow. Validate trigger_type and that steps is a non-empty array.
 * Set created_by from req.user.id.
 */
const createWorkflow = async (req, res) => {
  try {
    const { name, trigger_type, trigger_config, steps, is_active } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required.' });
    }

    if (!trigger_type) {
      return res.status(400).json({ success: false, message: 'trigger_type is required.' });
    }

    if (!VALID_TRIGGER_TYPES.includes(trigger_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid trigger_type. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`,
      });
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'steps must be a non-empty array.',
      });
    }

    const workflow = await Workflow.create({
      name,
      trigger_type,
      trigger_config: trigger_config || null,
      steps,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user.id,
    });

    return res.status(201).json({ success: true, data: workflow });
  } catch (error) {
    console.error('createWorkflow error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/workflows/:id
 * Update workflow fields including steps JSON.
 */
const updateWorkflow = async (req, res) => {
  try {
    const workflow = await Workflow.findByPk(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found.' });
    }

    // Validate trigger_type if being updated
    if (req.body.trigger_type && !VALID_TRIGGER_TYPES.includes(req.body.trigger_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid trigger_type. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`,
      });
    }

    // Validate steps if being updated
    if (req.body.steps !== undefined) {
      if (!Array.isArray(req.body.steps) || req.body.steps.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'steps must be a non-empty array.',
        });
      }
    }

    await workflow.update(pick(req.body, WORKFLOW_WRITABLE));

    return res.status(200).json({ success: true, data: workflow });
  } catch (error) {
    console.error('updateWorkflow error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/workflows/:id
 * Delete workflow and run logs.
 */
const deleteWorkflow = async (req, res) => {
  try {
    const workflow = await Workflow.findByPk(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found.' });
    }

    // Delete related run logs first
    await WorkflowRunLog.destroy({ where: { workflow_id: workflow.id } });

    await workflow.destroy();

    return res.status(200).json({ success: true, message: 'Workflow deleted successfully.' });
  } catch (error) {
    console.error('deleteWorkflow error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PATCH /api/workflows/:id/toggle
 * Toggle is_active.
 */
const toggleWorkflow = async (req, res) => {
  try {
    const workflow = await Workflow.findByPk(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found.' });
    }

    await workflow.update({ is_active: !workflow.is_active });

    return res.status(200).json({
      success: true,
      data: workflow,
      message: `Workflow ${workflow.is_active ? 'activated' : 'deactivated'} successfully.`,
    });
  } catch (error) {
    console.error('toggleWorkflow error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/workflows/:id/logs
 * Get WorkflowRunLog for a workflow. Filter by status, date range. Paginate.
 */
const getWorkflowRunLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { status, date_from, date_to } = req.query;

    const workflow = await Workflow.findByPk(id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found.' });
    }

    const where = { workflow_id: id };

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

    const { rows, count } = await WorkflowRunLog.findAndCountAll({
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
    console.error('getWorkflowRunLogs error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/workflows/test-run
 * Body: { workflow_id, lead_id }
 * Simulate a workflow run. Walk through each step and log what would happen.
 */
const testRunWorkflow = async (req, res) => {
  try {
    const { workflow_id, lead_id } = req.body;

    if (!workflow_id) {
      return res.status(400).json({ success: false, message: 'workflow_id is required.' });
    }

    if (!lead_id) {
      return res.status(400).json({ success: false, message: 'lead_id is required.' });
    }

    const workflow = await Workflow.findByPk(workflow_id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found.' });
    }

    const lead = await Lead.findByPk(lead_id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const leadPlain = lead.get({ plain: true });
    const steps = workflow.steps;

    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ success: false, message: 'Workflow has no steps configured.' });
    }

    const stepsExecuted = [];
    const startedAt = new Date();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepResult = {
        step_index: i + 1,
        type: step.type || 'unknown',
        name: step.name || `Step ${i + 1}`,
        status: 'simulated',
        executed_at: new Date(),
        result: '',
      };

      switch (step.type) {
        case 'send_sms':
          stepResult.result = `Would send SMS to ${leadPlain.mobile || 'N/A'}: "${step.template || step.message || 'No template'}"`;
          break;

        case 'send_email':
          stepResult.result = `Would send email to ${leadPlain.email || 'N/A'} with subject: "${step.subject || 'No subject'}"`;
          break;

        case 'change_status':
        case 'update_status':
          stepResult.result = `Would change lead status from "${leadPlain.status || 'N/A'}" to "${step.target_status || step.status || 'N/A'}"`;
          break;

        case 'change_stage':
        case 'update_stage':
          stepResult.result = `Would change stage to "${step.target_stage || step.stage || 'N/A'}"`;
          break;

        case 'assign_agent':
          stepResult.result = `Would assign lead to agent ID: ${step.agent_id || 'N/A'}`;
          break;

        case 'add_tag':
          stepResult.result = `Would add tag "${step.tag || 'N/A'}" to lead`;
          break;

        case 'remove_tag':
          stepResult.result = `Would remove tag "${step.tag || 'N/A'}" from lead`;
          break;

        case 'create_followup':
          stepResult.result = `Would create follow-up: "${step.note || 'N/A'}" scheduled in ${step.delay_hours || 24} hours`;
          break;

        case 'send_whatsapp':
          stepResult.result = `Would send WhatsApp message to ${leadPlain.mobile || 'N/A'}: "${step.template || step.message || 'No template'}"`;
          break;

        case 'wait':
        case 'delay':
          stepResult.result = `Would wait for ${step.delay_minutes || step.duration || 0} minutes before next step`;
          break;

        case 'condition':
          stepResult.result = `Would evaluate condition: "${step.condition || step.expression || 'N/A'}"`;
          break;

        case 'webhook':
          stepResult.result = `Would call webhook URL: ${step.url || 'N/A'} with method ${step.method || 'POST'}`;
          break;

        case 'notification':
          stepResult.result = `Would send notification: "${step.message || step.text || 'N/A'}"`;
          break;

        default:
          stepResult.result = `Would execute unknown step type "${step.type}" with config: ${JSON.stringify(step)}`;
          break;
      }

      stepsExecuted.push(stepResult);
    }

    const completedAt = new Date();

    const runLog = await WorkflowRunLog.create({
      workflow_id,
      lead_id,
      status: 'completed',
      steps_executed: stepsExecuted,
      started_at: startedAt,
      completed_at: completedAt,
      is_test: true,
      triggered_by: req.user.id,
    });

    return res.status(201).json({
      success: true,
      data: runLog,
      message: 'Test workflow run completed. No actual actions were performed.',
    });
  } catch (error) {
    console.error('testRunWorkflow error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllWorkflows,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflow,
  getWorkflowRunLogs,
  testRunWorkflow,
};
