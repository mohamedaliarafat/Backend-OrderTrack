const bcrypt = require('bcryptjs');
const User = require('../models/User');

const ALLOWED_ROLES = [
  'owner',
  'admin',
  'manager',
  'supervisor',
  'maintenance',
  'employee',
  'viewer',
];

const PERMISSIONS = [
  'orders_edit',
  'orders_delete',
  'orders_manage',
  'users_manage',
  'settings_access',
  'reports_view',
];

const normalizeRole = (role) => {
  if (typeof role !== 'string') return 'employee';
  return ALLOWED_ROLES.includes(role) ? role : 'employee';
};

const normalizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions)]
    .filter((permission) => PERMISSIONS.includes(permission));
};

exports.listUsers = async (req, res) => {
  try {
    let { page = 1, limit = 50, search, role, blocked } = req.query;

    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Number(limit) || 50);
    const filter = {};

    if (role && ALLOWED_ROLES.includes(role)) {
      filter.role = role;
    }

    if (blocked === 'true') {
      filter.isBlocked = true;
    } else if (blocked === 'false') {
      filter.isBlocked = false;
    }

    if (search && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { company: regex },
        { phone: regex },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email role company phone createdAt isBlocked permissions')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('User list error:', error);
    res.status(500).json({ success: false, error: 'Failed to load users' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, company, phone, role, permissions } = req.body;

    if (!name || !email || !password || !company) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing required fields' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, error: 'Email already in use' });
    }

    const user = new User({
      name,
      email,
      password,
      company,
      phone,
      role: normalizeRole(role),
      permissions: normalizePermissions(permissions),
    });

    await user.save();

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        phone: user.phone,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, company, phone, role, password, permissions } =
      req.body;
    const updates = {};

    if (name) updates.name = name;
    if (email) updates.email = email;
    if (company) updates.company = company;
    if (phone !== undefined) updates.phone = phone;
    if (role) updates.role = normalizeRole(role);
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password, salt);
    }

    if (permissions !== undefined) {
      updates.permissions = normalizePermissions(permissions);
    }

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select(
      'name email role company phone createdAt isBlocked permissions'
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: 'User not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { block } = req.body;

    if (typeof block !== 'boolean') {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid block flag' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: 'User not found' });
    }

    user.isBlocked = block;
    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        phone: user.phone,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
};
