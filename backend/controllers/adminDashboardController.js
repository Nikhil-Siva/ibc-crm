const { Op } = require('sequelize');
const { sequelize } = require('../models');
const { Lead, CallLog, AgentSession, ActivityLog, User, Campaign, Pipeline, Followup, Customer } = require('../models');

const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      leadsToday,
      leadsYesterday,
      callsToday,
      callsYesterday,
      connectedToday,
      connectedYesterday,
      notConnectedToday,
      notConnectedYesterday,
      activeAgents,
      activeAgentsYesterday,
      convertedThisMonth,
      convertedLastMonth
    ] = await Promise.all([
      Lead.count({ where: { createdAt: { [Op.gte]: todayStart } } }),
      Lead.count({ where: { createdAt: { [Op.gte]: yesterdayStart, [Op.lt]: todayStart } } }),
      CallLog.count({ where: { createdAt: { [Op.gte]: todayStart } } }),
      CallLog.count({ where: { createdAt: { [Op.gte]: yesterdayStart, [Op.lt]: todayStart } } }),
      CallLog.count({ where: { status: 'connected', createdAt: { [Op.gte]: todayStart } } }),
      CallLog.count({ where: { status: 'connected', createdAt: { [Op.gte]: yesterdayStart, [Op.lt]: todayStart } } }),
      CallLog.count({ where: { status: { [Op.ne]: 'connected' }, createdAt: { [Op.gte]: todayStart } } }),
      CallLog.count({ where: { status: { [Op.ne]: 'connected' }, createdAt: { [Op.gte]: yesterdayStart, [Op.lt]: todayStart } } }),
      AgentSession.count({ where: { status: 'active' } }),
      AgentSession.count({ where: { status: 'active', createdAt: { [Op.gte]: yesterdayStart, [Op.lt]: todayStart } } }),
      Lead.count({ where: { status: 'Closed Won', createdAt: { [Op.gte]: monthStart } } }),
      Lead.count({
        where: {
          status: 'Closed Won',
          createdAt: {
            [Op.gte]: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            [Op.lt]: monthStart
          }
        }
      })
    ]);

    const calcTrend = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    };

    const stats = [
      {
        label: 'Total Leads Today',
        value: leadsToday,
        previousValue: leadsYesterday,
        trend: calcTrend(leadsToday, leadsYesterday)
      },
      {
        label: 'Calls Attempted Today',
        value: callsToday,
        previousValue: callsYesterday,
        trend: calcTrend(callsToday, callsYesterday)
      },
      {
        label: 'Calls Connected',
        value: connectedToday,
        previousValue: connectedYesterday,
        trend: calcTrend(connectedToday, connectedYesterday)
      },
      {
        label: 'Calls Not Connected',
        value: notConnectedToday,
        previousValue: notConnectedYesterday,
        trend: calcTrend(notConnectedToday, notConnectedYesterday)
      },
      {
        label: 'Active Agents',
        value: activeAgents,
        previousValue: activeAgentsYesterday,
        trend: calcTrend(activeAgents, activeAgentsYesterday)
      },
      {
        label: 'Leads Converted This Month',
        value: convertedThisMonth,
        previousValue: convertedLastMonth,
        trend: calcTrend(convertedThisMonth, convertedLastMonth)
      }
    ];

    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getRecentActivity = async (req, res) => {
  try {
    const activities = await ActivityLog.findAll({
      limit: 20,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name']
        }
      ]
    });

    return res.json({ success: true, data: activities });
  } catch (error) {
    console.error('getRecentActivity error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getTopAgents = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const topAgents = await CallLog.findAll({
      attributes: [
        'agent_id',
        // The model is defined as 'call_log', so that — not 'CallLog' — is the
        // table alias Sequelize emits.
        [sequelize.fn('COUNT', sequelize.col('call_log.id')), 'connected_calls']
      ],
      where: {
        status: 'connected',
        createdAt: { [Op.gte]: todayStart }
      },
      group: ['agent_id'],
      order: [[sequelize.literal('connected_calls'), 'DESC']],
      limit: 5,
      include: [
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'name']
        }
      ],
      raw: false
    });

    return res.json({ success: true, data: topAgents });
  } catch (error) {
    console.error('getTopAgents error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getQuickStats = async (req, res) => {
  try {
    const [totalLeads, totalCustomers, totalCampaigns, totalPipelines] = await Promise.all([
      Lead.count(),
      Customer.count(),
      Campaign.count(),
      Pipeline.count()
    ]);

    return res.json({
      success: true,
      data: {
        totalLeads,
        totalCustomers,
        totalCampaigns,
        totalPipelines
      }
    });
  } catch (error) {
    console.error('getQuickStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/admin/dashboard/telecaller
 * Returns dashboard stats for the logged-in agent (telecaller)
 */
const getTelecallerDashboard = async (req, res) => {
  try {
    const agentId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalAssigned, newLeads, followupsToday, converted, notInterested, pendingLeads, callsToday] = await Promise.all([
      Lead.count({ where: { assigned_to: agentId } }),
      Lead.count({ where: { assigned_to: agentId, status: 'New' } }),
      Followup.count({ where: { created_by: agentId, scheduled_at: { [Op.between]: [today, tomorrow] }, is_done: false } }),
      Lead.count({ where: { assigned_to: agentId, status: 'Closed Won' } }),
      Lead.count({ where: { assigned_to: agentId, status: 'Not Interested' } }),
      Lead.count({ where: { assigned_to: agentId, status: { [Op.notIn]: ['Closed Won', 'Closed Lost', 'Not Interested'] } } }),
      CallLog.count({ where: { agent_id: agentId, started_at: { [Op.gte]: today } } }),
    ]);

    // Recent call logs
    const recentCalls = await CallLog.findAll({
      where: { agent_id: agentId },
      include: [{ model: Lead, attributes: ['id', 'name', 'mobile'] }],
      order: [['started_at', 'DESC']],
      limit: 5,
    });

    // Today's followups
    const todayFollowups = await Followup.findAll({
      where: { created_by: agentId, scheduled_at: { [Op.between]: [today, tomorrow] } },
      include: [{ model: Lead, attributes: ['id', 'name', 'mobile'] }],
      order: [['scheduled_at', 'ASC']],
      limit: 10,
    });

    return res.json({
      success: true,
      data: {
        stats: { totalAssigned, newLeads, followupsToday, converted, notInterested, pendingLeads, callsToday },
        recentCalls,
        todayFollowups,
      },
    });
  } catch (error) {
    console.error('getTelecallerDashboard error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getDashboardStats,
  getRecentActivity,
  getTopAgents,
  getQuickStats,
  getTelecallerDashboard,
};
