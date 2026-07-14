const { AsyncLocalStorage } = require('node:async_hooks');

/**
 * Request-scoped tenant enforcement.
 *
 * Every authenticated request runs inside an AsyncLocalStorage context holding
 * the caller's org_id. Sequelize hooks then inject that org_id into the WHERE
 * clause of every query and onto every INSERT.
 *
 * This is deliberately centralised rather than done per-controller: there are
 * ~100 queries across 19 controllers, and a single forgotten `where` clause is
 * a cross-tenant data leak. A hook cannot be forgotten.
 *
 * System work that legitimately spans tenants (cron sweeps, seeds, migrations)
 * runs outside a context and is not filtered — see runAsSystem.
 */
const storage = new AsyncLocalStorage();

/** Run fn with the given tenant context. */
const runWithOrg = (orgId, fn) => storage.run({ orgId }, fn);

/**
 * Run fn explicitly outside any tenant scope. Use for cron jobs and scripts
 * that must see every organization's data. Named so it is obvious in review.
 */
const runAsSystem = (fn) => storage.run({ orgId: null, system: true }, fn);

/** The current org_id, or null outside a request. */
const getOrgId = () => storage.getStore()?.orgId ?? null;

const isSystem = () => storage.getStore()?.system === true;

/** Models whose rows belong to a tenant. Populated by applyTenancyHooks. */
const scopedModels = new Set();

const hasOrgColumn = (model) => model?.rawAttributes?.org_id !== undefined;

/**
 * Decide whether a given query should be filtered.
 * Skips when: outside a request, running as system, the model isn't scoped, or
 * the caller opted out explicitly.
 */
const shouldScope = (model, options) => {
  if (options?.skipOrgScope) return false;
  if (isSystem()) return false;
  if (!hasOrgColumn(model)) return false;
  return getOrgId() !== null;
};

/**
 * Merge org_id into a where clause without clobbering an existing one.
 * An explicit org_id already present is left alone — callers that set it are
 * either the tenancy layer itself or a deliberate cross-tenant admin query.
 */
const injectWhere = (options, orgId) => {
  options.where = options.where || {};
  if (options.where.org_id === undefined) {
    options.where.org_id = orgId;
  }
};

const applyTenancyHooks = (sequelize) => {
  for (const model of Object.values(sequelize.models)) {
    if (hasOrgColumn(model)) scopedModels.add(model.name);
  }

  // ── Reads ───────────────────────────────────────────────────────────
  // These must be `function`, not arrows: Sequelize passes the model as `this`
  // and does NOT pass it as an argument. An arrow here silently matches no
  // model, so every query goes unscoped — i.e. it fails open.
  sequelize.addHook('beforeFind', function beforeFind(options) {
    const model = this || options.model;
    if (!shouldScope(model, options)) return;
    injectWhere(options, getOrgId());
  });

  sequelize.addHook('beforeCount', function beforeCount(options) {
    const model = this || options.model;
    if (!shouldScope(model, options)) return;
    injectWhere(options, getOrgId());
  });

  // ── Writes ──────────────────────────────────────────────────────────
  // beforeValidate, not beforeCreate: Sequelize validates before beforeCreate
  // runs, so stamping there would trip org_id's NOT NULL check first.
  sequelize.addHook('beforeValidate', (instance, options) => {
    if (!instance?.isNewRecord) return;

    const model = instance.constructor;
    if (!hasOrgColumn(model) || options?.skipOrgScope || isSystem()) return;

    const orgId = getOrgId();
    // Stamp the tenant rather than trusting a client-supplied org_id.
    if (orgId !== null) instance.org_id = orgId;
  });

  sequelize.addHook('beforeBulkCreate', (instances, options) => {
    if (!instances.length) return;
    const model = instances[0].constructor;
    if (!hasOrgColumn(model) || options?.skipOrgScope || isSystem()) return;

    const orgId = getOrgId();
    if (orgId === null) return;
    for (const instance of instances) instance.org_id = orgId;
  });

  // Bulk update/destroy bypass instance hooks, so they need their own guard —
  // otherwise `Model.update(x, { where: {...} })` would cross tenants.
  sequelize.addHook('beforeBulkUpdate', function beforeBulkUpdate(options) {
    const model = options.model || this;
    if (!shouldScope(model, options)) return;
    injectWhere(options, getOrgId());
  });

  sequelize.addHook('beforeBulkDestroy', function beforeBulkDestroy(options) {
    const model = options.model || this;
    if (!shouldScope(model, options)) return;
    injectWhere(options, getOrgId());
  });
};

/**
 * Express middleware: bind the authenticated user's org to the request.
 * Must run after the auth middleware has populated req.user.
 */
const tenantContext = (req, res, next) => {
  const orgId = req.user?.org_id ?? null;
  if (orgId === null) return next();
  runWithOrg(orgId, next);
};

module.exports = {
  applyTenancyHooks,
  tenantContext,
  runWithOrg,
  runAsSystem,
  getOrgId,
  isSystem,
  scopedModels,
};
