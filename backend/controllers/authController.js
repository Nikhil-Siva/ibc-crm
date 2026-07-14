const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { User, Organization } = require('../models');
const { validatePassword } = require('../utils/validation');
const { runAsSystem } = require('../services/tenancy');
const { recordActivity, ACTIONS } = require('../services/auditLog');

/**
 * The organization a self-registered user joins.
 *
 * Signup is for staff of the agency running this deployment, so new accounts
 * land in the default organization as agents. Creating an organization is an
 * operator action (seeds/admin), not something an anonymous request can do.
 */
const resolveSignupOrg = async () => {
  const org = await runAsSystem(() => Organization.findOne({ where: { slug: 'default' } }));
  if (!org) {
    throw new Error('Default organization is missing — run "npm run migrate".');
  }
  return org;
};

/**
 * Generate JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      org_id: user.org_id,
      // Checked against the database on every request so the token can be
      // revoked before it expires.
      token_version: user.token_version ?? 0,
      purpose: 'access',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Send OTP email helper
 * purpose: 'verification' | 'password_reset'
 */
const sendOtpEmail = async (email, otp, purpose) => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || gmailUser === 'your@gmail.com') {
    console.log(`[OTP EMAIL] Skipping email send — GMAIL_USER not configured. OTP for ${email}: ${otp}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  const subjectMap = {
    verification: 'Email Verification OTP — Insurance CRM',
    password_reset: 'Password Reset OTP — Insurance CRM',
  };

  const headingMap = {
    verification: 'Verify Your Email',
    password_reset: 'Reset Your Password',
  };

  const descriptionMap = {
    verification: 'Use the OTP below to verify your email address.',
    password_reset: 'Use the OTP below to reset your password.',
  };

  const subject = subjectMap[purpose] || 'Your OTP — Insurance CRM';
  const heading = headingMap[purpose] || 'Your OTP';
  const description = descriptionMap[purpose] || 'Use the OTP below.';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #1d4ed8; margin-bottom: 8px;">${heading}</h2>
      <p style="color: #374151; margin-bottom: 24px;">${description}</p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1d4ed8;">${otp}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Insurance CRM" <${gmailUser}>`,
    to: email,
    subject,
    html,
  });
};

/**
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    // Email is unique globally, so this lookup must span tenants.
    const existingUser = await runAsSystem(() =>
      User.findOne({ where: { email: email.trim().toLowerCase() } })
    );
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists.' });
    }

    const org = await resolveSignupOrg();
    const password_hash = await bcrypt.hash(password, 10);
    // Role is never taken from the request body — self-registration is always 'agent'.
    // Privileged roles are assigned only via POST /api/users (admin-only).
    const user = await runAsSystem(() => User.create({
      name,
      email: email.trim().toLowerCase(),
      mobile,
      password_hash,
      role: 'agent',
      org_id: org.id,
    }));

    // Generate OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp_code = otp;
    user.otp_expires_at = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    console.log(`[OTP] Verification OTP for ${email}: ${otp}`);

    // Try to send email (silently catch failures)
    try {
      await sendOtpEmail(email.trim().toLowerCase(), otp, 'verification');
    } catch (emailError) {
      console.error('[OTP] Failed to send verification email:', emailError.message);
    }

    const token = generateToken(user);
    const userData = user.toJSON();
    delete userData.password_hash;
    return res.status(201).json({ success: true, data: { token, user: userData } });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during registration.' });
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Login happens before any tenant context exists, so this lookup spans
    // organizations — email is globally unique.
    const user = await runAsSystem(() => User.findOne({ where: { email: cleanEmail } }));

    if (!user) {
      console.log(`[AUTH] Login failed: no user found for email="${cleanEmail}"`);
      await recordActivity({
        userId: null, action: ACTIONS.LOGIN_FAILED, req,
        details: { email: cleanEmail, reason: 'unknown_email' },
      });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Check account status
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again after ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
      });
    }

    // Validate password hash exists
    if (!user.password_hash) {
      console.error(`[AUTH] User ${cleanEmail} has no password_hash in database!`);
      return res.status(500).json({ success: false, message: 'Account configuration error. Contact admin.' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      console.log(`[AUTH] Login failed: password mismatch for email="${cleanEmail}"`);

      // Increment login attempts
      user.login_attempts = (user.login_attempts || 0) + 1;

      if (user.login_attempts >= 5) {
        user.locked_until = new Date(Date.now() + 15 * 60 * 1000);
        await runAsSystem(() => user.save());
        await recordActivity({
          userId: user.id, orgId: user.org_id, action: ACTIONS.LOGIN_FAILED, req,
          details: { email: cleanEmail, reason: 'locked_out' },
        });
        return res.status(401).json({
          success: false,
          message: 'Too many failed attempts. Account locked for 15 minutes.',
        });
      }

      await runAsSystem(() => user.save());
      await recordActivity({
        userId: user.id, orgId: user.org_id, action: ACTIONS.LOGIN_FAILED, req,
        details: { email: cleanEmail, reason: 'bad_password', attempt: user.login_attempts },
      });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // On success: reset counters, update last_login
    user.login_attempts = 0;
    user.locked_until = null;
    user.last_login = new Date();
    await runAsSystem(() => user.save());

    await recordActivity({
      userId: user.id, orgId: user.org_id, action: ACTIONS.LOGIN_SUCCESS, req,
      details: { email: cleanEmail, role: user.role },
    });

    const token = generateToken(user);
    const userData = user.toJSON();
    delete userData.password_hash;

    console.log(`[AUTH] Login success: email="${cleanEmail}", role="${user.role}"`);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token, user: userData }
    });

  } catch (error) {
    console.error('[AUTH] Login controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login.',
    });
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('GetMe error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Old password and new password are required.' });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Old password is incorrect.' });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    user.password_hash = newHash;
    // Changing a password must invalidate sessions opened with the old one.
    user.token_version += 1;
    await user.save();

    await recordActivity({
      userId: user.id, orgId: user.org_id, action: ACTIONS.PASSWORD_CHANGED, req,
    });

    // The caller's own token is now stale — hand back a fresh one so they
    // aren't logged out by the very request that succeeded.
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
      data: { token },
    });
  } catch (error) {
    console.error('ChangePassword error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await runAsSystem(() =>
      User.findOne({ where: { email: email.trim().toLowerCase() } })
    );

    // Always return 200 to avoid leaking user existence
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If this email exists, an OTP has been sent.',
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp_code = otp;
    user.otp_expires_at = new Date(Date.now() + 10 * 60 * 1000);
    await runAsSystem(() => user.save());

    console.log(`[OTP] Password reset OTP for ${email}: ${otp}`);

    // Try to send email (silently catch failures)
    try {
      await sendOtpEmail(email.trim().toLowerCase(), otp, 'password_reset');
    } catch (emailError) {
      console.error('[OTP] Failed to send password reset email:', emailError.message);
    }

    return res.status(200).json({ success: true, message: 'OTP sent to your email.' });
  } catch (error) {
    console.error('forgotPassword error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/auth/verify-otp
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const user = await runAsSystem(() =>
      User.findOne({ where: { email: email.trim().toLowerCase() } })
    );

    if (
      !user ||
      user.otp_code !== otp.toString() ||
      !user.otp_expires_at ||
      new Date(user.otp_expires_at) < new Date()
    ) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Generate short-lived reset token
    const resetToken = jwt.sign(
      { id: user.id, purpose: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Clear OTP fields
    user.otp_code = null;
    user.otp_expires_at = null;
    await runAsSystem(() => user.save());

    return res.status(200).json({ success: true, data: { resetToken } });
  } catch (error) {
    console.error('verifyOtp error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    if (payload.purpose !== 'reset') {
      return res.status(400).json({ success: false, message: 'Invalid reset token.' });
    }

    const user = await runAsSystem(() => User.findByPk(payload.id));
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Hash and save new password, clear OTP fields
    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.otp_code = null;
    user.otp_expires_at = null;
    // A reset is often a response to compromise — revoke every existing session.
    user.token_version += 1;
    await runAsSystem(() => user.save());

    await recordActivity({
      userId: user.id, orgId: user.org_id, action: ACTIONS.PASSWORD_RESET, req,
    });

    return res.status(200).json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    console.error('resetPassword error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { register, login, getMe, changePassword, forgotPassword, verifyOtp, resetPassword };
