const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// جميع المسارات تتطلب مصادقة
router.use(authMiddleware);

// مسارات الطلبات
router.post('/', orderController.createOrder);
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrder);

// تحديث الطلب (محدود للحقول المسموح بها)
router.put('/:id', orderController.updateOrder);

// تحديث حالة الطلب (للإداريين فقط)
router.patch('/:id/status', adminMiddleware, orderController.updateOrderStatus);

// حذف الطلب (للإداريين فقط)
router.delete('/:id', adminMiddleware, orderController.deleteOrder);

// حذف مرفق
router.delete('/:orderId/attachments/:attachmentId', orderController.deleteAttachment);

// تصدير PDF
router.get('/:id/export/pdf', async (req, res) => {
  try {
    const Order = require('../models/Order');
    const Activity = require('../models/Activity');
    const pdfGenerator = require('../utils/pdfGenerator');
    
    const order = await Order.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('customer', 'name code');
    
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

// معلومات الطلبات حسب الحالة
router.get('/stats/status', async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب الإحصائيات' });
  }
});

// طلبات اليوم
router.get('/today/orders', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const orders = await Order.find({
      loadingDate: {
        $gte: today,
        $lt: tomorrow
      }
    })
    .populate('customer', 'name code')
    .sort({ loadingTime: 1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب طلبات اليوم' });
  }
});

// طلبات تحتاج للتحميل الآن
router.get('/urgent/loading', async (req, res) => {
  try {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);
    
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
          actualArrivalTime: { $exists: false },
          loadingDate: { $lt: thirtyMinutesAgo }
        }
      ]
    })
    .populate('customer', 'name code phone')
    .sort({ loadingDate: 1, loadingTime: 1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب الطلبات العاجلة' });
  }
});

// جلب الطلبات مع المؤقتات
router.get('/with-timers', orderController.getOrdersWithTimers);

// جلب الطلبات القريبة من وقتها
router.get('/upcoming/orders', orderController.getUpcomingOrders);

// إرسال إشعار يدوي لطلب معين
router.post('/:orderId/send-reminder', orderController.sendArrivalReminder);

// إحصاءات المؤقتات
router.get('/stats/timers', async (req, res) => {
  try {
    const now = new Date();
    const twoAndHalfHoursLater = new Date(now.getTime() + (2.5 * 60 * 60 * 1000));
    
    const allOrders = await Order.find({
      status: { $in: ['في انتظار التحميل', 'جاهز للتحميل', 'مخصص للعميل'] }
    });
    
    const stats = {
      total: allOrders.length,
      approachingArrival: 0,
      approachingLoading: 0,
      needsNotification: 0,
      overdue: 0
    };
    
    allOrders.forEach(order => {
      const arrivalDateTime = order.getFullArrivalDateTime();
      const loadingDateTime = order.getFullLoadingDateTime();
      
      if (arrivalDateTime > now && arrivalDateTime <= twoAndHalfHoursLater) {
        stats.approachingArrival++;
        if (!order.arrivalNotificationSentAt) {
          stats.needsNotification++;
        }
      }
      
      if (loadingDateTime > now && loadingDateTime <= twoAndHalfHoursLater) {
        stats.approachingLoading++;
      }
      
      if (loadingDateTime < now && order.status !== 'تم التحميل') {
        stats.overdue++;
      }
    });
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب إحصاءات المؤقتات' });
  }
});

module.exports = router;