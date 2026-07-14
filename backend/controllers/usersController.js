const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User } = require('../models');
const { validatePassword, escapeLike } = require('../utils/validation');
const { recordActivity, ACTIONS } = require('../services/auditLog');

/**
 * GET /api/users
 * admin/manager: list all users with pagination + filters
 */
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { search, role, is_active } = req.query;

    const where = {};

    if (search) {
      const term = `%${escapeLike(search)}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { email: { [Op.like]: term } },
      ];
    }

    if (role) where.role = role;
    if (is_active !== undefined) where.is_active = is_active === 'true';

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password_hash'] },
      order: [['name', 'ASC']],
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: {
        rows,
        count,
        page,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('getAllUsers error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/users/:id
 * admin/manager: get single user
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('getUserById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /api/users
 * admin only: create user with hashed password
 */
const createUser = async (req, res) => {
  try {
    const { name, email, mobile, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const existingUser = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.trim().toLowerCase(),
      mobile,
      password_hash,
      role: role || 'agent',
    });

    const userData = user.toJSON();
    delete userData.password_hash;

    await recordActivity({
      userId: req.user.id, action: ACTIONS.USER_CREATED, entityType: 'user', entityId: user.id, req,
      details: { email: user.email, role: user.role },
    });

    return res.status(201).json({ success: true, data: userData });
  } catch (error) {
    console.error('createUser error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/users/:id
 * admin only: update user (cannot change email)
 */
const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { name, mobile, role, is_active, password } = req.body;

    // An admin demoting or deactivating itself can lock the last admin out.
    if (user.id === req.user.id && ((role !== undefined && role !== user.role) || is_active === false)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role or deactivate your own account.',
      });
    }

    const previousRole = user.role;

    if (name !== undefined) user.name = name;
    if (mobile !== undefined) user.mobile = mobile;
    if (role !== undefined) user.role = role;
    if (is_active !== undefined) user.is_active = is_active;

    // If password field provided, hash it
    if (password) {
      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({ success: false, message: passwordError });
      }
      user.password_hash = await bcrypt.hash(password, 10);
    }

    // A demotion, a deactivation, or an admin-set password must all take effect
    // immediately rather than when the user's 7-day token happens to expire.
    const revokes = (role !== undefined && role !== previousRole)
      || is_active === false
      || Boolean(password);

    if (revokes) user.token_version += 1;

    await user.save();

    if (role !== undefined && role !== previousRole) {
      await recordActivity({
        userId: req.user.id, action: ACTIONS.ROLE_CHANGED, entityType: 'user', entityId: user.id, req,
        details: { from: previousRole, to: role },
      });
    }

    await recordActivity({
      userId: req.user.id, action: ACTIONS.USER_UPDATED, entityType: 'user', entityId: user.id, req,
      details: { fields: Object.keys(req.body).filter((k) => k !== 'password') },
    });

    const userData = user.toJSON();
    delete userData.password_hash;

    return res.status(200).json({ success: true, data: userData });
  } catch (error) {
    console.error('updateUser error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/users/:id
 * admin only: soft-delete (set is_active=false)
 */
const deactivateUser = async (req, res) => {
  try {
    // Cannot deactivate self
    if (parseInt(req.params.id, 10) === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.is_active = false;
    // Deactivation has to end their session now, not in up to 7 days.
    user.token_version += 1;
    await user.save();

    await recordActivity({
      userId: req.user.id, action: ACTIONS.USER_DEACTIVATED, entityType: 'user', entityId: user.id, req,
      details: { email: user.email },
    });

    return res.status(200).json({ success: true, message: `User "${user.name}" has been deactivated.` });
  } catch (error) {
    console.error('deactivateUser error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET /api/users/profile/me
 * Any auth'd user: get own profile
 */
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('getMyProfile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * PUT /api/users/profile/me
 * Any auth'd user: update own name/mobile
 */
const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { name, mobile } = req.body;

    if (name !== undefined) user.name = name;
    if (mobile !== undefined) user.mobile = mobile;

    await user.save();

    const userData = user.toJSON();
    delete userData.password_hash;

    return res.status(200).json({ success: true, data: userData });
  } catch (error) {
    console.error('updateMyProfile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  getMyProfile,
  updateMyProfile,
};
