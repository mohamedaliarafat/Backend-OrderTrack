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
      // ✅ نوع العملية (شراء | نقل)
      // ==================================================
      const allowedRequestTypes = ['شراء', 'نقل'];
      orderData.requestType = orderData.requestType || 'شراء';

      if (!allowedRequestTypes.includes(orderData.requestType)) {
        return res.status(400).json({
          error: 'نوع العملية غير صحيح (يجب أن يكون شراء أو نقل)',
        });
      }

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
      // 🚚 شرط النقل: لازم سائق
      // ==================================================
      if (orderData.requestType === 'نقل' && !orderData.driver) {
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
<<<<<<< HEAD
        .populate('customer', 'name code phone city area')
        .populate('supplier', 'name company city area')
        .populate('createdBy', 'name email')
        .populate('driver', 'name phone vehicleNumber');
=======
        .populate('customer', 'name code phone email')
        .populate('createdBy', 'name email');

      // تسجيل النشاط
      const activity = new Activity({
        orderId: order._id,
        activityType: 'إنشاء',
        description: `تم إنشاء طلب جديد برقم ${order.orderNumber}`,
        performedBy: req.user._id,
        performedByName: req.user.name,
        changes: {
          'رقم الطلب': order.orderNumber,
          'المورد': order.supplierName,
          'وقت التحميل': `${order.loadingDate.toLocaleDateString('ar-SA')} ${order.loadingTime}`,
          'وقت الوصول': `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
        },
      });
      await activity.save();

      // =========================
      // 📧 إرسال الإيميل
      // =========================
      try {
        const emails = await getOrderEmails(populatedOrder);

       if (!emails || emails.length === 0) {
          console.log('⚠️ No valid emails found for order creation');
        } else {
          await sendEmail({
            to: emails,
            subject: `📦 تم إنشاء طلب جديد - ${order.orderNumber}`,
            html: EmailTemplates.orderCreatedTemplate(populatedOrder),
          });
        }
      } catch (emailError) {
        // لا نوقف العملية لو الإيميل فشل
        console.error('❌ Email sending failed:', emailError.message);
      }
>>>>>>> 7728126dac41333cffeba291d43dfc9409179aa6

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
    
    if (req.query.city) {
      filter.city = new RegExp(req.query.city, 'i');
    }
    
    if (req.query.area) {
      filter.area = new RegExp(req.query.area, 'i');
    }
    
    if (req.query.startDate) {
      filter.orderDate = { $gte: new Date(req.query.startDate) };
    }
    
    if (req.query.endDate) {
      if (filter.orderDate) {
        filter.orderDate.$lte = new Date(req.query.endDate);
      } else {
        filter.orderDate = { $lte: new Date(req.query.endDate) };
      }
    }

    // تصفية حسب نوع المنتج
    if (req.query.productType) {
      filter.productType = req.query.productType;
    }

    // جلب الطلبات
    const orders = await Order.find(filter)
      .populate('customer', 'name code phone email')
      .populate('supplier', 'name company contactPerson')
      .populate('createdBy', 'name email')
      .populate('driver', 'name phone vehicleNumber')
      .sort({ orderDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // إضافة معلومات العرض لكل طلب
    const ordersWithDisplayInfo = orders.map(order => ({
      ...order.toObject(),
      displayInfo: order.getDisplayInfo ? order.getDisplayInfo() : null
    }));

    // العدد الإجمالي
    const total = await Order.countDocuments(filter);

    res.json({
      orders: ordersWithDisplayInfo,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

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

<<<<<<< HEAD
            if (!emails || emails.length === 0) {
=======
           if (!emails || emails.length === 0) {
>>>>>>> 7728126dac41333cffeba291d43dfc9409179aa6
              console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
            } else {
              await sendEmail({
                to: emails,
                subject: `⏰ تذكير: اقتراب وصول الطلب ${order.orderNumber}`,
<<<<<<< HEAD
                html: EmailTemplates.arrivalReminderTemplate(order, timeRemaining),
              });
            }
=======
                html: EmailTemplates.arrivalReminderTemplate(
                  order,
                  timeRemaining
                ),
              });
            }

>>>>>>> 7728126dac41333cffeba291d43dfc9409179aa6

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
<<<<<<< HEAD
            console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
          } else {
            await sendEmail({
              to: emails,
              subject: `⏰ تذكير: اقتراب وصول الطلب ${order.orderNumber}`,
              html: EmailTemplates.arrivalReminderTemplate(order, formatDuration(arrivalRemaining)),
            });
          }
=======
              console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
            } else {
              await sendEmail({
                to: emails,
                subject: `⏰ تذكير: اقتراب وصول الطلب ${order.orderNumber}`,
                html: EmailTemplates.arrivalReminderTemplate(
                  order,
                  formatDuration(arrivalRemaining)
                ),
              });
            }

>>>>>>> 7728126dac41333cffeba291d43dfc9409179aa6

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

<<<<<<< HEAD
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
=======
    // =========================
    // 📧 إرسال الإيميل لكل المستخدمين
    // =========================
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
  console.error(
    `❌ Failed to send arrival reminder email for order ${order.orderNumber}:`,
    emailError.message
  );
}

>>>>>>> 7728126dac41333cffeba291d43dfc9409179aa6

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

<<<<<<< HEAD
          if (!emails || emails.length === 0) {
            console.log(`⚠️ No valid emails for order update - order ${order.orderNumber}`);
          } else {
            await sendEmail({
              to: emails,
              subject: `✏️ تحديث على الطلب ${order.orderNumber}`,
              html: EmailTemplates.orderUpdatedTemplate(populatedForEmail, changes, req.user.name),
            });
          }
=======
         if (!emails || emails.length === 0) {
  console.log(`⚠️ No valid emails for order update - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `✏️ تحديث على الطلب ${order.orderNumber}`,
    html: EmailTemplates.orderUpdatedTemplate(
      populatedForEmail,
      changes,
      req.user.name
    ),
  });
}

>>>>>>> 7728126dac41333cffeba291d43dfc9409179aa6
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
      .populate('customer', 'name email')
      .populate('supplier', 'name email contactPerson')
      .populate('createdBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    // التحقق من الصلاحيات
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      // السماح للسائق بتغيير الحالة إلى "في الطريق" أو "تم التسليم" فقط
      if (req.user.role === 'driver') {
        const allowedDriverStatuses = ['في الطريق', 'تم التسليم', 'تم التحميل'];
        if (!allowedDriverStatuses.includes(status)) {
          return res.status(403).json({ error: 'غير مصرح بتغيير الحالة إلى هذا الوضع' });
        }
      } else {
        return res.status(403).json({ error: 'غير مصرح بتغيير حالة الطلب' });
      }
    }

    const oldStatus = order.status;

    // التحقق من أن الحالة لم تتغير
    if (oldStatus === status) {
      return res.json({
        message: 'الحالة لم تتغير',
        order,
      });
    }

    // تحديث الحالة
    order.status = status;
    order.updatedAt = new Date();

    // إذا تم التحميل
    if (status === 'تم التحميل' && oldStatus !== 'تم التحميل') {
      order.loadingCompletedAt = new Date();
    }

    // إذا تم التسليم
    if (status === 'تم التسليم' && oldStatus !== 'تم التسليم') {
      order.completedAt = new Date();
    }

    // إذا تم الإلغاء
    if (status === 'ملغى' && oldStatus !== 'ملغى') {
      order.cancelledAt = new Date();
      if (reason) order.notes = (order.notes || '') + `\nسبب الإلغاء: ${reason}`;
    }

    await order.save();

    // تسجيل النشاط
    const activity = new Activity({
      orderId: order._id,
      activityType: 'تغيير حالة',
      description: `تم تغيير حالة الطلب رقم ${order.orderNumber} من "${oldStatus}" إلى "${status}"`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        الحالة: `من: ${oldStatus} → إلى: ${status}`,
        ...(reason ? { 'سبب التغيير': reason } : {})
      },
    });
    await activity.save();

    // إرسال الإيميل
    try {
      const emails = await getOrderEmails(order);

<<<<<<< HEAD
      if (!emails || emails.length === 0) {
        console.log(`⚠️ No valid emails for order status update - order ${order.orderNumber}`);
      } else {
        await sendEmail({
          to: emails,
          subject: `🔄 تحديث حالة الطلب ${order.orderNumber}`,
          html: EmailTemplates.orderStatusTemplate(order, oldStatus, status, req.user.name, reason),
        });
      }
=======
      const emails = await getOrderEmails(populatedForEmail);

     if (!emails || emails.length === 0) {
  console.log(`⚠️ No valid emails for order status update - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `🔄 تحديث حالة الطلب ${order.orderNumber}`,
    html: EmailTemplates.orderStatusTemplate(
      populatedForEmail,
      oldStatus,
      status,
      req.user.name
    ),
  });
}

>>>>>>> 7728126dac41333cffeba291d43dfc9409179aa6
    } catch (emailError) {
      console.error('❌ Failed to send order status email:', emailError.message);
    }

    return res.json({
      message: 'تم تحديث حالة الطلب بنجاح',
      order: {
        ...order.toObject(),
        displayInfo: order.getDisplayInfo ? order.getDisplayInfo() : null
      },
      oldStatus,
      newStatus: status,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// ============================================
// 🔗 دمج الطلبات
// ============================================

exports.mergeOrders = async (req, res) => {
  try {
    const { sourceOrderId, targetOrderId } = req.body;

    // =========================
    // 1️⃣ التحقق من المدخلات
    // =========================
    if (!sourceOrderId || !targetOrderId) {
      return res.status(400).json({
        success: false,
        message: 'معرف طلب المورد ومعرف طلب العميل مطلوبان',
      });
    }

    if (sourceOrderId === targetOrderId) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن دمج الطلب مع نفسه',
      });
    }

    // =========================
    // 2️⃣ جلب الطلبات
    // =========================
    const supplierOrder = await Order.findById(sourceOrderId);
    const customerOrder = await Order.findById(targetOrderId);

    if (!supplierOrder || !customerOrder) {
      return res.status(404).json({
        success: false,
        message: 'أحد الطلبات غير موجود',
      });
    }

    // =========================
    // 🔴 تحقق مهم (رقم طلب المورد)
    // =========================
    if (!supplierOrder.supplierOrderNumber) {
      return res.status(400).json({
        success: false,
        message: 'رقم طلب المورد غير مُدخل',
      });
    }

    // =========================
    // 3️⃣ التحقق من حالة الدمج
    // =========================
    if (
      supplierOrder.mergeStatus !== 'منفصل' ||
      customerOrder.mergeStatus !== 'منفصل'
    ) {
      return res.status(400).json({
        success: false,
        message: 'أحد الطلبات تم دمجه مسبقًا',
      });
    }

    // =========================
    // 4️⃣ التحقق من التوافق
    // =========================
    if (supplierOrder.fuelType !== customerOrder.fuelType) {
      return res.status(400).json({
        success: false,
        message: 'نوع الوقود غير متطابق',
      });
    }

    const supplierQty = Number(supplierOrder.quantity || 0);
    const customerQty = Number(customerOrder.quantity || 0);

    if (supplierQty < customerQty) {
      return res.status(400).json({
        success: false,
        message: 'كمية المورد أقل من كمية طلب العميل',
      });
    }

    // =========================
    // 5️⃣ إنشاء رقم الطلب المدموج
    // =========================
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);

    const mergedOrderNumber = `MIX-${y}${m}${d}-${rand}`;

    // =========================
    // 6️⃣ تحديد الموقع
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
    // 7️⃣ إنشاء الطلب المدموج
    // =========================
    const mergedOrder = new Order({
      orderSource: 'مدمج',
      mergeStatus: 'مدمج',
      orderNumber: mergedOrderNumber,

      // 🔴 رقم طلب المورد (يدوي)
      supplierOrderNumber: supplierOrder.supplierOrderNumber,

      mergedFrom: {
        supplierOrderId: supplierOrder._id,
        customerOrderId: customerOrder._id,
        supplierOrderNumber: supplierOrder.supplierOrderNumber,
        customerOrderNumber: customerOrder.orderNumber,
      },

      city,
      area,
      address,

      supplierAddress: supplierOrder.supplierAddress,

      supplierName: supplierOrder.supplierName,
      supplierPhone: supplierOrder.supplierPhone,
      supplierCompany: supplierOrder.supplierCompany,
      supplier: supplierOrder.supplier,

      customer: customerOrder.customer,
      customerName: customerOrder.customerName,
      customerCode: customerOrder.customerCode,
      customerPhone: customerOrder.customerPhone,

      requestType: 'مدمج',
      productType: supplierOrder.productType,
      fuelType: supplierOrder.fuelType,
      quantity: customerQty,
      unit: supplierOrder.unit || 'لتر',

      orderDate: new Date(),
      loadingDate: supplierOrder.loadingDate || new Date(),
      loadingTime: supplierOrder.loadingTime || '08:00',
      arrivalDate: customerOrder.arrivalDate || new Date(),
      arrivalTime: customerOrder.arrivalTime || '10:00',

      status: 'مدمج وجاهز للتنفيذ',

      driver: supplierOrder.driver,
      driverName: supplierOrder.driverName,
      driverPhone: supplierOrder.driverPhone,
      vehicleNumber: supplierOrder.vehicleNumber,

      notes: `طلب مدمج: ${supplierOrder.notes || ''} | ${customerOrder.notes || ''}`,

      createdBy: supplierOrder.createdBy || customerOrder.createdBy,
      createdByName:
        supplierOrder.createdByName ||
        customerOrder.createdByName ||
        'النظام',

      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await mergedOrder.save();

    // =========================
    // 8️⃣ تحديث الطلبات الأصلية
    // =========================
    supplierOrder.mergeStatus = 'مدمج';
    supplierOrder.status = 'تم دمجه';
    supplierOrder.mergedOrderId = mergedOrder._id;
    supplierOrder.mergedAt = new Date();

    customerOrder.mergeStatus = 'مدمج';
    customerOrder.status = 'تم دمجه';
    customerOrder.mergedOrderId = mergedOrder._id;
    customerOrder.mergedAt = new Date();

    // 🔴 نسخ رقم طلب المورد إلى العميل
    customerOrder.supplierOrderNumber =
      supplierOrder.supplierOrderNumber;

    await supplierOrder.save();
    await customerOrder.save();

    // =========================
    // 9️⃣ تسجيل النشاط
    // =========================
    try {
      const activity = new Activity({
        orderId: mergedOrder._id,
        activityType: 'دمج',
        description: `تم دمج طلب المورد رقم ${supplierOrder.supplierOrderNumber} مع طلب العميل`,
        performedByName: supplierOrder.createdByName || 'النظام',
      });

      await activity.save();
    } catch (err) {
      console.warn('⚠️ Activity not saved:', err.message);
    }

    // =========================
    // 🔟 الاستجابة
    // =========================
    return res.status(200).json({
      success: true,
      message: 'تم دمج الطلبات بنجاح',
      mergedOrder,
    });

  } catch (error) {
    console.error('❌ Error merging orders:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء دمج الطلبات',
      error: error.message,
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
<<<<<<< HEAD
        console.log(`⚠️ No valid emails for order deletion - order ${order.orderNumber}`);
      } else {
        await sendEmail({
          to: emails,
          subject: `🗑️ تم حذف الطلب ${order.orderNumber}`,
          html: EmailTemplates.orderDeletedTemplate(order, req.user.name),
        });
=======
  console.log(`⚠️ No valid emails for order deletion - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `🗑️ تم حذف الطلب ${order.orderNumber}`,
    html: EmailTemplates.orderDeletedTemplate(
      order,
      req.user.name
    ),
  });
}

    } catch (emailError) {
      console.error(
        '❌ Failed to send delete order email:',
        emailError.message
      );
    }

    // =========================
    // 🗑️ حذف الملفات المرتبطة
    // =========================
    if (order.companyLogo && fs.existsSync(order.companyLogo)) {
      fs.unlinkSync(order.companyLogo);
    }

    order.attachments.forEach((attachment) => {
      if (fs.existsSync(attachment.path)) {
        fs.unlinkSync(attachment.path);
>>>>>>> 7728126dac41333cffeba291d43dfc9409179aa6
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

<<<<<<< HEAD
      if (!emails || emails.length === 0) {
        console.log(`⚠️ No valid emails for attachment deletion - order ${order.orderNumber}`);
      } else {
        await sendEmail({
          to: emails,
          subject: `📎 حذف مرفق من الطلب ${order.orderNumber}`,
          html: EmailTemplates.attachmentDeletedTemplate(order, attachment.filename, req.user.name, docType),
        });
      }
=======
     if (!emails || emails.length === 0) {
  console.log(`⚠️ No valid emails for attachment deletion - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `📎 حذف مرفق من الطلب ${order.orderNumber}`,
    html: EmailTemplates.attachmentDeletedTemplate(
      order,
      attachment.filename,
      req.user.name
    ),
  });
}

>>>>>>> 7728126dac41333cffeba291d43dfc9409179aa6
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

exports.checkArrivalNotifications = async () => {
  try {
    const now = new Date();

    // الطلبات التي لم يُرسل لها إشعار بعد
    const orders = await Order.find({
      status: { $in: ['جاهز للتحميل', 'في انتظار التحميل', 'مخصص للعميل', 'في الطريق'] },
      arrivalNotificationSentAt: { $exists: false },
    })
    .populate('customer', 'name email')
    .populate('supplier', 'name email contactPerson')
    .populate('createdBy', 'name email');

    const User = require('../models/User');
    const Notification = require('../models/Notification');

    for (const order of orders) {
      const notificationTime = order.getArrivalNotificationTime();

      if (now >= notificationTime) {
        // Admin + Manager
        const adminUsers = await User.find({
          role: { $in: ['admin', 'manager'] },
          isActive: true,
        });

        // إنشاء Notification
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

        // إرسال الإيميل
        try {
          const arrivalDateTime = order.getFullArrivalDateTime();
          const timeRemainingMs = arrivalDateTime - now;

          const emails = await getOrderEmails(order);

          if (!emails || emails.length === 0) {
<<<<<<< HEAD
            console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
          } else {
            await sendEmail({
              to: emails,
              subject: `⏰ تذكير بوصول الطلب ${order.orderNumber}`,
              html: EmailTemplates.arrivalReminderTemplate(order, formatDuration(timeRemainingMs)),
            });
          }
=======
  console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `⏰ تذكير بوصول الطلب ${order.orderNumber}`,
    html: EmailTemplates.arrivalReminderTemplate(
      order,
      formatDuration(timeRemainingMs)
    ),
  });
}

>>>>>>> 7728126dac41333cffeba291d43dfc9409179aa6
        } catch (emailError) {
          console.error(`❌ Email failed for order ${order.orderNumber}:`, emailError.message);
        }

        // تحديث حالة الإرسال
        order.arrivalNotificationSentAt = new Date();
        order.arrivalEmailSentAt = new Date();
        await order.save();

        console.log(`🔔📧 Arrival notification + email sent for order ${order.orderNumber}`);
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

    // الطلبات التي انتهى وقت تحميلها ولم تُحدّث حالتها
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

      // بعد ساعة من وقت التحميل
      const oneHourAfterLoading = new Date(loadingDateTime);
      oneHourAfterLoading.setHours(oneHourAfterLoading.getHours() + 1);

      if (now >= oneHourAfterLoading) {
        const oldStatus = order.status;

        // تحديث حالة الطلب
        order.status = 'تم التحميل';
        order.loadingCompletedAt = now;
        await order.save();

        // Admin + Manager
        const adminUsers = await User.find({
          role: { $in: ['admin', 'manager'] },
          isActive: true,
        });

        // Notification
        const notification = new Notification({
          type: 'loading_completed',
          title: 'اكتمل التحميل تلقائيًا',
          message: `تم تحديث حالة الطلب ${order.orderNumber} إلى "تم التحميل" تلقائيًا`,
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            oldStatus,
            newStatus: 'تم التحميل',
            auto: true,
          },
          recipients: adminUsers.map((u) => ({ user: u._id })),
          createdBy: order.createdBy?._id,
        });
        await notification.save();

        // Activity Log
        const activity = new Activity({
          orderId: order._id,
          activityType: 'تغيير حالة',
          description: `تم تحديث حالة الطلب ${order.orderNumber} تلقائيًا إلى "تم التحميل"`,
          performedBy: null,
          performedByName: 'النظام',
          changes: {
            الحالة: `من: ${oldStatus} → إلى: تم التحميل`,
          },
        });
        await activity.save();

        // Email
        try {
          const emails = await getOrderEmails(order);

          if (!emails || emails.length === 0) {
<<<<<<< HEAD
            console.log(`⚠️ No valid emails for loading completion - order ${order.orderNumber}`);
          } else {
            await sendEmail({
              to: emails,
              subject: `✅ تم اكتمال تحميل الطلب ${order.orderNumber}`,
              html: EmailTemplates.orderStatusTemplate(order, oldStatus, 'تم التحميل', 'النظام'),
            });
          }
=======
  console.log(`⚠️ No valid emails for loading completion - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `✅ تم اكتمال تحميل الطلب ${order.orderNumber}`,
    html: EmailTemplates.orderStatusTemplate(
      order,
      oldStatus,
      'تم التحميل',
      'النظام'
    ),
  });
}

>>>>>>> 7728126dac41333cffeba291d43dfc9409179aa6
        } catch (emailError) {
          console.error(`❌ Email failed for order ${order.orderNumber}:`, emailError.message);
        }

        console.log(`✅🔔📧 Order ${order.orderNumber} marked as "تم التحميل" automatically`);
      }
    }
  } catch (error) {
    console.error('❌ خطأ في التحقق من اكتمال التحميل:', error);
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


