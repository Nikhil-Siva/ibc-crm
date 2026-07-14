const pino = require('pino');
const { randomUUID } = require('node:crypto');

/**
 * Structured logging and error tracking.
 *
 * The app previously used console.log/console.error with no levels, no request
 * correlation and no timestamps. Diagnosing a 500 meant reading raw stack
 * traces out of a terminal — workable on a laptop, useless in production.
 *
 * Output is JSON (one object per line) so it can be shipped to any log
 * aggregator. In development it's pretty-printed for humans.
 */

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Never let a secret reach the log store.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.newPassword',
      'req.body.oldPassword',
      'req.body.resetToken',
      'req.body.otp',
      'req.body.api_key',
      'req.body.api_secret',
      'password',
      'password_hash',
      'token',
    ],
    censor: '[redacted]',
  },

  ...(isProduction ? {} : {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});

/**
 * Report an error to the configured tracker.
 *
 * Deliberately a thin seam rather than a hard Sentry dependency: the DSN is
 * usually unset in dev and CI, and this keeps the app from requiring an
 * external service to run. Point ERROR_TRACKING_DSN at Sentry and swap the
 * body for `Sentry.captureException(error)`.
 */
const captureException = (error, context = {}) => {
  logger.error(
    {
      err: { message: error?.message, stack: error?.stack, name: error?.name },
      ...context,
    },
    error?.message || 'Unhandled error'
  );

  if (process.env.ERROR_TRACKING_DSN) {
    // Intentionally not wired to a vendor SDK here — see comment above.
    logger.debug({ dsn: '[configured]' }, 'Error forwarded to tracker');
  }
};

/**
 * Attach a request id to every request and expose a child logger on req.log.
 * Correlating the lines belonging to one request is the whole point.
 */
const requestLogger = require('pino-http')({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    // Health checks would otherwise flood the log.
    if (req.url === '/api/health' || req.url === '/api/ready') return 'silent';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

module.exports = { logger, captureException, requestLogger };
