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
        return res.status(400).json({ error: 'يوجد قراءة بدون رقم الليّة' });
      }

      if (!nr.fuelType) {
        return res.status(400).json({ error: 'يوجد قراءة بدون نوع الوقود' });
      }

      if (nr.openingReading == null) {
        return res.status(400).json({ error: 'يوجد قراءة بدون قيمة فتح' });
      }

      const pump = station.pumps.id(nr.pumpId);
      if (!pump) {
        return res.status(400).json({
          error: `الطلمبة غير موجودة (${nr.pumpId})`,
        });
      }

      // ✅ FIX: توحيد النوع
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
        side: nozzle.side, // ✅ من الداتا الأصلية
        fuelType: nr.fuelType,

        openingReading: nr.openingReading,
        openingImageUrl: nr.imageUrl || nr.attachmentPath,
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
    // 📝 Activity
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

    const session = await PumpSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'الجلسة غير موجودة' });
    }

    if (session.status !== 'مفتوحة') {
      return res.status(400).json({ error: 'الجلسة ليست مفتوحة' });
    }

    /* =========================
       🧾 بيانات الإغلاق الأساسية
    ========================= */
    session.closingEmployeeId = req.user._id;
    session.closingEmployeeName = req.user.name;
    session.closingTime = new Date();

    /* =========================
       💰 التحصيل (إجباري)
    ========================= */
    if (
      !closingData.paymentTypes ||
      typeof closingData.paymentTypes !== 'object'
    ) {
      return res.status(400).json({
        error: 'بيانات التحصيل مطلوبة',
      });
    }

    session.paymentTypes = closingData.paymentTypes;

    /* =========================
       💸 المصروفات (اختياري)
    ========================= */
    if (Array.isArray(closingData.expenses)) {
      session.expenses = closingData.expenses;
    }
    // لو مش موجودة → تفضل زي ما هي (أو فاضية)

    /* =========================
       ⛽ التوريد (اختياري)
    ========================= */
    if (closingData.fuelSupply) {
      session.fuelSupply = closingData.fuelSupply;
    }

    /* =========================
       📝 ملاحظات / سبب فرق (اختياري)
    ========================= */
    if (
      closingData.differenceReason &&
      closingData.differenceReason !== ''
    ) {
      session.differenceReason = closingData.differenceReason;
    } else {
      session.differenceReason = undefined;
    }

    session.notes = closingData.notes || undefined;

    /* =========================
       🔒 إغلاق الجلسة
    ========================= */
    session.status = 'مغلقة';
    await session.save(); // 🔥 هنا الحساب كله يتم تلقائيًا (hook)

    /* =========================
       📝 Activity
    ========================= */
    const changes = {
      الحالة: 'مغلقة',
      'إجمالي التحصيل': session.totalSales.toString(),
      'صافي المبيعات': session.netSales.toString(),
      'إجمالي المصروفات': session.expensesTotal.toString(),
      'فرق الجلسة': session.calculatedDifference.toString(),
    };

    if (session.expenses?.length) {
      changes['عدد المصروفات'] = session.expenses.length.toString();
    }

    await Activity.create({
      sessionId: session._id,
      activityType: 'إغلاق',
      description: `تم إغلاق الجلسة ${session.sessionNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes,
    });

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