const PumpSession = require('../models/PumpSession');
const Station = require('../models/Station');
const Activity = require('../models/Activity');
const mongoose = require('mongoose');

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

// Open new session
exports.openSession = async (req, res) => {
  try {
    // 🔹 انسخ البيانات بدل استخدام req.body مباشرة
    const sessionData = { ...req.body };

    // 🔥 تنظيف القيم المسببة للأخطاء
    if (!sessionData._id) delete sessionData._id;
    if (sessionData.differenceReason == null) delete sessionData.differenceReason;

    // =========================
    // Get station info
    // =========================
    const station = await Station.findById(sessionData.stationId);
    if (!station) {
      return res.status(404).json({ error: 'المحطة غير موجودة' });
    }

    // =========================
    // Get pump info
    // =========================
    const pump = station.pumps.id(sessionData.pumpId);
    if (!pump) {
      return res.status(404).json({ error: 'الطلمبة غير موجودة' });
    }

    // =========================
    // Generate session number
    // =========================
    sessionData.sessionNumber = await generateSessionNumber(station.stationCode);

    // =========================
    // Set additional data
    // =========================
    sessionData.stationName = station.stationName;
    sessionData.pumpNumber = pump.pumpNumber;
    sessionData.fuelType = pump.fuelType;
    sessionData.openingEmployeeId = req.user._id;
    sessionData.openingEmployeeName = req.user.name;
    sessionData.openingTime = new Date();
    sessionData.sessionDate = new Date();

    // =========================
    // Get current fuel price (safe)
    // =========================
    const fuelPrice = station.fuelPrices?.find(
      p => p.fuelType === pump.fuelType
    );

    if (fuelPrice) {
      sessionData.unitPrice = fuelPrice.price;
    }

    // =========================
    // Create & save session
    // =========================
    const session = new PumpSession(sessionData);
    await session.save();

    // =========================
    // Log activity
    // =========================
    const activity = new Activity({
      sessionId: session._id,
      activityType: 'إنشاء',
      description: `تم فتح جلسة جديدة ${session.sessionNumber} للطلمبة ${pump.pumpNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'رقم الجلسة': session.sessionNumber,
        'الطلمبة': pump.pumpNumber,
        'قراءة الفتح': session.openingReading.toString()
      }
    });

    await activity.save();

    // =========================
    // Response
    // =========================
    res.status(201).json({
      message: 'تم فتح الجلسة بنجاح',
      session
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};


// Close session
exports.closeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const closingData = { ...req.body }; // ✅ نسخ بدل استخدام مباشر

    const session = await PumpSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'الجلسة غير موجودة' });
    }

    if (session.status !== 'مفتوحة') {
      return res.status(400).json({ error: 'الجلسة ليست مفتوحة' });
    }

    // ✅ تحقق بسيط من قراءة الإغلاق
    if (closingData.closingReading == null) {
      return res.status(400).json({ error: 'قراءة الإغلاق مطلوبة' });
    }

    // Set closing data
    session.closingEmployeeId = req.user._id;
    session.closingEmployeeName = req.user.name;
    session.closingReading = closingData.closingReading;
    session.closingTime = new Date();

    session.paymentTypes = closingData.paymentTypes || session.paymentTypes;
    session.fuelSupply = closingData.fuelSupply;
    session.carriedForwardBalance = closingData.carriedForwardBalance || 0;
    session.actualDifference = closingData.actualDifference;

    // 🔥 الحل الأساسي: لا تحفظ null في enum
    if (closingData.differenceReason != null && closingData.differenceReason !== '') {
      session.differenceReason = closingData.differenceReason;
    } else {
      session.differenceReason = undefined; // ✅ يشيلها بدل null
    }

    session.notes = closingData.notes;
    session.status = 'مغلقة';

    await session.save();

    // Log activity
    const activity = new Activity({
      sessionId: session._id,
      activityType: 'إغلاق',
      description: `تم إغلاق الجلسة ${session.sessionNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'قراءة الإغلاق': session.closingReading.toString(),
        'إجمالي المبيعات': session.totalSales?.toString() || '0',
        'الحالة': 'مغلقة'
      }
    });

    await activity.save();

    res.json({
      message: 'تم إغلاق الجلسة بنجاح',
      session
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
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
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
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