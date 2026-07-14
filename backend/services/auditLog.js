const { ActivityLog } = require('../models');

/**
 * Audit trail.
 *
 * ActivityLog existed but was written from exactly one place (addCallNote), so
 * logins, deletions, role changes and exports left no trace at all. For a CRM
 * holding insurance records that is a compliance gap, not a nice-to-have.
 *
 * Auditing must never break the request it is recording: a failure here is
 * logged and swallowed rather than turning a successful delete into a 500.
 */

const ACTIONS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PASSWORD_CHANGED: 'password_changed',
  PASSWORD_RESET: 'password_reset',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DEACTIVATED: 'user_deactivated',
  ROLE_CHANGED: 'role_changed',
  RECORD_CREATED: 'record_created',
  RECORD_UPDATED: 'record_updated',
  RECORD_DELETED: 'record_deleted',
  BULK_ASSIGNED: 'bulk_assigned',
  DATA_EXPORTED: 'data_exported',
  DATA_IMPORTED: 'data_imported',
  CALL_MADE: 'call_made',
};

/**
 * Best-effort client IP. Honours X-Forwarded-For only because the app sets
 * `trust proxy`, so Express has already validated the hop.
 */
const clientIp = (req) => (req?.ip || req?.connection?.remoteAddress || null);

/**
 * Record an audited action.
 *
 * @param {object}  params
 * @param {number}  params.userId      actor (null for anonymous attempts)
 * @param {string}  params.action      one of ACTIONS
 * @param {string} [params.entityType] e.g. 'lead', 'customer'
 * @param {number} [params.entityId]
 * @param {object} [params.details]    small JSON payload; never secrets
 * @param {object} [params.req]        request, for IP capture
 * @param {number} [params.orgId]      explicit tenant (defaults to the context)
 */
const recordActivity = async ({ userId, action, entityType, entityId, details, req, orgId }) => {
  try {
    const payload = {
      user_id: userId,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      details: details || {},
      ip_address: clientIp(req),
    };

    // Login attempts happen before any tenant context exists, so the caller
    // passes the org explicitly.
    if (orgId != null) payload.org_id = orgId;

    await ActivityLog.create(payload);
  } catch (error) {
    // Never let auditing fail the operation being audited.
    console.error(`[audit] Failed to record "${action}":`, error.message);
  }
};

module.exports = { recordActivity, ACTIONS };
