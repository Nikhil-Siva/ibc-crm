const { Op } = require('sequelize');
const { sequelize } = require('../models');
const { Pipeline, PipelineStage, Campaign } = require('../models');

const getAllPipelines = async (req, res) => {
  try {
    const pipelines = await Pipeline.findAll({
      include: [
        {
          model: PipelineStage,
          as: 'stages',
          attributes: []
        },
        {
          model: Campaign,
          as: 'campaigns',
          attributes: []
        }
      ],
      attributes: {
        include: [
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('stages.id'))), 'stageCount'],
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('campaigns.id'))), 'campaignCount']
        ]
      },
      group: ['Pipeline.id'],
      order: [['createdAt', 'DESC']],
      subQuery: false
    });

    return res.json({ success: true, data: pipelines });
  } catch (error) {
    console.error('getAllPipelines error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getPipelineById = async (req, res) => {
  try {
    const { id } = req.params;

    const pipeline = await Pipeline.findByPk(id, {
      include: [
        {
          model: PipelineStage,
          as: 'stages',
          order: [['order_index', 'ASC']]
        },
        {
          model: Campaign,
          as: 'campaigns',
          attributes: ['id', 'name', 'status']
        }
      ],
      order: [
        [{ model: PipelineStage, as: 'stages' }, 'order_index', 'ASC']
      ]
    });

    if (!pipeline) {
      return res.status(404).json({ success: false, message: 'Pipeline not found' });
    }

    return res.json({ success: true, data: pipeline });
  } catch (error) {
    console.error('getPipelineById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const createPipeline = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { name, description, stages } = req.body;

    if (!name) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Pipeline name is required' });
    }

    const pipeline = await Pipeline.create({
      name,
      description: description || null,
      is_active: true,
      created_by: req.user ? req.user.id : null
    }, { transaction });

    if (stages && Array.isArray(stages) && stages.length > 0) {
      const stageRecords = stages.map(stage => ({
        pipeline_id: pipeline.id,
        name: stage.name,
        color: stage.color || '#6366f1',
        order_index: stage.order_index,
        is_terminal_won: stage.is_terminal_won || false,
        is_terminal_lost: stage.is_terminal_lost || false
      }));

      await PipelineStage.bulkCreate(stageRecords, { transaction });
    }

    await transaction.commit();

    const fullPipeline = await Pipeline.findByPk(pipeline.id, {
      include: [
        {
          model: PipelineStage,
          as: 'stages',
          order: [['order_index', 'ASC']]
        }
      ],
      order: [
        [{ model: PipelineStage, as: 'stages' }, 'order_index', 'ASC']
      ]
    });

    return res.status(201).json({ success: true, data: fullPipeline });
  } catch (error) {
    await transaction.rollback();
    console.error('createPipeline error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const updatePipeline = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, description, stages, is_active } = req.body;

    const pipeline = await Pipeline.findByPk(id);
    if (!pipeline) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Pipeline not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active;

    await pipeline.update(updateData, { transaction });

    if (stages && Array.isArray(stages)) {
      await PipelineStage.destroy({
        where: { pipeline_id: id },
        transaction
      });

      if (stages.length > 0) {
        const stageRecords = stages.map(stage => ({
          pipeline_id: pipeline.id,
          name: stage.name,
          color: stage.color || '#6366f1',
          order_index: stage.order_index,
          is_terminal_won: stage.is_terminal_won || false,
          is_terminal_lost: stage.is_terminal_lost || false
        }));

        await PipelineStage.bulkCreate(stageRecords, { transaction });
      }
    }

    await transaction.commit();

    const updatedPipeline = await Pipeline.findByPk(id, {
      include: [
        {
          model: PipelineStage,
          as: 'stages'
        }
      ],
      order: [
        [{ model: PipelineStage, as: 'stages' }, 'order_index', 'ASC']
      ]
    });

    return res.json({ success: true, data: updatedPipeline });
  } catch (error) {
    await transaction.rollback();
    console.error('updatePipeline error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const deletePipeline = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const pipeline = await Pipeline.findByPk(id);
    if (!pipeline) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Pipeline not found' });
    }

    const campaigns = await Campaign.findAll({
      where: { pipeline_id: id },
      attributes: ['id', 'name']
    });

    if (campaigns.length > 0) {
      await transaction.rollback();
      const campaignNames = campaigns.map(c => c.name);
      return res.status(400).json({
        success: false,
        message: `Cannot delete pipeline. It is used by the following campaigns: ${campaignNames.join(', ')}`,
        data: { campaigns: campaignNames }
      });
    }

    await PipelineStage.destroy({ where: { pipeline_id: id }, transaction });
    await pipeline.destroy({ transaction });

    await transaction.commit();
    return res.json({ success: true, message: 'Pipeline and its stages deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('deletePipeline error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const togglePipelineStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const pipeline = await Pipeline.findByPk(id);
    if (!pipeline) {
      return res.status(404).json({ success: false, message: 'Pipeline not found' });
    }

    await pipeline.update({ is_active: !pipeline.is_active });

    return res.json({
      success: true,
      data: {
        id: pipeline.id,
        name: pipeline.name,
        is_active: pipeline.is_active
      },
      message: `Pipeline ${pipeline.is_active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('togglePipelineStatus error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllPipelines,
  getPipelineById,
  createPipeline,
  updatePipeline,
  deletePipeline,
  togglePipelineStatus
};
