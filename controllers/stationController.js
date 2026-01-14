const Station = require('../models/Station');
const PumpSession = require('../models/PumpSession');
const DailyInventory = require('../models/DailyInventory');
const Activity = require('../models/Activity');
const { sendEmail } = require('../services/emailService');
const User = require('../models/User');

const mongoose = require('mongoose');


// Generate station code
const generateStationCode = async () => {
  const count = await Station.countDocuments();
  const code = `STN${(count + 1).toString().padStart(3, '0')}`;
  return code;
};

// Get all stations
exports.getStations = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, city, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};

    if (search) {
      filter.$or = [
        { stationCode: new RegExp(search, 'i') },
        { stationName: new RegExp(search, 'i') },
        { location: new RegExp(search, 'i') }
      ];
    }

    if (city) filter.city = city;
    if (status) filter.isActive = status === 'active';

    const stations = await Station.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // 👈 مهم للـ performance

    const total = await Station.countDocuments(filter);

    res.json({
      stations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};


// Get single station
exports.getStation = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!station) {
      return res.status(404).json({ error: 'المحطة غير موجودة' });
    }

    // Get today's sessions for this station
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sessions = await PumpSession.find({
      stationId: station._id,
      sessionDate: { $gte: today }
    }).sort({ createdAt: -1 });

    // Get today's inventory
    const inventory = await DailyInventory.findOne({
      stationId: station._id,
      inventoryDate: { $gte: today }
    });

    res.json({
      station,
      todaysSessions: sessions,
      todaysInventory: inventory
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Create station
exports.createStation = async (req, res) => {
  try {
    // 🧹 نسخ وتنظيف البيانات
    const stationData = { ...req.body };

    // 🚫 منع _id الفاضي
    if (!stationData._id) {
      delete stationData._id;
    }

    // 🔢 Generate station code if not provided
    if (!stationData.stationCode) {
      stationData.stationCode = await generateStationCode();
    }

    // 👤 منشئ المحطة
    stationData.createdBy = req.user._id;

    // 🏭 إنشاء المحطة
    const station = new Station(stationData);
    await station.save();

    // 📝 تسجيل النشاط
    const activity = new Activity({
      stationId: station._id,
      activityType: 'إنشاء',
      description: `تم إنشاء محطة جديدة ${station.stationName}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'كود المحطة': station.stationCode,
        'اسم المحطة': station.stationName,
        'المدينة': station.city,
        'الموقع': station.location
      }
    });
    await activity.save();

    // =========================
    // 📧 إرسال إشعار بريد إلكتروني
    // =========================

    // 👥 جلب admin و owner فقط
    const recipients = await User.find({
      role: { $in: ['admin', 'owner'] },
      email: { $exists: true, $ne: '' }
    }).select('email name role');

    const emails = recipients.map(u => u.email);

    if (emails.length > 0) {
      await sendEmail({
        to: emails,
        subject: '📢 تم إنشاء محطة جديدة',
        html: `
          <div style="font-family: Arial, sans-serif; direction: rtl">
            <h2>🚉 تم إنشاء محطة جديدة</h2>
            <p><strong>اسم المحطة:</strong> ${station.stationName}</p>
            <p><strong>كود المحطة:</strong> ${station.stationCode}</p>
            <p><strong>المدينة:</strong> ${station.city}</p>
            <p><strong>الموقع:</strong> ${station.location}</p>
            <p><strong>تم الإنشاء بواسطة:</strong> ${req.user.name}</p>
            <hr />
            <p style="color: #777">نظام إدارة المحطات</p>
          </div>
        `
      });
    }

    // ✅ الرد النهائي
    res.status(201).json({
      success: true,
      message: 'تم إنشاء المحطة بنجاح وتم إرسال إشعار للإدارة',
      station
    });

  } catch (error) {
    console.error('❌ createStation error:', error);
    res.status(500).json({
      success: false,
      error: 'حدث خطأ في السيرفر'
    });
  }
};

// Update station
exports.updateStation = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'المحطة غير موجودة' });
    }

    const oldData = { ...station.toObject() };
    const updates = req.body;

    Object.assign(station, updates);
    await station.save();

    // Log changes
    const changes = {};
    Object.keys(updates).forEach(key => {
      if (oldData[key] !== updates[key]) {
        changes[key] = `من: ${oldData[key]} → إلى: ${updates[key]}`;
      }
    });

    if (Object.keys(changes).length > 0) {
      const activity = new Activity({
        stationId: station._id,
        activityType: 'تعديل',
        description: `تم تعديل المحطة ${station.stationName}`,
        performedBy: req.user._id,
        performedByName: req.user.name,
        changes
      });
      await activity.save();
    }

    res.json({
      message: 'تم تحديث المحطة بنجاح',
      station
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Add pump to station
exports.addPump = async (req, res) => {
  try {
    const { stationId } = req.params;
    const pumpData = req.body;

    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({ error: 'المحطة غير موجودة' });
    }

    // Check if pump number already exists
    const existingPump = station.pumps.find(p => p.pumpNumber === pumpData.pumpNumber);
    if (existingPump) {
      return res.status(400).json({ error: 'رقم الطلمبة موجود بالفعل' });
    }

    station.pumps.push(pumpData);
    await station.save();

    // Log activity
    const activity = new Activity({
      stationId: station._id,
      activityType: 'إضافة',
      description: `تم إضافة طلمبة جديدة رقم ${pumpData.pumpNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'رقم الطلمبة': pumpData.pumpNumber,
        'نوع الوقود': pumpData.fuelType,
        'عدد الفتحات': pumpData.nozzleCount.toString()
      }
    });
    await activity.save();

    res.status(201).json({
      message: 'تم إضافة الطلمبة بنجاح',
      station
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Update pump
exports.updatePump = async (req, res) => {
  try {
    const { stationId, pumpId } = req.params;
    const updates = req.body;

    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({ error: 'المحطة غير موجودة' });
    }

    const pump = station.pumps.id(pumpId);
    if (!pump) {
      return res.status(404).json({ error: 'الطلمبة غير موجودة' });
    }

    Object.assign(pump, updates);
    await station.save();

    res.json({
      message: 'تم تحديث الطلمبة بنجاح',
      pump
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Delete pump
exports.deletePump = async (req, res) => {
  try {
    const { stationId, pumpId } = req.params;

    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({ error: 'المحطة غير موجودة' });
    }

    const pump = station.pumps.id(pumpId);
    if (!pump) {
      return res.status(404).json({ error: 'الطلمبة غير موجودة' });
    }

    station.pumps.pull(pumpId);
    await station.save();

    res.json({
      message: 'تم حذف الطلمبة بنجاح'
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};


exports.updateFuelPrices = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { prices } = req.body;

    // ✅ تحقق أساسي
    if (!Array.isArray(prices)) {
      return res.status(400).json({
        error: 'prices يجب أن تكون Array',
      });
    }

    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({ error: 'المحطة غير موجودة' });
    }

    // ✅ تنظيف الأسعار
    const cleanedPrices = prices.filter(
      p =>
        p &&
        typeof p.fuelType === 'string' &&
        typeof p.price === 'number' &&
        p.price > 0
    );

    if (cleanedPrices.length === 0) {
      return res.status(400).json({
        error: 'لا توجد أسعار صالحة للحفظ',
      });
    }

    // ✅ تحديث أو إضافة
    cleanedPrices.forEach(newPrice => {
      const existing = station.fuelPrices.find(
        p => p.fuelType === newPrice.fuelType
      );

      if (existing) {
        existing.price = newPrice.price;
        existing.effectiveDate = new Date();
      } else {
        station.fuelPrices.push({
          fuelType: newPrice.fuelType,
          price: newPrice.price,
          effectiveDate: new Date(),
        });
      }
    });

    await station.save();

    res.json({
      success: true,
      message: 'تم تحديث تسعيرة الوقود بنجاح',
      station,
    });
  } catch (error) {
    console.error('❌ updateFuelPrices error:', error);
    res.status(500).json({
      error: 'حدث خطأ في السيرفر',
    });
  }
};





// Get station statistics
exports.getStationStats = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate } = req.query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const start = startDate ? new Date(startDate) : today;
    const end = endDate ? new Date(endDate) : today;
    end.setHours(23, 59, 59, 999);

    // Get sessions for period
    const sessions = await PumpSession.find({
      stationId,
      sessionDate: { $gte: start, $lte: end },
      status: { $in: ['مغلقة', 'معتمدة'] }
    });

    // Calculate statistics
    const stats = {
      totalSessions: sessions.length,
      totalLiters: sessions.reduce((sum, session) => sum + (session.totalLiters || 0), 0),
      totalAmount: sessions.reduce((sum, session) => sum + (session.totalAmount || 0), 0),
      totalSales: sessions.reduce((sum, session) => sum + (session.totalSales || 0), 0),
      paymentBreakdown: {
        cash: sessions.reduce((sum, session) => sum + (session.paymentTypes?.cash || 0), 0),
        card: sessions.reduce((sum, session) => sum + (session.paymentTypes?.card || 0), 0),
        mada: sessions.reduce((sum, session) => sum + (session.paymentTypes?.mada || 0), 0),
        other: sessions.reduce((sum, session) => sum + (session.paymentTypes?.other || 0), 0)
      },
      fuelTypeBreakdown: {}
    };

    // Breakdown by fuel type
    sessions.forEach(session => {
      if (!stats.fuelTypeBreakdown[session.fuelType]) {
        stats.fuelTypeBreakdown[session.fuelType] = {
          liters: 0,
          amount: 0,
          sessions: 0
        };
      }
      stats.fuelTypeBreakdown[session.fuelType].liters += session.totalLiters || 0;
      stats.fuelTypeBreakdown[session.fuelType].amount += session.totalAmount || 0;
      stats.fuelTypeBreakdown[session.fuelType].sessions += 1;
    });

    // Get inventory for period
    const inventories = await DailyInventory.find({
      stationId,
      inventoryDate: { $gte: start, $lte: end },
      status: 'معتمد'
    });

    stats.totalExpenses = inventories.reduce((sum, inv) => sum + (inv.totalExpenses || 0), 0);
    stats.netRevenue = inventories.reduce((sum, inv) => sum + (inv.netRevenue || 0), 0);

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};