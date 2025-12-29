const Driver = require('../models/Driver');
const Activity = require('../models/Activity');
const mongoose = require('mongoose');

// إنشاء سائق جديد
exports.createDriver = async (req, res) => {
  try {
    const driverData = req.body;
    
    // التحقق من عدم تكرار رقم الرخصة
    const existingDriver = await Driver.findOne({ licenseNumber: driverData.licenseNumber });
    if (existingDriver) {
      return res.status(400).json({ error: 'رقم الرخصة موجود بالفعل' });
    }
    
    driverData.createdBy = req.user._id;
    
    const driver = new Driver(driverData);
    await driver.save();
    
    // تسجيل النشاط
    const activity = new Activity({
      activityType: 'إنشاء',
      description: `تم إنشاء سائق جديد: ${driver.name} (${driver.licenseNumber})`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'اسم السائق': driver.name,
        'رقم الرخصة': driver.licenseNumber,
        'رقم الهاتف': driver.phone
      }
    });
    await activity.save();
    
    res.status(201).json({
      message: 'تم إنشاء السائق بنجاح',
      driver
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// جلب جميع السائقين
exports.getDrivers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = { status: { $ne: 'معلق' } };
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.search) {
      filter.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { licenseNumber: new RegExp(req.query.search, 'i') },
        { phone: new RegExp(req.query.search, 'i') },
        { vehicleNumber: new RegExp(req.query.search, 'i') }
      ];
    }
    
    const drivers = await Driver.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Driver.countDocuments(filter);
    
    res.json({
      drivers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// جلب سائق محدد
exports.getDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .populate('createdBy', 'name');
    
    if (!driver) {
      return res.status(404).json({ error: 'السائق غير موجود' });
    }
    
    // جلب الطلبات المرتبطة بهذا السائق
    const Order = require('../models/Order');
    const orders = await Order.find({ 
      driverName: driver.name,
      status: { $in: ['مخصص للعميل', 'قيد التجهيز', 'جاهز للتحميل'] }
    })
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.json({
      driver,
      recentOrders: orders
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// تحديث السائق
exports.updateDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
      return res.status(404).json({ error: 'السائق غير موجود' });
    }
    
    const oldData = { ...driver.toObject() };
    const updates = req.body;
    
    // إذا تم تغيير رقم الرخصة، التحقق من عدم التكرار
    if (updates.licenseNumber && updates.licenseNumber !== driver.licenseNumber) {
      const existingDriver = await Driver.findOne({ licenseNumber: updates.licenseNumber });
      if (existingDriver) {
        return res.status(400).json({ error: 'رقم الرخصة موجود بالفعل' });
      }
    }
    
    Object.assign(driver, updates);
    await driver.save();
    
    // تسجيل النشاط
    const changes = {};
    Object.keys(updates).forEach(key => {
      if (oldData[key] !== updates[key]) {
        changes[key] = `من: ${oldData[key]} → إلى: ${updates[key]}`;
      }
    });
    
    if (Object.keys(changes).length > 0) {
      const activity = new Activity({
        activityType: 'تعديل',
        description: `تم تعديل بيانات السائق: ${driver.name}`,
        performedBy: req.user._id,
        performedByName: req.user.name,
        changes
      });
      await activity.save();
    }
    
    res.json({
      message: 'تم تحديث بيانات السائق بنجاح',
      driver
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// حذف السائق (تعطيل)
exports.deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
      return res.status(404).json({ error: 'السائق غير موجود' });
    }
    
    driver.status = 'معلق';
    await driver.save();
    
    // تسجيل النشاط
    const activity = new Activity({
      activityType: 'حذف',
      description: `تم تعطيل السائق: ${driver.name} (${driver.licenseNumber})`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'اسم السائق': driver.name,
        'رقم الرخصة': driver.licenseNumber
      }
    });
    await activity.save();
    
    res.json({
      message: 'تم تعطيل السائق بنجاح'
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// البحث عن السائقين للـ autocomplete
exports.searchDrivers = async (req, res) => {
  try {
    const searchTerm = req.query.q;
    
    const drivers = await Driver.find({
      status: 'نشط',
      $or: [
        { name: new RegExp(searchTerm, 'i') },
        { licenseNumber: new RegExp(searchTerm, 'i') },
        { phone: new RegExp(searchTerm, 'i') }
      ]
    })
    .select('_id name licenseNumber phone vehicleNumber')
    .limit(10);
    
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// جلب السائقين النشطين فقط
exports.getActiveDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find({ status: 'نشط' })
      .select('_id name licenseNumber phone vehicleNumber vehicleType')
      .sort({ name: 1 });
    
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};