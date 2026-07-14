const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { Policy, Customer, Followup, User, Lead, ReminderLog } = require('../models');
const whatsappService = require('./whatsappService');
const emailService = require('./emailService');

/**
 * Generate a unique key for deduplication
 */
const reminderKey = (type, id, date) => `${type}-${id}-${date}`;

/**
 * Claim the right to send one reminder, backed by the unique index on
 * reminder_logs.dedupe_key. Returns false when it was already sent.
 *
 * This replaces an in-memory Set, which reset on every restart and was
 * per-process — so a redeploy or a second PM2 worker re-sent live WhatsApp
 * messages to customers who had already received them.
 */
const claimReminder = async (type, id, date, orgId = null) => {
  try {
    await ReminderLog.create({
      dedupe_key: reminderKey(type, id, date),
      reminder_type: type,
      entity_id: Number.isInteger(id) ? id : null,
      sent_on: date,
      org_id: orgId,
    });
    return true;
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return false;
    }
    throw error;
  }
};

/**
 * Send renewal reminders for policies due in 7 and 3 days
 */
const sendRenewalReminders = async () => {
  try {
    console.log('[Cron] Running sendRenewalReminders...');
    const today = dayjs().format('YYYY-MM-DD');

    const dueDates = [
      dayjs().add(7, 'day').format('YYYY-MM-DD'),
      dayjs().add(3, 'day').format('YYYY-MM-DD'),
    ];

    for (const dueDate of dueDates) {
      const policies = await Policy.findAll({
        where: {
          status: 'Active',
          next_due_date: dueDate,
        },
        include: [{ model: Customer }],
      });

      for (const policy of policies) {
        if (!(policy.Customer && policy.Customer.mobile)) continue;

        // Claim before sending: a duplicate WhatsApp message to a customer is
        // worse than a reminder dropped by a crash mid-send.
        if (!(await claimReminder('renewal', policy.id, today, policy.org_id))) {
          console.log(`[Cron] Skipping duplicate renewal reminder for policy ${policy.id}`);
          continue;
        }

        await whatsappService.sendRenewalReminder(
          policy.Customer.mobile,
          policy.Customer.name,
          policy.policy_type,
          policy.next_due_date,
          policy.premium_amount
        );

        // Also send email if customer has email
        if (policy.Customer.email) {
          await emailService.sendRenewalEmail(
            policy.Customer.email,
            policy.Customer.name,
            {
              policy_number: policy.policy_number,
              policy_type: policy.policy_type,
              premium_amount: policy.premium_amount,
              next_due_date: policy.next_due_date,
            }
          );
        }
      }
    }

    console.log('[Cron] sendRenewalReminders completed.');
  } catch (error) {
    console.error('[Cron] sendRenewalReminders error:', error.message);
  }
};

/**
 * Send today's follow-up digest to each agent via email
 */
const sendFollowupDigest = async () => {
  try {
    console.log('[Cron] Running sendFollowupDigest...');
    const today = dayjs().format('YYYY-MM-DD');

    if (!(await claimReminder('followup-digest', 'all', today))) {
      console.log('[Cron] Followup digest already sent today.');
      return;
    }

    const todayStart = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();

    const followups = await Followup.findAll({
      where: {
        scheduled_at: { [Op.between]: [todayStart, todayEnd] },
        is_done: false,
      },
      include: [
        { model: Lead, attributes: ['id', 'name', 'mobile'] },
        { model: Customer, attributes: ['id', 'name', 'mobile'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });

    // Group by agent (created_by)
    const agentFollowups = {};
    for (const followup of followups) {
      const agentId = followup.created_by;
      if (!agentFollowups[agentId]) {
        agentFollowups[agentId] = {
          agent: followup.creator,
          followups: [],
        };
      }
      agentFollowups[agentId].followups.push(followup);
    }

    // Send digest email to each agent
    for (const agentId of Object.keys(agentFollowups)) {
      const { agent, followups: agentTasks } = agentFollowups[agentId];

      if (agent && agent.email) {
        await emailService.sendDailyDigest(agent.email, {
          new_leads: 0,
          followups_due: agentTasks.length,
          renewals_due: 0,
          policies_issued: 0,
        });
      }
    }

    console.log('[Cron] sendFollowupDigest completed.');
  } catch (error) {
    console.error('[Cron] sendFollowupDigest error:', error.message);
  }
};

/**
 * Send birthday wishes to customers whose DOB matches today
 */
const sendBirthdayWishes = async () => {
  try {
    console.log('[Cron] Running sendBirthdayWishes...');
    const today = dayjs();
    const todayMonth = today.month() + 1; // 1-12
    const todayDay = today.date();
    const todayStr = today.format('YYYY-MM-DD');

    // Find customers with matching month and day
    const { sequelize } = require('../models');
    const customers = await Customer.findAll({
      where: sequelize.where(
        sequelize.fn('MONTH', sequelize.col('dob')),
        todayMonth
      ),
    });

    // Further filter by day (Sequelize doesn't chain two where fns cleanly in all dialects)
    const birthdayCustomers = customers.filter((c) => {
      if (!c.dob) return false;
      return dayjs(c.dob).date() === todayDay;
    });

    for (const customer of birthdayCustomers) {
      if (!customer.mobile) continue;

      if (!(await claimReminder('birthday', customer.id, todayStr, customer.org_id))) {
        console.log(`[Cron] Skipping duplicate birthday wish for customer ${customer.id}`);
        continue;
      }

      await whatsappService.sendBirthdayWish(customer.mobile, customer.name);
    }

    console.log('[Cron] sendBirthdayWishes completed.');
  } catch (error) {
    console.error('[Cron] sendBirthdayWishes error:', error.message);
  }
};

/**
 * Send weekly summary to admin users
 */
const sendWeeklySummary = async () => {
  try {
    console.log('[Cron] Running sendWeeklySummary...');
    const today = dayjs().format('YYYY-MM-DD');

    if (!(await claimReminder('weekly-summary', 'all', today))) {
      console.log('[Cron] Weekly summary already sent today.');
      return;
    }

    const weekStart = dayjs().subtract(7, 'day').toDate();
    const weekEnd = new Date();

    // Compile weekly stats
    const newLeads = await Lead.count({
      where: { createdAt: { [Op.between]: [weekStart, weekEnd] } },
    });

    const conversions = await Lead.count({
      where: {
        status: 'Closed Won',
        updatedAt: { [Op.between]: [weekStart, weekEnd] },
      },
    });

    const policiesIssued = await Policy.count({
      where: { createdAt: { [Op.between]: [weekStart, weekEnd] } },
    });

    const followupsCompleted = await Followup.count({
      where: {
        is_done: true,
        done_at: { [Op.between]: [weekStart, weekEnd] },
      },
    });

    // Find admin users
    const admins = await User.findAll({
      where: { role: 'admin', is_active: true },
      attributes: ['id', 'name', 'email'],
    });

    for (const admin of admins) {
      if (admin.email) {
        await emailService.sendDailyDigest(admin.email, {
          new_leads: newLeads,
          followups_due: followupsCompleted,
          renewals_due: conversions,
          policies_issued: policiesIssued,
        });
      }
    }

    console.log('[Cron] sendWeeklySummary completed.');
  } catch (error) {
    console.error('[Cron] sendWeeklySummary error:', error.message);
  }
};

module.exports = {
  sendRenewalReminders,
  sendFollowupDigest,
  sendBirthdayWishes,
  sendWeeklySummary,
};
