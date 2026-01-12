const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../services/emailService');

// ======================
// 🔐 Generate JWT
// ======================
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// ======================
// 📝 Register
// ======================
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, company, phone, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    }

    const user = new User({
      name,
      email,
      password,
      company,
      phone,
      role: role || 'employee',
    });

    await user.save();

    const token = generateToken(user._id);

    // 📧 إيميل ترحيب عند إنشاء الحساب (اختياري)
    try {
      await sendEmail({
        to: user.email,
        subject: '🎉 مرحبًا بك في البحيرة العربية',
        html: `
          <div dir="rtl" style="font-family:Arial;padding:20px">
            <h2>مرحبًا ${user.name} 👋</h2>
            <p>
              تم إنشاء حسابك بنجاح في نظام <strong>البحيرة العربية</strong>.
            </p>
            <p>
              يمكنك الآن تسجيل الدخول وبدء استخدام النظام.
            </p>
            <hr />
            <p style="color:#666;font-size:12px">
              هذا البريد تم إرساله تلقائيًا.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('❌ Failed to send register email:', emailError.message);
    }

    return res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        permissions: user.permissions || [],
      },
      token,
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// ======================
// 🔐 Login + Welcome Email
// ======================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'User account is blocked' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const token = generateToken(user._id);

    // ======================
    // 📧 رسالة ترحيب عند تسجيل الدخول
    // ======================
    try {
      await sendEmail({
        to: user.email,
        subject: '👋 تسجيل دخول ناجح',
        html: `
          <div dir="rtl" style="font-family:Arial;padding:20px">
            <h2>أهلاً ${user.name} 👋</h2>
            <p>
              تم تسجيل دخولك بنجاح إلى نظام <strong>البحيرة العربية</strong>.
            </p>
            <p>
              إذا لم تكن أنت من قام بتسجيل الدخول، يرجى التواصل معنا فورًا.
            </p>
            <hr />
            <p style="color:#666;font-size:12px">
              هذا البريد تم إرساله تلقائيًا بعد تسجيل الدخول.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error(
        '❌ Failed to send login welcome email:',
        emailError.message
      );
    }

    return res.json({
      message: 'تم تسجيل الدخول بنجاح',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company,
          permissions: user.permissions || [],
        },
      token,
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// ======================
// 👤 Profile
// ======================
exports.getProfile = async (req, res) => {
  try {
    return res.json({
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          company: req.user.company,
          phone: req.user.phone,
          createdAt: req.user.createdAt,
          permissions: req.user.permissions || [],
        },
    });
  } catch (error) {
    console.error('❌ Profile error:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};
