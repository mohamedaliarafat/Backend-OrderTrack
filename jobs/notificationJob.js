const cron = require('node-cron');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const User = require('../models/User');
const orderController = require('../controllers/orderController');

// مهمة مجدولة للتحقق من الطلبات المتأخرة
const checkOverdueOrders = async () => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    // البحث عن الطلبات التي مر عليها ساعتين ولم يتم تعيينها لعملاء
    const overdueOrders = await Order.find({
      status: 'قيد الانتظار',
      createdAt: { $lte: twoHoursAgo },
      notificationSentAt: { $exists: false }
    }).populate('createdBy');
    
    for (const order of overdueOrders) {
      // إرسال إشعار للمسؤولين
      const adminUsers = await User.find({ 
        role: { $in: ['admin', 'manager'] },
        isActive: true 
      });
      
      const notification = new Notification({
        type: 'order_overdue',
        title: 'طلب متأخر',
        message: `مرت ساعتان على الطلب رقم ${order.orderNumber} ولم يتم تعيينه للعميل`,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          supplierName: order.supplierName,
          createdAt: order.createdAt
        },
        recipients: adminUsers.map(user => ({ user: user._id })),
        createdBy: order.createdBy._id
      });
      
      await notification.save();
      
      // تحديث الطلب لتسجيل وقت إرسال الإشعار
      order.notificationSentAt = new Date();
      await order.save();
      
      console.log(`📨 إشعار متأخر تم إرساله للطلب: ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('خطأ في مهمة التحقق من الطلبات المتأخرة:', error);
  }
};

// مهمة للتحقق من إشعارات قبل الوصول
const checkArrivalNotifications = async () => {
  try {
    await orderController.checkArrivalNotifications();
    console.log('✅ تم التحقق من إشعارات الوصول');
  } catch (error) {
    console.error('خطأ في مهمة التحقق من إشعارات الوصول:', error);
  }
};

// مهمة للتحقق من اكتمال التحميل
const checkCompletedLoading = async () => {
  try {
    await orderController.checkCompletedLoading();
    console.log('✅ تم التحقق من اكتمال التحميل');
  } catch (error) {
    console.error('خطأ في مهمة التحقق من اكتمال التحميل:', error);
  }
};

// مهمة للتحقق من الطلبات القريبة من وقت التحميل
const checkUpcomingLoadingOrders = async () => {
  try {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    // البحث عن الطلبات التي وقت تحميلها خلال الساعة القادمة
    const upcomingOrders = await Order.find({
      status: { $in: ['مخصص للعميل', 'في انتظار التحميل'] }
    }).populate('customer createdBy');
    
    for (const order of upcomingOrders) {
      const loadingDateTime = order.getFullLoadingDateTime();
      
      if (loadingDateTime >= now && loadingDateTime <= oneHourLater) {
        // إرسال إشعار للمستخدمين المعنيين
        const recipients = [];
        
        if (order.createdBy) {
          recipients.push(order.createdBy._id);
        }
        
        const notification = new Notification({
          type: 'loading_reminder',
          title: 'تذكير بموعد التحميل',
          message: `موعد تحميل الطلب رقم ${order.orderNumber} خلال الساعة القادمة`,
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            loadingTime: `${order.loadingDate.toLocaleDateString('ar-SA')} ${order.loadingTime}`,
            customerName: order.customer?.name
          },
          recipients: recipients.map(userId => ({ user: userId })),
          createdBy: order.createdBy?._id
        });
        
        await notification.save();
        console.log(`📨 إشعار تحميل تم إرساله للطلب: ${order.orderNumber}`);
      }
    }
  } catch (error) {
    console.error('خطأ في مهمة التحقق من الطلبات القريبة:', error);
  }
};

// تشغيل المهام المجدولة
const startNotificationJobs = () => {
  // تشغيل كل 5 دقائق للتحقق من الطلبات المتأخرة
  cron.schedule('*/5 * * * *', checkOverdueOrders);
  
  // تشغيل كل 10 دقائق للتحقق من إشعارات الوصول
  cron.schedule('*/10 * * * *', checkArrivalNotifications);
  
  // تشغيل كل 15 دقيقة للتحقق من اكتمال التحميل
  cron.schedule('*/15 * * * *', checkCompletedLoading);
  
  // تشغيل كل 30 دقيقة للتحقق من الطلبات القريبة من وقت التحميل
  cron.schedule('*/30 * * * *', checkUpcomingLoadingOrders);
  
  console.log('🚀 تم تشغيل جميع مهام الإشعارات المجدولة');
};

module.exports = {
  startNotificationJobs,
  checkOverdueOrders,
  checkArrivalNotifications,
  checkCompletedLoading,
  checkUpcomingLoadingOrders
};