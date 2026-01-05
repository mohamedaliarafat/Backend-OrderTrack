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
const reshape = require('arabic-persian-reshaper');
const bidi = require('bidi-js');

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
// 🅰️ Arabic RTL Support
// ===============================
function rtl(text) {
  if (!text) return '';
  try {
    const reshaped = reshape(text.toString());
    return bidi.fromString(reshaped).toString();
  } catch {
    return text.toString();
  }
}

// ===============================
// 🎨 دوال مساعدة للـ PDF
// ===============================
function box(doc, x, y, w, h) {
  doc
    .roundedRect(x, y, w, h, 6)
    .lineWidth(1)
    .strokeColor('#0A2A43')
    .stroke();
}

function softBox(doc, x, y, w, h) {
  doc
    .roundedRect(x, y, w, h, 6)
    .lineWidth(0.5)
    .strokeColor('#CCCCCC')
    .fillColor('#F9F9F9')
    .fillAndStroke();
}

function sectionTitle(doc, text) {
  doc
    .fontSize(13)
    .fillColor('#0A2A43')
    .font('Arabic')
    .text(rtl(text), { align: 'right' })
    .moveDown(0.5);
}

function drawPageBorder(doc) {
  doc
    .save()
    .lineWidth(2)
    .strokeColor('#0A2A43')
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

// ===============================
// 📄 دوال إضافة البيانات للـ PDF
// ===============================
function addCustomersToPDF(doc, data) {
  sectionTitle(doc, 'تفاصيل العملاء');
  
  data.customers.forEach((customer, index) => {
    const y = doc.y;
    softBox(doc, 40, y, doc.page.width - 80, 110);
    
    doc
      .font('Arabic')
      .fontSize(12)
      .fillColor('#0A2A43')
      .text(
        rtl(`${index + 1}. ${customer.customerName || '—'}`),
        doc.page.width - 60,
        y + 15,
        { align: 'right' }
      );
    
    doc.fontSize(10).fillColor('#000');
    
    const details = [
      `الكود: ${customer.customerCode || '—'}`,
      `الهاتف: ${customer.customerPhone || '—'}`,
      `المدينة: ${customer.customerCity || '—'}`,
      `عدد الطلبات: ${customer.totalOrders || 0}`,
      `إجمالي المبلغ: ${(customer.totalAmount || 0).toFixed(2)} ريال`,
      `نسبة النجاح: ${(customer.successRate || 0).toFixed(1)}%`
    ];
    
    details.forEach((detail, i) => {
      doc.text(
        rtl(detail),
        doc.page.width - 60,
        y + 35 + (i * 15),
        { align: 'right' }
      );
    });
    
    doc.moveDown(6);
  });
}

function addDriversToPDF(doc, data) {
  sectionTitle(doc, 'تفاصيل السائقين');
  
  data.drivers.forEach((driver, index) => {
    const y = doc.y;
    softBox(doc, 40, y, doc.page.width - 80, 110);
    
    doc
      .font('Arabic')
      .fontSize(12)
      .fillColor('#0A2A43')
      .text(
        rtl(`${index + 1}. ${driver.driverName || '—'}`),
        doc.page.width - 60,
        y + 15,
        { align: 'right' }
      );
    
    doc.fontSize(10).fillColor('#000');
    
    const details = [
      `رقم السيارة: ${driver.vehicleNumber || '—'}`,
      `الهاتف: ${driver.driverPhone || '—'}`,
      `عدد الطلبات: ${driver.totalOrders || 0}`,
      `إجمالي المسافة: ${(driver.totalDistance || 0).toFixed(1)} كم`,
      `إجمالي الأرباح: ${(driver.totalEarnings || 0).toFixed(2)} ريال`,
      `نسبة النجاح: ${(driver.successRate || 0).toFixed(1)}%`
    ];
    
    details.forEach((detail, i) => {
      doc.text(
        rtl(detail),
        doc.page.width - 60,
        y + 35 + (i * 15),
        { align: 'right' }
      );
    });
    
    doc.moveDown(6);
  });
}

function addSuppliersToPDF(doc, data) {
  sectionTitle(doc, 'تفاصيل الموردين');
  
  data.suppliers.forEach((supplier, index) => {
    const y = doc.y;
    softBox(doc, 40, y, doc.page.width - 80, 110);
    
    doc
      .font('Arabic')
      .fontSize(12)
      .fillColor('#0A2A43')
      .text(
        rtl(`${index + 1}. ${supplier.supplierName || '—'}`),
        doc.page.width - 60,
        y + 15,
        { align: 'right' }
      );
    
    doc.fontSize(10).fillColor('#000');
    
    const details = [
      `الشركة: ${supplier.supplierCompany || '—'}`,
      `الهاتف: ${supplier.supplierPhone || '—'}`,
      `عدد الطلبات: ${supplier.totalOrders || 0}`,
      `إجمالي المبلغ: ${(supplier.totalAmount || 0).toFixed(2)} ريال`,
      `المدفوع: ${(supplier.paidAmount || 0).toFixed(2)} ريال`,
      `المتبقي: ${(supplier.pendingAmount || 0).toFixed(2)} ريال`
    ];
    
    details.forEach((detail, i) => {
      doc.text(
        rtl(detail),
        doc.page.width - 60,
        y + 35 + (i * 15),
        { align: 'right' }
      );
    });
    
    doc.moveDown(6);
  });
}

function addUsersToPDF(doc, data) {
  sectionTitle(doc, 'تفاصيل المستخدمين');
  
  data.users.forEach((user, index) => {
    const y = doc.y;
    softBox(doc, 40, y, doc.page.width - 80, 110);
    
    doc
      .font('Arabic')
      .fontSize(12)
      .fillColor('#0A2A43')
      .text(
        rtl(`${index + 1}. ${user.userName || '—'}`),
        doc.page.width - 60,
        y + 15,
        { align: 'right' }
      );
    
    doc.fontSize(10).fillColor('#000');
    
    const details = [
      `البريد: ${user.userEmail || '—'}`,
      `الدور: ${user.userRole || '—'}`,
      `عدد الطلبات: ${user.totalOrders || 0}`,
      `إجمالي المبلغ: ${(user.totalAmount || 0).toFixed(2)} ريال`,
      `الطلبات المكتملة: ${user.completedOrders || 0}`,
      `نسبة النجاح: ${(user.successRate || 0).toFixed(1)}%`
    ];
    
    details.forEach((detail, i) => {
      doc.text(
        rtl(detail),
        doc.page.width - 60,
        y + 35 + (i * 15),
        { align: 'right' }
      );
    });
    
    doc.moveDown(6);
  });
}

// ===============================
// 📊 تقارير العملاء
// ===============================
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

    if (startDate || endDate) {
      match.orderDate = {};
      if (startDate) match.orderDate.$gte = new Date(startDate);
      if (endDate) match.orderDate.$lte = new Date(endDate);
    }

    if (customerId) {
      match.customer = mongoose.Types.ObjectId(customerId);
    }

    if (city) match.city = city;
    if (area) match.area = area;
    if (status) match.status = status;

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

// ===============================
// 🚚 تقارير السائقين
// ===============================
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

    if (startDate || endDate) {
      match.orderDate = {};
      if (startDate) match.orderDate.$gte = new Date(startDate);
      if (endDate) match.orderDate.$lte = new Date(endDate);
    }

    if (driverId) {
      match.driver = mongoose.Types.ObjectId(driverId);
    }

    if (vehicleType) match.vehicleType = vehicleType;
    if (status) match.status = status;
    if (city) match.city = city;

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

// ===============================
// 🏢 تقارير الموردين
// ===============================
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

    if (startDate || endDate) {
      match.orderDate = {};
      if (startDate) match.orderDate.$gte = new Date(startDate);
      if (endDate) match.orderDate.$lte = new Date(endDate);
    }

    if (supplierId) {
      match.supplier = mongoose.Types.ObjectId(supplierId);
    }

    if (supplierType) match.supplierType = supplierType;
    if (productType) match.productType = productType;
    if (paymentStatus) match.paymentStatus = paymentStatus;

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

// ===============================
// 👤 تقارير المستخدمين
// ===============================
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

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    if (userId) {
      match.createdBy = mongoose.Types.ObjectId(userId);
    }

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

    const userFilter = {};
    if (role) userFilter.role = role;
    if (userId) userFilter._id = mongoose.Types.ObjectId(userId);

    const users = await User.find(userFilter)
      .select('name email role company phone createdAt')
      .skip(skip)
      .limit(limit);

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

// ===============================
// 📦 تقرير الفواتير المحددة
// ===============================
exports.invoiceReport = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: 'رقم الطلب مطلوب' });
    }

    const order = await Order.findById(orderId)
      .populate('customer', 'name code phone email address taxNumber')
      .populate('supplier', 'name company contactPerson phone address taxNumber commercialNumber')
      .populate('driver', 'name phone vehicleNumber licenseNumber')
      .populate('createdBy', 'name email phone');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const activities = await Activity.find({ orderId: order._id })
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 });

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

    const taxRate = 0.15;
    const subtotal = order.totalPrice || 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

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
        dueDate: new Date(order.orderDate.getTime() + 30 * 24 * 60 * 60 * 1000)
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

// ===============================
// 📄 تصدير PDF - محدث
// ===============================
exports.exportPDF = async (req, res) => {
  try {
    console.log('📥 EXPORT PDF QUERY:', req.query);

    const { reportType, startDate, endDate, ...filters } = req.query;

    let data;
    let title = '';
    let fileName = '';

    switch (reportType) {
      case 'customers':
        data = await getCustomerReportData({ ...filters, startDate, endDate });
        title = 'تقرير العملاء';
        fileName = 'customers-report';
        break;

      case 'drivers':
        data = await getDriverReportData({ ...filters, startDate, endDate });
        title = 'تقرير السائقين';
        fileName = 'drivers-report';
        break;

      case 'suppliers':
        data = await getSupplierReportData({ ...filters, startDate, endDate });
        title = 'تقرير الموردين';
        fileName = 'suppliers-report';
        break;

      case 'users':
        data = await getUserReportData({ ...filters, startDate, endDate });
        title = 'تقرير المستخدمين';
        fileName = 'users-report';
        break;

      default:
        return res.status(400).json({ error: 'نوع التقرير غير مدعوم' });
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
    });

    doc.registerFont('Arabic', FONT_AR);
    doc.font('Arabic');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}-${Date.now()}.pdf"`
    );

    doc.pipe(res);

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

    sectionTitle(doc, 'الملخص');

    const summaryTop = doc.y;
    softBox(doc, 40, summaryTop, doc.page.width - 80, 100);

    doc
      .font('Arabic')
      .fontSize(11)
      .fillColor('#000')
      .text(
        rtl(`إجمالي العناصر: ${
          data.summary?.totalCustomers ??
          data.summary?.totalDrivers ??
          data.summary?.totalSuppliers ??
          data.summary?.totalUsers ??
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
        rtl(`إجمالي المبلغ: ${data.summary?.totalAmount?.toFixed(2) ?? 0} ريال`),
        doc.page.width - 300,
        summaryTop + 70,
        { align: 'right' }
      );

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#000')
      .text(
        `Total Items: ${
          data.summary?.totalCustomers ??
          data.summary?.totalDrivers ??
          data.summary?.totalSuppliers ??
          data.summary?.totalUsers ??
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
        `Total Amount: ${data.summary?.totalAmount?.toFixed(2) ?? 0} SAR`,
        60,
        summaryTop + 70
      );

    doc.moveDown(6);

    switch (reportType) {
      case 'customers':
        if (data.customers && data.customers.length > 0) {
          addCustomersToPDF(doc, data);
        } else {
          doc.text(rtl('لا توجد بيانات لعرضها'), { align: 'center' });
        }
        break;

      case 'drivers':
        if (data.drivers && data.drivers.length > 0) {
          addDriversToPDF(doc, data);
        } else {
          doc.text(rtl('لا توجد بيانات لعرضها'), { align: 'center' });
        }
        break;

      case 'suppliers':
        if (data.suppliers && data.suppliers.length > 0) {
          addSuppliersToPDF(doc, data);
        } else {
          doc.text(rtl('لا توجد بيانات لعرضها'), { align: 'center' });
        }
        break;

      case 'users':
        if (data.users && data.users.length > 0) {
          addUsersToPDF(doc, data);
        } else {
          doc.text(rtl('لا توجد بيانات لعرضها'), { align: 'center' });
        }
        break;
    }

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

// ===============================
// 📊 تصدير Excel - محدث
// ===============================
exports.exportExcel = async (req, res) => {
  try {
    console.log('📥 EXPORT EXCEL QUERY:', req.query);

    const { reportType, ...rawFilters } = req.query;

    if (!['customers', 'drivers', 'suppliers', 'users'].includes(reportType)) {
      return res.status(400).json({ error: 'نوع التقرير غير مدعوم' });
    }

    const filters = {};

    if (rawFilters.startDate) {
      filters.startDate = new Date(rawFilters.startDate);
    }

    if (rawFilters.endDate) {
      filters.endDate = new Date(rawFilters.endDate);
    }

    if (rawFilters.customerId && mongoose.Types.ObjectId.isValid(rawFilters.customerId)) {
      filters.customerId = rawFilters.customerId;
    }

    if (rawFilters.driverId && mongoose.Types.ObjectId.isValid(rawFilters.driverId)) {
      filters.driverId = rawFilters.driverId;
    }

    if (rawFilters.supplierId && mongoose.Types.ObjectId.isValid(rawFilters.supplierId)) {
      filters.supplierId = rawFilters.supplierId;
    }

    if (rawFilters.userId && mongoose.Types.ObjectId.isValid(rawFilters.userId)) {
      filters.userId = rawFilters.userId;
    }

    console.log('🧩 FINAL FILTERS:', filters);

    let data;
    let fileName = '';
    let worksheetTitle = '';

    switch (reportType) {
      case 'customers':
        data = await getCustomerReportData(filters);
        fileName = 'customers-report';
        worksheetTitle = 'العملاء';
        break;

      case 'drivers':
        data = await getDriverReportData(filters);
        fileName = 'drivers-report';
        worksheetTitle = 'السائقين';
        break;

      case 'suppliers':
        data = await getSupplierReportData(filters);
        fileName = 'suppliers-report';
        worksheetTitle = 'الموردين';
        break;

      case 'users':
        data = await getUserReportData(filters);
        fileName = 'users-report';
        worksheetTitle = 'المستخدمين';
        break;
    }

    console.log(`📊 ${reportType.toUpperCase()} COUNT:`, 
      data.customers?.length || 
      data.drivers?.length || 
      data.suppliers?.length || 
      data.users?.length || 0
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(worksheetTitle);

    let headers = [];
    let dataRows = [];

    switch (reportType) {
      case 'customers':
        headers = [
          'اسم العميل', 'الكود', 'الهاتف', 'البريد الإلكتروني', 'المدينة',
          'عدد الطلبات', 'إجمالي الكمية', 'إجمالي المبلغ', 'طلبات مكتملة',
          'طلبات معلقة', 'طلبات ملغية', 'نسبة النجاح %', 'متوسط قيمة الطلب',
          'أول طلب', 'آخر طلب'
        ];
        
        dataRows = data.customers?.map(customer => [
          customer.customerName || '-',
          customer.customerCode || '-',
          customer.customerPhone || '-',
          customer.customerEmail || '-',
          customer.customerCity || '-',
          customer.totalOrders || 0,
          customer.totalQuantity || 0,
          customer.totalAmount?.toFixed(2) || '0.00',
          customer.completedOrders || 0,
          customer.pendingOrders || 0,
          customer.cancelledOrders || 0,
          customer.successRate?.toFixed(1) || '0.0',
          customer.avgOrderValue?.toFixed(2) || '0.00',
          customer.firstOrderDate ? new Date(customer.firstOrderDate).toLocaleDateString('ar-SA') : '-',
          customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString('ar-SA') : '-'
        ]) || [];
        break;

      case 'drivers':
        headers = [
          'اسم السائق', 'الهاتف', 'البريد الإلكتروني', 'رقم السيارة', 'نوع السيارة',
          'عدد الطلبات', 'إجمالي المسافة (كم)', 'إجمالي الأرباح', 'طلبات مكتملة',
          'طلبات متأخرة', 'طلبات معلقة', 'نسبة النجاح %', 'نسبة التسليم في الوقت %',
          'متوسط وقت التسليم', 'أول مهمة', 'آخر مهمة'
        ];
        
        dataRows = data.drivers?.map(driver => [
          driver.driverName || '-',
          driver.driverPhone || '-',
          driver.driverEmail || '-',
          driver.vehicleNumber || '-',
          driver.vehicleType || '-',
          driver.totalOrders || 0,
          driver.totalDistance?.toFixed(1) || '0.0',
          driver.totalEarnings?.toFixed(2) || '0.00',
          driver.completedOrders || 0,
          driver.delayedOrders || 0,
          driver.pendingOrders || 0,
          driver.successRate?.toFixed(1) || '0.0',
          driver.onTimeRate?.toFixed(1) || '0.0',
          driver.avgDeliveryTime ? `${driver.avgDeliveryTime?.toFixed(0)} دقيقة` : '-',
          driver.firstAssignment ? new Date(driver.firstAssignment).toLocaleDateString('ar-SA') : '-',
          driver.lastAssignment ? new Date(driver.lastAssignment).toLocaleDateString('ar-SA') : '-'
        ]) || [];
        break;

      case 'suppliers':
        headers = [
          'اسم المورد', 'الشركة', 'الهاتف', 'البريد الإلكتروني', 'نوع المورد',
          'عدد الطلبات', 'إجمالي الكمية', 'إجمالي المبلغ', 'مدفوع', 'غير مدفوع',
          'نسبة السداد %', 'طلبات مكتملة', 'طلبات ملغية', 'نسبة النجاح %',
          'متوسط قيمة الطلب', 'أول طلب', 'آخر طلب'
        ];
        
        dataRows = data.suppliers?.map(supplier => [
          supplier.supplierName || '-',
          supplier.supplierCompany || '-',
          supplier.supplierPhone || '-',
          supplier.supplierEmail || '-',
          supplier.supplierType || '-',
          supplier.totalOrders || 0,
          supplier.totalQuantity || 0,
          supplier.totalAmount?.toFixed(2) || '0.00',
          supplier.paidAmount?.toFixed(2) || '0.00',
          supplier.pendingAmount?.toFixed(2) || '0.00',
          supplier.paymentPercentage?.toFixed(1) || '0.0',
          supplier.completedOrders || 0,
          supplier.cancelledOrders || 0,
          supplier.successRate?.toFixed(1) || '0.0',
          supplier.avgOrderValue?.toFixed(2) || '0.00',
          supplier.firstOrderDate ? new Date(supplier.firstOrderDate).toLocaleDateString('ar-SA') : '-',
          supplier.lastOrderDate ? new Date(supplier.lastOrderDate).toLocaleDateString('ar-SA') : '-'
        ]) || [];
        break;

      case 'users':
        headers = [
          'اسم المستخدم', 'البريد الإلكتروني', 'الدور', 'الشركة', 'الهاتف',
          'عدد الطلبات', 'طلبات عملاء', 'طلبات موردين', 'طلبات مدمجة',
          'إجمالي المبلغ', 'طلبات مكتملة', 'طلبات ملغية', 'نسبة النجاح %',
          'تاريخ التسجيل', 'أول طلب', 'آخر طلب'
        ];
        
        dataRows = data.users?.map(user => [
          user.userName || '-',
          user.userEmail || '-',
          user.userRole || '-',
          user.userCompany || '-',
          user.userPhone || '-',
          user.totalOrders || 0,
          user.totalCustomerOrders || 0,
          user.totalSupplierOrders || 0,
          user.totalMixedOrders || 0,
          user.totalAmount?.toFixed(2) || '0.00',
          user.completedOrders || 0,
          user.cancelledOrders || 0,
          user.successRate?.toFixed(1) || '0.0',
          user.userCreatedAt ? new Date(user.userCreatedAt).toLocaleDateString('ar-SA') : '-',
          user.firstOrderDate ? new Date(user.firstOrderDate).toLocaleDateString('ar-SA') : '-',
          user.lastOrderDate ? new Date(user.lastOrderDate).toLocaleDateString('ar-SA') : '-'
        ]) || [];
        break;
    }

    sheet.addRow(headers);
    
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    dataRows.forEach(rowData => {
      sheet.addRow(rowData);
    });

    sheet.columns.forEach(column => {
      column.width = 20;
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}-${Date.now()}.xlsx"`
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
