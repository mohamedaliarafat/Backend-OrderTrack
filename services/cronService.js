const cron = require('node-cron');
const Order = require('../models/Order');
const notificationService = require('./notificationService');

// مهمة للتحقق من الطلبات كل دقيقة
const checkOrdersMinutely = async () => {
  try {
    const now = new Date();
    
    // جلب جميع الطلبات النشطة
    const activeOrders = await Order.find({
      status: { 
        $in: [
          'قيد الانتظار', 
          'مخصص للعميل', 
          'في انتظار التحميل', 
          'جاهز للتحميل'
        ] 
      }
    }).populate('customer createdBy');
    
    for (const order of activeOrders) {
      const loadingDateTime = order.getFullLoadingDateTime();
      const arrivalDateTime = order.getFullArrivalDateTime();
      
      const timeToLoading = loadingDateTime - now;
      const timeToArrival = arrivalDateTime - now;
      
      // ✅ إرسال إشعار قبل التحميل بـ 30 دقيقة
      if (timeToLoading > 0 && timeToLoading <= 30 * 60 * 1000) {
        // التحقق من عدم إرسال الإشعار بالفعل
        const notificationSent = await checkIfNotificationSent(order._id, 'loading_reminder', '30min');
        if (!notificationSent) {
          await notificationService.notifyLoadingReminder(order, 30);
          await markNotificationSent(order._id, 'loading_reminder', '30min');
        }
      }
      
      // ✅ إرسال إشعار قبل التحميل بـ 10 دقائق
      if (timeToLoading > 0 && timeToLoading <= 10 * 60 * 1000) {
        const notificationSent = await checkIfNotificationSent(order._id, 'loading_reminder', '10min');
        if (!notificationSent) {
          await notificationService.notifyLoadingReminder(order, 10);
          await markNotificationSent(order._id, 'loading_reminder', '10min');
        }
      }
      
      // ✅ إرسال إشعار قبل الوصول بـ 2.5 ساعة
      if (timeToArrival > 0 && timeToArrival <= 2.5 * 60 * 60 * 1000) {
        const notificationSent = await checkIfNotificationSent(order._id, 'arrival_reminder', '2.5h');
        if (!notificationSent) {
          await notificationService.notifyArrivalReminder(order, 2.5);
          await markNotificationSent(order._id, 'arrival_reminder', '2.5h');
        }
      }
      
      // ✅ إرسال إشعار قبل الوصول بـ 1 ساعة
      if (timeToArrival > 0 && timeToArrival <= 60 * 60 * 1000) {
        const notificationSent = await checkIfNotificationSent(order._id, 'arrival_reminder', '1h');
        if (!notificationSent) {
          await notificationService.notifyArrivalReminder(order, 1);
          await markNotificationSent(order._id, 'arrival_reminder', '1h');
        }
      }
      
      // ✅ التحقق من الطلبات المتأخرة (أكثر من ساعتين)
      if (order.status === 'قيد الانتظار') {
        const timeSinceCreation = now - order.createdAt;
        if (timeSinceCreation > 2 * 60 * 60 * 1000) {
          const notificationSent = await checkIfNotificationSent(order._id, 'order_overdue');
          if (!notificationSent) {
            await notificationService.notifyOrderOverdue(order);
            await markNotificationSent(order._id, 'order_overdue');
          }
        }
      }
      
      // ✅ تحديث حالة الطلب تلقائياً
      if (order.status === 'جاهز للتحميل' || order.status === 'في انتظار التحميل') {
        const oneHourAfterLoading = new Date(loadingDateTime);
        oneHourAfterLoading.setHours(oneHourAfterLoading.getHours() + 1);
        
        if (now >= oneHourAfterLoading && !order.loadingCompletedAt) {
          order.status = 'تم التحميل';
          order.loadingCompletedAt = now;
          await order.save();
          
          // إرسال إشعار اكتمال التحميل
          await notificationService.notifyLoadingCompleted(order, { name: 'النظام' });
        }
      }
    }
    
    console.log(`✅ تم التحقق من ${activeOrders.length} طلب`);
  } catch (error) {
    console.error('❌ خطأ في مهمة التحقق الدقيقة:', error);
    await notificationService.notifySystemAlert(
      'خطأ في النظام',
      `حدث خطأ في مهمة التحقق المجدولة: ${error.message}`,
      'urgent'
    );
  }
};

// دالة مساعدة للتحقق من إرسال الإشعار
const checkIfNotificationSent = async (orderId, type, key = '') => {
  const Notification = require('../models/Notification');
  const notification = await Notification.findOne({
    orderId,
    type,
    'data.reminderKey': key
  });
  return !!notification;
};

// دالة مساعدة لتسجيل إرسال الإشعار
const markNotificationSent = async (orderId, type, key = '') => {
  const Notification = require('../models/Notification');
  const notification = new Notification({
    type: 'system_record',
    title: 'تسجيل إشعار',
    message: `تم إرسال إشعار ${type}`,
    data: {
      orderId,
      type,
      reminderKey: key,
      sentAt: new Date()
    },
    recipients: [], // لا يحتوي على مستلمين
    priority: 'low'
  });
  await notification.save();
};

// مهمة للتنظيف اليومي
const dailyCleanup = async () => {
  try {
    const Notification = require('../models/Notification');
    
    // حذف الإشعارات المنتهية الصلاحية
    const result = await Notification.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    
    console.log(`🗑️ تم حذف ${result.deletedCount} إشعار منتهي`);
  } catch (error) {
    console.error('❌ خطأ في مهمة التنظيف:', error);
  }
};

// تشغيل المهام المجدولة
const startCronJobs = () => {
  // تشغيل كل دقيقة للتحقق من الطلبات
  cron.schedule('* * * * *', checkOrdersMinutely);
  
  // تشغيل كل يوم في منتصف الليل للتنظيف
  cron.schedule('0 0 * * *', dailyCleanup);
  
  console.log('🚀 تم تشغيل المهام المجدولة');
};

module.exports = {
  startCronJobs,
  checkOrdersMinutely,
  dailyCleanup
};