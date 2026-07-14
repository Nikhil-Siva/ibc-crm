const { Op, fn, col, literal } = require('sequelize');
const dayjs = require('dayjs');
const { sequelize, Lead, Customer, Policy, Followup, User } = require('../models');

/**
 * GET /api/reports/dashboard
 * Total leads this month, new leads today, followups due today,
 * renewals due this month, total customers, policies issued this month,
 * total premium this month, conversion rate
 */
const getDashboardStats = async (req, res) => {
  try {
    const today = dayjs();
    const startOfMonth = today.startOf('month').toDate();
    const endOfMonth = today.endOf('month').toDate();
    const startOfDay = today.startOf('day').toDate();
    const endOfDay = today.endOf('day').toDate();

    // Total leads this month
    const leadsThisMonth = await Lead.count({
      where: { createdAt: { [Op.between]: [startOfMonth, endOfMonth] } },
    });

    // New leads today
    const newLeadsToday = await Lead.count({
      where: { createdAt: { [Op.between]: [startOfDay, endOfDay] } },
    });

    // Followups due today
    const followupsDueToday = await Followup.count({
      where: {
        scheduled_at: { [Op.between]: [startOfDay, endOfDay] },
        is_done: false,
      },
    });

    // Renewals due this month
    const renewalsDueThisMonth = await Policy.count({
      where: {
        status: 'Active',
        next_due_date: {
          [Op.between]: [today.format('YYYY-MM-DD'), today.endOf('month').format('YYYY-MM-DD')],
        },
      },
    });

    // Total customers
    const totalCustomers = await Customer.count();

    // Policies issued this month
    const policiesThisMonth = await Policy.count({
      where: { createdAt: { [Op.between]: [startOfMonth, endOfMonth] } },
    });

    // Total premium this month
    const premiumResult = await Policy.findOne({
      attributes: [[fn('SUM', col('premium_amount')), 'total_premium']],
      where: { createdAt: { [Op.between]: [startOfMonth, endOfMonth] } },
      raw: true,
    });
    const totalPremiumThisMonth = parseFloat(premiumResult.total_premium) || 0;

    // Conversion rate (Closed Won / Total leads)
    const totalLeads = await Lead.count();
    const closedWon = await Lead.count({ where: { status: 'Closed Won' } });
    const conversionRate = totalLeads > 0
      ? ((closedWon / totalLeads) * 100).toFixed(2)
      : '0.00';

    return res.status(200).json({
      success: true,
      data: {
        leads_this_month: leadsThisMonth,
        new_leads_today: newLeadsToday,
        followups_due_today: followupsDueToday,
        renewals_due_this_month: renewalsDueThisMonth,
        total_customers: totalCustomers,
        policies_this_month: policiesThisMonth,
        total_premium_this_month: totalPremiumThisMonth,
        conversion_rate: parseFloat(conversionRate),
        total_leads: totalLeads,
        closed_won: closedWon,
      },
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/reports/sales-summary
 * Date range based — total leads, converted, policies issued, premium collected
 */
const getSalesSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const startDate = from ? new Date(from) : dayjs().startOf('month').toDate();
    const endDate = to ? new Date(to) : dayjs().endOf('month').toDate();

    const totalLeads = await Lead.count({
      where: { createdAt: { [Op.between]: [startDate, endDate] } },
    });

    const convertedLeads = await Lead.count({
      where: {
        status: 'Closed Won',
        updatedAt: { [Op.between]: [startDate, endDate] },
      },
    });

    const policiesIssued = await Policy.count({
      where: { createdAt: { [Op.between]: [startDate, endDate] } },
    });

    const premiumResult = await Policy.findOne({
      attributes: [[fn('SUM', col('premium_amount')), 'total_premium']],
      where: { createdAt: { [Op.between]: [startDate, endDate] } },
      raw: true,
    });
    const premiumCollected = parseFloat(premiumResult.total_premium) || 0;

    const commissionResult = await Policy.findOne({
      attributes: [[fn('SUM', col('commission_earned')), 'total_commission']],
      where: { createdAt: { [Op.between]: [startDate, endDate] } },
      raw: true,
    });
    const totalCommission = parseFloat(commissionResult.total_commission) || 0;

    return res.status(200).json({
      success: true,
      data: {
        period: { from: startDate, to: endDate },
        total_leads: totalLeads,
        converted_leads: convertedLeads,
        conversion_rate: totalLeads > 0 ? parseFloat(((convertedLeads / totalLeads) * 100).toFixed(2)) : 0,
        policies_issued: policiesIssued,
        premium_collected: premiumCollected,
        total_commission: totalCommission,
      },
    });
  } catch (error) {
    console.error('getSalesSummary error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/reports/agent-performance
 * Per agent — leads assigned, closed won, conversion rate, premium
 */
const getAgentPerformance = async (req, res) => {
  try {
    const agents = await User.findAll({
      where: { role: { [Op.in]: ['agent', 'manager'] }, is_active: true },
      attributes: ['id', 'name', 'email', 'role'],
      raw: true,
    });

    const performance = [];

    for (const agent of agents) {
      const leadsAssigned = await Lead.count({ where: { assigned_to: agent.id } });
      const closedWon = await Lead.count({
        where: { assigned_to: agent.id, status: 'Closed Won' },
      });

      const customerIds = await Customer.findAll({
        where: { assigned_to: agent.id },
        attributes: ['id'],
        raw: true,
      });
      const customerIdList = customerIds.map((c) => c.id);

      let totalPremium = 0;
      let policiesCount = 0;
      if (customerIdList.length > 0) {
        const premiumResult = await Policy.findOne({
          attributes: [
            [fn('SUM', col('premium_amount')), 'total_premium'],
            [fn('COUNT', col('id')), 'policy_count'],
          ],
          where: { customer_id: { [Op.in]: customerIdList } },
          raw: true,
        });
        totalPremium = parseFloat(premiumResult.total_premium) || 0;
        policiesCount = parseInt(premiumResult.policy_count, 10) || 0;
      }

      performance.push({
        agent_id: agent.id,
        agent_name: agent.name,
        agent_email: agent.email,
        role: agent.role,
        leads_assigned: leadsAssigned,
        closed_won: closedWon,
        conversion_rate: leadsAssigned > 0
          ? parseFloat(((closedWon / leadsAssigned) * 100).toFixed(2))
          : 0,
        policies_count: policiesCount,
        total_premium: totalPremium,
      });
    }

    // Sort by total_premium descending
    performance.sort((a, b) => b.total_premium - a.total_premium);

    return res.status(200).json({ success: true, data: performance });
  } catch (error) {
    console.error('getAgentPerformance error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/reports/monthly-trend
 * Last 12 months — new leads count, conversions count per month
 */
const getMonthlyTrend = async (req, res) => {
  try {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const month = dayjs().subtract(i, 'month');
      const startOfMonth = month.startOf('month').toDate();
      const endOfMonth = month.endOf('month').toDate();

      const newLeads = await Lead.count({
        where: { createdAt: { [Op.between]: [startOfMonth, endOfMonth] } },
      });

      const conversions = await Lead.count({
        where: {
          status: 'Closed Won',
          updatedAt: { [Op.between]: [startOfMonth, endOfMonth] },
        },
      });

      const policiesIssued = await Policy.count({
        where: { createdAt: { [Op.between]: [startOfMonth, endOfMonth] } },
      });

      months.push({
        month: month.format('YYYY-MM'),
        month_name: month.format('MMM YYYY'),
        new_leads: newLeads,
        conversions,
        policies_issued: policiesIssued,
      });
    }

    return res.status(200).json({ success: true, data: months });
  } catch (error) {
    console.error('getMonthlyTrend error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/reports/source-wise
 * Leads count and conversion count grouped by source
 */
const getSourceWiseReport = async (req, res) => {
  try {
    const sources = ['Facebook', 'Google', 'WhatsApp', 'Referral', 'Walk-in', 'Instagram', 'Cold Call', 'Other'];

    const report = [];

    for (const source of sources) {
      const totalLeads = await Lead.count({ where: { source } });
      const convertedLeads = await Lead.count({
        where: { source, status: 'Closed Won' },
      });

      report.push({
        source,
        total_leads: totalLeads,
        converted: convertedLeads,
        conversion_rate: totalLeads > 0
          ? parseFloat(((convertedLeads / totalLeads) * 100).toFixed(2))
          : 0,
      });
    }

    // Sort by total_leads descending
    report.sort((a, b) => b.total_leads - a.total_leads);

    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('getSourceWiseReport error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/reports/premium
 * Total premium, grouped by insurer, by month
 */
const getPremiumReport = async (req, res) => {
  try {
    // Total premium overall
    const totalResult = await Policy.findOne({
      attributes: [[fn('SUM', col('premium_amount')), 'total_premium']],
      raw: true,
    });
    const totalPremium = parseFloat(totalResult.total_premium) || 0;

    // Premium grouped by insurer
    const byInsurer = await Policy.findAll({
      attributes: [
        'insurer',
        [fn('SUM', col('premium_amount')), 'total_premium'],
        [fn('COUNT', col('id')), 'policy_count'],
      ],
      group: ['insurer'],
      order: [[fn('SUM', col('premium_amount')), 'DESC']],
      raw: true,
    });

    // Premium grouped by month (last 12 months)
    const byMonth = [];
    for (let i = 11; i >= 0; i--) {
      const month = dayjs().subtract(i, 'month');
      const startOfMonth = month.startOf('month').toDate();
      const endOfMonth = month.endOf('month').toDate();

      const premResult = await Policy.findOne({
        attributes: [
          [fn('SUM', col('premium_amount')), 'total_premium'],
          [fn('COUNT', col('id')), 'policy_count'],
        ],
        where: { createdAt: { [Op.between]: [startOfMonth, endOfMonth] } },
        raw: true,
      });

      byMonth.push({
        month: month.format('YYYY-MM'),
        month_name: month.format('MMM YYYY'),
        total_premium: parseFloat(premResult.total_premium) || 0,
        policy_count: parseInt(premResult.policy_count, 10) || 0,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        total_premium: totalPremium,
        by_insurer: byInsurer.map((row) => ({
          insurer: row.insurer,
          total_premium: parseFloat(row.total_premium) || 0,
          policy_count: parseInt(row.policy_count, 10) || 0,
        })),
        by_month: byMonth,
      },
    });
  } catch (error) {
    console.error('getPremiumReport error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getDashboardStats,
  getSalesSummary,
  getAgentPerformance,
  getMonthlyTrend,
  getSourceWiseReport,
  getPremiumReport,
};
