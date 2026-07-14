const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { runWithOrg, runAsSystem } = require('../services/tenancy');

/**
 * Authentication middleware – verifies the JWT, confirms the account is still
 * usable, and binds the request to the caller's organization.
 *
 * The token payload alone is not trusted for authorization state. A JWT lives
 * for 7 days, so a token minted before a user was deactivated, demoted, or had
 * their password reset would otherwise keep working until it expired. Each
 * request re-reads the user and checks:
 *   - the account still exists and is active
 *   - token_version still matches (bumped on deactivate / role change / reset)
 *   - the role and org come from the database, not from the token
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.',
      });
    }

    // A password-reset token must not be usable as an access token.
    if (decoded.purpose && decoded.purpose !== 'access') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    // The user lookup itself must not be tenant-filtered — we don't know the
    // tenant until we've loaded the user.
    const user = await runAsSystem(() =>
      User.findByPk(decoded.id, {
        attributes: ['id', 'email', 'name', 'role', 'is_active', 'org_id', 'token_version'],
      })
    );

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive or no longer exists.',
      });
    }

    if ((decoded.token_version ?? 0) !== user.token_version) {
      return res.status(401).json({
        success: false,
        message: 'Session has been revoked. Please log in again.',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      org_id: user.org_id,
    };

    // Everything downstream runs inside this tenant's context, so Sequelize
    // hooks can scope every query by org_id.
    return runWithOrg(user.org_id, () => next());
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
    });
  }
};

/**
 * Role-based authorization middleware.
 * Usage: authorize('admin', 'manager')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = { auth, authorize };
