const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const reportController = require('../controllers/reportController');
const filterController = require('../controllers/filterController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

const multer = require('multer');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

// إضافة middleware للمديرين
const managerMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'غير مصرح (لا يوجد مستخدم)' });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'غير مسموح بالوصول' });
  }

  next();
};

// جميع المسارات تتطلب مصادقة
router.use(authMiddleware);


// ============================================
// 🔗 مسارات الدمج
// ============================================

// دمج الطلبات (للإداريين والمديرين)
router.post('/merge', managerMiddleware, orderController.mergeOrders);

// فك دمج الطلب
router.post('/:id/unmerge', managerMiddleware, async (req, res) => {
  try {
    const Order = require('../models/Order');
    const Activity = require('../models/Activity');
    const NotificationService = require('../services/notificationService');

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: '????? ??? ?????' });
    }


    
    
    if (order.mergeStatus !== 'مدمج') {
      return res.status(400).json({ error: 'الطلب غير مدمج' });
    }
    
    // إعادة تعيين حالة الدمج
    order.mergeStatus = 'منفصل';
    order.originalOrderId = null;
    order.mergedOrderId = null;
    order.mergedAt = null;
    await order.save();
    
    // تسجيل النشاط
    const activity = new Activity({
      orderId: order._id,
      activityType: 'فك دمج',
      description: `تم فك دمج الطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'حالة الدمج': 'من: مدمج → إلى: منفصل'
      },
    });
    await activity.save();

    await NotificationService.sendToAll({
      type: 'order_unmerged',
      title: '?? ?? ?????',
      message: `?? ?? ??? ????? ${order.orderNumber} ?????.`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderSource: order.orderSource
      },
      createdBy: req.user._id,
      orderId: order._id,
      channels: ['in_app', 'email'],
      extraEmails: [order.customerEmail, order.supplierEmail].filter(Boolean)
    });
    
    res.json({
      message: 'تم فك دمج الطلب بنجاح',
      order
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في فك الدمج' });
  }
});





// ============================================
// 📋 مسارات الطلبات الأساسية
// ============================================

router.post('/', orderController.createOrder);
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrder);

// تحديث الطلب
router.put('/:id', orderController.updateOrder);


// تحديث حالة الطلب (للإداريين والمديرين فقط)
router.patch('/:id/status', managerMiddleware, orderController.updateOrderStatus);

// حذف الطلب (للإداريين فقط)
router.delete('/:id', adminMiddleware, orderController.deleteOrder);

// ============================================
// 📎 مسارات المرفقات
// ============================================

// حذف مرفق عام
router.delete('/:orderId/attachments/:attachmentId', orderController.deleteAttachment);
// حذف مستند مورد
router.delete('/:orderId/supplier-docs/:docId', orderController.deleteAttachment);

// حذف مستند عميل
router.delete('/:orderId/customer-docs/:docId', orderController.deleteAttachment);

router.get('/reports/customers', reportController.customerReports);

// تقارير السائقين
router.get('/reports/drivers', reportController.driverReports);

// تقارير الموردين
router.get('/reports/suppliers', reportController.supplierReports);

// تقارير المستخدمين
router.get('/reports/users', reportController.userReports);

// تقرير فاتورة محددة
router.get('/reports/invoice/:orderId', reportController.invoiceReport);

// تصدير PDF
router.get('/reports/export/pdf', reportController.exportPDF);

// تصدير Excel
router.get('/reports/export/excel', reportController.exportExcel);

// ============================================
// 🔍 مسارات الفلاتر
// ============================================

// خيارات الفلاتر
router.get('/filters/options', filterController.getFilterOptions);

// بحث ذكي
router.get('/filters/search', filterController.smartSearch);

// إحصائيات الفلاتر
router.post('/filters/stats', filterController.getFilterStats);




// جلب الطلبات مع المؤقتات
router.get('/with-timers/orders', orderController.getOrdersWithTimers);

// جلب الطلبات القريبة من وقتها
router.get('/upcoming/orders', orderController.getUpcomingOrders);

// إرسال إشعار يدوي لطلب معين
router.post('/:orderId/send-reminder', managerMiddleware, orderController.sendArrivalReminder);

// جرد الطلبات المتأخرة
router.get('/overdue/orders', async (req, res) => {
  try {
    const now = new Date();
    const Order = require('../models/Order');
    
    const overdueOrders = await Order.find({
      $or: [
        {
          status: { $in: ['في انتظار التحميل', 'جاهز للتحميل'] },
          loadingDate: { $lt: now }
        },
        {
          status: { $in: ['في الطريق', 'مخصص للعميل'] },
          arrivalDate: { $lt: now }
        }
      ]
    })
    .populate('customer', 'name code phone')
    .populate('supplier', 'name contactPerson phone')
    .populate('driver', 'name phone')
    .sort({ arrivalDate: 1, loadingDate: 1 });
    
    res.json(overdueOrders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في جلب الطلبات المتأخرة' });
  }
});

// ============================================
// 📊 مسارات الإحصائيات والتقارير
// ============================================

// إحصائيات شاملة
router.get('/stats/overall', orderController.getOrderStats);

// إحصائيات حسب حالة الطلب
router.get('/stats/by-status', async (req, res) => {
  try {
    const Order = require('../models/Order');
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalPrice: { $sum: '$totalPrice' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في جلب الإحصائيات' });
  }
});

// إحصائيات حسب مصدر الطلب
router.get('/stats/by-source', async (req, res) => {
  try {
    const Order = require('../models/Order');
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$orderSource',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalPrice: { $sum: '$totalPrice' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في جلب الإحصائيات' });
  }
});

// إحصائيات حسب المدينة
router.get('/stats/by-city', async (req, res) => {
  try {
    const Order = require('../models/Order');
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalPrice: { $sum: '$totalPrice' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 20
      }
    ]);
    
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في جلب الإحصائيات' });
  }
});

// إحصائيات المؤقتات
router.get('/stats/timers', async (req, res) => {
  try {
    const now = new Date();
    const twoAndHalfHoursLater = new Date(now.getTime() + (2.5 * 60 * 60 * 1000));
    const Order = require('../models/Order');
    
    const allOrders = await Order.find({
      status: { 
        $in: ['في انتظار التحميل', 'جاهز للتحميل', 'مخصص للعميل', 'في الطريق'] 
      }
    });
    
    const stats = {
      total: allOrders.length,
      approachingArrival: 0,
      approachingLoading: 0,
      needsNotification: 0,
      overdueArrival: 0,
      overdueLoading: 0
    };
    
    allOrders.forEach(order => {
      const arrivalDateTime = order.getFullArrivalDateTime();
      const loadingDateTime = order.getFullLoadingDateTime();
      
      // طلبات تقترب من وقت الوصول
      if (arrivalDateTime > now && arrivalDateTime <= twoAndHalfHoursLater) {
        stats.approachingArrival++;
        if (!order.arrivalNotificationSentAt) {
          stats.needsNotification++;
        }
      }
      
      // طلبات تقترب من وقت التحميل
      if (loadingDateTime > now && loadingDateTime <= twoAndHalfHoursLater) {
        stats.approachingLoading++;
      }
      
      // طلبات تأخرت في الوصول
      if (arrivalDateTime < now && ['مخصص للعميل', 'في الطريق'].includes(order.status)) {
        stats.overdueArrival++;
      }
      
      // طلبات تأخرت في التحميل
      if (loadingDateTime < now && ['في انتظار التحميل', 'جاهز للتحميل'].includes(order.status)) {
        stats.overdueLoading++;
      }
    });
    
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في جلب إحصاءات المؤقتات' });
  }
});


// طلبات اليوم حسب تاريخ التحميل
router.get('/today/loading', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const Order = require('../models/Order');
    const orders = await Order.find({
      loadingDate: {
        $gte: today,
        $lt: tomorrow
      }
    })
    .populate('customer', 'name code phone')
    .populate('supplier', 'name contactPerson phone')
    .populate('driver', 'name phone vehicleNumber')
    .sort({ loadingTime: 1 });
    
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في جلب طلبات اليوم' });
  }
});

// طلبات اليوم حسب تاريخ الوصول
router.get('/today/arrival', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const Order = require('../models/Order');
    const orders = await Order.find({
      arrivalDate: {
        $gte: today,
        $lt: tomorrow
      }
    })
    .populate('customer', 'name code phone')
    .populate('supplier', 'name contactPerson phone')
    .populate('driver', 'name phone vehicleNumber')
    .sort({ arrivalTime: 1 });
    
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في جلب طلبات اليوم' });
  }
});

// طلبات تحتاج للتحميل الآن
router.get('/urgent/loading', async (req, res) => {
  try {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);
    
    const Order = require('../models/Order');
    const orders = await Order.find({
      status: { $in: ['في انتظار التحميل', 'جاهز للتحميل'] },
      $or: [
        {
          loadingDate: {
            $gte: thirtyMinutesAgo,
            $lte: thirtyMinutesLater
          }
        },
        {
          loadingCompletedAt: { $exists: false },
          loadingDate: { $lt: thirtyMinutesAgo }
        }
      ]
    })
    .populate('customer', 'name code phone email')
    .populate('supplier', 'name contactPerson phone')
    .populate('driver', 'name phone vehicleNumber')
    .sort({ loadingDate: 1, loadingTime: 1 });
    
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في جلب الطلبات العاجلة' });
  }
});


// تصدير PDF للطلب
router.get('/:id/export/pdf', async (req, res) => {
  try {
    const Order = require('../models/Order');
    const Activity = require('../models/Activity');
    const pdfGenerator = require('../utils/pdfGenerator');
    
    const order = await Order.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('customer', 'name code phone email city area address')
      .populate('supplier', 'name company contactPerson phone address')
      .populate('driver', 'name phone vehicleNumber');
    
    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }
    
    const activities = await Activity.find({ orderId: req.params.id })
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 });

    const pdfData = await pdfGenerator.generateOrderPDF(order, activities);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="order-${order.orderNumber}.pdf"`);
    res.send(pdfData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في توليد PDF' });
  }
});

// تصدير تقرير حسب التاريخ
router.get('/export/report', adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, format = 'pdf' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'يجب تحديد تاريخ البداية والنهاية' });
    }
    
    const Order = require('../models/Order');
    const pdfGenerator = require('../utils/pdfGenerator');
    
    const orders = await Order.find({
      orderDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
    .populate('customer', 'name code city')
    .populate('supplier', 'name company')
    .populate('createdBy', 'name')
    .sort({ orderDate: -1 });
    
    if (format === 'pdf') {
      const pdfData = await pdfGenerator.generateOrdersReportPDF(orders, {
        startDate,
        endDate
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="orders-report-${startDate}-to-${endDate}.pdf"`);
      res.send(pdfData);
    } else if (format === 'excel') {
      // TODO: Implement Excel export
      res.status(501).json({ error: 'تصدير Excel غير متوفر حالياً' });
    } else {
      res.status(400).json({ error: 'تنسيق التصدير غير مدعوم' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في تصدير التقرير' });
  }
});

// ============================================
// 🔍 مسارات البحث المتقدم
// ============================================

// البحث حسب معايير متعددة
router.get('/search/advanced', async (req, res) => {
  try {
    const { 
      customerName, 
      supplierName, 
      orderNumber, 
      city, 
      area,
      status,
      orderSource,
      productType,
      fuelType,
      startDate,
      endDate
    } = req.query;
    
    const filter = {};
    
    if (customerName) filter.customerName = new RegExp(customerName, 'i');
    if (supplierName) filter.supplierName = new RegExp(supplierName, 'i');
    if (orderNumber) filter.orderNumber = new RegExp(orderNumber, 'i');
    if (city) filter.city = new RegExp(city, 'i');
    if (area) filter.area = new RegExp(area, 'i');
    if (status) filter.status = status;
    if (orderSource) filter.orderSource = orderSource;
    if (productType) filter.productType = productType;
    if (fuelType) filter.fuelType = fuelType;
    
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) filter.orderDate.$gte = new Date(startDate);
      if (endDate) filter.orderDate.$lte = new Date(endDate);
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const Order = require('../models/Order');
    const orders = await Order.find(filter)
      .populate('customer', 'name code phone email')
      .populate('supplier', 'name company contactPerson')
      .populate('createdBy', 'name email')
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Order.countDocuments(filter);
    
    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في البحث' });
  }
});

// ============================================
// 🔄 مسارات المزامنة والتحديث التلقائي
// ============================================

// تحديث حالات الطلبات التلقائي (للسيرفر فقط)
router.post('/sync/auto-update', adminMiddleware, async (req, res) => {
  try {
    await orderController.checkArrivalNotifications();
    await orderController.checkCompletedLoading();
    
    res.json({
      message: 'تم تحديث حالات الطلبات تلقائياً',
      timestamp: new Date()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في التحديث التلقائي' });
  }
});

// ============================================
// 📋 إعادة تسمية المسارات لتجنب التعارض
// ============================================

// تجنب التعارض مع المسارات الأخرى
router.get('/list/orders', orderController.getOrders);
router.get('/detail/:id', orderController.getOrder);

module.exports = router;
