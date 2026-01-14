const DailyInventory = require('../models/DailyInventory');
const Station = require('../models/Station');
const PumpSession = require('../models/PumpSession');
const Activity = require('../models/Activity');
const mongoose = require('mongoose');
const moment = require('moment');

// Get Arabic date
const getArabicDate = () => {
  const hijri = moment().locale('ar').format('iYYYY/iM/iD');
  return hijri;
};

// Create daily inventory
exports.createInventory = async (req, res) => {
  try {
    const inventoryData = req.body;
    
    // Check if inventory already exists for this date and station
    const existingInventory = await DailyInventory.findOne({
      stationId: inventoryData.stationId,
      inventoryDate: { 
        $gte: new Date(inventoryData.inventoryDate).setHours(0, 0, 0, 0),
        $lt: new Date(inventoryData.inventoryDate).setHours(23, 59, 59, 999)
      },
      fuelType: inventoryData.fuelType
    });

    if (existingInventory) {
      return res.status(400).json({ error: 'يوجد جرد يومي مسجل بالفعل لهذا التاريخ ونوع الوقود' });
    }

    // Get station info
    const station = await Station.findById(inventoryData.stationId);
    if (!station) {
      return res.status(404).json({ error: 'المحطة غير موجودة' });
    }

    // Set additional data
    inventoryData.stationName = station.stationName;
    inventoryData.arabicDate = getArabicDate();
    inventoryData.preparedBy = req.user._id;

    // Calculate total sales from sessions for this date
    const targetDate = new Date(inventoryData.inventoryDate);
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const sessions = await PumpSession.find({
      stationId: inventoryData.stationId,
      fuelType: inventoryData.fuelType,
      sessionDate: { $gte: targetDate, $lt: nextDay },
      status: { $in: ['مغلقة', 'معتمدة'] }
    });

    inventoryData.totalSales = sessions.reduce((sum, session) => sum + (session.totalLiters || 0), 0);
    inventoryData.pumpCount = sessions.length;
    
    // Calculate total revenue from sessions
    inventoryData.totalRevenue = sessions.reduce((sum, session) => sum + (session.totalSales || 0), 0);

    const inventory = new DailyInventory(inventoryData);
    await inventory.save();

    // Log activity
    const activity = new Activity({
      inventoryId: inventory._id,
      activityType: 'إنشاء',
      description: `تم إنشاء جرد يومي للمحطة ${station.stationName} - ${inventory.fuelType}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'التاريخ': inventory.inventoryDate.toISOString().split('T')[0],
        'نوع الوقود': inventory.fuelType,
        'المبيعات': inventory.totalSales.toString()
      }
    });
    await activity.save();

    res.status(201).json({
      message: 'تم إنشاء الجرد اليومي بنجاح',
      inventory
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Update inventory
exports.updateInventory = async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const updates = req.body;

    const inventory = await DailyInventory.findById(inventoryId);
    if (!inventory) {
      return res.status(404).json({ error: 'الجرد غير موجود' });
    }

    Object.assign(inventory, updates);
    await inventory.save();

    res.json({
      message: 'تم تحديث الجرد بنجاح',
      inventory
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Approve inventory
exports.approveInventory = async (req, res) => {
  try {
    const { inventoryId } = req.params;

    const inventory = await DailyInventory.findById(inventoryId);
    if (!inventory) {
      return res.status(404).json({ error: 'الجرد غير موجود' });
    }

    inventory.status = 'معتمد';
    inventory.approvedBy = req.user._id;
    await inventory.save();

    res.json({
      message: 'تم اعتماد الجرد اليومي بنجاح',
      inventory
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Add expense to inventory
exports.addExpense = async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const expenseData = req.body;

    const inventory = await DailyInventory.findById(inventoryId);
    if (!inventory) {
      return res.status(404).json({ error: 'الجرد غير موجود' });
    }

    inventory.expenses.push(expenseData);
    await inventory.save();

    res.json({
      message: 'تم إضافة المصروف بنجاح',
      inventory
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Get inventory reports
exports.getInventoryReports = async (req, res) => {
  try {
    const {
      stationId,
      startDate,
      endDate,
      fuelType,
      status,
      page = 1,
      limit = 20
    } = req.query;
    
    const skip = (page - 1) * limit;

    const filter = {};
    
    if (stationId) filter.stationId = stationId;
    if (fuelType) filter.fuelType = fuelType;
    if (status) filter.status = status;
    
    if (startDate || endDate) {
      filter.inventoryDate = {};
      if (startDate) filter.inventoryDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.inventoryDate.$lte = end;
      }
    }

    const inventories = await DailyInventory.find(filter)
      .populate('stationId', 'stationName stationCode')
      .populate('preparedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ inventoryDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DailyInventory.countDocuments(filter);

    // Calculate summary
    const summary = {
      totalInventories: inventories.length,
      totalSales: inventories.reduce((sum, inv) => sum + (inv.totalSales || 0), 0),
      totalRevenue: inventories.reduce((sum, inv) => sum + (inv.totalRevenue || 0), 0),
      totalExpenses: inventories.reduce((sum, inv) => sum + (inv.totalExpenses || 0), 0),
      netRevenue: inventories.reduce((sum, inv) => sum + (inv.netRevenue || 0), 0)
    };

    res.json({
      inventories,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Get inventory detail
exports.getInventoryDetail = async (req, res) => {
  try {
    const inventory = await DailyInventory.findById(req.params.id)
      .populate('stationId', 'stationName stationCode location')
      .populate('preparedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('expenses.approvedBy', 'name');

    if (!inventory) {
      return res.status(404).json({ error: 'الجرد غير موجود' });
    }

    // Get sessions for this date and fuel type
    const targetDate = new Date(inventory.inventoryDate);
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const sessions = await PumpSession.find({
      stationId: inventory.stationId,
      fuelType: inventory.fuelType,
      sessionDate: { $gte: targetDate, $lt: nextDay }
    }).populate('openingEmployeeId', 'name')
      .populate('closingEmployeeId', 'name');

    res.json({
      inventory,
      sessions
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Get fuel balance report
exports.getFuelBalanceReport = async (req, res) => {
  try {
    const { stationId, fuelType, startDate, endDate } = req.query;

    const filter = { stationId };
    if (fuelType) filter.fuelType = fuelType;
    
    if (startDate || endDate) {
      filter.inventoryDate = {};
      if (startDate) filter.inventoryDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.inventoryDate.$lte = end;
      }
    }

    const inventories = await DailyInventory.find(filter)
      .sort({ inventoryDate: 1 })
      .populate('stationId', 'stationName');

    const report = inventories.map(inv => ({
      date: inv.inventoryDate.toISOString().split('T')[0],
      arabicDate: inv.arabicDate,
      fuelType: inv.fuelType,
      openingBalance: inv.previousBalance,
      received: inv.receivedQuantity,
      sales: inv.totalSales,
      calculatedBalance: inv.calculatedBalance,
      actualBalance: inv.actualBalance,
      difference: inv.difference,
      differencePercentage: inv.differencePercentage,
      status: inv.status
    }));

    res.json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};