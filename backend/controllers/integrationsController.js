const { CrmIntegration, IntegrationLog, Lead, Campaign } = require('../models');
const { runAsSystem, runWithOrg } = require('../services/tenancy');
const { v4: uuidv4 } = require('uuid');

const getAllIntegrations = async (req, res) => {
  try {
    const integrations = await CrmIntegration.findAll({
      include: [
        {
          model: Campaign,
          as: 'targetCampaign',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.json({ success: true, data: integrations });
  } catch (error) {
    console.error('getAllIntegrations error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getIntegrationById = async (req, res) => {
  try {
    const { id } = req.params;

    const integration = await CrmIntegration.findByPk(id, {
      include: [
        {
          model: Campaign,
          as: 'targetCampaign',
          attributes: ['id', 'name']
        },
        {
          model: IntegrationLog,
          as: 'logs',
          limit: 50,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    return res.json({ success: true, data: integration });
  } catch (error) {
    console.error('getIntegrationById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const createIntegration = async (req, res) => {
  try {
    const { name, type, config, target_campaign_id, is_active } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'name and type are required' });
    }

    const integrationData = {
      name,
      type,
      config: config || {},
      target_campaign_id: target_campaign_id || null,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user.id
    };

    if (type === 'webhook_generic') {
      const webhookUuid = uuidv4();
      integrationData.webhook_url = `/api/webhooks/incoming/${webhookUuid}`;
    }

    const integration = await CrmIntegration.create(integrationData);

    const fullIntegration = await CrmIntegration.findByPk(integration.id, {
      include: [
        {
          model: Campaign,
          as: 'targetCampaign',
          attributes: ['id', 'name']
        }
      ]
    });

    return res.status(201).json({ success: true, data: fullIntegration });
  } catch (error) {
    console.error('createIntegration error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const updateIntegration = async (req, res) => {
  try {
    const { id } = req.params;
    const { config, target_campaign_id, is_active, name } = req.body;

    const integration = await CrmIntegration.findByPk(id);
    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (config !== undefined) updateData.config = config;
    if (target_campaign_id !== undefined) updateData.target_campaign_id = target_campaign_id;
    if (is_active !== undefined) updateData.is_active = is_active;

    await integration.update(updateData);

    const updated = await CrmIntegration.findByPk(id, {
      include: [
        {
          model: Campaign,
          as: 'targetCampaign',
          attributes: ['id', 'name']
        }
      ]
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('updateIntegration error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const deleteIntegration = async (req, res) => {
  try {
    const { id } = req.params;

    const integration = await CrmIntegration.findByPk(id);
    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    const logCount = await IntegrationLog.count({ where: { integration_id: id } });

    if (logCount > 0) {
      await integration.update({ is_active: false });
      return res.json({
        success: true,
        data: { deactivated: true },
        message: 'Integration has existing logs and was deactivated instead of deleted'
      });
    }

    await integration.destroy();
    return res.json({ success: true, message: 'Integration deleted successfully' });
  } catch (error) {
    console.error('deleteIntegration error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const syncIntegration = async (req, res) => {
  try {
    const { id } = req.params;

    const integration = await CrmIntegration.findByPk(id);
    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    if (!integration.is_active) {
      return res.status(400).json({ success: false, message: 'Integration is inactive. Activate it before syncing.' });
    }

    const log = await IntegrationLog.create({
      integration_id: integration.id,
      event_type: 'sync',
      status: 'success',
      request_data: JSON.stringify({ triggered_by: req.user.id, triggered_at: new Date().toISOString() }),
      response_data: JSON.stringify({
        message: `Sync triggered for ${integration.name}`,
        records_synced: 0,
        sample: true
      }),
      records_processed: 0
    });

    return res.json({
      success: true,
      data: log,
      message: `Sync triggered for ${integration.name}`
    });
  } catch (error) {
    console.error('syncIntegration error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getIntegrationLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const integration = await CrmIntegration.findByPk(id);
    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    const { count, rows } = await IntegrationLog.findAndCountAll({
      where: { integration_id: id },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return res.json({
      success: true,
      data: {
        logs: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('getIntegrationLogs error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const handleWebhook = async (req, res) => {
  try {
    const { webhookId } = req.params;

    // Public endpoint: there is no authenticated user and therefore no tenant
    // context. The webhook URL itself identifies the integration, and the
    // integration carries the org that everything below must be written into.
    const integration = await runAsSystem(() => CrmIntegration.findOne({
      where: {
        webhook_url: `/api/webhooks/incoming/${webhookId}`
      }
    }));

    if (!integration) {
      return res.status(404).json({ success: false, message: 'Webhook not found' });
    }

    if (!integration.is_active) {
      return res.status(403).json({ success: false, message: 'Webhook integration is inactive' });
    }

    let lead = null;
    let logStatus = 'success';
    let logResponse = {};

    // mobile is NOT NULL on leads, so a payload without a number can never
    // become a lead — reject it rather than logging a phantom success.
    const mobile = req.body.mobile || req.body.phone || null;

    if (!mobile) {
      logStatus = 'failed';
      logResponse = { error: 'Payload has no mobile/phone number.' };
    } else {
      try {
        const name = req.body.name || req.body.first_name || 'Webhook Lead';
        const inbound = req.body;
        // The lead belongs to the integration's tenant.
        lead = await runWithOrg(integration.org_id, () => Lead.create({
          name: String(name).slice(0, 100),
          email: inbound.email || null,
          mobile: String(mobile).slice(0, 15),
          // 'source' is an ENUM — the integration name goes in notes instead.
          source: 'Other',
          campaign_id: integration.target_campaign_id || null,
          notes: `Received via integration "${integration.name}".\n${JSON.stringify(inbound)}`,
        }));
        logResponse = { lead_id: lead.id, message: 'Lead created successfully' };
      } catch (leadError) {
        logStatus = 'failed';
        logResponse = { error: leadError.message };
      }
    }

    await runWithOrg(integration.org_id, () => IntegrationLog.create({
      integration_id: integration.id,
      event_type: 'webhook_received',
      status: logStatus,
      request_data: JSON.stringify(req.body),
      response_data: JSON.stringify(logResponse),
      records_processed: logStatus === 'success' ? 1 : 0
    }));

    // Report the real outcome — the caller needs to know its lead was dropped.
    if (logStatus === 'failed') {
      return res.status(422).json({ success: false, message: 'Webhook received but lead could not be created', data: logResponse });
    }

    return res.status(200).json({ success: true, message: 'Webhook received', data: logResponse });
  } catch (error) {
    console.error('handleWebhook error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllIntegrations,
  getIntegrationById,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  syncIntegration,
  getIntegrationLogs,
  handleWebhook
};
