const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Driver = require('../models/Driver');
const { sendEmail } = require('../services/emailService');
const EmailTemplates = require('../services/emailTemplates');
const getOrderEmails = require('../utils/getOrderEmails');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');

const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// تكوين multer لرفع الملفات
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|zip/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'));
    }
  }
}).fields([
  { name: 'attachments', maxCount: 5 },
  { name: 'supplierDocuments', maxCount: 5 },
  { name: 'customerDocuments', maxCount: 5 }
]);

exports.uploadMiddleware = upload;

// ============================================
// 🔧 وظائف مساعدة
// ============================================

// تنسيق المدة الزمنية
function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (minutes > 0) parts.push(`${minutes} دقيقة`);
  
  return parts.join(' و ') || 'أقل من دقيقة';
}

// ============================================
// 📦 إنشاء طلب جديد
// ============================================

// ============================================
// 📦 إنشاء طلب جديد (مع دعم شراء / نقل)
// ============================================

exports.createOrder = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const orderData = { ...req.body };

      // ==================================================
      // 🚫 امنع إدخال status / orderNumber يدويًا
      // ==================================================
      delete orderData.status;
      delete orderData.orderNumber;

      // ==================================================
      // 🧭 تحديد مصدر الطلب
      // ==================================================
      orderData.orderSource = orderData.customer ? 'عميل' : 'مورد';

      // ==================================================
      // 👤 العميل مطلوب لطلبات العملاء
      // ==================================================
      if (orderData.orderSource === 'عميل' && !orderData.customer) {
        return res.status(400).json({
          error: 'العميل مطلوب لطلبات العملاء',
        });
      }

      // ==================================================
      // ✅ نوع العملية (شراء | نقل) — للعملاء فقط
      // ==================================================
      const allowedRequestTypes = ['شراء', 'نقل'];

      if (orderData.orderSource === 'عميل') {
        // افتراضي شراء
        orderData.requestType = orderData.requestType || 'شراء';

        if (!allowedRequestTypes.includes(orderData.requestType)) {
          return res.status(400).json({
            error: 'نوع العملية غير صحيح (يجب أن يكون شراء أو نقل)',
          });
        }
      } else {
        // طلب مورد → ممنوع وجود requestType
        delete orderData.requestType;
      }

      // ==================================================
      // 🚚 شرط النقل: سائق (طلب عميل + نقل فقط)
      // ==================================================
      if (
        orderData.orderSource === 'عميل' &&
        orderData.requestType === 'نقل' &&
        !orderData.driver
      ) {
        return res.status(400).json({
          error: 'طلبات النقل تتطلب تعيين سائق',
        });
      }

      // ==================================================
      // ⏰ التحقق من الأوقات
      // ==================================================
      if (
        !orderData.loadingDate ||
        !orderData.loadingTime ||
        !orderData.arrivalDate ||
        !orderData.arrivalTime
      ) {
        return res.status(400).json({ error: 'جميع الأوقات مطلوبة' });
      }

      const loadingDateTime = new Date(
        `${orderData.loadingDate}T${orderData.loadingTime}`
      );
      const arrivalDateTime = new Date(
        `${orderData.arrivalDate}T${orderData.arrivalTime}`
      );

      if (arrivalDateTime <= loadingDateTime) {
        return res.status(400).json({
          error: 'وقت الوصول يجب أن يكون بعد وقت التحميل',
        });
      }

      // ==================================================
      // 👤 بيانات المُنشئ
      // ==================================================
      orderData.createdBy = req.user._id;
      orderData.createdByName = req.user.name;

      // ==================================================
      // 👥 بيانات العميل (لو طلب عميل)
      // ==================================================
      if (orderData.orderSource === 'عميل') {
        const customerDoc = await Customer.findById(orderData.customer);
        if (!customerDoc) {
          return res.status(400).json({ error: 'العميل غير موجود' });
        }

        orderData.customerName = customerDoc.name;
        orderData.customerCode = customerDoc.code;
        orderData.customerPhone = customerDoc.phone;
        orderData.customerEmail = customerDoc.email;

        orderData.city = orderData.city || customerDoc.city;
        orderData.area = orderData.area || customerDoc.area;
        orderData.address = orderData.address ?? null;
      }

      // ==================================================
      // 🏢 بيانات المورد (لو طلب مورد)
      // ==================================================
      if (orderData.orderSource === 'مورد' && orderData.supplier) {
        const supplierDoc = await Supplier.findById(orderData.supplier);
        if (!supplierDoc) {
          return res.status(400).json({ error: 'المورد غير موجود' });
        }

        orderData.supplierName = supplierDoc.name;
        orderData.supplierCompany = supplierDoc.company;
        orderData.supplierContactPerson = supplierDoc.contactPerson;
        orderData.supplierPhone = supplierDoc.phone;

        orderData.city = orderData.city || supplierDoc.city;
        orderData.area = orderData.area || supplierDoc.area;
        orderData.address = orderData.address ?? null;
      }

      // ==================================================
      // 🛡️ تحقق نهائي للموقع
      // ==================================================
      if (!orderData.city || !orderData.area) {
        return res.status(400).json({
          error: 'المدينة والمنطقة مطلوبة لإنشاء الطلب',
          debug: {
            city: orderData.city,
            area: orderData.area,
          },
        });
      }

      // ==================================================
      // 📅 تحويل التواريخ
      // ==================================================
      orderData.orderDate = new Date(orderData.orderDate || new Date());
      orderData.loadingDate = new Date(orderData.loadingDate);
      orderData.arrivalDate = new Date(orderData.arrivalDate);

      // ==================================================
      // 📎 الملفات
      // ==================================================
      if (req.files?.attachments) {
        orderData.attachments = req.files.attachments.map((file) => ({
          filename: file.originalname,
          path: file.path,
          uploadedAt: new Date(),
          uploadedBy: req.user._id,
        }));
      }

      // ==================================================
      // 🧾 إنشاء الطلب
      // ==================================================
      const order = new Order(orderData);
      await order.save();

      const populatedOrder = await Order.findById(order._id)
        .populate('customer', 'name code phone city area')
        .populate('supplier', 'name company city area')
        .populate('createdBy', 'name email')
        .populate('driver', 'name phone vehicleNumber');

      return res.status(201).json({
        message:
          order.orderSource === 'عميل'
            ? 'تم إنشاء طلب العميل بنجاح'
            : 'تم إنشاء طلب المورد بنجاح',
        order: populatedOrder,
      });
    });
  } catch (error) {
    console.error('❌ Error creating order:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// ============================================
// 📋 جلب جميع الطلبات
// ============================================

exports.getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // بناء عوامل التصفية
    const filter = {};
    
    // تصفية حسب مصدر الطلب
    if (req.query.orderSource) {
      filter.orderSource = req.query.orderSource;
    }
    
    // تصفية حسب حالة الدمج
    if (req.query.mergeStatus) {
      filter.mergeStatus = req.query.mergeStatus;
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.supplierName) {
      filter.supplierName = new RegExp(req.query.supplierName, 'i');
    }
    
    if (req.query.customerName) {
      filter.customerName = new RegExp(req.query.customerName, 'i');
    }
    
    if (req.query.orderNumber) {
      filter.orderNumber = new RegExp(req.query.orderNumber, 'i');
    }
    
    if (req.query.supplierOrderNumber) {
      filter.supplierOrderNumber = new RegExp(req.query.supplierOrderNumber, 'i');
    }
    
    if (req.query.city) {
      filter.city = new RegExp(req.query.city, 'i');
    }
    
    if (req.query.area) {
      filter.area = new RegExp(req.query.area, 'i');
    }
    
    if (req.query.productType) {
      filter.productType = req.query.productType;
    }
    
    if (req.query.fuelType) {
      filter.fuelType = req.query.fuelType;
    }
    
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }
    
    if (req.query.driverName) {
      filter.driverName = new RegExp(req.query.driverName, 'i');
    }
    
    if (req.query.createdByName) {
      filter.createdByName = new RegExp(req.query.createdByName, 'i');
    }
    
    // تصفية حسب التواريخ
    if (req.query.startDate || req.query.endDate) {
      const dateField = req.query.dateField || 'orderDate';
      filter[dateField] = {};
      
      if (req.query.startDate) {
        const startDate = new Date(req.query.startDate);
        startDate.setHours(0, 0, 0, 0);
        filter[dateField].$gte = startDate;
      }
      
      if (req.query.endDate) {
        const endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999);
        filter[dateField].$lte = endDate;
      }
    }

    // تصفية حسب حالة التحميل/التوصيل
    if (req.query.isOverdue) {
      const now = new Date();
      if (req.query.isOverdue === 'arrival') {
        filter.$expr = {
          $lt: [
            {
              $dateFromParts: {
                year: { $year: '$arrivalDate' },
                month: { $month: '$arrivalDate' },
                day: { $dayOfMonth: '$arrivalDate' },
                hour: { $toInt: { $arrayElemAt: [{ $split: ['$arrivalTime', ':'] }, 0] } },
                minute: { $toInt: { $arrayElemAt: [{ $split: ['$arrivalTime', ':'] }, 1] } }
              }
            },
            now
          ]
        };
      } else if (req.query.isOverdue === 'loading') {
        filter.$expr = {
          $lt: [
            {
              $dateFromParts: {
                year: { $year: '$loadingDate' },
                month: { $month: '$loadingDate' },
                day: { $dayOfMonth: '$loadingDate' },
                hour: { $toInt: { $arrayElemAt: [{ $split: ['$loadingTime', ':'] }, 0] } },
                minute: { $toInt: { $arrayElemAt: [{ $split: ['$loadingTime', ':'] }, 1] } }
              }
            },
            now
          ]
        };
      }
    }

    // جلب الطلبات مع جميع العلاقات
    const orders = await Order.find(filter)
      .populate('customer', 'name code phone email city area address')
      .populate('supplier', 'name company contactPerson phone email address city area')
      .populate('createdBy', 'name email role')
      .populate('driver', 'name phone vehicleNumber licenseNumber')
      .populate('mergedWithOrderId', 'orderNumber customerName supplierName')
      .sort({ orderDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // معالجة كل طلب للحصول على معلومات إضافية
    const ordersWithDisplayInfo = await Promise.all(
      orders.map(async (order) => {
        // الحصول على معلومات العرض الأساسية
        const displayInfo = order.getDisplayInfo ? order.getDisplayInfo() : {
          orderNumber: order.orderNumber,
          orderSource: order.orderSource,
          orderSourceText: getOrderSourceText(order.orderSource),
          supplierName: order.supplierName || 'غير محدد',
          customerName: order.customerName || 'غير محدد',
          status: order.status,
          statusColor: getStatusColor(order.status),
          location: getLocation(order),
          fuelType: order.fuelType,
          quantity: order.quantity,
          unit: order.unit,
          mergeStatus: order.mergeStatus,
          totalPrice: order.totalPrice,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt
        };

        // حساب المؤقتات
        let arrivalCountdown = 'غير متاح';
        let loadingCountdown = 'غير متاح';
        let isArrivalOverdue = false;
        let isLoadingOverdue = false;

        if (order.getFullArrivalDateTime) {
          const arrivalDateTime = order.getFullArrivalDateTime();
          const now = new Date();
          const arrivalRemaining = arrivalDateTime - now;
          
          if (arrivalRemaining <= 0) {
            arrivalCountdown = 'تأخر';
            isArrivalOverdue = true;
          } else {
            arrivalCountdown = formatDuration(arrivalRemaining);
          }
        }

        if (order.getFullLoadingDateTime) {
          const loadingDateTime = order.getFullLoadingDateTime();
          const now = new Date();
          const loadingRemaining = loadingDateTime - now;
          
          if (loadingRemaining <= 0) {
            loadingCountdown = 'تأخر';
            isLoadingOverdue = true;
          } else {
            loadingCountdown = formatDuration(loadingRemaining);
          }
        }

        // الحصول على معلومات الطرف المدمج معه
        let mergePartnerInfo = null;
        if (order.mergedWithOrderId && typeof order.mergedWithOrderId === 'object') {
          mergePartnerInfo = {
            orderNumber: order.mergedWithOrderId.orderNumber,
            name: order.orderSource === 'مورد' 
              ? order.mergedWithOrderId.customerName 
              : order.mergedWithOrderId.supplierName,
            type: order.orderSource === 'مورد' ? 'عميل' : 'مورد'
          };
        } else if (order.mergedWithInfo) {
          mergePartnerInfo = order.mergedWithInfo;
        }

        // الحصول على معلومات إضافية حسب نوع الطلب
        let additionalInfo = {};
        
        if (order.orderSource === 'مورد') {
          additionalInfo = {
            supplierOrder: {
              orderNumber: order.orderNumber,
              supplierName: order.supplierName,
              supplierCompany: order.supplierCompany,
              supplierPhone: order.supplierPhone,
              status: order.status,
              mergeStatus: order.mergeStatus,
              mergedWith: mergePartnerInfo
            }
          };
        } else if (order.orderSource === 'عميل') {
          additionalInfo = {
            customerOrder: {
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              customerCode: order.customerCode,
              customerPhone: order.customerPhone,
              requestType: order.requestType,
              status: order.status,
              mergeStatus: order.mergeStatus,
              mergedWith: mergePartnerInfo
            }
          };
        } else if (order.orderSource === 'مدمج') {
          additionalInfo = {
            mergedOrder: {
              orderNumber: order.orderNumber,
              supplierName: order.supplierName,
              customerName: order.customerName,
              quantity: order.quantity,
              unit: order.unit,
              status: order.status,
              mergeStatus: order.mergeStatus
            }
          };
        }

        return {
          ...order.toObject(),
          displayInfo: {
            ...displayInfo,
            arrivalCountdown,
            loadingCountdown,
            isArrivalOverdue,
            isLoadingOverdue
          },
          mergePartnerInfo,
          additionalInfo,
          timelines: {
            orderDate: order.orderDate,
            loadingDate: order.loadingDate,
            arrivalDate: order.arrivalDate,
            loadingTime: order.loadingTime,
            arrivalTime: order.arrivalTime,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            mergedAt: order.mergedAt,
            completedAt: order.completedAt
          },
          financials: {
            unitPrice: order.unitPrice,
            totalPrice: order.totalPrice,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            driverEarnings: order.driverEarnings
          },
          logistics: {
            driverName: order.driverName,
            driverPhone: order.driverPhone,
            vehicleNumber: order.vehicleNumber,
            deliveryDuration: order.deliveryDuration,
            distance: order.distance
          }
        };
      })
    );

    // الحصول على العدد الإجمالي
    const total = await Order.countDocuments(filter);
    const stats = {
  totalOrders: total,
  bySource: {
    supplier: await Order.countDocuments({
      ...filter,
      orderSource: 'مورد'
    }),

    // ⭐ طلبات العميل + الطلبات المدمجة اللي فيها عميل
    customer: await Order.countDocuments({
      ...filter,
      $or: [
        { orderSource: 'عميل' },
        { orderSource: 'مدمج', customer: { $ne: null } }
      ]
    }),

    merged: await Order.countDocuments({
      ...filter,
      orderSource: 'مدمج'
    })
  },

      byStatus: {
        pending: await Order.countDocuments({ 
          ...filter, 
          status: { 
            $in: ['قيد الإنشاء', 'في انتظار التخصيص', 'في انتظار الدمج'] 
          } 
        }),
        inProgress: await Order.countDocuments({ 
          ...filter, 
          status: { 
            $in: ['تم الإنشاء', 'تم تخصيص طلب المورد', 'تم دمجه مع العميل', 
                  'تم دمجه مع المورد', 'جاهز للتحميل', 'في انتظار التحميل'] 
          } 
        }),
        active: await Order.countDocuments({ 
          ...filter, 
          status: { 
            $in: ['تم التحميل', 'في الطريق'] 
          } 
        }),
        completed: await Order.countDocuments({ 
          ...filter, 
          status: { 
            $in: ['تم التسليم', 'تم التنفيذ', 'مكتمل'] 
          } 
        }),
        cancelled: await Order.countDocuments({ 
          ...filter, 
          status: 'ملغى' 
        })
      }
    };

    res.json({
      success: true,
      orders: ordersWithDisplayInfo,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats,
      filters: req.query
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ 
      success: false,
      error: 'حدث خطأ في السيرفر',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// 🔧 دوال مساعدة محلية
// ============================================

function getOrderSourceText(orderSource) {
  switch(orderSource) {
    case 'مورد': return 'طلب مورد';
    case 'عميل': return 'طلب عميل';
    case 'مدمج': return 'طلب مدمج';
    default: return 'طلب';
  }
}

function getStatusColor(status) {
  const statusColors = {
    // طلبات المورد
    'قيد الإنشاء': '#ff9800',
    'تم الإنشاء': '#2196f3',
    'في انتظار الدمج': '#ff5722',
    'تم دمجه مع العميل': '#9c27b0',
    'جاهز للتحميل': '#00bcd4',
    'تم التحميل': '#4caf50',
    'في الطريق': '#3f51b5',
    'تم التسليم': '#8bc34a',
    
    // طلبات العميل
    'في انتظار التخصيص': '#ff9800',
    'تم تخصيص طلب المورد': '#2196f3',
    'في انتظار الدمج': '#ff5722',
    'تم دمجه مع المورد': '#9c27b0',
    'في انتظار التحميل': '#00bcd4',
    'في الطريق': '#3f51b5',
    'تم التسليم': '#8bc34a',
    
    // طلبات مدمجة
    'تم الدمج': '#9c27b0',
    'مخصص للعميل': '#2196f3',
    'جاهز للتحميل': '#00bcd4',
    'تم التحميل': '#4caf50',
    'في الطريق': '#3f51b5',
    'تم التسليم': '#8bc34a',
    'تم التنفيذ': '#4caf50',
    
    // عامة
    'ملغى': '#f44336',
    'مكتمل': '#8bc34a'
  };
  
  return statusColors[status] || '#757575';
}

function getLocation(order) {
  if (order.city && order.area) {
    return `${order.city} - ${order.area}`;
  }
  return order.city || order.area || 'غير محدد';
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (minutes > 0) parts.push(`${minutes} دقيقة`);
  
  return parts.join(' و ') || 'أقل من دقيقة';
}
// ============================================
// 🔍 جلب طلب محدد
// ============================================

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name code phone email city area address')
      .populate('supplier', 'name company contactPerson phone address email')
      .populate('createdBy', 'name email')
      .populate('driver', 'name phone vehicleNumber licenseNumber')
      .populate('originalOrderId', 'orderNumber orderSource customerName')
      .populate('mergedOrderId', 'orderNumber orderSource customerName');
    
    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    // جلب النشاطات لهذا الطلب
    const activities = await Activity.find({ orderId: order._id })
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 });

    // جلب الطلبات المرتبطة (إذا كان مدمج)
    let relatedOrders = [];
    if (order.mergeStatus === 'مدمج' && order.mergedOrderId) {
      relatedOrders = await Order.find({
        $or: [
          { originalOrderId: order._id },
          { mergedOrderId: order._id }
        ]
      }).populate('customer', 'name code');
    }

    res.json({
      order: {
        ...order.toObject(),
        displayInfo: order.getDisplayInfo ? order.getDisplayInfo() : null
      },
      activities,
      relatedOrders
    });
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// ============================================
// 📅 جلب الطلبات القادمة
// ============================================

exports.getUpcomingOrders = async (req, res) => {
  try {
    const now = new Date();

    // ساعتين قبل الوصول
    const twoHoursBefore = new Date(now.getTime() + (2 * 60 * 60 * 1000));

    // جلب الطلبات المحتملة
    const orders = await Order.find({
      status: { $in: ['في انتظار التحميل', 'جاهز للتحميل', 'مخصص للعميل', 'في الطريق'] },
    })
    .populate('customer', 'name code phone email')
    .populate('supplier', 'name company contactPerson')
    .populate('createdBy', 'name email')
    .populate('driver', 'name phone vehicleNumber');

    const upcomingOrders = [];

    for (const order of orders) {
      const arrivalDateTime = order.getFullArrivalDateTime();

      // الطلب داخل نطاق الإشعار (قبل الوصول بساعتين)
      if (arrivalDateTime > now && arrivalDateTime <= twoHoursBefore) {
        upcomingOrders.push({
          ...order.toObject(),
          arrivalDateTime,
          timeRemaining: formatDuration(arrivalDateTime - now)
        });

        // إرسال الإيميل مرة واحدة فقط
        if (!order.arrivalEmailSentAt) {
          try {
            const timeRemainingMs = arrivalDateTime - now;
            const timeRemaining = formatDuration(timeRemainingMs);

            const emails = await getOrderEmails(order);

            if (!emails || emails.length === 0) {
              console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
            } else {
              await sendEmail({
                to: emails,
                subject: `⏰ تذكير: اقتراب وصول الطلب ${order.orderNumber}`,
                html: EmailTemplates.arrivalReminderTemplate(order, timeRemaining),
              });
            }

            // تحديث وقت الإرسال
            order.arrivalEmailSentAt = new Date();
            await order.save();

            console.log(`📧 Arrival email sent for order ${order.orderNumber}`);
          } catch (emailError) {
            console.error(`❌ Failed to send arrival email for order ${order.orderNumber}:`, emailError.message);
          }
        }
      }
    }

    return res.json(upcomingOrders);
  } catch (error) {
    console.error('Error getting upcoming orders:', error);
    return res.status(500).json({ error: 'حدث خطأ في جلب الطلبات القريبة' });
  }
};

// ============================================
// ⏱️ جلب الطلبات مع المؤقتات
// ============================================

exports.getOrdersWithTimers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.orderSource) {
      filter.orderSource = req.query.orderSource;
    }

    if (req.query.supplierName) {
      filter.supplierName = new RegExp(req.query.supplierName, 'i');
    }

    if (req.query.customerName) {
      filter.customerName = new RegExp(req.query.customerName, 'i');
    }

    // جلب الطلبات
    const orders = await Order.find(filter)
      .populate('customer', 'name code email')
      .populate('supplier', 'name company contactPerson')
      .populate('driver', 'name phone vehicleNumber')
      .populate('createdBy', 'name email')
      .sort({ arrivalDate: 1, arrivalTime: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);
    const now = new Date();

    const ordersWithTimers = [];

    for (const order of orders) {
      const arrivalDateTime = order.getFullArrivalDateTime();
      const loadingDateTime = order.getFullLoadingDateTime();

      const arrivalRemaining = arrivalDateTime - now;
      const loadingRemaining = loadingDateTime - now;

      const arrivalCountdown = arrivalRemaining > 0 ? formatDuration(arrivalRemaining) : 'تأخر';
      const loadingCountdown = loadingRemaining > 0 ? formatDuration(loadingRemaining) : 'تأخر';

      // قبل الوصول بساعتين ونصف
      const isApproachingArrival = arrivalRemaining > 0 && arrivalRemaining <= 2.5 * 60 * 60 * 1000;
      const isApproachingLoading = loadingRemaining > 0 && loadingRemaining <= 2.5 * 60 * 60 * 1000;

      // إرسال الإيميل (مرة واحدة فقط)
      if (isApproachingArrival && !order.arrivalEmailSentAt) {
        try {
          const emails = await getOrderEmails(order);

          if (!emails || emails.length === 0) {
            console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
          } else {
            await sendEmail({
              to: emails,
              subject: `⏰ تذكير: اقتراب وصول الطلب ${order.orderNumber}`,
              html: EmailTemplates.arrivalReminderTemplate(order, formatDuration(arrivalRemaining)),
            });
          }

          order.arrivalEmailSentAt = new Date();
          await order.save();

          console.log(`📧 Arrival reminder email sent for order ${order.orderNumber}`);
        } catch (emailError) {
          console.error(`❌ Failed to send arrival email for order ${order.orderNumber}:`, emailError.message);
        }
      }

      ordersWithTimers.push({
        ...order.toObject(),
        displayInfo: order.getDisplayInfo ? order.getDisplayInfo() : null,
        arrivalDateTime,
        loadingDateTime,
        arrivalRemaining,
        loadingRemaining,
        arrivalCountdown,
        loadingCountdown,
        needsArrivalNotification: isApproachingArrival && !order.arrivalEmailSentAt,
        isApproachingArrival,
        isApproachingLoading,
        isArrivalOverdue: arrivalRemaining < 0,
        isLoadingOverdue: loadingRemaining < 0
      });
    }

    return res.json({
      orders: ordersWithTimers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error getting orders with timers:', error);
    return res.status(500).json({ error: 'حدث خطأ في جلب الطلبات' });
  }
};

// ============================================
// 🔔 إرسال تذكير بالوصول
// ============================================

exports.sendArrivalReminder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('customer', 'name email phone')
      .populate('supplier', 'name email contactPerson')
      .populate('createdBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const User = require('../models/User');
    const Notification = require('../models/Notification');
    const Activity = require('../models/Activity');

    // المستخدمين المستهدفين (منشئ الطلب + الإداريين + العميل إذا كان له إيميل)
    const usersToNotify = await User.find({
      $or: [
        { _id: order.createdBy?._id },
        { role: { $in: ['admin', 'manager'] } }
      ],
      isActive: true
    });

    if (usersToNotify.length === 0) {
      return res.status(400).json({ error: 'لا يوجد مستخدمون للإشعار' });
    }

    const arrivalDateTime = order.getFullArrivalDateTime();
    const timeRemainingMs = arrivalDateTime - new Date();
    const timeRemaining = formatDuration(timeRemainingMs);

    // إنشاء Notification
    const notification = new Notification({
      type: 'arrival_reminder',
      title: 'تذكير بقرب وقت الوصول',
      message: `الطلب رقم ${order.orderNumber} (${order.customerName}) سيصل خلال ${timeRemaining}`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        supplierName: order.supplierName,
        arrivalTime: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
        timeRemaining,
        isManual: true
      },
      recipients: usersToNotify.map(user => ({ user: user._id })),
      createdBy: req.user._id
    });

    await notification.save();

    // إرسال الإيميل
    try {
      const emails = await getOrderEmails(order);

      if (!emails || emails.length === 0) {
        console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
      } else {
        await sendEmail({
          to: emails,
          subject: `⏰ تذكير بوصول الطلب ${order.orderNumber}`,
          html: EmailTemplates.arrivalReminderTemplate(order, timeRemaining),
        });
      }
    } catch (emailError) {
      console.error(`❌ Failed to send arrival reminder email for order ${order.orderNumber}:`, emailError.message);
    }

    // تحديث حالة الإرسال
    order.arrivalNotificationSentAt = new Date();
    order.arrivalEmailSentAt = new Date();
    await order.save();

    // تسجيل النشاط
    const activity = new Activity({
      orderId: order._id,
      activityType: 'إشعار',
      description: `تم إرسال إشعار وإيميل تذكير قبل الوصول للطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'وقت الإشعار': new Date().toLocaleString('ar-SA'),
        'وقت الوصول المتبقي': timeRemaining
      }
    });
    await activity.save();

    return res.json({
      message: 'تم إرسال الإشعار والإيميل بنجاح',
      notification,
      timeRemaining
    });

  } catch (error) {
    console.error('Error sending arrival reminder:', error);
    return res.status(500).json({ error: 'حدث خطأ في إرسال الإشعار' });
  }
};

// ============================================
// ✏️ تحديث الطلب
// ============================================

exports.updateOrder = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const order = await Order.findById(req.params.id)
        .populate('customer', 'name code phone email city area address')
        .populate('supplier', 'name company contactPerson phone address');

      if (!order) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }

      // الحقول المسموح تعديلها
      const allowedUpdates = [
        'driver', 'driverName', 'driverPhone', 'vehicleNumber',
        'notes', 'supplierNotes', 'customerNotes', 'internalNotes',
        'actualArrivalTime', 'loadingDuration', 'delayReason',
        'quantity', 'unit', 'fuelType', 'productType',
        'unitPrice', 'totalPrice', 'paymentMethod', 'paymentStatus',
        'city', 'area', 'address',
        'loadingDate', 'loadingTime', 'arrivalDate', 'arrivalTime',
        'status', 'mergeStatus'
      ];

      const updates = {};
      Object.keys(req.body).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key] !== undefined ? req.body[key] : null;
        }
      });

      // معالجة تغيير السائق
      if ('driver' in updates) {
        if (updates.driver) {
          const driver = await Driver.findById(updates.driver);
          if (driver) {
            updates.driverName = driver.name;
            updates.driverPhone = driver.phone;
            updates.vehicleNumber = driver.vehicleNumber;
          }
        } else {
          updates.driverName = null;
          updates.driverPhone = null;
          updates.vehicleNumber = null;
        }
      }

      // معالجة تغيير الموقع
      if (('city' in updates || 'area' in updates || 'address' in updates) && 
          order.customer && typeof order.customer === 'object') {
        // تحديث بيانات العميل مع الموقع الجديد
        await Customer.findByIdAndUpdate(order.customer._id, {
          city: updates.city || order.customer.city,
          area: updates.area || order.customer.area,
          address: updates.address || order.customer.address
        });
      }

      // معالجة التواريخ
      if (updates.loadingDate) updates.loadingDate = new Date(updates.loadingDate);
      if (updates.arrivalDate) updates.arrivalDate = new Date(updates.arrivalDate);

      // معالجة الملفات
      if (req.files) {
        if (req.files.attachments) {
          const newAttachments = req.files.attachments.map((file) => ({
            filename: file.originalname,
            path: file.path,
            uploadedAt: new Date(),
            uploadedBy: req.user._id
          }));
          updates.attachments = [...order.attachments, ...newAttachments];
        }

        if (req.files.supplierDocuments) {
          const newDocs = req.files.supplierDocuments.map((file) => ({
            type: 'أخرى',
            filename: file.originalname,
            path: file.path,
            uploadedAt: new Date()
          }));
          updates.supplierDocuments = [...order.supplierDocuments, ...newDocs];
        }

        if (req.files.customerDocuments) {
          const newDocs = req.files.customerDocuments.map((file) => ({
            type: 'أخرى',
            filename: file.originalname,
            path: file.path,
            uploadedAt: new Date()
          }));
          updates.customerDocuments = [...order.customerDocuments, ...newDocs];
        }
      }

      // معالجة وقت الوصول الفعلي
      if ('actualArrivalTime' in updates) {
        if (updates.actualArrivalTime) {
          const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
          if (!timeRegex.test(updates.actualArrivalTime)) {
            return res.status(400).json({
              error: 'تنسيق الوقت غير صحيح. استخدم HH:MM',
            });
          }

          if (['جاهز للتحميل', 'في انتظار التحميل', 'في الطريق'].includes(order.status)) {
            order.loadingCompletedAt = new Date();
            if (!updates.status) {
              updates.status = 'تم التحميل';
            }
          }
        }
      }

      // حفظ القيم القديمة
      const oldData = { ...order.toObject() };

      // تحديث الطلب
      Object.assign(order, updates);
      order.updatedAt = new Date();
      await order.save();

      // حساب التغييرات
      const changes = {};
      const excludedKeys = ['attachments', 'supplierDocuments', 'customerDocuments', 'updatedAt'];
      
      Object.keys(updates).forEach((key) => {
        if (!excludedKeys.includes(key)) {
          const oldVal = oldData[key];
          const newVal = updates[key];

          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            const oldStr = oldVal !== null && oldVal !== undefined && oldVal !== '' ? 
              (typeof oldVal === 'object' ? JSON.stringify(oldVal) : oldVal.toString()) : 'غير محدد';

            const newStr = newVal !== null && newVal !== undefined && newVal !== '' ? 
              (typeof newVal === 'object' ? JSON.stringify(newVal) : newVal.toString()) : 'غير محدد';

            changes[key] = `من: ${oldStr} → إلى: ${newStr}`;
          }
        }
      });

      // تسجيل Activity
      if (Object.keys(changes).length > 0) {
        const activity = new Activity({
          orderId: order._id,
          activityType: 'تعديل',
          description: `تم تعديل الطلب رقم ${order.orderNumber}`,
          performedBy: req.user._id,
          performedByName: req.user.name,
          changes,
        });
        await activity.save();
      }

      // إرسال الإيميل
      if (Object.keys(changes).length > 0) {
        try {
          const populatedForEmail = await Order.findById(order._id)
            .populate('customer', 'name email')
            .populate('supplier', 'name email contactPerson')
            .populate('createdBy', 'name email');

          const emails = await getOrderEmails(populatedForEmail);

          if (!emails || emails.length === 0) {
            console.log(`⚠️ No valid emails for order update - order ${order.orderNumber}`);
          } else {
            await sendEmail({
              to: emails,
              subject: `✏️ تحديث على الطلب ${order.orderNumber}`,
              html: EmailTemplates.orderUpdatedTemplate(populatedForEmail, changes, req.user.name),
            });
          }
        } catch (emailError) {
          console.error('❌ Failed to send update email:', emailError.message);
        }
      }

      // إرجاع البيانات
      const populatedOrder = await Order.findById(order._id)
        .populate('customer', 'name code phone email city area address')
        .populate('supplier', 'name company contactPerson phone address')
        .populate('createdBy', 'name email')
        .populate('driver', 'name phone vehicleNumber');

      return res.json({
        message: 'تم تحديث الطلب بنجاح',
        order: {
          ...populatedOrder.toObject(),
          displayInfo: populatedOrder.getDisplayInfo ? populatedOrder.getDisplayInfo() : null
        },
        changes: Object.keys(changes).length > 0 ? changes : null,
      });
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// ============================================
// 🔄 تحديث حالة الطلب
// ============================================

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const order = await Order.findById(id)
      .populate('customer', 'name email phone')
      .populate('supplier', 'name email contactPerson phone')
      .populate('createdBy', 'name email')
      .populate('driver', 'name phone vehicleNumber');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const oldStatus = order.status;

    // التحقق من أن الحالة لم تتغير
    if (oldStatus === status) {
      return res.json({
        message: 'الحالة لم تتغير',
        order,
      });
    }

    // ============================================
    // 🔐 التحقق من الصلاحيات
    // ============================================
    const user = req.user;
    
    if (user.role !== 'admin' && user.role !== 'manager') {
      if (user.role === 'driver') {
        // السماح للسائق فقط بتغيير حالات معينة
        const allowedDriverStatuses = ['في الطريق', 'تم التسليم', 'تم التحميل'];
        if (!allowedDriverStatuses.includes(status)) {
          return res.status(403).json({ 
            error: 'غير مصرح للسائق بتغيير الحالة إلى هذا الوضع' 
          });
        }
        
        // التحقق من أن السائق هو المسؤول عن هذا الطلب
        if (order.driver && order.driver._id.toString() !== user._id.toString()) {
          return res.status(403).json({ 
            error: 'أنت لست السائق المسؤول عن هذا الطلب' 
          });
        }
      } else {
        return res.status(403).json({ 
          error: 'غير مصرح لك بتغيير حالة الطلب' 
        });
      }
    }

    // ============================================
    // 🔄 التحقق من التسلسل المنطقي للحالات
    // ============================================
    const statusFlow = {
      // ========== طلبات المورد ==========
      'قيد الإنشاء': ['تم الإنشاء', 'ملغى'],
      'تم الإنشاء': ['في انتظار الدمج', 'ملغى'],
      'في انتظار الدمج': ['تم دمجه مع العميل', 'ملغى'],
      'تم دمجه مع العميل': ['جاهز للتحميل', 'ملغى'],
      'جاهز للتحميل': ['تم التحميل', 'ملغى'],
      'تم التحميل': ['في الطريق', 'ملغى'],
      'في الطريق': ['تم التسليم', 'ملغى'],
      'تم التسليم': ['مكتمل'],
      
      // ========== طلبات العميل ==========
      'في انتظار التخصيص': ['تم تخصيص طلب المورد', 'ملغى'],
      'تم تخصيص طلب المورد': ['في انتظار الدمج', 'ملغى'],
      'في انتظار الدمج': ['تم دمجه مع المورد', 'ملغى'],
      'تم دمجه مع المورد': ['في انتظار التحميل', 'ملغى'],
      'في انتظار التحميل': ['في الطريق', 'ملغى'],
      'في الطريق': ['تم التسليم', 'ملغى'],
      'تم التسليم': ['مكتمل'],
      
      // ========== طلبات مدمجة ==========
      'تم الدمج': ['مخصص للعميل', 'ملغى'],
      'مخصص للعميل': ['جاهز للتحميل', 'ملغى'],
      'جاهز للتحميل': ['تم التحميل', 'ملغى'],
      'تم التحميل': ['في الطريق', 'ملغى'],
      'في الطريق': ['تم التسليم', 'ملغى'],
      'تم التسليم': ['تم التنفيذ', 'ملغى'],
'تم التنفيذ': ['مكتمل'],
    };

    // التحقق من أن الانتقال مسموح
    if (!statusFlow[oldStatus] || !statusFlow[oldStatus].includes(status)) {
      return res.status(400).json({
        error: `غير مسموح بتغيير الحالة من "${oldStatus}" إلى "${status}"`,
        allowedStatuses: statusFlow[oldStatus] || []
      });
    }

    // ============================================
    // 📝 تحديث الحالة ومعالجة الحالات الخاصة
    // ============================================
    order.status = status;
    order.updatedAt = new Date();

    switch(status) {
      case 'تم التحميل':
        order.loadingCompletedAt = new Date();
        if (order.driver) {
          try {
            // تحديث إحصائيات السائق
            await mongoose.model('Driver').findByIdAndUpdate(
              order.driver._id,
              {
                $inc: {
                  totalDeliveries: 1,
                  totalEarnings: order.driverEarnings || 0,
                  totalDistance: order.distance || 0
                }
              }
            );
          } catch (statsError) {
            console.error('❌ Error updating driver stats:', statsError);
          }
        }
        break;
        
      case 'في الطريق':
        // بدء التتبع
        order.trackingStartedAt = new Date();
        break;
        
      case 'تم التسليم':
        order.completedAt = new Date();
        order.actualArrivalTime = new Date().toLocaleTimeString('ar-SA', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        break;
        
      case 'تم التنفيذ':
        order.completedAt = new Date();
        break;
        
      case 'ملغى':
        order.cancelledAt = new Date();
        if (reason) {
          order.cancellationReason = reason;
          order.notes = (order.notes || '') + `\nسبب الإلغاء: ${reason}`;
        }
        break;
        
      case 'مكتمل':
        order.completedAt = new Date();
        order.mergeStatus = 'مكتمل';
        break;
    }

    // ============================================
    // 💾 حفظ التغييرات
    // ============================================
    await order.save();

    // ============================================
    // 📋 تسجيل النشاط
    // ============================================
    const activity = new Activity({
      orderId: order._id,
      activityType: 'تغيير حالة',
      description: `تم تغيير حالة الطلب رقم ${order.orderNumber} من "${oldStatus}" إلى "${status}"`,
      performedBy: user._id,
      performedByName: user.name,
      changes: {
        الحالة: `من: ${oldStatus} → إلى: ${status}`,
        ...(reason ? { 'سبب التغيير': reason } : {}),
        ...(status === 'تم التحميل' ? { 'وقت التحميل الفعلي': new Date().toLocaleString('ar-SA') } : {}),
        ...(status === 'تم التسليم' ? { 'وقت التسليم الفعلي': new Date().toLocaleString('ar-SA') } : {})
      },
    });
    await activity.save();

    // ============================================
    // 📧 إرسال الإيميلات
    // ============================================
    try {
      const emails = await getOrderEmails(order);

      if (!emails || emails.length === 0) {
        console.log(`⚠️ No valid emails for order status update - order ${order.orderNumber}`);
      } else {
        // تحديد قالب الإيميل المناسب
        let emailTemplate;
        
        if (status === 'تم دمجه مع العميل' || status === 'تم تخصيص طلب المورد') {
          // إيميل خاص بالدمج
          const partnerInfo = await order.getMergePartnerInfo();
          if (partnerInfo) {
            if (order.orderSource === 'مورد') {
              emailTemplate = EmailTemplates.mergeSupplierTemplate(order, partnerInfo);
            } else {
              emailTemplate = EmailTemplates.mergeCustomerTemplate(order, partnerInfo);
            }
          } else {
            emailTemplate = EmailTemplates.orderStatusTemplate(order, oldStatus, status, user.name, reason);
          }
        } else {
          // إيميل حالة عادي
          emailTemplate = EmailTemplates.orderStatusTemplate(order, oldStatus, status, user.name, reason);
        }

        await sendEmail({
          to: emails,
          subject: `🔄 تحديث حالة الطلب ${order.orderNumber}`,
          html: emailTemplate,
        });
        
        console.log(`📧 Status update email sent for order ${order.orderNumber}`);
      }
    } catch (emailError) {
      console.error('❌ Failed to send order status email:', emailError.message);
    }

    // ============================================
    // 🔔 إرسال إشعارات إذا لزم الأمر
    // ============================================
    if (['في الطريق', 'تم التسليم', 'تم التحميل'].includes(status)) {
      try {
        const Notification = require('../models/Notification');
        const User = require('../models/User');
        
        // مستخدمين للإشعار (المسؤولين + صاحب الطلب)
        const usersToNotify = await User.find({
          $or: [
            { role: { $in: ['admin', 'manager'] } },
            { _id: order.createdBy?._id }
          ],
          isActive: true
        });

        if (usersToNotify.length > 0) {
          const notification = new Notification({
            type: 'order_status_update',
            title: `تحديث حالة الطلب ${order.orderNumber}`,
            message: `تم تحديث حالة الطلب ${order.orderNumber} إلى "${status}"`,
            data: {
              orderId: order._id,
              orderNumber: order.orderNumber,
              oldStatus,
              newStatus: status,
              updatedBy: user.name,
              customerName: order.customerName,
              supplierName: order.supplierName
            },
            recipients: usersToNotify.map(u => ({ user: u._id })),
            createdBy: user._id
          });
          
          await notification.save();
        }
      } catch (notifError) {
        console.error('❌ Failed to create notification:', notifError.message);
      }
    }

    // ============================================
    // 📦 تحديث الطلب المدمج المرتبط إذا وجد
    // ============================================
    if (order.mergedWithOrderId && ['تم التسليم', 'تم التحميل', 'في الطريق'].includes(status)) {
      try {
        const mergedOrder = await Order.findById(order.mergedWithOrderId);
        if (mergedOrder) {
          // تحديث حالة الطلب المدمج بناءً على حالة الطلب الحالي
          if (status === 'تم التسليم' && mergedOrder.status !== 'تم التسليم') {
            mergedOrder.status = 'تم التسليم';
            mergedOrder.completedAt = new Date();
            await mergedOrder.save();
            
            // تسجيل نشاط في الطلب المدمج
            const mergedActivity = new Activity({
              orderId: mergedOrder._id,
              activityType: 'تغيير حالة',
              description: `تم تحديث حالة الطلب المدمج تلقائياً إلى "تم التسليم" بناءً على حالة الطلب ${order.orderNumber}`,
              performedBy: user._id,
              performedByName: user.name
            });
            await mergedActivity.save();
          }
        }
      } catch (mergeError) {
        console.error('❌ Error updating merged order:', mergeError.message);
      }
    }

    // ============================================
    // 📊 إرجاع النتيجة
    // ============================================
    const updatedOrder = await Order.findById(order._id)
      .populate('customer', 'name code phone email')
      .populate('supplier', 'name company contactPerson phone')
      .populate('driver', 'name phone vehicleNumber')
      .populate('createdBy', 'name email');

    return res.json({
      success: true,
      message: 'تم تحديث حالة الطلب بنجاح',
      data: {
        order: {
          ...updatedOrder.toObject(),
          displayInfo: updatedOrder.getDisplayInfo ? updatedOrder.getDisplayInfo() : null
        },
        oldStatus,
        newStatus: status,
        updatedBy: {
          id: user._id,
          name: user.name,
          role: user.role
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error updating order status:', error);
    return res.status(500).json({ 
      error: 'حدث خطأ في السيرفر',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// ============================================
// 🔗 دمج الطلبات - محدثة حسب المتطلبات
// ============================================

exports.mergeOrders = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { supplierOrderId, customerOrderId } = req.body;

    // =========================
    // 1️⃣ التحقق من المدخلات
    // =========================
    if (!supplierOrderId || !customerOrderId) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'معرف طلب المورد ومعرف طلب العميل مطلوبان',
      });
    }

    if (supplierOrderId === customerOrderId) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'لا يمكن دمج الطلب مع نفسه',
      });
    }

    // =========================
    // 2️⃣ جلب الطلبات مع session
    // =========================
    const supplierOrder = await Order.findById(supplierOrderId).session(session);
    const customerOrder = await Order.findById(customerOrderId).session(session);

    if (!supplierOrder || !customerOrder) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(404).json({
        success: false,
        message: 'أحد الطلبات غير موجود',
      });
    }

    // =========================
    // 3️⃣ التحقق من أنواع الطلبات
    // =========================
    if (supplierOrder.orderSource !== 'مورد') {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'الطلب الأول يجب أن يكون طلب مورد',
      });
    }

    if (customerOrder.orderSource !== 'عميل') {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'الطلب الثاني يجب أن يكون طلب عميل',
      });
    }

    // =========================
    // 4️⃣ التحقق من حالة الدمج
    // =========================
    if (supplierOrder.mergeStatus !== 'منفصل' || customerOrder.mergeStatus !== 'منفصل') {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'أحد الطلبات تم دمجه مسبقًا',
      });
    }

    // =========================
    // 5️⃣ التحقق من التوافق
    // =========================
    if (supplierOrder.fuelType !== customerOrder.fuelType) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'نوع الوقود غير متطابق',
      });
    }

    const supplierQty = Number(supplierOrder.quantity || 0);
    const customerQty = Number(customerOrder.quantity || 0);

    if (supplierQty < customerQty) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'كمية المورد أقل من كمية طلب العميل',
      });
    }

    // =========================
    // 6️⃣ إنشاء رقم الطلب المدموج
    // =========================
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const mergedOrderNumber = `MIX-${y}${m}${d}-${rand}`;

    // =========================
    // 7️⃣ تحديد الموقع
    // =========================
    let city, area, address;

    if (customerOrder.city && customerOrder.area) {
      city = customerOrder.city;
      area = customerOrder.area;
      address = customerOrder.address || `${city} - ${area}`;
    } else if (supplierOrder.city && supplierOrder.area) {
      city = supplierOrder.city;
      area = supplierOrder.area;
      address = supplierOrder.address || `${city} - ${area}`;
    } else {
      city = 'غير محدد';
      area = 'غير محدد';
      address = 'غير محدد';
    }

    // =========================
    // 8️⃣ إنشاء الطلب المدموج
    // =========================
    const mergedOrderData = {
      orderSource: 'مدمج',
      mergeStatus: 'مدمج',
      orderNumber: mergedOrderNumber,
      
      // معلومات الدمج
      mergedWithOrderId: null,
      mergedWithInfo: {
        supplierOrderNumber: supplierOrder.orderNumber,
        customerOrderNumber: customerOrder.orderNumber,
        supplierName: supplierOrder.supplierName,
        customerName: customerOrder.customerName,
        mergedAt: new Date()
      },
      
      // معلومات المورد
      supplierOrderNumber: supplierOrder.supplierOrderNumber,
      supplier: supplierOrder.supplier,
      supplierName: supplierOrder.supplierName,
      supplierPhone: supplierOrder.supplierPhone,
      supplierCompany: supplierOrder.supplierCompany,
      supplierContactPerson: supplierOrder.supplierContactPerson,
      supplierAddress: supplierOrder.supplierAddress,
      
      // معلومات العميل
      customer: customerOrder.customer,
      customerName: customerOrder.customerName,
      customerCode: customerOrder.customerCode,
      customerPhone: customerOrder.customerPhone,
      customerEmail: customerOrder.customerEmail,
      
      // معلومات المنتج
      productType: supplierOrder.productType,
      fuelType: supplierOrder.fuelType,
      quantity: customerQty,
      unit: supplierOrder.unit || 'لتر',
      
      // معلومات الموقع
      city,
      area,
      address,
      
      // معلومات التوقيت
      orderDate: new Date(),
      loadingDate: supplierOrder.loadingDate || new Date(),
      loadingTime: supplierOrder.loadingTime || '08:00',
      arrivalDate: customerOrder.arrivalDate || new Date(),
      arrivalTime: customerOrder.arrivalTime || '10:00',
      
      // معلومات الشحن
      driver: supplierOrder.driver,
      driverName: supplierOrder.driverName,
      driverPhone: supplierOrder.driverPhone,
      vehicleNumber: supplierOrder.vehicleNumber,
      
      // معلومات السعر
      unitPrice: supplierOrder.unitPrice,
      totalPrice: supplierOrder.unitPrice ? supplierOrder.unitPrice * customerQty : 0,
      paymentMethod: supplierOrder.paymentMethod,
      paymentStatus: supplierOrder.paymentStatus,
      
      // حالة الطلب المدمج
      status: 'تم الدمج',
      
      // ملاحظات
      notes: `طلب مدمج من:\n• طلب المورد: ${supplierOrder.orderNumber} (${supplierOrder.supplierName})\n• طلب العميل: ${customerOrder.orderNumber} (${customerOrder.customerName})\n${supplierOrder.notes ? 'ملاحظات المورد: ' + supplierOrder.notes + '\n' : ''}${customerOrder.notes ? 'ملاحظات العميل: ' + customerOrder.notes : ''}`.trim(),
      
      supplierNotes: supplierOrder.supplierNotes,
      customerNotes: customerOrder.customerNotes,
      
      // معلومات الإنشاء
      createdBy: req.user._id,
      createdByName: req.user.name || 'النظام',
      
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mergedOrder = new Order(mergedOrderData);
    await mergedOrder.save({ session });

    // =========================
    // 9️⃣ تحديث الطلبات الأصلية
    // =========================
    
    // تحديث طلب المورد
    supplierOrder.mergeStatus = 'مدمج';
    supplierOrder.status = 'تم دمجه مع العميل';
    supplierOrder.mergedWithOrderId = mergedOrder._id;
    supplierOrder.mergedWithInfo = {
      orderNumber: customerOrder.orderNumber,
      partyName: customerOrder.customerName,
      partyType: 'عميل',
      mergedAt: new Date()
    };
    supplierOrder.mergedAt = new Date();
    supplierOrder.updatedAt = new Date();
    supplierOrder.notes = (supplierOrder.notes || '') + 
      `\n[${new Date().toLocaleString('ar-SA')}] تم دمجه مع طلب العميل: ${customerOrder.orderNumber} (${customerOrder.customerName})`;
    
    await supplierOrder.save({ session });

    // تحديث طلب العميل
    customerOrder.mergeStatus = 'مدمج';
    customerOrder.status = 'تم دمجه مع المورد';
    customerOrder.mergedWithOrderId = mergedOrder._id;
    customerOrder.mergedWithInfo = {
      orderNumber: supplierOrder.orderNumber,
      partyName: supplierOrder.supplierName,
      partyType: 'مورد',
      mergedAt: new Date()
    };
    customerOrder.supplierOrderNumber = supplierOrder.supplierOrderNumber;
    customerOrder.mergedAt = new Date();
    customerOrder.updatedAt = new Date();
    customerOrder.notes = (customerOrder.notes || '') + 
      `\n[${new Date().toLocaleString('ar-SA')}] تم دمجه مع طلب المورد: ${supplierOrder.orderNumber} (${supplierOrder.supplierName})`;
    
    await customerOrder.save({ session });

    // =========================
    // 🔟 تسجيل النشاطات
    // =========================
    try {
      // نشاط للطلب المدموج
      const mergedActivity = new Activity({
        orderId: mergedOrder._id,
        activityType: 'دمج',
        description: `تم دمج طلب المورد ${supplierOrder.orderNumber} مع طلب العميل ${customerOrder.orderNumber}`,
        details: {
          supplierOrder: supplierOrder.orderNumber,
          customerOrder: customerOrder.orderNumber,
          mergedBy: req.user.name || 'النظام',
          quantity: customerQty,
          fuelType: supplierOrder.fuelType
        },
        performedBy: req.user._id,
        performedByName: req.user.name || 'النظام',
      });
      await mergedActivity.save({ session });

      // نشاط لطلب المورد
      const supplierActivity = new Activity({
        orderId: supplierOrder._id,
        activityType: 'دمج',
        description: `تم دمج الطلب مع طلب العميل ${customerOrder.orderNumber} (${customerOrder.customerName})`,
        details: {
          mergedOrder: mergedOrder.orderNumber,
          customerOrder: customerOrder.orderNumber,
          customerName: customerOrder.customerName,
          mergedBy: req.user.name || 'النظام'
        },
        performedBy: req.user._id,
        performedByName: req.user.name || 'النظام',
      });
      await supplierActivity.save({ session });

      // نشاط لطلب العميل
      const customerActivity = new Activity({
        orderId: customerOrder._id,
        activityType: 'دمج',
        description: `تم دمج الطلب مع طلب المورد ${supplierOrder.orderNumber} (${supplierOrder.supplierName})`,
        details: {
          mergedOrder: mergedOrder.orderNumber,
          supplierOrder: supplierOrder.orderNumber,
          supplierName: supplierOrder.supplierName,
          mergedBy: req.user.name || 'النظام'
        },
        performedBy: req.user._id,
        performedByName: req.user.name || 'النظام',
      });
      await customerActivity.save({ session });

    } catch (err) {
      console.warn('⚠️ بعض النشاطات لم يتم حفظها:', err.message);
    }

    // =========================
    // 📧 إرسال الإيميلات
    // =========================
    try {
      const sendEmailPromises = [];
      
      // إيميل للمورد
      if (supplierOrder.supplierEmail || supplierOrder.supplier?.email) {
        const supplierEmail = supplierOrder.supplierEmail || supplierOrder.supplier?.email;
        const emailTemplate = `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #4CAF50;">✅ تم دمج طلبك مع عميل</h2>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>تفاصيل الدمج</h3>
              <p><strong>رقم طلبك:</strong> ${supplierOrder.orderNumber}</p>
              <p><strong>اسم العميل:</strong> ${customerOrder.customerName}</p>
              <p><strong>رقم طلب العميل:</strong> ${customerOrder.orderNumber}</p>
              <p><strong>الكمية:</strong> ${customerQty} ${supplierOrder.unit}</p>
              <p><strong>نوع الوقود:</strong> ${supplierOrder.fuelType}</p>
              <p><strong>رقم الطلب المدموج:</strong> ${mergedOrder.orderNumber}</p>
            </div>
            <p>تم تحديث حالة طلبك إلى: <strong style="color: #9c27b0;">تم دمجه مع العميل</strong></p>
          </div>
        `;
        
        sendEmailPromises.push(
          sendEmail({
            to: supplierEmail,
            subject: `✅ تم دمج طلبك ${supplierOrder.orderNumber} مع عميل`,
            html: emailTemplate,
          })
        );
      }
      
      // إيميل للعميل
      if (customerOrder.customerEmail) {
        const emailTemplate = `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #4CAF50;">✅ تم تخصيص مورد لطلبك</h2>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>تفاصيل التخصيص</h3>
              <p><strong>رقم طلبك:</strong> ${customerOrder.orderNumber}</p>
              <p><strong>اسم المورد:</strong> ${supplierOrder.supplierName}</p>
              <p><strong>رقم طلب المورد:</strong> ${supplierOrder.orderNumber}</p>
              <p><strong>رقم طلب المورد (الخاص بالمورد):</strong> ${supplierOrder.supplierOrderNumber}</p>
              <p><strong>الكمية:</strong> ${customerQty} ${supplierOrder.unit}</p>
              <p><strong>نوع الوقود:</strong> ${supplierOrder.fuelType}</p>
              <p><strong>رقم الطلب المدموج:</strong> ${mergedOrder.orderNumber}</p>
            </div>
            <p>تم تحديث حالة طلبك إلى: <strong style="color: #9c27b0;">تم دمجه مع المورد</strong></p>
          </div>
        `;
        
        sendEmailPromises.push(
          sendEmail({
            to: customerOrder.customerEmail,
            subject: `✅ تم تخصيص مورد لطلبك ${customerOrder.orderNumber}`,
            html: emailTemplate,
          })
        );
      }
      
      // إيميل للمسؤولين
      const adminUsers = await mongoose.model('User').find({
        role: { $in: ['admin', 'manager'] },
        isActive: true,
        email: { $exists: true, $ne: '' }
      }).session(session);
      
      if (adminUsers.length > 0) {
        const adminEmails = adminUsers.map(user => user.email);
        const adminEmailTemplate = `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2196F3;">📋 تقرير دمج طلبات</h2>
            <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>تفاصيل الدمج</h3>
              <p><strong>تم بواسطة:</strong> ${req.user.name || 'النظام'}</p>
              <p><strong>وقت الدمج:</strong> ${new Date().toLocaleString('ar-SA')}</p>
              <hr>
              <p><strong>طلب المورد:</strong> ${supplierOrder.orderNumber} (${supplierOrder.supplierName})</p>
              <p><strong>طلب العميل:</strong> ${customerOrder.orderNumber} (${customerOrder.customerName})</p>
              <p><strong>الطلب المدموج:</strong> ${mergedOrder.orderNumber}</p>
              <p><strong>الكمية:</strong> ${customerQty} ${supplierOrder.unit}</p>
              <p><strong>القيمة:</strong> ${mergedOrder.totalPrice ? mergedOrder.totalPrice.toLocaleString('ar-SA') : 0} ريال</p>
            </div>
          </div>
        `;
        
        sendEmailPromises.push(
          sendEmail({
            to: adminEmails,
            subject: `📋 تم دمج طلبين: ${supplierOrder.orderNumber} مع ${customerOrder.orderNumber}`,
            html: adminEmailTemplate,
          })
        );
      }
      
      // إرسال جميع الإيميلات
      await Promise.all(sendEmailPromises);
      
    } catch (emailError) {
      console.error('❌ Failed to send merge emails:', emailError.message);
      // لا نوقف العملية إذا فشل الإيميل
    }

    // =========================
    // ✅ تأكيد العملية
    // =========================
    await session.commitTransaction();
    session.endSession();

    // =========================
    // 📊 الاستجابة
    // =========================
    return res.status(200).json({
      success: true,
      message: 'تم دمج الطلبات بنجاح',
      data: {
        mergedOrder: {
          _id: mergedOrder._id,
          orderNumber: mergedOrder.orderNumber,
          status: mergedOrder.status,
          mergeStatus: mergedOrder.mergeStatus,
          supplierName: mergedOrder.supplierName,
          customerName: mergedOrder.customerName,
          quantity: mergedOrder.quantity,
          unit: mergedOrder.unit,
          fuelType: mergedOrder.fuelType,
          totalPrice: mergedOrder.totalPrice,
          createdAt: mergedOrder.createdAt
        },
        supplierOrder: {
          _id: supplierOrder._id,
          orderNumber: supplierOrder.orderNumber,
          status: supplierOrder.status,
          mergeStatus: supplierOrder.mergeStatus,
          mergedWith: supplierOrder.mergedWithInfo,
          updatedAt: supplierOrder.updatedAt
        },
        customerOrder: {
          _id: customerOrder._id,
          orderNumber: customerOrder.orderNumber,
          status: customerOrder.status,
          mergeStatus: customerOrder.mergeStatus,
          mergedWith: customerOrder.mergedWithInfo,
          supplierOrderNumber: customerOrder.supplierOrderNumber,
          updatedAt: customerOrder.updatedAt
        }
      }
    });

  } catch (error) {
    // =========================
    // ❌ معالجة الأخطاء
    // =========================
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ Error merging orders:', error);
    
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء دمج الطلبات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



// ============================================
// 🗑️ حذف الطلب
// ============================================

exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email')
      .populate('supplier', 'name email contactPerson')
      .populate('createdBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    // السماح فقط للإداريين بالحذف
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح بحذف الطلب' });
    }

    // التحقق من حالة الدمج
    if (order.mergeStatus === 'مدمج') {
      return res.status(400).json({ 
        error: 'لا يمكن حذف طلب مدمج. الرجاء فك الدمج أولاً.' 
      });
    }

    // إرسال إيميل قبل الحذف
    try {
      const emails = await getOrderEmails(order);

      if (!emails || emails.length === 0) {
        console.log(`⚠️ No valid emails for order deletion - order ${order.orderNumber}`);
      } else {
        await sendEmail({
          to: emails,
          subject: `🗑️ تم حذف الطلب ${order.orderNumber}`,
          html: EmailTemplates.orderDeletedTemplate(order, req.user.name),
        });
      }
    } catch (emailError) {
      console.error('❌ Failed to send delete order email:', emailError.message);
    }

    // حذف الملفات المرتبطة
    const deleteFile = (filePath) => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Failed to delete file: ${filePath}`, err);
        }
      }
    };

    // حذف المرفقات العامة
    order.attachments.forEach((attachment) => {
      deleteFile(attachment.path);
    });

    // حذف مستندات المورد
    order.supplierDocuments.forEach((doc) => {
      deleteFile(doc.path);
    });

    // حذف مستندات العميل
    order.customerDocuments.forEach((doc) => {
      deleteFile(doc.path);
    });

    // تسجيل النشاط
    const activity = new Activity({
      orderId: order._id,
      activityType: 'حذف',
      description: `تم حذف الطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'رقم الطلب': order.orderNumber,
        'نوع الطلب': order.orderSource === 'عميل' ? 'طلب عميل' : 'طلب مورد',
        'العميل': order.customerName,
        'المورد': order.supplierName,
      },
    });
    await activity.save();

    // حذف الطلب
    await Order.findByIdAndDelete(req.params.id);

    return res.json({
      message: 'تم حذف الطلب بنجاح',
      orderNumber: order.orderNumber
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    return res.status(500).json({ error: 'حدث خطأ في حذف الطلب' });
  }
};

// ============================================
// 📎 حذف مرفق
// ============================================

exports.deleteAttachment = async (req, res) => {
  try {
    const { orderId, attachmentId, docType } = req.params;

    const order = await Order.findById(orderId)
      .populate('customer', 'name email')
      .populate('createdBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    let attachment = null;
    let collection = null;

    // تحديد نوع المجموعة
    if (docType === 'supplier') {
      collection = order.supplierDocuments;
    } else if (docType === 'customer') {
      collection = order.customerDocuments;
    } else {
      collection = order.attachments;
    }

    attachment = collection.id(attachmentId);
    
    if (!attachment) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }

    // إرسال إيميل قبل الحذف
    try {
      const emails = await getOrderEmails(order);

      if (!emails || emails.length === 0) {
        console.log(`⚠️ No valid emails for attachment deletion - order ${order.orderNumber}`);
      } else {
        await sendEmail({
          to: emails,
          subject: `📎 حذف مرفق من الطلب ${order.orderNumber}`,
          html: EmailTemplates.attachmentDeletedTemplate(order, attachment.filename, req.user.name, docType),
        });
      }
    } catch (emailError) {
      console.error('❌ Failed to send attachment delete email:', emailError.message);
    }

    // حذف الملف من السيرفر
    if (fs.existsSync(attachment.path)) {
      fs.unlinkSync(attachment.path);
    }

    // إزالة المرفق من الطلب
    collection.pull(attachmentId);
    await order.save();

    // تسجيل النشاط
    const activity = new Activity({
      orderId: order._id,
      activityType: 'حذف',
      description: `تم حذف مرفق من الطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'اسم الملف': attachment.filename,
        'نوع الملف': docType === 'supplier' ? 'مستند مورد' : docType === 'customer' ? 'مستند عميل' : 'مرفق عام'
      },
    });
    await activity.save();

    return res.json({
      message: 'تم حذف الملف بنجاح',
      fileName: attachment.filename,
      docType
    });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return res.status(500).json({ error: 'حدث خطأ في حذف الملف' });
  }
};

// ============================================
// ⏰ التحقق من إشعارات الوصول
// ============================================

const { safeSendEmail } = require('../services/emailQueue');

exports.checkArrivalNotifications = async () => {
  try {
    const now = new Date();

    // الطلبات التي لم يُرسل لها إشعار أو إيميل بعد
    const orders = await Order.find({
      status: { $in: ['جاهز للتحميل', 'في انتظار التحميل', 'مخصص للعميل', 'في الطريق'] },
      arrivalNotificationSentAt: { $exists: false },
    })
      .populate('customer', 'name email')
      .populate('supplier', 'name email contactPerson')
      .populate('createdBy', 'name email');

    if (!orders.length) {
      return;
    }

    const User = require('../models/User');
    const Notification = require('../models/Notification');

    // Admin + Manager مرة واحدة (تحسين أداء)
    const adminUsers = await User.find({
      role: { $in: ['admin', 'manager'] },
      isActive: true,
    });

    for (const order of orders) {
      try {
        const notificationTime = order.getArrivalNotificationTime();

        if (now < notificationTime) {
          continue;
        }

        // =========================
        // 🔔 إنشاء Notification
        // =========================
        if (adminUsers.length > 0) {
          const notification = new Notification({
            type: 'arrival_reminder',
            title: 'تذكير بقرب وقت الوصول',
            message: `الطلب رقم ${order.orderNumber} (${order.customerName}) سيصل خلال ساعتين ونصف`,
            data: {
              orderId: order._id,
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              expectedArrival: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
              supplierName: order.supplierName,
              auto: true,
            },
            recipients: adminUsers.map((user) => ({ user: user._id })),
            createdBy: order.createdBy?._id,
          });

          await notification.save();
        }

        // =========================
        // 📧 إرسال الإيميل (Rate Limited)
        // =========================
        try {
          const arrivalDateTime = order.getFullArrivalDateTime();
          const timeRemainingMs = arrivalDateTime - now;
          const timeRemaining = formatDuration(timeRemainingMs);

          const emails = await getOrderEmails(order);

          if (emails && emails.length > 0) {
            await safeSendEmail(() =>
              sendEmail({
                to: emails,
                subject: `⏰ تذكير بوصول الطلب ${order.orderNumber}`,
                html: EmailTemplates.arrivalReminderTemplate(order, timeRemaining),
              })
            );
          } else {
            console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
          }
        } catch (emailError) {
          console.error(
            `❌ Email failed for order ${order.orderNumber}:`,
            emailError.message
          );
        }

        // =========================
        // 💾 تحديث حالة الإرسال
        // =========================
        order.arrivalNotificationSentAt = new Date();
        order.arrivalEmailSentAt = new Date();
        await order.save();

        console.log(
          `🔔📧 Arrival notification + email sent for order ${order.orderNumber}`
        );
      } catch (orderError) {
        console.error(
          `❌ Error processing arrival notification for order ${order.orderNumber}:`,
          orderError.message
        );
      }
    }
  } catch (error) {
    console.error('❌ خطأ في التحقق من إشعارات الوصول:', error);
  }
};


// ============================================
// ✅ التحقق من اكتمال التحميل
// ============================================

exports.checkCompletedLoading = async () => {
  try {
    const now = new Date();

    // الطلبات التي انتهى وقت تحميلها ولم تُنفّذ بعد
    const orders = await Order.find({
      status: { $in: ['في انتظار التحميل', 'جاهز للتحميل'] },
      loadingCompletedAt: { $exists: false },
    })
      .populate('customer', 'name email')
      .populate('supplier', 'name email contactPerson')
      .populate('createdBy', 'name email');

    const Notification = require('../models/Notification');
    const Activity = require('../models/Activity');
    const User = require('../models/User');

    for (const order of orders) {
      const loadingDateTime = order.getFullLoadingDateTime();

      // ⏰ بعد يوم كامل من انتهاء وقت التحميل
      const oneDayAfterLoading = new Date(loadingDateTime);
      oneDayAfterLoading.setDate(oneDayAfterLoading.getDate() + 1);

      /**
       * ✅ الشرط الجديد:
       * - الوقت عدى يوم كامل بعد التحميل
       * - الطلب مدمج فقط
       */
    if (
  now >= oneDayAfterLoading &&
  order.orderSource === 'مدمج' &&
  ['تم التسليم', 'في الطريق', 'تم التحميل'].includes(order.status)
) {

        order.loadingCompletedAt = now;
        await order.save();

        // Admin + Manager
        const adminUsers = await User.find({
          role: { $in: ['admin', 'manager'] },
          isActive: true,
        });

        // 🔔 Notification
        const notification = new Notification({
          type: 'execution_completed',
          title: 'تم التنفيذ',
          message: `تم تنفيذ الطلب ${order.orderNumber} تلقائيًا بعد مرور يوم كامل من انتهاء التحميل`,
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            oldStatus,
            newStatus: 'تم التنفيذ',
            auto: true,
            isMerged: true,
          },
          recipients: adminUsers.map((u) => ({ user: u._id })),
          createdBy: order.createdBy?._id,
        });
        await notification.save();

        // 📝 Activity Log
        const activity = new Activity({
          orderId: order._id,
          activityType: 'تغيير حالة',
          description: `تم تحديث حالة الطلب ${order.orderNumber} تلقائيًا إلى "تم التنفيذ" بعد مرور يوم من انتهاء التحميل (طلب مدمج)`,
          performedBy: null,
          performedByName: 'النظام',
          changes: {
            الحالة: `من: ${oldStatus} → إلى: تم التنفيذ`,
          },
        });
        await activity.save();

        // 📧 Email للعميل المدمج
        try {
          const emails = await getOrderEmails(order);

          if (emails && emails.length > 0) {
            await sendEmail({
              to: emails,
              subject: `✅ تم تنفيذ الطلب ${order.orderNumber}`,
              html: EmailTemplates.orderStatusTemplate(
                order,
                oldStatus,
                'تم التنفيذ',
                'النظام'
              ),
            });
          }
        } catch (emailError) {
          console.error(
            `❌ Email failed for order ${order.orderNumber}:`,
            emailError.message
          );
        }

        console.log(
          `✅ Order ${order.orderNumber} marked as "تم التنفيذ" after 1 day (merged order)`
        );
      }
    }
  } catch (error) {
    console.error('❌ خطأ في checkCompletedLoading:', error);
  }
};
// ============================================
// 📊 إحصائيات الطلبات
// ============================================






exports.getOrderStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const match = {};

    if (startDate || endDate) {
      match.orderDate = {};
      if (startDate) match.orderDate.$gte = new Date(startDate);
      if (endDate) match.orderDate.$lte = new Date(endDate);
    }

    const stats = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSupplierOrders: {
            $sum: { $cond: [{ $eq: ['$orderSource', 'مورد'] }, 1, 0] }
          },
          totalCustomerOrders: {
            $sum: { $cond: [{ $eq: ['$orderSource', 'عميل'] }, 1, 0] }
          },
          totalMergedOrders: {
            $sum: { $cond: [{ $eq: ['$orderSource', 'مدمج'] }, 1, 0] }
          },
          totalQuantity: { $sum: '$quantity' },
          totalPrice: { $sum: '$totalPrice' },
          pendingOrders: {
            $sum: { $cond: [{ $in: ['$status', ['قيد الانتظار', 'في انتظار إنشاء طلب العميل']] }, 1, 0] }
          },
          inProgressOrders: {
            $sum: { $cond: [{ $in: ['$status', ['مخصص للعميل', 'في انتظار التحميل', 'جاهز للتحميل', 'في الطريق']] }, 1, 0] }
          },
          completedOrders: {
            $sum: { $cond: [{ $in: ['$status', ['تم التسليم', 'مكتمل']] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'ملغى'] }, 1, 0] }
          }
        }
      }
    ]);

    const cityStats = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalPrice: { $sum: '$totalPrice' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const statusStats = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const productStats = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$productType',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      overall: stats[0] || {
        totalOrders: 0,
        totalSupplierOrders: 0,
        totalCustomerOrders: 0,
        totalMergedOrders: 0,
        totalQuantity: 0,
        totalPrice: 0,
        pendingOrders: 0,
        inProgressOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0
      },
      byCity: cityStats,
      byStatus: statusStats,
      byProduct: productStats,
      period: {
        startDate: startDate || null,
        endDate: endDate || null
      }
    });
  } catch (error) {
    console.error('Error getting order stats:', error);
    res.status(500).json({ error: 'حدث خطأ في جلب الإحصائيات' });
  }
};


exports.advancedSearch = async (req, res) => {
  try {
    const {
      searchType,
      keyword,
      dateField,
      startDate,
      endDate,
      statuses,
      minAmount,
      maxAmount,
      cities,
      areas,
      productTypes,
      fuelTypes,
      paymentStatuses,
      sortBy = 'orderDate',
      sortOrder = 'desc',
      page = 1,
      limit = 50
    } = req.query;

    const filter = {};
    const skip = (page - 1) * limit;

    if (searchType === 'customer') filter.orderSource = 'عميل';
    if (searchType === 'supplier') filter.orderSource = 'مورد';
    if (searchType === 'mixed') filter.orderSource = 'مدمج';

    if (keyword) {
      const r = new RegExp(keyword, 'i');
      filter.$or = [
        { orderNumber: r },
        { customerName: r },
        { supplierName: r },
        { driverName: r },
        { customerCode: r },
        { supplierOrderNumber: r }
      ];
    }

    if (dateField && (startDate || endDate)) {
      filter[dateField] = {};
      if (startDate) filter[dateField].$gte = new Date(startDate);
      if (endDate) filter[dateField].$lte = new Date(endDate);
    }

    if (statuses) {
      filter.status = { $in: Array.isArray(statuses) ? statuses : [statuses] };
    }

    if (minAmount || maxAmount) {
      filter.totalPrice = {};
      if (minAmount) filter.totalPrice.$gte = Number(minAmount);
      if (maxAmount) filter.totalPrice.$lte = Number(maxAmount);
    }

    if (cities) {
      filter.city = { $in: (Array.isArray(cities) ? cities : [cities]).map(c => new RegExp(c, 'i')) };
    }

    if (areas) {
      filter.area = { $in: (Array.isArray(areas) ? areas : [areas]).map(a => new RegExp(a, 'i')) };
    }

    if (productTypes) filter.productType = { $in: [].concat(productTypes) };
    if (fuelTypes) filter.fuelType = { $in: [].concat(fuelTypes) };
    if (paymentStatuses) filter.paymentStatus = { $in: [].concat(paymentStatuses) };

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const orders = await Order.find(filter)
      .populate('customer supplier driver createdBy')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في البحث المتقدم' });
  }
};

exports.updateStatistics = async (req, res) => {
  try {
    const drivers = await Driver.find({ status: 'نشط' });

    for (const driver of drivers) {
      const stats = await Order.aggregate([
        { $match: { driver: driver._id } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalEarnings: { $sum: { $ifNull: ['$driverEarnings', 0] } },
            totalDistance: { $sum: { $ifNull: ['$distance', 0] } },
            avgRating: { $avg: { $ifNull: ['$driverRating', 0] } }
          }
        }
      ]);

      if (stats[0]) {
        Object.assign(driver, {
          totalDeliveries: stats[0].totalOrders,
          totalEarnings: stats[0].totalEarnings,
          totalDistance: stats[0].totalDistance,
          averageRating: stats[0].avgRating || 0
        });
        await driver.save();
      }
    }

    res.json({ success: true, message: 'تم تحديث الإحصائيات بنجاح' });
  } catch (error) {
    console.error('Update statistics error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في تحديث الإحصائيات' });
  }
};


