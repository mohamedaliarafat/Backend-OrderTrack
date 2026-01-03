const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { safeSendEmail } = require('../services/emailQueue');
const { sendEmail } = require('../services/emailService');

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
      role: role || 'employee'
    });

    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
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

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const token = generateToken(user._id);

    // ======================
    // 📧 إرسال رسالة ترحيب
    // ======================
    try {
      await safeSendEmail(() =>
        sendEmail({
          to: [user.email],
          subject: '🎉 مرحبًا بك في البحيرة العربية',
          html: `
            <div style="font-family:Arial;padding:20px">
              <h2>مرحبًا ${user.name} 👋</h2>
              <p>
                سعداء بتسجيل دخولك إلى نظام <strong>البحيرة العربية</strong>.
              </p>
              <p>
                نتمنى لك تجربة موفقة، وإذا احتجت أي مساعدة لا تتردد في التواصل معنا.
              </p>
              <hr />
              <p style="color:#666;font-size:12px">
                هذا البريد تم إرساله تلقائيًا بعد تسجيل الدخول.
              </p>
            </div>
          `,
        })
      );
    } catch (emailError) {
      console.error('❌ Failed to send login welcome email:', emailError.message);
    }

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// ======================
// 👤 Profile
// ======================
exports.getProfile = async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        company: req.user.company,
        phone: req.user.phone,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};
