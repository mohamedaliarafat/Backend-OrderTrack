const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Driver = require('../models/Driver');
const User = require('../models/User');
const Activity = require('../models/Activity');
const mongoose = require('mongoose');

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '../assets/logo.png');
const FONT_AR = path.join(__dirname, '../assets/fonts/Cairo-Regular.ttf');


// ===============================
// 📊 Services
// ===============================
const {
  getCustomerReportData,
  getDriverReportData,
  getSupplierReportData,
  getUserReportData
} = require('../services/report.service');

// ===============================
// 🅰️ Arabic RTL Support (FIXED)
// ===============================
const reshape = require('arabic-persian-reshaper');
const bidiFactory = require('bidi-js');
const bidi = bidiFactory();


function box(doc, x, y, w, h) {
  doc
    .roundedRect(x, y, w, h, 6)
    .lineWidth(1)
    .strokeColor('#0A2A43')
    .stroke();
}

function sectionTitle(doc, text) {
  doc
    .fontSize(13)
    .fillColor('#0A2A43')
    .font('Arabic')
    .text(rtl(text), { align: 'right' })
    .moveDown(0.5);
}



function rtl(text) {
  if (!text) return '';
  try {
    const reshaped = reshape(text.toString());
    return bidi.fromString(reshaped).toString();
  } catch {
    return text.toString();
  }
}

function drawPageBorder(doc) {
  doc
    .save()
    .lineWidth(2)
    .strokeColor('#0A2A43') // أزرق كحلي
    .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
    .stroke()
    .restore();
}

function drawHeader(doc, { fromDate, toDate, reportTitle }) {
  const top = 40;

  // إطار
  drawPageBorder(doc);

  // الخط العربي
  doc.font(FONT_AR);

  // ===== اليمين (عربي) =====
  doc
    .fontSize(12)
    .text(rtl('شركة البحيرة العربية'), 380, top, { align: 'right' })
    .fontSize(9)
    .text(rtl('سجل تجاري: 1010123456'), { align: 'right' })
    .text(rtl('الرقم الضريبي: 310123456700003'), { align: 'right' });

  // ===== اليسار (English - LTR) =====
  doc
    .font('Helvetica')
    .fontSize(9)
    .text('ALBUHAIRA ALARABIA', 40, top)
    .text('Commercial Reg: 1010123456')
    .text('VAT No: 310123456700003');

  // ===== الشعار في المنتصف =====
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, doc.page.width / 2 - 40, top, {
      width: 80,
    });
  }

  // خط فاصل
  doc
    .moveTo(40, top + 70)
    .lineTo(doc.page.width - 40, top + 70)
    .lineWidth(1)
    .strokeColor('#0A2A43')
    .stroke();

  // ===== عنوان التقرير =====
  doc
    .font(FONT_AR)
    .fontSize(16)
    .fillColor('#0A2A43')
    .text(rtl(reportTitle), 0, top + 85, {
      align: 'center',
    });

  // ===== الفترة =====
  doc
    .fontSize(10)
    .fillColor('#000')
    .text(
      rtl(`الفترة من ${fromDate || '—'} إلى ${toDate || '—'}`),
      0,
      top + 110,
      { align: 'center' }
    );

  doc.moveDown(5);
}




// ============================================
// 📋 تقارير العملاء
// ============================================

exports.customerReports = async (req, res) => {
  try {
    const {
      customerId,
      startDate,
      endDate,
      status,
      city,
      area,
      includeDetails = 'true',
      page = 1,
      limit = 50
    } = req.query;

    const match = {};
    const skip = (page - 1) * limit;

    // فلترة حسب تاريخ الطلب
    if (startDate || endDate) {
      match.orderDate = {};
      if (startDate) match.orderDate.$gte = new Date(startDate);
      if (endDate) match.orderDate.$lte = new Date(endDate);
    }

    // فلترة حسب العميل
    if (customerId) {
      match.customer = mongoose.Types.ObjectId(customerId);
    }

    // فلترة حسب المدينة والمنطقة
    if (city) match.city = city;
    if (area) match.area = area;

    // فلترة حسب الحالة
    if (status) match.status = status;

    // تجميع البيانات
    const aggregation = [
      { $match: match },
      {
        $lookup: {
          from: 'customers',
          localField: 'customer',
          foreignField: '_id',
          as: 'customerInfo'
        }
      },
      { $unwind: { path: '$customerInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$customer',
          customerName: { $first: '$customerName' },
          customerCode: { $first: '$customerCode' },
          customerPhone: { $first: '$customerPhone' },
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalAmount: { $sum: '$totalPrice' },
          completedOrders: {
            $sum: { $cond: [{ $in: ['$status', ['تم التسليم', 'مكتمل']] }, 1, 0] }
          },
          pendingOrders: {
            $sum: { $cond: [{ $in: ['$status', ['في انتظار التحميل', 'جاهز للتحميل']] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'ملغى'] }, 1, 0] }
          },
          avgOrderValue: { $avg: '$totalPrice' },
          firstOrderDate: { $min: '$orderDate' },
          lastOrderDate: { $max: '$orderDate' }
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customerDetails'
        }
      },
      { $unwind: { path: '$customerDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          customerId: '$_id',
          customerName: 1,
          customerCode: 1,
          customerPhone: 1,
          customerEmail: '$customerDetails.email',
          customerAddress: '$customerDetails.address',
          customerCity: '$customerDetails.city',
          customerArea: '$customerDetails.area',
          totalOrders: 1,
          totalQuantity: 1,
          totalAmount: 1,
          completedOrders: 1,
          pendingOrders: 1,
          cancelledOrders: 1,
          successRate: {
            $cond: [
              { $eq: ['$totalOrders', 0] },
              0,
              { $multiply: [{ $divide: ['$completedOrders', '$totalOrders'] }, 100] }
            ]
          },
          avgOrderValue: 1,
          firstOrderDate: 1,
          lastOrderDate: 1,
          activityPeriod: {
            $cond: [
              { $and: ['$firstOrderDate', '$lastOrderDate'] },
              {
                days: {
                  $divide: [
                    { $subtract: ['$lastOrderDate', '$firstOrderDate'] },
                    1000 * 60 * 60 * 24
                  ]
                }
              },
              null
            ]
          }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    // جلب تفاصيل الطلبات إذا مطلوب
    let orderDetails = [];
    if (includeDetails === 'true' && customerId) {
      orderDetails = await Order.find(match)
        .populate('supplier', 'name company')
        .populate('driver', 'name vehicleNumber')
        .sort({ orderDate: -1 })
        .limit(100);
    }

    const results = await Order.aggregate(aggregation);
    const total = await Order.aggregate([
      { $match: match },
      { $group: { _id: '$customer' } },
      { $count: 'total' }
    ]);

    res.json({
      success: true,
      period: { startDate, endDate },
      filters: { customerId, city, area, status },
      summary: {
        totalCustomers: total[0]?.total || 0,
        totalOrders: results.reduce((sum, cust) => sum + cust.totalOrders, 0),
        totalQuantity: results.reduce((sum, cust) => sum + cust.totalQuantity, 0),
        totalAmount: results.reduce((sum, cust) => sum + cust.totalAmount, 0),
        avgSuccessRate: results.length > 0 ?
          results.reduce((sum, cust) => sum + cust.successRate, 0) / results.length : 0
      },
      customers: results,
      orderDetails: orderDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total[0]?.total || 0,
        pages: Math.ceil((total[0]?.total || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Customer report error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في توليد تقرير العملاء' });
  }
};

// ============================================
// 🚚 تقارير السائقين
// ============================================

exports.driverReports = async (req, res) => {
  try {
    const {
      driverId,
      startDate,
      endDate,
      vehicleType,
      status,
      city,
      page = 1,
      limit = 50
    } = req.query;

    const match = {};
    const skip = (page - 1) * limit;

    // فلترة حسب التاريخ
    if (startDate || endDate) {
      match.orderDate = {};
      if (startDate) match.orderDate.$gte = new Date(startDate);
      if (endDate) match.orderDate.$lte = new Date(endDate);
    }

    // فلترة حسب السائق
    if (driverId) {
      match.driver = mongoose.Types.ObjectId(driverId);
    }

    // فلترات أخرى
    if (vehicleType) match.vehicleType = vehicleType;
    if (status) match.status = status;
    if (city) match.city = city;

    // تجميع بيانات السائقين
    const aggregation = [
      { $match: { ...match, driver: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$driver',
          driverName: { $first: '$driverName' },
          driverPhone: { $first: '$driverPhone' },
          vehicleNumber: { $first: '$vehicleNumber' },
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalDistance: { $sum: { $ifNull: ['$distance', 0] } },
          completedOrders: {
            $sum: { $cond: [{ $in: ['$status', ['تم التسليم', 'مكتمل']] }, 1, 0] }
          },
          pendingOrders: {
            $sum: { $cond: [{ $in: ['$status', ['في الطريق', 'مخصص للعميل']] }, 1, 0] }
          },
          delayedOrders: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['تم التسليم', 'مكتمل']] },
                    { $gt: ['$actualArrivalTime', '$arrivalTime'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalEarnings: { $sum: { $ifNull: ['$driverEarnings', 0] } },
          avgDeliveryTime: { $avg: '$deliveryDuration' },
          firstAssignment: { $min: '$orderDate' },
          lastAssignment: { $max: '$orderDate' }
        }
      },
      {
        $lookup: {
          from: 'drivers',
          localField: '_id',
          foreignField: '_id',
          as: 'driverDetails'
        }
      },
      { $unwind: { path: '$driverDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          driverId: '$_id',
          driverName: 1,
          driverPhone: 1,
          driverEmail: '$driverDetails.email',
          driverAddress: '$driverDetails.address',
          licenseNumber: '$driverDetails.licenseNumber',
          licenseExpiryDate: '$driverDetails.licenseExpiryDate',
          vehicleType: '$driverDetails.vehicleType',
          vehicleNumber: 1,
          status: '$driverDetails.status',
          totalOrders: 1,
          totalQuantity: 1,
          totalDistance: 1,
          totalEarnings: 1,
          completedOrders: 1,
          pendingOrders: 1,
          delayedOrders: 1,
          successRate: {
            $cond: [
              { $eq: ['$totalOrders', 0] },
              0,
              { $multiply: [{ $divide: ['$completedOrders', '$totalOrders'] }, 100] }
            ]
          },
          onTimeRate: {
            $cond: [
              { $eq: ['$completedOrders', 0] },
              0,
              {
                $multiply: [
                  {
                    $divide: [
                      { $subtract: ['$completedOrders', '$delayedOrders'] },
                      '$completedOrders'
                    ]
                  },
                  100
                ]
              }
            ]
          },
          avgDeliveryTime: 1,
          firstAssignment: 1,
          lastAssignment: 1,
          activityDays: {
            $cond: [
              { $and: ['$firstAssignment', '$lastAssignment'] },
              {
                $divide: [
                  { $subtract: ['$lastAssignment', '$firstAssignment'] },
                  1000 * 60 * 60 * 24
                ]
              },
              0
            ]
          },
          ordersPerDay: {
            $cond: [
              { $and: ['$activityDays', { $gt: ['$activityDays', 0] }] },
              { $divide: ['$totalOrders', '$activityDays'] },
              0
            ]
          }
        }
      },
      { $sort: { totalOrders: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    const results = await Order.aggregate(aggregation);
    
    // جلب تفاصيل طلبات السائق إذا كان محدداً
    let driverOrders = [];
    if (driverId) {
      driverOrders = await Order.find(match)
        .populate('customer', 'name code phone')
        .populate('supplier', 'name company')
        .sort({ orderDate: -1 })
        .limit(100);
    }

    res.json({
      success: true,
      period: { startDate, endDate },
      filters: { driverId, vehicleType, status, city },
      summary: {
        totalDrivers: results.length,
        totalOrders: results.reduce((sum, driver) => sum + driver.totalOrders, 0),
        totalDistance: results.reduce((sum, driver) => sum + driver.totalDistance, 0),
        totalEarnings: results.reduce((sum, driver) => sum + driver.totalEarnings, 0),
        avgSuccessRate: results.length > 0 ?
          results.reduce((sum, driver) => sum + driver.successRate, 0) / results.length : 0
      },
      drivers: results,
      driverOrders: driverOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: results.length,
        pages: Math.ceil(results.length / limit)
      }
    });
  } catch (error) {
    console.error('Driver report error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في توليد تقرير السائقين' });
  }
};

// ============================================
// 🏢 تقارير الموردين
// ============================================

exports.supplierReports = async (req, res) => {
  try {
    const {
      supplierId,
      startDate,
      endDate,
      supplierType,
      productType,
      paymentStatus,
      page = 1,
      limit = 50
    } = req.query;

    const match = {};
    const skip = (page - 1) * limit;

    // فلترة حسب التاريخ
    if (startDate || endDate) {
      match.orderDate = {};
      if (startDate) match.orderDate.$gte = new Date(startDate);
      if (endDate) match.orderDate.$lte = new Date(endDate);
    }

    // فلترة حسب المورد
    if (supplierId) {
      match.supplier = mongoose.Types.ObjectId(supplierId);
    }

    // فلترات أخرى
    if (supplierType) match.supplierType = supplierType;
    if (productType) match.productType = productType;
    if (paymentStatus) match.paymentStatus = paymentStatus;

    // تجميع بيانات الموردين
    const aggregation = [
      { $match: { ...match, supplier: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$supplier',
          supplierName: { $first: '$supplierName' },
          supplierCompany: { $first: '$supplierCompany' },
          supplierPhone: { $first: '$supplierPhone' },
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalAmount: { $sum: '$totalPrice' },
          paidAmount: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'مدفوع'] },
                '$totalPrice',
                0
              ]
            }
          },
          pendingAmount: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'غير مدفوع'] },
                '$totalPrice',
                0
              ]
            }
          },
          completedOrders: {
            $sum: { $cond: [{ $in: ['$status', ['تم التسليم', 'مكتمل']] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'ملغى'] }, 1, 0] }
          },
          avgOrderValue: { $avg: '$totalPrice' },
          firstOrderDate: { $min: '$orderDate' },
          lastOrderDate: { $max: '$orderDate' }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplierDetails'
        }
      },
      { $unwind: { path: '$supplierDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          supplierId: '$_id',
          supplierName: 1,
          supplierCompany: 1,
          supplierPhone: 1,
          supplierEmail: '$supplierDetails.email',
          supplierAddress: '$supplierDetails.address',
          supplierType: '$supplierDetails.supplierType',
          taxNumber: '$supplierDetails.taxNumber',
          rating: '$supplierDetails.rating',
          totalOrders: 1,
          totalQuantity: 1,
          totalAmount: 1,
          paidAmount: 1,
          pendingAmount: 1,
          paymentPercentage: {
            $cond: [
              { $eq: ['$totalAmount', 0] },
              0,
              { $multiply: [{ $divide: ['$paidAmount', '$totalAmount'] }, 100] }
            ]
          },
          completedOrders: 1,
          cancelledOrders: 1,
          successRate: {
            $cond: [
              { $eq: ['$totalOrders', 0] },
              0,
              { $multiply: [{ $divide: ['$completedOrders', '$totalOrders'] }, 100] }
            ]
          },
          avgOrderValue: 1,
          firstOrderDate: 1,
          lastOrderDate: 1,
          partnershipDuration: {
            $cond: [
              { $and: ['$firstOrderDate', '$lastOrderDate'] },
              {
                days: {
                  $divide: [
                    { $subtract: ['$lastOrderDate', '$firstOrderDate'] },
                    1000 * 60 * 60 * 24
                  ]
                }
              },
              null
            ]
          }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    const results = await Order.aggregate(aggregation);
    
    // جلب تفاصيل طلبات المورد إذا كان محدداً
    let supplierOrders = [];
    if (supplierId) {
      supplierOrders = await Order.find(match)
        .populate('customer', 'name code')
        .populate('driver', 'name vehicleNumber')
        .sort({ orderDate: -1 })
        .limit(100);
    }

    res.json({
      success: true,
      period: { startDate, endDate },
      filters: { supplierId, supplierType, productType, paymentStatus },
      summary: {
        totalSuppliers: results.length,
        totalOrders: results.reduce((sum, sup) => sum + sup.totalOrders, 0),
        totalQuantity: results.reduce((sum, sup) => sum + sup.totalQuantity, 0),
        totalAmount: results.reduce((sum, sup) => sum + sup.totalAmount, 0),
        totalPaid: results.reduce((sum, sup) => sum + sup.paidAmount, 0),
        totalPending: results.reduce((sum, sup) => sum + sup.pendingAmount, 0),
        avgPaymentRate: results.length > 0 ?
          results.reduce((sum, sup) => sum + sup.paymentPercentage, 0) / results.length : 0
      },
      suppliers: results,
      supplierOrders: supplierOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: results.length,
        pages: Math.ceil(results.length / limit)
      }
    });
  } catch (error) {
    console.error('Supplier report error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في توليد تقرير الموردين' });
  }
};

// ============================================
// 👤 تقارير المستخدمين
// ============================================

exports.userReports = async (req, res) => {
  try {
    const {
      userId,
      startDate,
      endDate,
      role,
      page = 1,
      limit = 50
    } = req.query;

    const match = {};
    const skip = (page - 1) * limit;

    // فلترة حسب التاريخ
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    // فلترة حسب المستخدم
    if (userId) {
      match.createdBy = mongoose.Types.ObjectId(userId);
    }

    // تجميع بيانات المستخدمين من الطلبات
    const userOrdersAgg = [
      { $match: match },
      {
        $group: {
          _id: '$createdBy',
          userName: { $first: '$createdByName' },
          totalOrders: { $sum: 1 },
          totalCustomerOrders: {
            $sum: { $cond: [{ $eq: ['$orderSource', 'عميل'] }, 1, 0] }
          },
          totalSupplierOrders: {
            $sum: { $cond: [{ $eq: ['$orderSource', 'مورد'] }, 1, 0] }
          },
          totalMixedOrders: {
            $sum: { $cond: [{ $eq: ['$orderSource', 'مدمج'] }, 1, 0] }
          },
          totalAmount: { $sum: '$totalPrice' },
          completedOrders: {
            $sum: { $cond: [{ $in: ['$status', ['تم التسليم', 'مكتمل']] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'ملغى'] }, 1, 0] }
          },
          firstOrderDate: { $min: '$createdAt' },
          lastOrderDate: { $max: '$createdAt' }
        }
      }
    ];

    const userOrders = await Order.aggregate(userOrdersAgg);

    // جلب بيانات المستخدمين من قاعدة المستخدمين
    const userFilter = {};
    if (role) userFilter.role = role;
    if (userId) userFilter._id = mongoose.Types.ObjectId(userId);

    const users = await User.find(userFilter)
      .select('name email role company phone createdAt')
      .skip(skip)
      .limit(limit);

    // دمج بيانات المستخدمين مع بيانات الطلبات
    const combinedResults = users.map(user => {
      const userOrderData = userOrders.find(order => order._id?.toString() === user._id.toString()) || {};
      
      return {
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        userCompany: user.company,
        userPhone: user.phone,
        userCreatedAt: user.createdAt,
        totalOrders: userOrderData.totalOrders || 0,
        totalCustomerOrders: userOrderData.totalCustomerOrders || 0,
        totalSupplierOrders: userOrderData.totalSupplierOrders || 0,
        totalMixedOrders: userOrderData.totalMixedOrders || 0,
        totalAmount: userOrderData.totalAmount || 0,
        completedOrders: userOrderData.completedOrders || 0,
        cancelledOrders: userOrderData.cancelledOrders || 0,
        successRate: userOrderData.totalOrders > 0 ?
          ((userOrderData.completedOrders || 0) / userOrderData.totalOrders) * 100 : 0,
        firstOrderDate: userOrderData.firstOrderDate,
        lastOrderDate: userOrderData.lastOrderDate,
        activityPeriod: userOrderData.firstOrderDate && userOrderData.lastOrderDate ?
          Math.round((userOrderData.lastOrderDate - userOrderData.firstOrderDate) / (1000 * 60 * 60 * 24)) : 0
      };
    });

    // جلب نشاطات المستخدم إذا كان محدداً
    let userActivities = [];
    if (userId) {
      userActivities = await Activity.find({
        performedBy: mongoose.Types.ObjectId(userId),
        ...(startDate || endDate ? {
          createdAt: {
            ...(startDate ? { $gte: new Date(startDate) } : {}),
            ...(endDate ? { $lte: new Date(endDate) } : {})
          }
        } : {})
      })
      .populate('modelId')
      .sort({ createdAt: -1 })
      .limit(100);
    }

    res.json({
      success: true,
      period: { startDate, endDate },
      filters: { userId, role },
      summary: {
        totalUsers: users.length,
        totalOrders: combinedResults.reduce((sum, user) => sum + user.totalOrders, 0),
        totalAmount: combinedResults.reduce((sum, user) => sum + user.totalAmount, 0),
        avgSuccessRate: combinedResults.length > 0 ?
          combinedResults.reduce((sum, user) => sum + user.successRate, 0) / combinedResults.length : 0
      },
      users: combinedResults,
      userActivities: userActivities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await User.countDocuments(userFilter),
        pages: Math.ceil(await User.countDocuments(userFilter) / limit)
      }
    });
  } catch (error) {
    console.error('User report error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في توليد تقرير المستخدمين' });
  }
};

// ============================================
// 📦 تقرير الفواتير المحددة
// ============================================

exports.invoiceReport = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: 'رقم الطلب مطلوب' });
    }

    // جلب بيانات الطلب
    const order = await Order.findById(orderId)
      .populate('customer', 'name code phone email address taxNumber')
      .populate('supplier', 'name company contactPerson phone address taxNumber commercialNumber')
      .populate('driver', 'name phone vehicleNumber licenseNumber')
      .populate('createdBy', 'name email phone');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    // جلب جميع النشاطات المرتبطة بالطلب
    const activities = await Activity.find({ orderId: order._id })
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 });

    // جلب الطلبات المرتبطة إذا كان مدمج
    let relatedOrders = [];
    if (order.mergeStatus === 'مدمج') {
      relatedOrders = await Order.find({
        $or: [
          { originalOrderId: order._id },
          { mergedOrderId: order._id }
        ]
      })
      .populate('customer', 'name code')
      .populate('supplier', 'name company');
    }

    // حساب الضرائب والتكاليف الإضافية
    const taxRate = 0.15; // 15% ضريبة
    const subtotal = order.totalPrice || 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // بيانات الفاتورة
    const invoiceData = {
      invoiceNumber: `INV-${order.orderNumber}`,
      invoiceDate: new Date(),
      order: order.toObject(),
      subtotal,
      tax,
      total,
      taxRate: `${taxRate * 100}%`,
      activities,
      relatedOrders,
      paymentDetails: {
        method: order.paymentMethod,
        status: order.paymentStatus,
        dueDate: new Date(order.orderDate.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 يوم من تاريخ الطلب
      }
    };

    res.json({
      success: true,
      invoice: invoiceData
    });
  } catch (error) {
    console.error('Invoice report error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في توليد تقرير الفاتورة' });
  }
};

// ============================================
// 📄 تصدير PDF
// ============================================

function rtl(text) {
  if (!text) return '';

  try {
    const reshapedText = reshape(text.toString());
    const bidiText = bidi.fromString(reshapedText).toString();
    return bidiText;
  } catch (e) {
    console.error('RTL ERROR:', e);
    return text.toString();
  }
}


exports.exportPDF = async (req, res) => {
  try {
    console.log('📥 EXPORT PDF QUERY:', req.query);

    const { reportType, startDate, endDate, ...filters } = req.query;

    let data;
    let title = '';
    let fileName = '';

    // ===============================
    // 📊 اختيار نوع التقرير
    // ===============================
    switch (reportType) {
      case 'customers':
        data = await getCustomerReportData(filters);
        title = 'تقرير العملاء';
        fileName = 'customers-report';
        break;

      case 'drivers':
        data = await getDriverReportData(filters);
        title = 'تقرير السائقين';
        fileName = 'drivers-report';
        break;

      case 'suppliers':
        data = await getSupplierReportData(filters);
        title = 'تقرير الموردين';
        fileName = 'suppliers-report';
        break;

      case 'users':
        data = await getUserReportData(filters);
        title = 'تقرير المستخدمين';
        fileName = 'users-report';
        break;

      default:
        return res.status(400).json({ error: 'نوع التقرير غير مدعوم' });
    }

    // ===============================
    // 📄 إنشاء PDF
    // ===============================
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
    });

    const fontPath = path.join(__dirname, '../assets/fonts/Cairo-Regular.ttf');
    doc.registerFont('Arabic', fontPath);
    doc.font('Arabic');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}-${Date.now()}.pdf"`
    );

    doc.pipe(res);

    // ===============================
    // 🧾 Header ثابت
    // ===============================
    const headerOptions = {
      reportTitle: title,
      fromDate: startDate,
      toDate: endDate,
    };

    drawHeader(doc, headerOptions);

    doc.on('pageAdded', () => {
      drawHeader(doc, headerOptions);
    });

    doc.moveDown(6);

    // ===============================
    // 📌 Summary
    // ===============================
    sectionTitle(doc, 'الملخص');

    const summaryTop = doc.y;
    softBox(doc, 40, summaryTop, doc.page.width - 80, 100);

    // عربي (يمين)
    doc
      .font('Arabic')
      .fontSize(11)
      .fillColor('#000')
      .text(
        rtl(`إجمالي العناصر: ${
          data.summary?.totalCustomers ??
          data.summary?.totalUsers ??
          data.summary?.totalSuppliers ??
          0
        }`),
        doc.page.width - 300,
        summaryTop + 20,
        { align: 'right' }
      )
      .text(
        rtl(`إجمالي الطلبات: ${data.summary?.totalOrders ?? 0}`),
        doc.page.width - 300,
        summaryTop + 45,
        { align: 'right' }
      )
      .text(
        rtl(`إجمالي المبلغ: ${data.summary?.totalAmount ?? 0} ريال`),
        doc.page.width - 300,
        summaryTop + 70,
        { align: 'right' }
      );

    // English (Left)
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#000')
      .text(
        `Total Items: ${
          data.summary?.totalCustomers ??
          data.summary?.totalUsers ??
          data.summary?.totalSuppliers ??
          0
        }`,
        60,
        summaryTop + 20
      )
      .text(
        `Total Orders: ${data.summary?.totalOrders ?? 0}`,
        60,
        summaryTop + 45
      )
      .text(
        `Total Amount: ${data.summary?.totalAmount ?? 0} SAR`,
        60,
        summaryTop + 70
      );

    doc.moveDown(6);

    // ===============================
    // 📋 Details
    // ===============================
    sectionTitle(doc, 'التفاصيل');

    const list =
      data.customers ||
      data.drivers ||
      data.suppliers ||
      data.users ||
      [];

    if (!list.length) {
      doc
        .fontSize(12)
        .fillColor('#000')
        .text(rtl('لا توجد بيانات لعرضها'), { align: 'center' });
    }

    list.forEach((item, index) => {
      const name =
        item.customerName ||
        item.driverName ||
        item.supplierName ||
        item.userName ||
        '—';

      const y = doc.y;

      softBox(doc, 40, y, doc.page.width - 80, 90);

      // الاسم
      doc
        .font('Arabic')
        .fontSize(12)
        .fillColor('#0A2A43')
        .text(
          rtl(`${index + 1}. ${name}`),
          doc.page.width - 60,
          y + 15,
          { align: 'right' }
        );

      doc.fontSize(10).fillColor('#000');

      if (item.totalOrders !== undefined) {
        doc.text(
          rtl(`عدد الطلبات: ${item.totalOrders}`),
          doc.page.width - 60,
          y + 40,
          { align: 'right' }
        );
      }

      if (item.totalAmount !== undefined) {
        doc.text(
          rtl(`إجمالي المبلغ: ${item.totalAmount} ريال`),
          doc.page.width - 60,
          y + 60,
          { align: 'right' }
        );
      }

      doc.moveDown(6);
    });

    // ===============================
    // ✍️ Footer + Pagination
    // ===============================
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      doc
        .fontSize(9)
        .fillColor('#555')
        .text(
          `Page ${i + 1} of ${range.count}`,
          40,
          doc.page.height - 40
        )
        .text(
          rtl(`تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}`),
          doc.page.width - 200,
          doc.page.height - 40,
          { align: 'right' }
        );
    }

    doc.end();

    console.log('✅ PDF GENERATED SUCCESSFULLY');
  } catch (error) {
    console.error('🔥 PDF EXPORT ERROR:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'حدث خطأ في تصدير PDF',
        details: error.message,
      });
    }
  }
};




// ============================================
// 📊 تصدير Excel
// ============================================

exports.exportExcel = async (req, res) => {
  try {
    console.log('📥 EXPORT EXCEL QUERY:', req.query);

    const { reportType, ...rawFilters } = req.query;

    // ✅ دعم نوع تقرير واحد حاليًا
    if (reportType !== 'suppliers') {
      return res.status(400).json({ error: 'نوع التقرير غير مدعوم' });
    }

    // ===============================
    // 🔧 تجهيز الفلاتر بشكل آمن
    // ===============================
    const filters = {};

    if (rawFilters.startDate) {
      filters.startDate = new Date(rawFilters.startDate);
    }

    if (rawFilters.endDate) {
      filters.endDate = new Date(rawFilters.endDate);
    }

    if (rawFilters.supplierId && mongoose.Types.ObjectId.isValid(rawFilters.supplierId)) {
      filters.supplierId = rawFilters.supplierId;
    }

    if (rawFilters.supplierType) {
      filters.supplierType = rawFilters.supplierType;
    }

    if (rawFilters.productType) {
      filters.productType = rawFilters.productType;
    }

    if (rawFilters.paymentStatus) {
      filters.paymentStatus = rawFilters.paymentStatus;
    }

    console.log('🧩 FINAL FILTERS:', filters);

    // ===============================
    // 📊 جلب البيانات من Service
    // ===============================
    const data = await getSupplierReportData(filters);

    console.log('📊 SUPPLIERS COUNT:', data.suppliers.length);

    // ===============================
    // 📄 إنشاء ملف Excel
    // ===============================
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('الموردين');

    sheet.columns = [
      { header: 'اسم المورد', key: 'name', width: 30 },
      { header: 'عدد الطلبات', key: 'orders', width: 18 },
      { header: 'إجمالي المبلغ', key: 'amount', width: 22 },
      { header: 'مدفوع', key: 'paid', width: 18 },
      { header: 'غير مدفوع', key: 'pending', width: 18 }
    ];

    // تنسيق الهيدر
    sheet.getRow(1).font = { bold: true };

    // ===============================
    // 🧾 إضافة الصفوف
    // ===============================
    data.suppliers.forEach((sup) => {
      sheet.addRow({
        name: sup.supplierName || '-',
        orders: sup.totalOrders || 0,
        amount: sup.totalAmount || 0,
        paid: sup.paidAmount || 0,
        pending: sup.pendingAmount || 0
      });
    });

    // ===============================
    // 📤 إرسال الملف
    // ===============================
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="suppliers-report.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();

    console.log('✅ EXCEL SENT SUCCESSFULLY');

  } catch (error) {
    console.error('🔥 REAL EXCEL ERROR:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'حدث خطأ في تصدير Excel',
        details: error.message
      });
    }
  }
};




// ============================================
// 🔧 دوال مساعدة لتوليد المحتوى
// ============================================

exports.generatePDFContent = async (doc, reportType, data, filters) => {
  // إضافة العنوان
  doc.font('Helvetica-Bold')
     .fontSize(20)
     .text(`تقرير ${this.getReportTypeArabic(reportType)}`, { align: 'center' });
  
  doc.moveDown();

  // إضافة معلومات الفلترة
  if (Object.keys(filters).length > 0) {
    doc.fontSize(12)
       .text('معايير البحث:', { align: 'right' });
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        doc.text(`${this.getFilterLabel(key)}: ${value}`, { align: 'right' });
      }
    });
    doc.moveDown();
  }

  // إضافة التاريخ
  doc.fontSize(10)
     .text(`تم الإنشاء في: ${new Date().toLocaleDateString('ar-SA')}`, { align: 'left' });
  
  doc.moveDown(2);

  // إضافة البيانات حسب نوع التقرير
  switch (reportType) {
    case 'customers':
      this.addCustomersToPDF(doc, data);
      break;
    case 'drivers':
      this.addDriversToPDF(doc, data);
      break;
    case 'suppliers':
      this.addSuppliersToPDF(doc, data);
      break;
    case 'users':
      this.addUsersToPDF(doc, data);
      break;
    case 'invoice':
      this.addInvoiceToPDF(doc, data);
      break;
  }

  // إضافة التوقيع
  doc.moveDown(4);
  doc.fontSize(10)
     .text('................................................', { align: 'center' })
     .text('التوقيع', { align: 'center' });
};

exports.generateExcelContent = async (worksheet, reportType, data, filters) => {
  // إضافة العنوان
  worksheet.mergeCells('A1:F1');
  worksheet.getCell('A1').value = `تقرير ${this.getReportTypeArabic(reportType)}`;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  // إضافة معايير البحث
  let filterRow = 3;
  if (Object.keys(filters).length > 0) {
    worksheet.getCell(`A${filterRow}`).value = 'معايير البحث:';
    worksheet.getCell(`A${filterRow}`).font = { bold: true };
    filterRow++;

    Object.entries(filters).forEach(([key, value], index) => {
      if (value) {
        worksheet.getCell(`A${filterRow + index}`).value = `${this.getFilterLabel(key)}:`;
        worksheet.getCell(`B${filterRow + index}`).value = value;
      }
    });
    filterRow += Object.keys(filters).length + 1;
  }

  // إضافة البيانات حسب نوع التقرير
  switch (reportType) {
    case 'customers':
      this.addCustomersToExcel(worksheet, data, filterRow);
      break;
    case 'drivers':
      this.addDriversToExcel(worksheet, data, filterRow);
      break;
    case 'suppliers':
      this.addSuppliersToExcel(worksheet, data, filterRow);
      break;
    case 'users':
      this.addUsersToExcel(worksheet, data, filterRow);
      break;
  }

  // ضبط عرض الأعمدة
  worksheet.columns.forEach(column => {
    column.width = 20;
  });
};

// ============================================
// 📝 دوال إضافة البيانات إلى PDF
// ============================================

exports.addCustomersToPDF = (doc, data) => {
  doc.fontSize(14)
     .text('ملخص العملاء:', { align: 'right' });
  
  if (data.summary) {
    doc.fontSize(12)
       .text(`إجمالي العملاء: ${data.summary.totalCustomers}`)
       .text(`إجمالي الطلبات: ${data.summary.totalOrders}`)
       .text(`إجمالي الكمية: ${data.summary.totalQuantity}`)
       .text(`إجمالي المبلغ: ${data.summary.totalAmount.toFixed(2)} ريال`)
       .text(`متوسط نسبة النجاح: ${data.summary.avgSuccessRate.toFixed(2)}%`);
  }
  
  doc.moveDown(2);
  
  if (data.customers && data.customers.length > 0) {
    doc.fontSize(14)
       .text('تفاصيل العملاء:', { align: 'right' });
    
    data.customers.forEach((customer, index) => {
      doc.moveDown();
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text(`${index + 1}. ${customer.customerName} (${customer.customerCode})`);
      
      doc.font('Helvetica')
         .fontSize(10)
         .text(`الهاتف: ${customer.customerPhone || 'غير متوفر'}`)
         .text(`البريد: ${customer.customerEmail || 'غير متوفر'}`)
         .text(`المدينة: ${customer.customerCity || 'غير متوفر'}`)
         .text(`إجمالي الطلبات: ${customer.totalOrders}`)
         .text(`إجمالي المبلغ: ${customer.totalAmount.toFixed(2)} ريال`)
         .text(`نسبة النجاح: ${customer.successRate.toFixed(2)}%`);
    });
  }
};

// دالة مماثلة للسائقين والموردين والمستخدمين...
exports.addDriversToPDF = (doc, data) => {
  // تنفيذ مماثل مع تعديلات حسب البيانات
};

exports.addSuppliersToPDF = (doc, data) => {
  // تنفيذ مماثل مع تعديلات حسب البيانات
};

exports.addUsersToPDF = (doc, data) => {
  // تنفيذ مماثل مع تعديلات حسب البيانات
};

exports.addInvoiceToPDF = (doc, data) => {
  // تنفيذ خاص للفاتورة
};

// ============================================
// 📊 دوال إضافة البيانات إلى Excel
// ============================================

exports.addCustomersToExcel = (worksheet, data, startRow) => {
  // عناوين الأعمدة
  const headers = [
    'اسم العميل', 'الكود', 'الهاتف', 'البريد', 'المدينة',
    'عدد الطلبات', 'إجمالي الكمية', 'إجمالي المبلغ', 'طلبات مكتملة',
    'طلبات ملغية', 'نسبة النجاح %'
  ];

  headers.forEach((header, index) => {
    worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).value = header;
    worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).font = { bold: true };
    worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  });

  // البيانات
  data.customers.forEach((customer, rowIndex) => {
    const row = startRow + rowIndex + 1;
    const values = [
      customer.customerName,
      customer.customerCode,
      customer.customerPhone,
      customer.customerEmail,
      customer.customerCity,
      customer.totalOrders,
      customer.totalQuantity,
      customer.totalAmount,
      customer.completedOrders,
      customer.cancelledOrders,
      customer.successRate
    ];

    values.forEach((value, colIndex) => {
      worksheet.getCell(`${String.fromCharCode(65 + colIndex)}${row}`).value = value;
    });
  });
};

// دوال مماثلة لأنواع التقارير الأخرى...

// ============================================
// 🏷️ دوال مساعدة للتسميات
// ============================================

exports.getReportTypeArabic = (reportType) => {
  const types = {
    'customers': 'العملاء',
    'drivers': 'السائقين',
    'suppliers': 'الموردين',
    'users': 'المستخدمين',
    'invoice': 'الفاتورة'
  };
  return types[reportType] || reportType;
};

exports.getFilterLabel = (key) => {
  const labels = {
    'startDate': 'من تاريخ',
    'endDate': 'إلى تاريخ',
    'customerId': 'العميل',
    'driverId': 'السائق',
    'supplierId': 'المورد',
    'userId': 'المستخدم',
    'status': 'الحالة',
    'city': 'المدينة',
    'area': 'المنطقة',
    'vehicleType': 'نوع المركبة',
    'supplierType': 'نوع المورد',
    'productType': 'نوع المنتج',
    'paymentStatus': 'حالة الدفع',
    'role': 'الدور'
  };
  return labels[key] || key;
};
