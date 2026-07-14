require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');

const { sequelize, User, Organization } = require('./models');
const bcrypt = require('bcrypt');
const { runAsSystem } = require('./services/tenancy');
const { logger, captureException, requestLogger } = require('./services/logger');

// ─── Import Route Files ─────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const customersRoutes = require('./routes/customers');
const policiesRoutes = require('./routes/policies');
const followupsRoutes = require('./routes/followups');
const renewalsRoutes = require('./routes/renewals');
const agentsRoutes = require('./routes/agents');
const reportsRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');
const notesRoutes = require('./routes/notes');

// ─── NeoDove Route Imports ──────────────────────────────────────────
const adminDashboardRoutes = require('./routes/admin-dashboard');
const contactImportRoutes = require('./routes/contact-imports');
const integrationsRoutes = require('./routes/integrations');
const pipelinesRoutes = require('./routes/pipelines');
const campaignsRoutes = require('./routes/campaigns');
const engagementFormsRoutes = require('./routes/engagement-forms');
const callReportsRoutes = require('./routes/call-reports');
const marketplaceRoutes = require('./routes/marketplace');
const smsAutomationRoutes = require('./routes/sms-automations');
const workflowsRoutes = require('./routes/workflows');

// ─── Import Reminder Service ────────────────────────────────────────
const reminderService = require('./services/reminderService');

// ─── Webhook Controller (public, no auth) ───────────────────────────
const { handleWebhook } = require('./controllers/integrationsController');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Fail Fast on Missing Secrets ───────────────────────────────────
// Without this, jwt.sign throws per-request at runtime instead of at boot.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  logger.error('❌ JWT_SECRET is missing or shorter than 32 characters. Refusing to start.');
  process.exit(1);
}

// Without this, every read of an encrypted field throws at runtime. Better to
// fail at boot than to serve half the app and 500 on customer KYC.
if (!process.env.ENCRYPTION_KEY) {
  logger.error('❌ ENCRYPTION_KEY is missing. Refusing to start.');
  logger.error('   Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// Rate limiters key on req.ip. Behind Nginx (see README) every request carries
// the proxy's IP unless Express is told to read X-Forwarded-For, which would
// collapse all clients into a single bucket.
app.set('trust proxy', process.env.TRUST_PROXY || 1);

// ─── CORS ────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight requests for all routes
app.options('*', cors());

// ─── Security Headers ───────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── Request Logging ─────────────────────────────────────────────────
// Assigns a request id and logs one structured line per request.
app.use(requestLogger);

// ─── Body Parsers ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting on Auth Routes ────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // Configurable so the integration suite can raise it; the default is unchanged.
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 30,
  message: {
    success: false,
    message: 'Too many requests. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Only count POST requests (login/register) against rate limit
  skip: (req) => req.method !== 'POST',
});

// Webhooks are public and unauthenticated — without a cap, anyone holding a
// webhook URL can flood the leads and integration_logs tables.
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many webhook requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Baseline cap for the authenticated API surface.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Serve Uploads as Static ─────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health Check (liveness) ─────────────────────────────────────────
// Answers "is the process up". Deliberately does NOT touch the database:
// a liveness probe that fails on a slow query gets the container killed.
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Insurance CRM API is running.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── Readiness ───────────────────────────────────────────────────────
// Answers "can this instance actually serve traffic". /api/health returned 200
// even with a dead connection pool, so a load balancer would happily route to
// an instance that 500s every request. This one checks the database.
app.get('/api/ready', async (req, res) => {
  const checks = { database: 'unknown', migrations: 'unknown' };

  try {
    await sequelize.authenticate();
    checks.database = 'ok';
  } catch (error) {
    checks.database = 'unavailable';
    return res.status(503).json({ success: false, status: 'not_ready', checks });
  }

  try {
    const pending = await getPendingMigrations();
    checks.migrations = pending.length === 0 ? 'ok' : `${pending.length} pending`;
  } catch {
    checks.migrations = 'unknown';
  }

  return res.status(200).json({
    success: true,
    status: 'ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// ─── Public Webhook Endpoint (no auth) ──────────────────────────────
app.post('/api/webhooks/incoming/:webhookId', webhookLimiter, handleWebhook);

// ─── Mount Routes ────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', apiLimiter);
app.use('/api/leads', leadsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/policies', policiesRoutes);
app.use('/api/followups', followupsRoutes);
app.use('/api/renewals', renewalsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notes', notesRoutes);

// ─── NeoDove Route Mounts ───────────────────────────────────────────
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/contact-imports', contactImportRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/pipelines', pipelinesRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/engagement-forms', engagementFormsRoutes);
app.use('/api/call-reports', callReportsRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/sms-automations', smsAutomationRoutes);
app.use('/api/workflows', workflowsRoutes);

// /api/users is now handled by routes/users.js

// ─── 404 Handler ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ─── Global Error Handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  captureException(err, {
    reqId: req.id,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    orgId: req.user?.org_id,
  });

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 5MB.',
    });
  }

  // Multer general error
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const errors = err.errors ? err.errors.map((e) => e.message) : [err.message];
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors,
    });
  }

  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error.',
  });
});

// ─── Migration Status ────────────────────────────────────────────────
/**
 * Report migrations that haven't been applied. Boot warns rather than exits:
 * refusing to start on a pending migration turns a schema drift into an outage.
 */
const getPendingMigrations = async () => {
  try {
    const { umzug } = require('./migrations/umzug');
    const pending = await umzug.pending();
    return pending.map((m) => m.name);
  } catch (error) {
    logger.warn('⚠️  Could not determine migration status:', error.message);
    return [];
  }
};

// ─── Seed Admin User ─────────────────────────────────────────────────
// Runs at boot, outside any request, so it must opt out of tenant scoping
// explicitly — otherwise the hooks would filter on a null org and find nothing.
const seedAdmin = async () => {
  try {
    await runAsSystem(async () => {
      const adminCount = await User.count({ where: { role: 'admin' } });
      if (adminCount > 0) return;

      const org = await Organization.findOne({ where: { slug: 'default' } });
      if (!org) {
        logger.warn('⚠️  Default organization missing — run "npm run migrate" before seeding.');
        return;
      }

      const password_hash = await bcrypt.hash('Admin@123', 10);
      await User.create({
        name: 'Admin',
        email: 'admin@insurancecrm.com',
        mobile: '9999999999',
        password_hash,
        role: 'admin',
        is_active: true,
        org_id: org.id,
      });
      logger.info('✅ Default admin user created (admin@insurancecrm.com / Admin@123)');
    });
  } catch (error) {
    logger.error('❌ Error seeding admin user:', error.message);
  }
};

// ─── Setup Cron Jobs ─────────────────────────────────────────────────
const setupCronJobs = () => {
  // Cron sweeps every organization, so each job runs outside tenant scope.
  // Rejections are caught here: an unhandled one inside a cron tick would
  // otherwise surface as a bare "unhandledRejection" with no job name.
  const scheduled = (expression, label, job) => {
    cron.schedule(expression, () => {
      logger.info(`[Cron] Triggering ${label}...`);
      runAsSystem(job).catch((error) => {
        logger.error(`[Cron] ${label} failed:`, error.message);
      });
    });
  };

  scheduled('0 9 * * *', 'renewal reminders', () => reminderService.sendRenewalReminders());
  scheduled('30 8 * * *', 'followup digest', () => reminderService.sendFollowupDigest());
  scheduled('0 9 * * *', 'birthday wishes', () => reminderService.sendBirthdayWishes());
  scheduled('0 10 * * 1', 'weekly summary', () => reminderService.sendWeeklySummary());

  logger.info('✅ Cron jobs scheduled.');
};

// ─── Start Server ────────────────────────────────────────────────────
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('✅ Database connection established.');

    // The schema is owned by migrations (npm run migrate), not by sync().
    // sync({ alter: true }) used to run here on every boot: it drifted from
    // the committed schema and re-added a UNIQUE index to users.email each
    // start, accumulating 8 duplicates against MySQL's 64-key-per-table limit.
    const pending = await getPendingMigrations();
    if (pending.length > 0) {
      logger.warn(`⚠️  ${pending.length} pending migration(s): ${pending.join(', ')}`);
      logger.warn('   Run "npm run migrate" — the schema may not match the models.');
    } else {
      logger.info('✅ Database schema is up to date.');
    }

    // Seed admin
    await seedAdmin();

    // Setup cron jobs
    setupCronJobs();

    // Start listening
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Insurance CRM Server running on port ${PORT}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    });

    // Finish in-flight requests and close the pool before exiting, so a deploy
    // doesn't sever open connections mid-write.
    const shutdown = (signal) => {
      logger.info(`\n${signal} received — shutting down gracefully...`);
      server.close(async () => {
        try {
          await sequelize.close();
        } catch (err) {
          logger.error('Error closing database pool:', err.message);
        }
        process.exit(0);
      });
      // Don't hang forever on a stuck connection.
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// A rejected promise with no catch would otherwise terminate the process
// silently on Node 20 with no log line explaining why.
process.on('unhandledRejection', (reason) => {
  captureException(reason instanceof Error ? reason : new Error(String(reason)), {
    source: 'unhandledRejection',
  });
});

process.on('uncaughtException', (error) => {
  captureException(error, { source: 'uncaughtException' });
  // The process is in an undefined state after this — exit and let the
  // supervisor restart it rather than serving from a corrupted heap.
  process.exit(1);
});

startServer();

module.exports = app;
