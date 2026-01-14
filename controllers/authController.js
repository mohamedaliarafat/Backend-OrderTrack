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

    // ======================
    // 🔍 البحث عن المستخدم
    // ======================
    const user = await User.findOne({ email }).populate(
      'stationId',
      '_id stationName stationCode'
    );

    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    // ======================
    // ⛔ التحقق من الحظر
    // ======================
    if (user.isBlocked) {
      return res.status(403).json({ error: 'حساب المستخدم موقوف' });
    }

    // ======================
    // 🔐 مقارنة كلمة المرور
    // ======================
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    // ======================
    // 🎟️ إنشاء التوكن
    // ======================
    const token = generateToken(user._id);

    // ======================
    // 📧 رسالة ترحيب عند تسجيل الدخول
    // ======================
    try {
      await sendEmail({
  to: user.email,
  subject: '👋 تسجيل دخول ناجح - البحيرة العربية',
  html: `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: 'Segoe UI', Arial, sans-serif;">
        
        <div style="max-width:600px; margin:40px auto; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius:24px; overflow:hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.2);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding:40px 30px; text-align:center; position:relative;">
                <div style="width:80px; height:80px; background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%); border-radius:50%; margin:0 auto 20px; display:flex; align-items:center; justify-content:center; border:2px solid rgba(255,255,255,0.3);">
                    <span style="color:#fff; font-size:36px;">👋</span>
                </div>
                <h1 style="color:#fff; margin:0; font-size:28px; font-weight:300; letter-spacing:0.5px;">مرحباً ${user.name}</h1>
                <div style="width:60px; height:3px; background: linear-gradient(90deg, #3498db, #2ecc71); margin:15px auto; border-radius:10px;"></div>
            </div>
            
            <!-- Content -->
            <div style="padding:40px 30px;">
                <div style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(155, 89, 182, 0.1) 100%); padding:25px; border-radius:16px; border-right:4px solid #3498db; margin-bottom:30px;">
                    <h2 style="color:#2c3e50; margin:0 0 15px 0; font-size:22px; font-weight:600;">🚀 تسجيل دخول ناجح</h2>
                    <p style="color:#34495e; margin:0; font-size:16px; line-height:1.6;">
                        تم تسجيل دخولك بنجاح إلى نظام <strong style="color:#2c3e50;">البحيرة العربية</strong>.
                    </p>
                </div>
                
                <!-- Info Card -->
                <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding:25px; border-radius:16px; border:1px solid rgba(52, 152, 219, 0.1); margin-bottom:30px;">
                    <div style="display:flex; align-items:center; margin-bottom:15px;">
                        <div style="width:24px; height:24px; background: linear-gradient(135deg, #3498db, #2980b9); border-radius:6px; margin-left:10px; display:flex; align-items:center; justify-content:center;">
                            <span style="color:#fff; font-size:14px;">✓</span>
                        </div>
                        <h3 style="color:#2c3e50; margin:0; font-size:18px;">تفاصيل النشاط</h3>
                    </div>
                    <ul style="color:#34495e; margin:0; padding-right:20px; font-size:15px; line-height:1.8;">
                        <li style="margin-bottom:8px;">✅ تم التحقق من هويتك بنجاح</li>
                        <li style="margin-bottom:8px;">⏱️ وقت الدخول: ${new Date().toLocaleString('ar-SA')}</li>
                        <li>🔒 الجلسة آمنة ومشفرة</li>
                    </ul>
                </div>
                
                <!-- Warning Card -->
                <div style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.1) 0%, rgba(231, 76, 60, 0.05) 100%); padding:25px; border-radius:16px; border-right:4px solid #e74c3c; border:1px solid rgba(231, 76, 60, 0.2);">
                    <div style="display:flex; align-items:flex-start;">
                        <div style="width:24px; height:24px; background: linear-gradient(135deg, #e74c3c, #c0392b); border-radius:6px; margin-left:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <span style="color:#fff; font-size:14px;">!</span>
                        </div>
                        <div>
                            <h3 style="color:#c0392b; margin:0 0 10px 0; font-size:18px;">تنبيه أمني مهم</h3>
                            <p style="color:#7f8c8d; margin:0; font-size:15px; line-height:1.6;">
                                إذا لم تكن أنت من قام بتسجيل الدخول، يرجى 
                                <a href="mailto:support@arabic-lake.com" style="color:#3498db; text-decoration:none; font-weight:bold;">التواصل معنا فورًا</a> 
                                لحماية حسابك.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background: linear-gradient(135deg, #2c3e50 0%, #1a2530 100%); padding:25px 30px; text-align:center;">
                <p style="color:rgba(255,255,255,0.7); margin:0 0 15px 0; font-size:13px; line-height:1.5;">
                    هذا البريد تم إرساله تلقائيًا بعد تسجيل الدخول إلى نظام البحيرة العربية
                </p>
                <div style="width:100%; height:1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); margin:20px 0;"></div>
                <p style="color:rgba(255,255,255,0.5); margin:0; font-size:12px;">
                    © ${new Date().getFullYear()} البحيرة العربية. جميع الحقوق محفوظة.
                </p>
            </div>
            
        </div>
        
    </body>
    </html>
  `
});
    } catch (emailError) {
      console.error(
        '❌ Failed to send login welcome email:',
        emailError.message
      );
    }

    // ======================
    // ✅ Response النهائي
    // ======================
    return res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        permissions: user.permissions || [],

        // ⭐ المهم هنا
        stationId: user.stationId ? user.stationId._id : null,
        stationName: user.stationId ? user.stationId.stationName : null,
        stationCode: user.stationId ? user.stationId.stationCode : null,
      },
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
