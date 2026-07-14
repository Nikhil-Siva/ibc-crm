const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { Policy, Customer } = require('../models');
const whatsappService = require('../services/whatsappService');

/**
 * GET /api/renewals/upcoming
 * Policies with next_due_date in next N days (default 30), status Active
 * Group by urgency: overdue, this_week, this_month, later
 */
const getUpcomingRenewals = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const today = dayjs().startOf('day');
    const futureDate = today.add(days, 'day');
    const endOfWeek = today.add(7, 'day');
    const endOfMonth = today.add(30, 'day');

    const policies = await Policy.findAll({
      where: {
        status: 'Active',
        next_due_date: {
          [Op.lte]: futureDate.format('YYYY-MM-DD'),
        },
      },
      include: [
        { model: Customer, attributes: ['id', 'name', 'mobile', 'email', 'city'] },
      ],
      order: [['next_due_date', 'ASC']],
    });

    const grouped = {
      overdue: [],
      this_week: [],
      this_month: [],
      later: [],
    };

    policies.forEach((policy) => {
      const dueDate = dayjs(policy.next_due_date);
      if (dueDate.isBefore(today)) {
        grouped.overdue.push(policy);
      } else if (dueDate.isBefore(endOfWeek)) {
        grouped.this_week.push(policy);
      } else if (dueDate.isBefore(endOfMonth)) {
        grouped.this_month.push(policy);
      } else {
        grouped.later.push(policy);
      }
    });

    return res.status(200).json({
      success: true,
      data: grouped,
      summary: {
        overdue: grouped.overdue.length,
        this_week: grouped.this_week.length,
        this_month: grouped.this_month.length,
        later: grouped.later.length,
        total: policies.length,
      },
    });
  } catch (error) {
    console.error('getUpcomingRenewals error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/renewals/overdue
 * Past next_due_date, status still Active
 */
const getOverdueRenewals = async (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');

    const policies = await Policy.findAll({
      where: {
        status: 'Active',
        next_due_date: {
          [Op.lt]: today,
        },
      },
      include: [
        { model: Customer, attributes: ['id', 'name', 'mobile', 'email', 'city'] },
      ],
      order: [['next_due_date', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      data: policies,
      count: policies.length,
    });
  } catch (error) {
    console.error('getOverdueRenewals error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/renewals/send-reminder/:policyId
 * Send WhatsApp reminder for a specific policy
 */
const sendRenewalReminder = async (req, res) => {
  try {
    const policy = await Policy.findByPk(req.params.policyId, {
      include: [{ model: Customer }],
    });

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    if (!policy.Customer) {
      return res.status(400).json({ success: false, message: 'No customer linked to this policy.' });
    }

    const result = await whatsappService.sendRenewalReminder(
      policy.Customer.mobile,
      policy.Customer.name,
      policy.policy_type,
      policy.next_due_date,
      policy.premium_amount
    );

    return res.status(200).json({
      success: true,
      message: 'Renewal reminder sent.',
      data: result,
    });
  } catch (error) {
    console.error('sendRenewalReminder error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/renewals/stats
 * Count of due/overdue/collected, renewal rate, lapse rate
 */
const getRenewalStats = async (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const thirtyDaysLater = dayjs().add(30, 'day').format('YYYY-MM-DD');

    // Overdue: past due date, still Active
    const overdueCount = await Policy.count({
      where: {
        status: 'Active',
        next_due_date: { [Op.lt]: today },
      },
    });

    // Due in next 30 days
    const dueCount = await Policy.count({
      where: {
        status: 'Active',
        next_due_date: { [Op.between]: [today, thirtyDaysLater] },
      },
    });

    // Total active policies
    const totalActive = await Policy.count({
      where: { status: 'Active' },
    });

    // Lapsed policies
    const lapsedCount = await Policy.count({
      where: { status: 'Lapsed' },
    });

    // Total policies ever
    const totalPolicies = await Policy.count();

    const renewalRate = totalPolicies > 0
      ? ((totalActive / totalPolicies) * 100).toFixed(2)
      : '0.00';

    const lapseRate = totalPolicies > 0
      ? ((lapsedCount / totalPolicies) * 100).toFixed(2)
      : '0.00';

    return res.status(200).json({
      success: true,
      data: {
        due_in_30_days: dueCount,
        overdue: overdueCount,
        total_active: totalActive,
        lapsed: lapsedCount,
        total_policies: totalPolicies,
        renewal_rate_percent: parseFloat(renewalRate),
        lapse_rate_percent: parseFloat(lapseRate),
      },
    });
  } catch (error) {
    console.error('getRenewalStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getUpcomingRenewals,
  getOverdueRenewals,
  sendRenewalReminder,
  getRenewalStats,
};
