const { Op } = require('sequelize');
const { sequelize } = require('../models');
const { Campaign, Pipeline, PipelineStage, User, CampaignAgent, Lead, CallLog, AgentSession } = require('../models');
const { escapeLike } = require('../utils/validation');

const getAllCampaigns = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status, pipeline_id, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (pipeline_id) where.pipeline_id = pipeline_id;
    if (search) {
      where.name = { [Op.like]: `%${escapeLike(search)}%` };
    }

    const { count, rows } = await Campaign.findAndCountAll({
      where,
      include: [
        {
          model: Pipeline,
          as: 'pipeline',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'manager',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    const campaignsWithCounts = await Promise.all(
      rows.map(async (campaign) => {
        const campaignJson = campaign.toJSON();
        const [agentCount, leadCount] = await Promise.all([
          CampaignAgent.count({ where: { campaign_id: campaign.id } }),
          Lead.count({ where: { campaign_id: campaign.id } })
        ]);
        campaignJson.agentCount = agentCount;
        campaignJson.leadCount = leadCount;
        return campaignJson;
      })
    );

    return res.json({
      success: true,
      data: {
        campaigns: campaignsWithCounts,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('getAllCampaigns error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByPk(id, {
      include: [
        {
          model: Pipeline,
          as: 'pipeline',
          include: [
            {
              model: PipelineStage,
              as: 'stages',
              order: [['order_index', 'ASC']]
            }
          ]
        },
        {
          model: User,
          as: 'manager',
          attributes: ['id', 'name', 'email']
        },
        {
          model: CampaignAgent,
          as: 'campaignAgents',
          include: [
            {
              model: User,
              as: 'agent',
              attributes: ['id', 'name', 'email']
            }
          ]
        }
      ],
      order: [
        [{ model: Pipeline, as: 'pipeline' }, { model: PipelineStage, as: 'stages' }, 'order_index', 'ASC']
      ]
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const campaignJson = campaign.toJSON();

    if (campaign.pipeline && campaign.pipeline.stages) {
      const leadsPerStage = await Promise.all(
        campaign.pipeline.stages.map(async (stage) => {
          const count = await Lead.count({
            where: {
              campaign_id: id,
              pipeline_stage_id: stage.id
            }
          });
          return { stageId: stage.id, stageName: stage.name, leadCount: count };
        })
      );
      campaignJson.leadsPerStage = leadsPerStage;
    }

    return res.json({ success: true, data: campaignJson });
  } catch (error) {
    console.error('getCampaignById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const createCampaign = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      name,
      pipeline_id,
      manager_id,
      description,
      status,
      lead_distribution_type,
      conditional_distribution_rules,
      duplicacy_action,
      agent_ids
    } = req.body;

    if (!name || !pipeline_id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'name and pipeline_id are required' });
    }

    const pipelineExists = await Pipeline.findByPk(pipeline_id);
    if (!pipelineExists) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Pipeline not found' });
    }

    const campaign = await Campaign.create({
      name,
      pipeline_id,
      manager_id: manager_id || null,
      description: description || null,
      status: status || 'active',
      // These fall back to the model's ENUM defaults. The previous fallbacks
      // ('round_robin', 'allow') are not members of either ENUM, so MySQL
      // truncated them and every create failed.
      lead_distribution_type: lead_distribution_type || 'equal',
      // JSON column — Sequelize serialises it; stringifying here double-encodes.
      conditional_distribution_rules: conditional_distribution_rules || [],
      duplicacy_action: duplicacy_action || 'ignore',
      created_by: req.user ? req.user.id : null
    }, { transaction });

    if (agent_ids && Array.isArray(agent_ids) && agent_ids.length > 0) {
      const agentRecords = agent_ids.map(agentId => ({
        campaign_id: campaign.id,
        agent_id: agentId
      }));
      await CampaignAgent.bulkCreate(agentRecords, { transaction });
    }

    await transaction.commit();

    const fullCampaign = await Campaign.findByPk(campaign.id, {
      include: [
        {
          model: Pipeline,
          as: 'pipeline',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'manager',
          attributes: ['id', 'name']
        },
        {
          model: CampaignAgent,
          as: 'campaignAgents',
          include: [{ model: User, as: 'agent', attributes: ['id', 'name'] }]
        }
      ]
    });

    return res.status(201).json({ success: true, data: fullCampaign });
  } catch (error) {
    await transaction.rollback();
    console.error('createCampaign error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const updateCampaign = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      name,
      pipeline_id,
      manager_id,
      description,
      status,
      lead_distribution_type,
      conditional_distribution_rules,
      duplicacy_action,
      agent_ids
    } = req.body;

    const campaign = await Campaign.findByPk(id);
    if (!campaign) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (pipeline_id !== undefined) updateData.pipeline_id = pipeline_id;
    if (manager_id !== undefined) updateData.manager_id = manager_id;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (lead_distribution_type !== undefined) updateData.lead_distribution_type = lead_distribution_type;
    if (conditional_distribution_rules !== undefined) {
      // JSON column — Sequelize serialises it; stringifying here double-encodes.
      updateData.conditional_distribution_rules = conditional_distribution_rules;
    }
    if (duplicacy_action !== undefined) updateData.duplicacy_action = duplicacy_action;

    await campaign.update(updateData, { transaction });

    if (agent_ids && Array.isArray(agent_ids)) {
      await CampaignAgent.destroy({ where: { campaign_id: id }, transaction });

      if (agent_ids.length > 0) {
        const agentRecords = agent_ids.map(agentId => ({
          campaign_id: campaign.id,
          agent_id: agentId
        }));
        await CampaignAgent.bulkCreate(agentRecords, { transaction });
      }
    }

    await transaction.commit();

    const updatedCampaign = await Campaign.findByPk(id, {
      include: [
        {
          model: Pipeline,
          as: 'pipeline',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'manager',
          attributes: ['id', 'name']
        },
        {
          model: CampaignAgent,
          as: 'campaignAgents',
          include: [{ model: User, as: 'agent', attributes: ['id', 'name'] }]
        }
      ]
    });

    return res.json({ success: true, data: updatedCampaign });
  } catch (error) {
    await transaction.rollback();
    console.error('updateCampaign error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const deleteCampaign = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByPk(id);
    if (!campaign) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    await CampaignAgent.destroy({ where: { campaign_id: id }, transaction });
    await campaign.destroy({ transaction });

    await transaction.commit();
    return res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('deleteCampaign error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const pauseResumeCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByPk(id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    await campaign.update({ status: newStatus });

    return res.json({
      success: true,
      data: {
        id: campaign.id,
        name: campaign.name,
        status: newStatus
      },
      message: `Campaign ${newStatus === 'active' ? 'resumed' : 'paused'} successfully`
    });
  } catch (error) {
    console.error('pauseResumeCampaign error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getCampaignLeads = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { stage_id, search } = req.query;

    const campaign = await Campaign.findByPk(id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const where = { campaign_id: id };
    if (stage_id) where.pipeline_stage_id = stage_id;
    if (search) {
      const term = `%${escapeLike(search)}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { email: { [Op.like]: term } },
        { mobile: { [Op.like]: term } }
      ];
    }

    const { count, rows } = await Lead.findAndCountAll({
      where,
      include: [
        {
          model: PipelineStage,
          as: 'pipelineStage',
          attributes: ['id', 'name', 'color']
        },
        {
          model: User,
          as: 'assignedAgent',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return res.json({
      success: true,
      data: {
        leads: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('getCampaignLeads error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getCampaignAgents = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByPk(id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const agents = await CampaignAgent.findAll({
      where: { campaign_id: id },
      include: [
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'name', 'email', 'role']
        }
      ]
    });

    return res.json({ success: true, data: agents });
  } catch (error) {
    console.error('getCampaignAgents error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const assignAgents = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { agent_ids } = req.body;

    if (!agent_ids || !Array.isArray(agent_ids) || agent_ids.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'agent_ids array is required' });
    }

    const campaign = await Campaign.findByPk(id);
    if (!campaign) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const existingAgentIds = await CampaignAgent.findAll({
      where: { campaign_id: id },
      attributes: ['agent_id'],
      raw: true
    });

    const existingSet = new Set(existingAgentIds.map(a => a.agent_id));
    const newAgentIds = agent_ids.filter(agentId => !existingSet.has(agentId));

    if (newAgentIds.length > 0) {
      const agentRecords = newAgentIds.map(agentId => ({
        campaign_id: id,
        agent_id: agentId
      }));
      await CampaignAgent.bulkCreate(agentRecords, { transaction });
    }

    await transaction.commit();

    const allAgents = await CampaignAgent.findAll({
      where: { campaign_id: id },
      include: [
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    return res.json({
      success: true,
      data: allAgents,
      message: `${newAgentIds.length} new agent(s) assigned to campaign`
    });
  } catch (error) {
    await transaction.rollback();
    console.error('assignAgents error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getCampaignStats = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByPk(id, {
      include: [
        {
          model: Pipeline,
          as: 'pipeline',
          include: [
            {
              model: PipelineStage,
              as: 'stages',
              attributes: ['id', 'name', 'color', 'order_index']
            }
          ]
        }
      ]
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let leadsPerStage = [];
    if (campaign.pipeline && campaign.pipeline.stages) {
      leadsPerStage = await Promise.all(
        campaign.pipeline.stages.map(async (stage) => {
          const count = await Lead.count({
            where: { campaign_id: id, pipeline_stage_id: stage.id }
          });
          return {
            stageId: stage.id,
            stageName: stage.name,
            stageColor: stage.color,
            orderIndex: stage.order_index,
            leadCount: count
          };
        })
      );
      leadsPerStage.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    const campaignAgentIds = await CampaignAgent.findAll({
      where: { campaign_id: id },
      attributes: ['agent_id'],
      raw: true
    });
    const agentIdList = campaignAgentIds.map(a => a.agent_id);

    const [callsToday, activeAgents, totalLeads] = await Promise.all([
      agentIdList.length > 0
        ? CallLog.count({
            where: {
              agent_id: { [Op.in]: agentIdList },
              createdAt: { [Op.gte]: todayStart }
            }
          })
        : 0,
      agentIdList.length > 0
        ? AgentSession.count({
            where: {
              agent_id: { [Op.in]: agentIdList },
              status: 'active'
            }
          })
        : 0,
      Lead.count({ where: { campaign_id: id } })
    ]);

    return res.json({
      success: true,
      data: {
        totalLeads,
        callsToday,
        activeAgents,
        totalAgents: agentIdList.length,
        leadsPerStage
      }
    });
  } catch (error) {
    console.error('getCampaignStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  pauseResumeCampaign,
  getCampaignLeads,
  getCampaignAgents,
  assignAgents,
  getCampaignStats
};
