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
  'station_boy',
  'sales_manager_statiun',
  'maintenance_car_management',
];

const PERMISSIONS = [
  'orders_view',
  'orders_create_customer',
  'orders_create_supplier',
  'orders_merge',
  'orders_edit',
  'orders_delete',
  'orders_manage',
  'customers_view',
  'customers_manage',
  'drivers_view',
  'drivers_manage',
  'suppliers_view',
  'suppliers_manage',
  'users_manage',
  'settings_access',
  'reports_view',
  'stats_total_orders',
  'stats_supplier_pending',
  'stats_supplier_merged',
  'stats_customer_waiting',
  'stats_customer_assigned',
  'stats_merged_orders',
  'stats_completed_orders',
  'stats_today_orders',
  'stats_week_orders',
  'stats_month_orders',
  'stats_cancelled_orders',
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
    const {
      name,
      email,
      password,
      company,
      phone,
      role,
      permissions,
      stationId,
    } = req.body;

    // =========================
    // 1️⃣ التحقق من البيانات الأساسية
    // =========================
    if (!name || !email || !password || !company) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // =========================
    // 2️⃣ منع تكرار البريد
    // =========================
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Email already in use',
      });
    }

    // =========================
    // 3️⃣ تحديد الدور النهائي (موحّد)
    // =========================
    const finalRole = normalizeRole(role);

    // =========================
    // 4️⃣ التحقق من ربط عامل المحطة بمحطة
    // =========================
    if (finalRole === 'station_boy') {
      if (!stationId) {
        return res.status(400).json({
          success: false,
          error: 'Station is required for station boy',
        });
      }

      // (اختياري لكن مهم) التأكد أن المحطة موجودة
      const stationExists = await Station.exists({ _id: stationId });
      if (!stationExists) {
        return res.status(400).json({
          success: false,
          error: 'Invalid station',
        });
      }
    }

    // =========================
    // 5️⃣ إنشاء المستخدم
    // =========================
    const user = new User({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      company: company.trim(),
      phone: phone?.trim() || null,
      role: finalRole,
      permissions: normalizePermissions(permissions),

      // ✅ ربط المحطة فقط لعامل محطة
      stationId: finalRole === 'station_boy' ? stationId : null,
    });

    await user.save();

    // =========================
    // 6️⃣ الاستجابة
    // =========================
    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        phone: user.phone,
        stationId: user.stationId, // null لو مش station_boy
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
    });
  }
};


exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const {
      name,
      email,
      company,
      phone,
      role,
      password,
      permissions,
      stationId,
    } = req.body;

    const updates = {};

    // =========================
    // 1️⃣ تحديث الحقول العادية
    // =========================
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (company !== undefined) updates.company = company;
    if (phone !== undefined) updates.phone = phone;

    // =========================
    // 2️⃣ الدور
    // =========================
    let finalRole;
    if (role !== undefined) {
      finalRole = normalizeRole(role);
      updates.role = finalRole;
    }

    // =========================
    // 3️⃣ كلمة المرور
    // =========================
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password, salt);
    }

    // =========================
    // 4️⃣ الصلاحيات
    // =========================
    if (permissions !== undefined) {
      updates.permissions = normalizePermissions(permissions);
    }

    // =========================
    // 5️⃣ جلب المستخدم الحالي
    // =========================
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: 'User not found' });
    }

    const effectiveRole = finalRole || user.role;

    // =========================
    // 6️⃣ منطق ربط المحطة
    // =========================
    if (effectiveRole === 'station_boy') {
      if (!stationId) {
        return res.status(400).json({
          success: false,
          error: 'Station is required for station boy',
        });
      }

      updates.stationId = stationId;
    } else {
      // ❌ أي دور غير عامل محطة
      updates.stationId = null;
    }

    // =========================
    // 7️⃣ التحديث
    // =========================
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      {
        new: true,
        runValidators: true,
      }
    ).select(
      'name email role company phone stationId createdAt isBlocked permissions'
    );

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
    });
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
