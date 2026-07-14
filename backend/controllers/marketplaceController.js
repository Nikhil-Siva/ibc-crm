const { Op } = require('sequelize');
const { MarketplaceProvider, OrgProviderConnection } = require('../models');

/**
 * GET /api/marketplace/providers
 * Get all MarketplaceProvider records. Filter by category if provided.
 * For each provider, check if OrgProviderConnection exists (is_connected flag).
 */
const getAllProviders = async (req, res) => {
  try {
    const { category } = req.query;
    const where = {};

    if (category) {
      where.category = category;
    }

    const providers = await MarketplaceProvider.findAll({ where, order: [['name', 'ASC']] });

    const providerIds = providers.map((p) => p.id);

    const connections = await OrgProviderConnection.findAll({
      where: {
        provider_id: { [Op.in]: providerIds },
        is_active: true,
      },
      raw: true,
    });

    const connectedMap = {};
    for (const conn of connections) {
      connectedMap[conn.provider_id] = true;
    }

    const data = providers.map((provider) => {
      const plain = provider.get({ plain: true });
      return {
        ...plain,
        is_connected: !!connectedMap[plain.id],
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getAllProviders error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/marketplace/providers/:id
 * Single provider with connection details if connected.
 */
const getProviderById = async (req, res) => {
  try {
    const provider = await MarketplaceProvider.findByPk(req.params.id);

    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found.' });
    }

    const connection = await OrgProviderConnection.findOne({
      where: {
        provider_id: provider.id,
        is_active: true,
      },
    });

    const data = {
      ...provider.get({ plain: true }),
      is_connected: !!connection,
      connection: connection ? connection.get({ plain: true }) : null,
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getProviderById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/marketplace/connect
 * Body: { provider_id, api_key, api_secret, extra_config }
 * Create OrgProviderConnection.
 */
const connectProvider = async (req, res) => {
  try {
    const { provider_id, api_key, api_secret, extra_config } = req.body;

    if (!provider_id) {
      return res.status(400).json({ success: false, message: 'provider_id is required.' });
    }

    const provider = await MarketplaceProvider.findByPk(provider_id);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found.' });
    }

    // Check if already connected
    const existingConnection = await OrgProviderConnection.findOne({
      where: { provider_id, is_active: true },
    });

    if (existingConnection) {
      return res.status(400).json({
        success: false,
        message: 'Provider is already connected. Use reconfigure to update credentials.',
      });
    }

    const connection = await OrgProviderConnection.create({
      provider_id,
      api_key: api_key || null,
      api_secret: api_secret || null,
      extra_config: extra_config || null,
      is_active: true,
      connected_by: req.user.id,
      connected_at: new Date(),
    });

    return res.status(201).json({ success: true, data: connection });
  } catch (error) {
    console.error('connectProvider error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/marketplace/disconnect/:id
 * Set OrgProviderConnection is_active=false for the provider.
 */
const disconnectProvider = async (req, res) => {
  try {
    const { id: providerId } = req.params;

    const connection = await OrgProviderConnection.findOne({
      where: { provider_id: providerId, is_active: true },
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'No active connection found for this provider.',
      });
    }

    await connection.update({
      is_active: false,
      disconnected_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Provider disconnected successfully.',
    });
  } catch (error) {
    console.error('disconnectProvider error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/marketplace/reconfigure/:id
 * Update existing OrgProviderConnection with new credentials.
 * Body: { api_key, api_secret, extra_config }
 */
const reconfigureProvider = async (req, res) => {
  try {
    const { id: providerId } = req.params;
    const { api_key, api_secret, extra_config } = req.body;

    const connection = await OrgProviderConnection.findOne({
      where: { provider_id: providerId, is_active: true },
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'No active connection found for this provider.',
      });
    }

    const updates = {};
    if (api_key !== undefined) updates.api_key = api_key;
    if (api_secret !== undefined) updates.api_secret = api_secret;
    if (extra_config !== undefined) updates.extra_config = extra_config;

    await connection.update(updates);

    return res.status(200).json({ success: true, data: connection });
  } catch (error) {
    console.error('reconfigureProvider error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/marketplace/test/:id
 * Mock test — always return success. Log the test.
 */
const testConnection = async (req, res) => {
  try {
    const { id: providerId } = req.params;

    const connection = await OrgProviderConnection.findOne({
      where: { provider_id: providerId, is_active: true },
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'No active connection found for this provider.',
      });
    }

    console.log(`[Marketplace] Connection test for provider_id=${providerId} at ${new Date().toISOString()} — SUCCESS`);

    await connection.update({ last_tested_at: new Date() });

    return res.status(200).json({
      success: true,
      message: 'Connection verified successfully.',
      data: {
        provider_id: parseInt(providerId, 10),
        tested_at: new Date(),
        status: 'ok',
      },
    });
  } catch (error) {
    console.error('testConnection error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllProviders,
  getProviderById,
  connectProvider,
  disconnectProvider,
  reconfigureProvider,
  testConnection,
};
