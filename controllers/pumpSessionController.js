const PumpSession = require('../models/PumpSession');
const Station = require('../models/Station');
const Activity = require('../models/Activity');
const mongoose = require('mongoose');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');


// Generate session number
const generateSessionNumber = async (stationCode) => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const lastSession = await PumpSession.findOne({
    sessionNumber: new RegExp(`^${stationCode}-${dateStr}`)
  }).sort({ sessionNumber: -1 });
  
  if (!lastSession) {
    return `${stationCode}-${dateStr}-001`;
  }
  
  const lastNumber = parseInt(lastSession.sessionNumber.slice(-3));
  const newNumber = (lastNumber + 1).toString().padStart(3, '0');
  return `${stationCode}-${dateStr}-${newNumber}`;
};

const SESSION_NOTIFICATION_ROLES = [
  'owner',
  'manager',
  'sales_manager_statiun',
];



exports.openSession = async (req, res) => {
  try {
    const sessionData = { ...req.body };

    // =========================
    // 🧹 تنظيف _id
    // =========================
    if (!sessionData._id) {
      delete sessionData._id;
    }

    // =========================
    // ✅ تحقق من قراءات الليّات
    // =========================
    if (
      !Array.isArray(sessionData.nozzleReadings) ||
      sessionData.nozzleReadings.length === 0
    ) {
      return res.status(400).json({
        error: 'يجب إدخال قراءات الليّات',
      });
    }

    // =========================
    // 📍 جلب المحطة
    // =========================
    const station = await Station.findById(sessionData.stationId);
    if (!station) {
      return res.status(404).json({ error: 'المحطة غير موجودة' });
    }

    // =========================
    // 🔢 رقم الجلسة
    // =========================
    sessionData.sessionNumber = await generateSessionNumber(
      station.stationCode
    );

    sessionData.stationName = station.stationName;
    sessionData.sessionDate = new Date();
    sessionData.openingEmployeeId = req.user._id;
    sessionData.openingEmployeeName = req.user.name;

    // =========================
    // 🧠 التحقق وبناء nozzleReadings
    // =========================
    const finalNozzleReadings = [];

    for (const nr of sessionData.nozzleReadings) {
      if (!nr.pumpId) {
        return res.status(400).json({ error: 'يوجد قراءة بدون pumpId' });
      }

      if (nr.nozzleNumber == null) {
        return res
          .status(400)
          .json({ error: 'يوجد قراءة بدون رقم الليّة' });
      }

      if (!nr.fuelType) {
        return res
          .status(400)
          .json({ error: 'يوجد قراءة بدون نوع الوقود' });
      }

      if (nr.openingReading == null) {
        return res
          .status(400)
          .json({ error: 'يوجد قراءة بدون قيمة فتح' });
      }

      // ✅ تحقق إلزامي من صورة الفتح (Firebase URL)
      if (
        !nr.openingImageUrl ||
        typeof nr.openingImageUrl !== 'string'
      ) {
        return res.status(400).json({
          error: `يجب إرفاق صورة فتح لليّة ${nr.nozzleNumber}`,
        });
      }

      const pump = station.pumps.id(nr.pumpId);
      if (!pump) {
        return res.status(400).json({
          error: `الطلمبة غير موجودة (${nr.pumpId})`,
        });
      }

      // ✅ توحيد نوع الليّة
      const nozzle = pump.nozzles.find(
        (n) => Number(n.nozzleNumber) === Number(nr.nozzleNumber)
      );

      if (!nozzle) {
        return res.status(400).json({
          error: `الليّة ${nr.nozzleNumber} غير موجودة في الطلمبة ${pump.pumpNumber}`,
        });
      }

      const fuelPrice = station.fuelPrices?.find(
        (p) => p.fuelType === nr.fuelType
      );

      finalNozzleReadings.push({
        pumpId: pump._id,
        pumpNumber: pump.pumpNumber,

        nozzleNumber: nozzle.nozzleNumber,
        side: nozzle.side,
        fuelType: nr.fuelType,

        openingReading: nr.openingReading,
        openingImageUrl: nr.openingImageUrl, // ✅ Firebase URL فقط
        openingTime: new Date(),

        unitPrice: fuelPrice?.price || 0,
      });
    }

    sessionData.nozzleReadings = finalNozzleReadings;

    // =========================
    // 💾 حفظ الجلسة
    // =========================
    const session = new PumpSession(sessionData);
    await session.save();

    // =========================
    // 📝 Activity Log
    // =========================
    await Activity.create({
      sessionId: session._id,
      activityType: 'إنشاء',
      description: `تم فتح جلسة ${session.sessionNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'رقم الجلسة': session.sessionNumber,
        'عدد الليّات': session.nozzleReadings.length.toString(),
      },
    });

    // =========================
    // 📧 إرسال بريد إلكتروني لفتح الجلسة
    // =========================
    try {
const usersToNotify = await User.find({
  role: { $in: SESSION_NOTIFICATION_ROLES },
  email: { $exists: true, $ne: null },
  isBlocked: false,
}).select('email name role');


      // إضافة المستخدم الحالي (أنت) إذا لم يكن موجوداً
      const allRecipients = usersToNotify.map(user => user.email);
      if (!allRecipients.includes('nasser@albuheiraalarabia.com')) {
        allRecipients.push('nasser@albuheiraalarabia.com');
      }

      // إرسال البريد إذا كان هناك مستلمين
      if (allRecipients.length > 0) {
        const emailHtml = generateOpenSessionEmail(session, req.user, station);
        
        await sendEmail({
 to: process.env.EMAIL_USER,          bcc: allRecipients,
          subject: `🔓 فتح جلسة جديدة - ${session.sessionNumber} - ${station.stationName} - نظام نبراس`,
          html: emailHtml,
  replyTo: process.env.EMAIL_USER,
        });

        console.log(`📧 تم إرسال إشعار فتح الجلسة ${session.sessionNumber} إلى ${allRecipients.length} مستخدم`);
      }
    } catch (emailError) {
      console.error('❌ خطأ في إرسال البريد الإلكتروني:', emailError);
      // لا نوقف العملية إذا فشل الإرسال
    }

    res.status(201).json({
      message: 'تم فتح الجلسة بنجاح',
      session,
    });
  } catch (error) {
    console.error('❌ openSession error:', error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Close session
exports.closeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const closingData = { ...req.body };

    /* =========================
       🔎 جلب الجلسة
    ========================= */
    const session = await PumpSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'الجلسة غير موجودة' });
    }

    if (session.status !== 'مفتوحة') {
      return res.status(400).json({ error: 'الجلسة ليست مفتوحة' });
    }

    /* =========================
       👤 بيانات موظف الإغلاق
    ========================= */
    session.closingEmployeeId = req.user._id;
    session.closingEmployeeName = req.user.name;
    session.closingTime = new Date();

    /* =========================
       💳 التحصيل (إجباري)
    ========================= */
    if (
      !closingData.paymentTypes ||
      typeof closingData.paymentTypes !== 'object'
    ) {
      return res.status(400).json({
        error: 'بيانات التحصيل مطلوبة',
      });
    }

    session.paymentTypes = {
      cash: Number(closingData.paymentTypes.cash) || 0,
      card: Number(closingData.paymentTypes.card) || 0,
      mada: Number(closingData.paymentTypes.mada) || 0,
      other: Number(closingData.paymentTypes.other) || 0,
    };

    /* =========================
       💸 المصروفات (اختياري) ✅ FIXED
    ========================= */
    if (Array.isArray(closingData.expenses)) {
      session.expenses = closingData.expenses
        .filter((e) => Number(e.amount) > 0)
        .map((e) => ({
          category: e.category || e.type || 'عام',
          amount: Number(e.amount),
          description: e.description || e.notes || '',
          createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
        }));
    } else {
      session.expenses = [];
    }

    /* =========================
       ⚖️ سبب الفرق / ملاحظات
    ========================= */
    session.differenceReason =
      closingData.differenceReason?.trim() || undefined;

    session.notes = closingData.notes?.trim() || undefined;

    /* =========================
       ⛽ دمج قراءات الغلق + الصور
    ========================= */
    if (Array.isArray(closingData.nozzleReadings)) {
      for (const closing of closingData.nozzleReadings) {
        const nozzle = session.nozzleReadings.find(
          (n) =>
            String(n.pumpId) === String(closing.pumpId) &&
            Number(n.nozzleNumber) === Number(closing.nozzleNumber)
        );

        if (!nozzle) continue;

        nozzle.closingReading = Number(closing.closingReading);
        nozzle.closingImageUrl = closing.closingImageUrl;
        nozzle.closingTime = new Date();
      }
    }

    /* =========================
       🔒 إغلاق الجلسة
    ========================= */
    session.status = 'مغلقة';

    // 🔥 الحسابات تتم تلقائيًا داخل pre('save')
    await session.save();

    /* =========================
       📝 Activity Log
    ========================= */
    const changes = {
      الحالة: 'مغلقة',
      'إجمالي اللترات': String(session.totalLiters),
      'إجمالي المبيعات': String(session.totalSales),
      'صافي المبيعات': String(session.netSales),
      'إجمالي المصروفات': String(session.expensesTotal),
      'فرق الجلسة': String(session.calculatedDifference),
    };

    if (session.expenses.length) {
      changes['عدد المصروفات'] = String(session.expenses.length);
    }

    await Activity.create({
      sessionId: session._id,
      activityType: 'إغلاق',
      description: `تم إغلاق الجلسة ${session.sessionNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes,
    });

    /* =========================
       📧 إرسال بريد إلكتروني لإغلاق الجلسة
    ========================= */
    try {
     const usersToNotify = await User.find({
  role: { $in: SESSION_NOTIFICATION_ROLES },
  email: { $exists: true, $ne: null },
  isBlocked: false,
}).select('email name role');


      // إضافة المستخدم الحالي (أنت) إذا لم يكن موجوداً
      const allRecipients = usersToNotify.map(user => user.email);
      if (!allRecipients.includes('nasser@albuheiraalarabia.com')) {
        allRecipients.push('nasser@albuheiraalarabia.com');
      }

      // جلب معلومات المحطة
      const station = await Station.findById(session.stationId);

      // إرسال البريد إذا كان هناك مستلمين
      if (allRecipients.length > 0) {
        const emailHtml = generateCloseSessionEmail(session, req.user, station);
        
      await sendEmail({
  // ✅ إيميلك أنت (Gmail) – تقني فقط
  to: process.env.EMAIL_USER,

  // 👥 المستلمين الحقيقيين
  bcc: allRecipients,

  subject: `🔒 إغلاق جلسة - ${session.sessionNumber} - ${station.stationName} - نظام نبراس`,
  html: emailHtml,

  replyTo: process.env.EMAIL_USER,
});


        console.log(`📧 تم إرسال إشعار إغلاق الجلسة ${session.sessionNumber} إلى ${allRecipients.length} مستخدم`);
      }
    } catch (emailError) {
      console.error('❌ خطأ في إرسال البريد الإلكتروني:', emailError);
      // لا نوقف العملية إذا فشل الإرسال
    }

    res.json({
      success: true,
      message: 'تم إغلاق الجلسة بنجاح',
      session,
    });
  } catch (error) {
    console.error('❌ closeSession error:', error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// ===============================
// 📧 وظائف توليد محتوى البريد الإلكتروني (محدثة)
// ===============================

const generateOpenSessionEmail = (session, user, station) => {
  const openingTime = new Date(session.sessionDate).toLocaleString('ar-SA');
  
  // إنشاء جدول قراءات الليّات
  const nozzleReadingsTable = session.nozzleReadings.map(reading => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
      <td style="padding: 12px; text-align: center;">${reading.pumpNumber}</td>
      <td style="padding: 12px; text-align: center;">${reading.nozzleNumber}</td>
      <td style="padding: 12px; text-align: center;">${reading.fuelType}</td>
      <td style="padding: 12px; text-align: center;">${reading.openingReading.toLocaleString()}</td>
      <td style="padding: 12px; text-align: center;">${reading.unitPrice.toLocaleString('ar-SA')} ر.س</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>فتح جلسة جديدة - نظام نبراس</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Tajawal', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: #333;
        }
        
        .email-container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .header {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
            animation: shine 3s infinite;
        }
        
        @keyframes shine {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        .logo {
            font-size: 32px;
            font-weight: 700;
            color: white;
            margin-bottom: 10px;
            text-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        .logo span {
            color: #4CAF50;
        }
        
        .subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 18px;
            font-weight: 300;
        }
        
        .status-badge {
            display: inline-block;
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white;
            padding: 10px 25px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 18px;
            margin-top: 20px;
            box-shadow: 0 5px 15px rgba(76, 175, 80, 0.4);
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .session-info {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 25px;
            border-radius: 15px;
            margin-bottom: 30px;
            border-left: 5px solid #3498db;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .info-item {
            background: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.1);
        }
        
        .info-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }
        
        .info-value {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .table-container {
            overflow-x: auto;
            margin: 30px 0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        th {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            padding: 15px;
            text-align: center;
            font-weight: 600;
        }
        
        td {
            padding: 12px;
            text-align: center;
            border-bottom: 1px solid #eee;
        }
        
        tr:hover {
            background: #f8f9fa;
        }
        
        .footer {
            background: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .footer-links {
            margin-top: 20px;
        }
        
        .footer-links a {
            color: #3498db;
            text-decoration: none;
            margin: 0 10px;
        }
        
        .footer-links a:hover {
            text-decoration: underline;
        }
        
        .timestamp {
            color: rgba(255,255,255,0.7);
            font-size: 14px;
            margin-top: 20px;
        }
        
        .user-info {
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
        }
        
        @media (max-width: 600px) {
            .header {
                padding: 30px 20px;
            }
            
            .content {
                padding: 20px;
            }
            
            .info-grid {
                grid-template-columns: 1fr;
            }
            
            table {
                font-size: 14px;
            }
            
            th, td {
                padding: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">نظام <span>نبراس</span></div>
            <div class="subtitle">شركة البحيرة العربية</div>
            <div class="status-badge">🔓 جلسة جديدة مفتوحة</div>
        </div>
        
        <div class="content">
            <h2 style="color: #2c3e50; margin-bottom: 20px; text-align: center;">
                تم فتح جلسة جديدة بنجاح
            </h2>
            
            <div class="session-info">
                <h3 style="color: #3498db; margin-bottom: 15px;">معلومات الجلسة</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">رقم الجلسة</div>
                        <div class="info-value">${session.sessionNumber}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">المحطة</div>
                        <div class="info-value">${session.stationName}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">كود المحطة</div>
                        <div class="info-value">${station?.stationCode || 'N/A'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">تاريخ الفتح</div>
                        <div class="info-value">${openingTime}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">موظف الفتح</div>
                        <div class="info-value">${session.openingEmployeeName}</div>
                    </div>
                </div>
            </div>
            
            <div class="user-info">
                <p style="margin: 0; color: #1565c0;">
                    <strong>تم تنفيذ العملية بواسطة:</strong> ${user.name} (${user.email})
                </p>
            </div>
            
            <h3 style="color: #2c3e50; margin: 30px 0 15px 0;">قراءات الليّات المفتوحة</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>رقم الطلمبة</th>
                            <th>رقم الليّة</th>
                            <th>نوع الوقود</th>
                            <th>قراءة الفتح</th>
                            <th>سعر اللتر</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${nozzleReadingsTable}
                    </tbody>
                </table>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
                <p style="color: #666; margin-bottom: 10px;">إجمالي عدد الليّات: <strong>${session.nozzleReadings.length}</strong></p>
                <p style="color: #666; margin-bottom: 5px;">عدد الطلمبات: <strong>${[...new Set(session.nozzleReadings.map(r => r.pumpNumber))].length}</strong></p>
                <p style="color: #666;">يمكنك مراجعة تفاصيل الجلسة في النظام عند الحاجة</p>
            </div>
        </div>
        
        <div class="footer">
            <div style="margin-bottom: 15px;">
                <strong>شركة البحيرة العربية</strong><br>
                نظام إدارة محطات الوقود - نبراس
            </div>
            <div class="footer-links">
                <a href="https://albuhairaalarabia.com">الموقع الإلكتروني</a>
                <a href="mailto:support@albuhairaalarabia.com">الدعم الفني</a>
            </div>
            <div class="timestamp">
                تم إرسال هذا البريد تلقائياً بتاريخ: ${new Date().toLocaleString('ar-SA')}
            </div>
        </div>
    </div>
</body>
</html>
  `;
};

const generateCloseSessionEmail = (session, user, station) => {
  const openingTime = new Date(session.sessionDate).toLocaleString('ar-SA');
  const closingTime = new Date(session.closingTime).toLocaleString('ar-SA');
  
  // إنشاء جدول قراءات الليّات
  const nozzleReadingsTable = session.nozzleReadings.map(reading => {
    const liters = reading.closingReading - reading.openingReading;
    const sales = liters * reading.unitPrice;
    
    return `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
      <td style="padding: 10px; text-align: center;">${reading.pumpNumber}</td>
      <td style="padding: 10px; text-align: center;">${reading.nozzleNumber}</td>
      <td style="padding: 10px; text-align: center;">${reading.fuelType}</td>
      <td style="padding: 10px; text-align: center;">${reading.openingReading.toLocaleString()}</td>
      <td style="padding: 10px; text-align: center;">${reading.closingReading.toLocaleString()}</td>
      <td style="padding: 10px; text-align: center; color: #2ecc71;">${liters.toLocaleString()}</td>
      <td style="padding: 10px; text-align: center; color: #3498db;">${reading.unitPrice.toLocaleString('ar-SA')}</td>
      <td style="padding: 10px; text-align: center; color: #e74c3c; font-weight: bold;">${sales.toLocaleString('ar-SA')}</td>
    </tr>
  `}).join('');

  // إنشاء جدول المصروفات
  const expensesTable = session.expenses && session.expenses.length > 0 
    ? session.expenses.map(expense => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
          <td style="padding: 10px; text-align: center;">${expense.category}</td>
          <td style="padding: 10px; text-align: center; color: #e74c3c;">${expense.amount.toLocaleString('ar-SA')} ر.س</td>
          <td style="padding: 10px; text-align: center;">${expense.description || '-'}</td>
          <td style="padding: 10px; text-align: center;">${new Date(expense.createdAt).toLocaleString('ar-SA')}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #666;">لا توجد مصروفات</td></tr>`;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إغلاق جلسة - نظام نبراس</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Tajawal', sans-serif;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            min-height: 100vh;
            padding: 20px;
            color: #333;
        }
        
        .email-container {
            max-width: 900px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .header {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
            animation: shine 3s infinite;
        }
        
        @keyframes shine {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        .logo {
            font-size: 32px;
            font-weight: 700;
            color: white;
            margin-bottom: 10px;
            text-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        .logo span {
            color: #e74c3c;
        }
        
        .subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 18px;
            font-weight: 300;
        }
        
        .status-badge {
            display: inline-block;
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 10px 25px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 18px;
            margin-top: 20px;
            box-shadow: 0 5px 15px rgba(231, 76, 60, 0.4);
        }
        
        .financial-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
            margin: 30px 0;
        }
        
        .financial-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            border-top: 4px solid;
        }
        
        .card-sales { border-color: #2ecc71; }
        .card-liters { border-color: #3498db; }
        .card-expenses { border-color: #e74c3c; }
        .card-difference { 
            border-color: ${session.calculatedDifference >= 0 ? '#f39c12' : '#e74c3c'};
            background: ${session.calculatedDifference >= 0 ? 'linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%)' : 'linear-gradient(135deg, #fdeaea 0%, #f8d7da 100%)'};
        }
        
        .financial-card .label {
            font-size: 14px;
            color: #666;
            margin-bottom: 8px;
        }
        
        .financial-card .value {
            font-size: 24px;
            font-weight: 700;
            color: #2c3e50;
        }
        
        .payment-summary {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 25px;
            border-radius: 15px;
            margin: 30px 0;
        }
        
        .payment-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        
        .payment-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 3px 10px rgba(0,0,0,0.1);
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .table-container {
            overflow-x: auto;
            margin: 30px 0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        th {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            padding: 12px;
            text-align: center;
            font-weight: 600;
            font-size: 14px;
        }
        
        td {
            padding: 10px;
            text-align: center;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        }
        
        tr:hover {
            background: #f8f9fa;
        }
        
        .section-title {
            color: #2c3e50;
            margin: 30px 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #3498db;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        
        .info-item {
            background: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.1);
        }
        
        .info-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }
        
        .info-value {
            font-size: 16px;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .user-info {
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
        }
        
        .footer {
            background: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .footer-links {
            margin-top: 20px;
        }
        
        .footer-links a {
            color: #3498db;
            text-decoration: none;
            margin: 0 10px;
        }
        
        .footer-links a:hover {
            text-decoration: underline;
        }
        
        .timestamp {
            color: rgba(255,255,255,0.7);
            font-size: 14px;
            margin-top: 20px;
        }
        
        @media (max-width: 600px) {
            .header {
                padding: 30px 20px;
            }
            
            .content {
                padding: 20px;
            }
            
            .financial-summary,
            .payment-grid,
            .info-grid {
                grid-template-columns: 1fr;
            }
            
            table {
                font-size: 12px;
            }
            
            th, td {
                padding: 6px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">نظام <span>نبراس</span></div>
            <div class="subtitle">شركة البحيرة العربية</div>
            <div class="status-badge">🔒 جلسة مغلقة</div>
        </div>
        
        <div class="content">
            <h2 style="color: #2c3e50; margin-bottom: 20px; text-align: center;">
                تم إغلاق الجلسة بنجاح
            </h2>
            
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">رقم الجلسة</div>
                    <div class="info-value">${session.sessionNumber}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">المحطة</div>
                    <div class="info-value">${session.stationName}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">كود المحطة</div>
                    <div class="info-value">${station?.stationCode || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">تاريخ الفتح</div>
                    <div class="info-value">${openingTime}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">تاريخ الإغلاق</div>
                    <div class="info-value">${closingTime}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">موظف الفتح</div>
                    <div class="info-value">${session.openingEmployeeName}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">موظف الإغلاق</div>
                    <div class="info-value">${session.closingEmployeeName}</div>
                </div>
            </div>
            
            <div class="user-info">
                <p style="margin: 0; color: #1565c0;">
                    <strong>تم تنفيذ العملية بواسطة:</strong> ${user.name} (${user.email})
                </p>
            </div>
            
            <h3 class="section-title">ملخص مالي</h3>
            <div class="financial-summary">
                <div class="financial-card card-sales">
                    <div class="label">إجمالي المبيعات</div>
                    <div class="value">${session.totalSales.toLocaleString('ar-SA')} ر.س</div>
                </div>
                <div class="financial-card card-liters">
                    <div class="label">إجمالي اللترات</div>
                    <div class="value">${session.totalLiters.toLocaleString('ar-SA')} لتر</div>
                </div>
                <div class="financial-card card-expenses">
                    <div class="label">إجمالي المصروفات</div>
                    <div class="value">${session.expensesTotal.toLocaleString('ar-SA')} ر.س</div>
                </div>
                <div class="financial-card card-difference">
                    <div class="label">فرق الجلسة</div>
                    <div class="value">${session.calculatedDifference.toLocaleString('ar-SA')} ر.س</div>
                </div>
            </div>
            
            <h3 class="section-title">أنواع الدفع</h3>
            <div class="payment-summary">
                <div class="payment-grid">
                    <div class="payment-item">
                        <div class="label">نقدي</div>
                        <div class="value">${session.paymentTypes.cash.toLocaleString('ar-SA')} ر.س</div>
                    </div>
                    <div class="payment-item">
                        <div class="label">بطاقة</div>
                        <div class="value">${session.paymentTypes.card.toLocaleString('ar-SA')} ر.س</div>
                    </div>
                    <div class="payment-item">
                        <div class="label">مدى</div>
                        <div class="value">${session.paymentTypes.mada.toLocaleString('ar-SA')} ر.س</div>
                    </div>
                    <div class="payment-item">
                        <div class="label">أخرى</div>
                        <div class="value">${session.paymentTypes.other.toLocaleString('ar-SA')} ر.س</div>
                    </div>
                </div>
            </div>
            
            <h3 class="section-title">قراءات الليّات</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>الطلمبة</th>
                            <th>الليّة</th>
                            <th>الوقود</th>
                            <th>قراءة فتح</th>
                            <th>قراءة غلق</th>
                            <th>اللترات</th>
                            <th>سعر اللتر</th>
                            <th>المبيعات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${nozzleReadingsTable}
                    </tbody>
                </table>
            </div>
            
            <h3 class="section-title">المصروفات</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>الفئة</th>
                            <th>المبلغ</th>
                            <th>الوصف</th>
                            <th>التاريخ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expensesTable}
                    </tbody>
                </table>
            </div>
            
            ${session.notes ? `
            <div style="background: #fff3cd; padding: 20px; border-radius: 10px; margin: 30px 0; border-right: 5px solid #ffc107;">
                <h4 style="color: #856404; margin-bottom: 10px;">📝 ملاحظات:</h4>
                <p style="color: #856404;">${session.notes}</p>
            </div>
            ` : ''}
            
            ${session.differenceReason ? `
            <div style="background: #f8d7da; padding: 20px; border-radius: 10px; margin: 30px 0; border-right: 5px solid #dc3545;">
                <h4 style="color: #721c24; margin-bottom: 10px;">⚖️ سبب الفرق:</h4>
                <p style="color: #721c24;">${session.differenceReason}</p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
                <p style="color: #666; margin-bottom: 10px; font-size: 18px;">
                    <strong>صافي المبيعات:</strong> 
                    <span style="color: #2ecc71; font-weight: bold;">${session.netSales.toLocaleString('ar-SA')} ر.س</span>
                </p>
                <p style="color: #666;">تم إغلاق الجلسة بنجاح وجميع البيانات محفوظة في النظام</p>
            </div>
        </div>
        
        <div class="footer">
            <div style="margin-bottom: 15px;">
                <strong>شركة البحيرة العربية</strong><br>
                نظام إدارة محطات الوقود - نبراس
            </div>
            <div class="footer-links">
                <a href="https://albuhairaalarabia.com">الموقع الإلكتروني</a>
                <a href="mailto:support@albuhairaalarabia.com">الدعم الفني</a>
            </div>
            <div class="timestamp">
                تم إرسال هذا البريد تلقائياً بتاريخ: ${new Date().toLocaleString('ar-SA')}
            </div>
        </div>
    </div>
</body>
</html>
  `;
};


// Approve opening reading
exports.approveOpening = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await PumpSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'الجلسة غير موجودة' });
    }

    session.openingApproved = true;
    session.openingApprovedBy = req.user._id;
    session.openingApprovedAt = new Date();

    await session.save();

    res.json({
      message: 'تم اعتماد قراءة الفتح بنجاح',
      session
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Approve closing reading
exports.approveClosing = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await PumpSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'الجلسة غير موجودة' });
    }

    if (session.status !== 'مغلقة') {
      return res.status(400).json({ error: 'يجب إغلاق الجلسة أولاً' });
    }

    session.closingApproved = true;
    session.closingApprovedBy = req.user._id;
    session.closingApprovedAt = new Date();
    session.status = 'معتمدة';

    await session.save();

    res.json({
      message: 'تم اعتماد قراءة الإغلاق بنجاح',
      session
    });
  } catch (error) {
  console.error('❌ approveClosing error:', error);
  res.status(500).json({
    error: error.message,
    stack: error.stack, // مؤقتًا للتشخيص
  });
}

};



// Get sessions with filters
exports.getSessions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      stationId,
      pumpId,
      status,
      startDate,
      endDate,
      fuelType,
      shiftType,
    } = req.query;

    const skip = (page - 1) * limit;

    const filter = {};

    // =========================
    // 🔐 التحكم حسب الدور
    // =========================
    const user = req.user;

    if (user.role === 'station_boy') {
      // 🔒 إجبار المستخدم على محطته فقط
      if (!user.stationId) {
        return res.status(403).json({
          error: 'المستخدم غير مرتبط بأي محطة',
        });
      }
      filter.stationId = user.stationId;
    } else {
      // باقي الأدوار
      if (stationId) filter.stationId = stationId;
    }

    // =========================
    // 🎯 فلاتر إضافية
    // =========================
    if (pumpId) filter.pumpId = pumpId;
    if (status) filter.status = status;
    if (fuelType) filter.fuelType = fuelType;
    if (shiftType) filter.shiftType = shiftType;

    // =========================
    // 📅 فلترة بالتاريخ
    // =========================
    if (startDate || endDate) {
      filter.sessionDate = {};

      if (startDate) {
        filter.sessionDate.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.sessionDate.$lte = end;
      }
    }

    // =========================
    // 📦 جلب البيانات
    // =========================
    const sessions = await PumpSession.find(filter)
      .populate('stationId', 'stationName stationCode')
      .populate('openingEmployeeId', 'name')
      .populate('closingEmployeeId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PumpSession.countDocuments(filter);

    // =========================
    // ✅ Response
    // =========================
    res.json({
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('❌ getSessions error:', error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};


// Get single session
exports.getSession = async (req, res) => {
  try {
    const session = await PumpSession.findById(req.params.id)
      .populate('stationId', 'stationName stationCode location')
      .populate('openingEmployeeId', 'name email')
      .populate('closingEmployeeId', 'name email')
      .populate('openingApprovedBy', 'name')
      .populate('closingApprovedBy', 'name');

    if (!session) {
      return res.status(404).json({ error: 'الجلسة غير موجودة' });
    }

    // Get activities for this session
    const activities = await Activity.find({ sessionId: session._id })
      .sort({ createdAt: -1 });

    res.json({
      session,
      activities
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Calculate session summary
exports.getSessionSummary = async (req, res) => {
  try {
    const { stationId, date } = req.query;
    
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const filter = {
      stationId,
      sessionDate: { $gte: targetDate, $lt: nextDay },
      status: { $in: ['مغلقة', 'معتمدة'] }
    };

    const sessions = await PumpSession.find(filter);

    const summary = {
      date: targetDate.toISOString().split('T')[0],
      totalSessions: sessions.length,
      totalLiters: sessions.reduce((sum, s) => sum + (s.totalLiters || 0), 0),
      totalAmount: sessions.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
      totalSales: sessions.reduce((sum, s) => sum + (s.totalSales || 0), 0),
      sessionsByShift: {
        صباحية: sessions.filter(s => s.shiftType === 'صباحية').length,
        مسائية: sessions.filter(s => s.shiftType === 'مسائية').length
      },
      fuelTypes: {}
    };

    // Group by fuel type
    sessions.forEach(session => {
      if (!summary.fuelTypes[session.fuelType]) {
        summary.fuelTypes[session.fuelType] = {
          liters: 0,
          amount: 0,
          sessions: 0
        };
      }
      summary.fuelTypes[session.fuelType].liters += session.totalLiters || 0;
      summary.fuelTypes[session.fuelType].amount += session.totalAmount || 0;
      summary.fuelTypes[session.fuelType].sessions += 1;
    });

    res.json(summary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};