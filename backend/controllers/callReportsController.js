const { Op, fn, col, literal } = require('sequelize');
const dayjs = require('dayjs');
const { toCsvBuffer } = require('../utils/spreadsheet');
const { recordActivity, ACTIONS } = require('../services/auditLog');
const { sequelize, CallLog, AgentSession, User } = require('../models');

/**
 * GET /api/call-reports/user
 * Query params: agent_ids (comma-separated), from_date, to_date, campaign_id, pipeline_id.
 * Group by agent_id. For each agent: total_attempted, connected, not_connected,
 * in_progress (status='busy'), avg_duration. Include User name.
 */
const getUserCallReport = async (req, res) => {
  try {
    const { agent_ids, from_date, to_date, campaign_id, pipeline_id } = req.query;

    const where = {};

    if (agent_ids) {
      const ids = agent_ids.split(',').map((id) => parseInt(id.trim(), 10)).filter(Boolean);
      if (ids.length > 0) {
        where.agent_id = { [Op.in]: ids };
      }
    }

    if (from_date && to_date) {
      where.started_at = {
        [Op.between]: [
          dayjs(from_date).startOf('day').toDate(),
          dayjs(to_date).endOf('day').toDate(),
        ],
      };
    } else if (from_date) {
      where.started_at = { [Op.gte]: dayjs(from_date).startOf('day').toDate() };
    } else if (to_date) {
      where.started_at = { [Op.lte]: dayjs(to_date).endOf('day').toDate() };
    }

    if (campaign_id) where.campaign_id = campaign_id;
    if (pipeline_id) where.pipeline_id = pipeline_id;

    const callLogs = await CallLog.findAll({
      where,
      attributes: [
        'agent_id',
        // 'call_log' is the defined model name and therefore the SQL alias.
        [fn('COUNT', col('call_log.id')), 'total_attempted'],
        [fn('SUM', literal("CASE WHEN status = 'connected' THEN 1 ELSE 0 END")), 'connected'],
        [fn('SUM', literal("CASE WHEN status = 'not_connected' THEN 1 ELSE 0 END")), 'not_connected'],
        [fn('SUM', literal("CASE WHEN status = 'busy' THEN 1 ELSE 0 END")), 'in_progress'],
        [fn('AVG', col('duration_seconds')), 'avg_duration'],
      ],
      include: [
        { model: User, as: 'agent', attributes: ['id', 'name'] },
      ],
      group: ['agent_id', 'agent.id', 'agent.name'],
      raw: false,
    });

    const agentData = callLogs.map((row) => {
      const plain = row.get({ plain: true });
      return {
        agent_id: plain.agent_id,
        agent_name: plain.agent ? plain.agent.name : null,
        total_attempted: parseInt(plain.total_attempted, 10) || 0,
        connected: parseInt(plain.connected, 10) || 0,
        not_connected: parseInt(plain.not_connected, 10) || 0,
        in_progress: parseInt(plain.in_progress, 10) || 0,
        avg_duration: parseFloat(parseFloat(plain.avg_duration || 0).toFixed(2)),
      };
    });

    const summary = {
      total_attempted: agentData.reduce((sum, a) => sum + a.total_attempted, 0),
      connected: agentData.reduce((sum, a) => sum + a.connected, 0),
      not_connected: agentData.reduce((sum, a) => sum + a.not_connected, 0),
      in_progress: agentData.reduce((sum, a) => sum + a.in_progress, 0),
      avg_duration: agentData.length > 0
        ? parseFloat((agentData.reduce((sum, a) => sum + a.avg_duration, 0) / agentData.length).toFixed(2))
        : 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        agents: agentData,
        summary,
      },
    });
  } catch (error) {
    console.error('getUserCallReport error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/call-reports/timeline
 * Query params: agent_id, date.
 * Return hourly breakdown of calls for that agent on that date.
 */
const getCallTimeline = async (req, res) => {
  try {
    const { agent_id, date } = req.query;

    if (!agent_id || !date) {
      return res.status(400).json({ success: false, message: 'agent_id and date are required.' });
    }

    const startOfDay = dayjs(date).startOf('day').toDate();
    const endOfDay = dayjs(date).endOf('day').toDate();

    const hourlyData = await CallLog.findAll({
      where: {
        agent_id,
        started_at: { [Op.between]: [startOfDay, endOfDay] },
      },
      attributes: [
        [fn('HOUR', col('started_at')), 'hour'],
        [fn('SUM', literal("CASE WHEN status = 'connected' THEN 1 ELSE 0 END")), 'connected'],
        [fn('SUM', literal("CASE WHEN status = 'not_connected' THEN 1 ELSE 0 END")), 'not_connected'],
      ],
      group: [fn('HOUR', col('started_at'))],
      order: [[fn('HOUR', col('started_at')), 'ASC']],
      raw: true,
    });

    const timeline = hourlyData.map((row) => ({
      hour: parseInt(row.hour, 10),
      connected: parseInt(row.connected, 10) || 0,
      not_connected: parseInt(row.not_connected, 10) || 0,
    }));

    return res.status(200).json({ success: true, data: timeline });
  } catch (error) {
    console.error('getCallTimeline error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/call-reports/agent-login
 * Query params: agent_id (or 'all'), from_date, to_date.
 * Calculate: login_time, logout_time, total_logged_in_seconds, total_break_seconds,
 * net_working_seconds, efficiency_pct.
 */
const getAgentLoginReport = async (req, res) => {
  try {
    const { agent_id, from_date, to_date } = req.query;

    const where = {};

    if (agent_id && agent_id !== 'all') {
      where.agent_id = agent_id;
    }

    // The columns are login_at/logout_at on AgentSession; the response keeps the
    // login_time/logout_time names the frontend already reads.
    if (from_date && to_date) {
      where.login_at = {
        [Op.between]: [
          dayjs(from_date).startOf('day').toDate(),
          dayjs(to_date).endOf('day').toDate(),
        ],
      };
    } else if (from_date) {
      where.login_at = { [Op.gte]: dayjs(from_date).startOf('day').toDate() };
    } else if (to_date) {
      where.login_at = { [Op.lte]: dayjs(to_date).endOf('day').toDate() };
    }

    const sessions = await AgentSession.findAll({
      where,
      include: [
        { model: User, as: 'agent', attributes: ['id', 'name'] },
      ],
      order: [['login_at', 'DESC']],
    });

    const report = sessions.map((session) => {
      const plain = session.get({ plain: true });

      const loginTime = dayjs(plain.login_at);
      const logoutTime = plain.logout_at ? dayjs(plain.logout_at) : dayjs();
      const totalLoggedInSeconds = logoutTime.diff(loginTime, 'second');

      let totalBreakSeconds = 0;
      if (plain.breaks && Array.isArray(plain.breaks)) {
        for (const brk of plain.breaks) {
          if (brk.start && brk.end) {
            totalBreakSeconds += dayjs(brk.end).diff(dayjs(brk.start), 'second');
          }
        }
      }

      const netWorkingSeconds = Math.max(totalLoggedInSeconds - totalBreakSeconds, 0);
      const efficiencyPct = totalLoggedInSeconds > 0
        ? parseFloat(((netWorkingSeconds / totalLoggedInSeconds) * 100).toFixed(2))
        : 0;

      return {
        session_id: plain.id,
        agent_id: plain.agent_id,
        agent_name: plain.agent ? plain.agent.name : null,
        login_time: plain.login_time,
        logout_time: plain.logout_time,
        total_logged_in_seconds: totalLoggedInSeconds,
        total_break_seconds: totalBreakSeconds,
        net_working_seconds: netWorkingSeconds,
        efficiency_pct: efficiencyPct,
      };
    });

    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('getAgentLoginReport error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/call-reports/agent-timeline
 * Query params: agent_id, date.
 * Get AgentSession for that date. Return session with breaks array.
 */
const getAgentTimeline = async (req, res) => {
  try {
    const { agent_id, date } = req.query;

    if (!agent_id || !date) {
      return res.status(400).json({ success: false, message: 'agent_id and date are required.' });
    }

    const startOfDay = dayjs(date).startOf('day').toDate();
    const endOfDay = dayjs(date).endOf('day').toDate();

    const session = await AgentSession.findOne({
      where: {
        agent_id,
        login_at: { [Op.between]: [startOfDay, endOfDay] },
      },
      include: [
        { model: User, as: 'agent', attributes: ['id', 'name'] },
      ],
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'No session found for this agent on the given date.' });
    }

    const plain = session.get({ plain: true });

    return res.status(200).json({
      success: true,
      data: {
        session_id: plain.id,
        agent_id: plain.agent_id,
        agent_name: plain.agent ? plain.agent.name : null,
        login_time: plain.login_at,
        logout_time: plain.logout_at,
        breaks: plain.breaks || [],
      },
    });
  } catch (error) {
    console.error('getAgentTimeline error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/call-reports/day-wise
 * Query params: agent_id, from_date, to_date.
 * Group CallLog by DATE(started_at). For each day: attempted, connected, not_connected.
 * Also join AgentSession for breaks_taken, time_logged_in.
 */
const getDayWiseSummary = async (req, res) => {
  try {
    const { agent_id, from_date, to_date } = req.query;

    if (!agent_id) {
      return res.status(400).json({ success: false, message: 'agent_id is required.' });
    }

    const where = { agent_id };

    if (from_date && to_date) {
      where.started_at = {
        [Op.between]: [
          dayjs(from_date).startOf('day').toDate(),
          dayjs(to_date).endOf('day').toDate(),
        ],
      };
    }

    const dailyCalls = await CallLog.findAll({
      where,
      attributes: [
        [fn('DATE', col('started_at')), 'call_date'],
        [fn('COUNT', col('id')), 'attempted'],
        [fn('SUM', literal("CASE WHEN status = 'connected' THEN 1 ELSE 0 END")), 'connected'],
        [fn('SUM', literal("CASE WHEN status = 'not_connected' THEN 1 ELSE 0 END")), 'not_connected'],
      ],
      group: [fn('DATE', col('started_at'))],
      order: [[fn('DATE', col('started_at')), 'ASC']],
      raw: true,
    });

    // Fetch agent sessions for the same date range
    const sessionWhere = { agent_id };
    if (from_date && to_date) {
      sessionWhere.login_at = {
        [Op.between]: [
          dayjs(from_date).startOf('day').toDate(),
          dayjs(to_date).endOf('day').toDate(),
        ],
      };
    }

    const sessions = await AgentSession.findAll({
      where: sessionWhere,
      raw: true,
    });

    // Build a map of date -> session info
    const sessionMap = {};
    for (const session of sessions) {
      const dateKey = dayjs(session.login_at).format('YYYY-MM-DD');
      const loginTime = dayjs(session.login_at);
      const logoutTime = session.logout_at ? dayjs(session.logout_at) : dayjs();
      const timeLoggedIn = logoutTime.diff(loginTime, 'second');

      let breaksTaken = 0;
      let breakSeconds = 0;
      if (session.breaks) {
        const breaks = typeof session.breaks === 'string' ? JSON.parse(session.breaks) : session.breaks;
        if (Array.isArray(breaks)) {
          breaksTaken = breaks.length;
          for (const brk of breaks) {
            if (brk.start && brk.end) {
              breakSeconds += dayjs(brk.end).diff(dayjs(brk.start), 'second');
            }
          }
        }
      }

      sessionMap[dateKey] = {
        time_logged_in_seconds: timeLoggedIn,
        breaks_taken: breaksTaken,
        break_seconds: breakSeconds,
      };
    }

    const result = dailyCalls.map((row) => {
      const dateStr = dayjs(row.call_date).format('YYYY-MM-DD');
      const sessionInfo = sessionMap[dateStr] || {
        time_logged_in_seconds: 0,
        breaks_taken: 0,
        break_seconds: 0,
      };

      return {
        date: dateStr,
        attempted: parseInt(row.attempted, 10) || 0,
        connected: parseInt(row.connected, 10) || 0,
        not_connected: parseInt(row.not_connected, 10) || 0,
        time_logged_in_seconds: sessionInfo.time_logged_in_seconds,
        breaks_taken: sessionInfo.breaks_taken,
        break_seconds: sessionInfo.break_seconds,
      };
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('getDayWiseSummary error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/call-reports/export
 * Same as getUserCallReport but format as CSV using xlsx and send as file download.
 */
const exportCallReport = async (req, res) => {
  try {
    const { agent_ids, from_date, to_date, campaign_id, pipeline_id } = req.query;

    const where = {};

    if (agent_ids) {
      const ids = agent_ids.split(',').map((id) => parseInt(id.trim(), 10)).filter(Boolean);
      if (ids.length > 0) {
        where.agent_id = { [Op.in]: ids };
      }
    }

    if (from_date && to_date) {
      where.started_at = {
        [Op.between]: [
          dayjs(from_date).startOf('day').toDate(),
          dayjs(to_date).endOf('day').toDate(),
        ],
      };
    } else if (from_date) {
      where.started_at = { [Op.gte]: dayjs(from_date).startOf('day').toDate() };
    } else if (to_date) {
      where.started_at = { [Op.lte]: dayjs(to_date).endOf('day').toDate() };
    }

    if (campaign_id) where.campaign_id = campaign_id;
    if (pipeline_id) where.pipeline_id = pipeline_id;

    const callLogs = await CallLog.findAll({
      where,
      attributes: [
        'agent_id',
        // 'call_log' is the defined model name and therefore the SQL alias.
        [fn('COUNT', col('call_log.id')), 'total_attempted'],
        [fn('SUM', literal("CASE WHEN status = 'connected' THEN 1 ELSE 0 END")), 'connected'],
        [fn('SUM', literal("CASE WHEN status = 'not_connected' THEN 1 ELSE 0 END")), 'not_connected'],
        [fn('SUM', literal("CASE WHEN status = 'busy' THEN 1 ELSE 0 END")), 'in_progress'],
        [fn('AVG', col('duration_seconds')), 'avg_duration'],
      ],
      include: [
        { model: User, as: 'agent', attributes: ['id', 'name'] },
      ],
      group: ['agent_id', 'agent.id', 'agent.name'],
      raw: false,
    });

    const rows = callLogs.map((row) => {
      const plain = row.get({ plain: true });
      return {
        'Agent ID': plain.agent_id,
        'Agent Name': plain.agent ? plain.agent.name : '',
        'Total Attempted': parseInt(plain.total_attempted, 10) || 0,
        'Connected': parseInt(plain.connected, 10) || 0,
        'Not Connected': parseInt(plain.not_connected, 10) || 0,
        'In Progress': parseInt(plain.in_progress, 10) || 0,
        'Avg Duration (sec)': parseFloat(parseFloat(plain.avg_duration || 0).toFixed(2)),
      };
    });

    const buffer = await toCsvBuffer(rows, 'Call Report');

    const filename = `call_report_${dayjs().format('YYYY-MM-DD_HHmmss')}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await recordActivity({
      userId: req.user.id,
      action: ACTIONS.DATA_EXPORTED,
      entityType: 'call_report',
      req,
      details: { rows: rows.length },
    });

    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('exportCallReport error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getUserCallReport,
  getCallTimeline,
  getAgentLoginReport,
  getAgentTimeline,
  getDayWiseSummary,
  exportCallReport,
};
