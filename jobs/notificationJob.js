const cron = require('node-cron');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const User = require('../models/User');

// ⭐ دالة لتحويل الميلي ثانية إلى تنسيق مقروء
const formatDuration = (milliseconds) => {
  if (milliseconds <= 0) return 'تأخر';
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (minutes > 0) parts.push(`${minutes} دقيقة`);
  
  return parts.join(' و ') || 'أقل من دقيقة';
};

// ============================================
// 1. مهمة مجدولة للتحقق من الطلبات المتأخرة عن التعيين
// ============================================
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
      
      if (adminUsers.length > 0) {
        const notification = new Notification({
          type: 'order_overdue',
          title: 'طلب متأخر عن التعيين',
          message: `مرت ساعتان على الطلب رقم ${order.orderNumber} ولم يتم تعيينه للعميل`,
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            supplierName: order.supplierName,
            createdAt: order.createdAt,
            overdueBy: '2 ساعة'
          },
          recipients: adminUsers.map(user => ({ user: user._id })),
          createdBy: order.createdBy?._id
        });
        
        await notification.save();
        
        // تحديث الطلب لتسجيل وقت إرسال الإشعار
        order.notificationSentAt = new Date();
        await order.save();
        
        console.log(`📨 إشعار متأخر تم إرساله للطلب: ${order.orderNumber}`);
      }
    }
  } catch (error) {
    console.error('خطأ في مهمة التحقق من الطلبات المتأخرة:', error);
  }
};

// ============================================
// 2. مهمة للتحقق من إشعارات قبل الوصول (ساعتين ونصف)
// ============================================
const checkArrivalReminders = async () => {
  try {
    const now = new Date();
    const twoAndHalfHoursFromNow = new Date(now.getTime() + (2.5 * 60 * 60 * 1000));
    
    // البحث عن الطلبات التي وقت وصولها خلال الساعتين ونصف القادمة
    const orders = await Order.find({
      status: { $in: ['مخصص للعميل', 'في انتظار التحميل', 'جاهز للتحميل'] },
      arrivalNotificationSentAt: { $exists: false }
    }).populate('customer createdBy');
    
    for (const order of orders) {
      const arrivalDateTime = order.getFullArrivalDateTime();
      
      // إذا كان وقت الوصول خلال الساعتين ونصف القادمة
      if (arrivalDateTime > now && arrivalDateTime <= twoAndHalfHoursFromNow) {
        // حساب الوقت المتبقي
        const timeRemaining = arrivalDateTime - now;
        const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
        const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
        
        // جلب المستخدمين للإشعار (المالك + المسؤولين)
        const usersToNotify = await User.find({
          $or: [
            { _id: order.createdBy?._id },
            { role: { $in: ['admin', 'manager'] } }
          ],
          isActive: true
        });
        
        if (usersToNotify.length > 0) {
          const notification = new Notification({
            type: 'arrival_reminder',
            title: 'تذكير بقرب وقت الوصول',
            message: `الطلب رقم ${order.orderNumber} سيصل خلال ${hours} ساعة و ${minutes} دقيقة`,
            data: {
              orderId: order._id,
              orderNumber: order.orderNumber,
              supplierName: order.supplierName,
              expectedArrival: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
              timeRemaining: `${hours} ساعة و ${minutes} دقيقة`,
              customerName: order.customer?.name,
              countdown: formatDuration(timeRemaining)
            },
            recipients: usersToNotify.map(user => ({ user: user._id })),
            createdBy: order.createdBy?._id
          });
          
          await notification.save();
          
          // تحديث وقت الإشعار في الطلب
          order.arrivalNotificationSentAt = new Date();
          await order.save();
          
          console.log(`📨 إشعار وصول تم إرساله للطلب: ${order.orderNumber} (متبقي: ${hours} ساعة و ${minutes} دقيقة)`);
        }
      }
    }
  } catch (error) {
    console.error('خطأ في مهمة التحقق من تذكير الوصول:', error);
  }
};

// ============================================
// 3. مهمة للتحقق من إشعارات قبل التحميل (ساعتين ونصف)
// ============================================
const checkLoadingReminders = async () => {
  try {
    const now = new Date();
    const twoAndHalfHoursFromNow = new Date(now.getTime() + (2.5 * 60 * 60 * 1000));
    
    // البحث عن الطلبات التي وقت تحميلها خلال الساعتين ونصف القادمة
    const orders = await Order.find({
      status: { $in: ['في انتظار التحميل', 'جاهز للتحميل'] },
      loadingNotificationSentAt: { $exists: false }
    }).populate('customer createdBy driver');
    
    for (const order of orders) {
      const loadingDateTime = order.getFullLoadingDateTime();
      
      // إذا كان وقت التحميل خلال الساعتين ونصف القادمة
      if (loadingDateTime > now && loadingDateTime <= twoAndHalfHoursFromNow) {
        // حساب الوقت المتبقي
        const timeRemaining = loadingDateTime - now;
        const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
        const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
        
        // جلب المستخدمين للإشعار (المالك + المسؤولين + السائق)
        const userIds = [order.createdBy?._id];
        
        if (order.driver?._id) {
          userIds.push(order.driver._id);
        }
        
        const usersToNotify = await User.find({
          $or: [
            { _id: { $in: userIds } },
            { role: { $in: ['admin', 'manager'] } }
          ],
          isActive: true
        });
        
        if (usersToNotify.length > 0) {
          const notification = new Notification({
            type: 'loading_reminder',
            title: 'تذكير بقرب وقت التحميل',
            message: `موعد تحميل الطلب رقم ${order.orderNumber} خلال ${hours} ساعة و ${minutes} دقيقة`,
            data: {
              orderId: order._id,
              orderNumber: order.orderNumber,
              loadingTime: `${order.loadingDate.toLocaleDateString('ar-SA')} ${order.loadingTime}`,
              timeRemaining: `${hours} ساعة و ${minutes} دقيقة`,
              customerName: order.customer?.name,
              driverName: order.driverName,
              vehicleNumber: order.vehicleNumber,
              countdown: formatDuration(timeRemaining)
            },
            recipients: usersToNotify.map(user => ({ user: user._id })),
            createdBy: order.createdBy?._id
          });
          
          await notification.save();
          
          // تحديث وقت الإشعار في الطلب
          order.loadingNotificationSentAt = new Date();
          await order.save();
          
          console.log(`📨 إشعار تحميل تم إرساله للطلب: ${order.orderNumber} (متبقي: ${hours} ساعة و ${minutes} دقيقة)`);
        }
      }
    }
  } catch (error) {
    console.error('خطأ في مهمة التحقق من تذكير التحميل:', error);
  }
};

// ============================================
// 4. مهمة للتحقق من الطلبات المتأخرة عن التحميل
// ============================================
const checkLoadingOverdue = async () => {
  try {
    const now = new Date();
    
    // البحث عن الطلبات التي تجاوز وقت تحميلها
    const orders = await Order.find({
      status: { $in: ['في انتظار التحميل', 'جاهز للتحميل'] },
      loadingCompletedAt: { $exists: false }
    }).populate('customer createdBy driver');
    
    for (const order of orders) {
      const loadingDateTime = order.getFullLoadingDateTime();
      
      // إذا تجاوز وقت التحميل
      if (loadingDateTime < now) {
        const hoursOverdue = Math.floor((now - loadingDateTime) / (60 * 60 * 1000));
        const minutesOverdue = Math.floor(((now - loadingDateTime) % (60 * 60 * 1000)) / (60 * 1000));
        
        // فقط إذا تجاوزت ساعة واحدة
        if (hoursOverdue >= 1) {
          // جلب المستخدمين للإشعار
          const userIds = [order.createdBy?._id];
          
          if (order.driver?._id) {
            userIds.push(order.driver._id);
          }
          
          const usersToNotify = await User.find({
            $or: [
              { _id: { $in: userIds } },
              { role: { $in: ['admin', 'manager'] } }
            ],
            isActive: true
          });
          
          if (usersToNotify.length > 0 && hoursOverdue >= 2) {
            // إرسال إشعار للمسؤولين فقط إذا تجاوزت 2 ساعة
            const adminUsers = await User.find({ 
              role: { $in: ['admin', 'manager'] },
              isActive: true 
            });
            
            const notification = new Notification({
              type: 'loading_overdue',
              title: 'تأخير في التحميل',
              message: `الطلب رقم ${order.orderNumber} تأخر في التحميل بمقدار ${hoursOverdue} ساعة و ${minutesOverdue} دقيقة`,
              data: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                expectedLoading: `${order.loadingDate.toLocaleDateString('ar-SA')} ${order.loadingTime}`,
                hoursOverdue: hoursOverdue,
                minutesOverdue: minutesOverdue,
                customerName: order.customer?.name,
                driverName: order.driverName
              },
              recipients: adminUsers.map(user => ({ user: user._id })),
              createdBy: order.createdBy?._id
            });
            
            await notification.save();
            console.log(`⚠️ إشعار تأخير تحميل للطلب: ${order.orderNumber} (تأخير: ${hoursOverdue} ساعة)`);
          }
          
          // تحديث الحالة تلقائياً إذا تجاوزت 3 ساعات
          if (hoursOverdue >= 3 && order.status !== 'تم التحميل') {
            order.status = 'تم التحميل';
            order.loadingCompletedAt = now;
            order.delayReason = `تأخير تلقائي (${hoursOverdue} ساعة و ${minutesOverdue} دقيقة)`;
            await order.save();
            
            // إشعار بالتحويل التلقائي
            const notification = new Notification({
              type: 'auto_completion',
              title: 'اكتمال تلقائي للتحميل',
              message: `تم تحديث حالة الطلب ${order.orderNumber} تلقائياً إلى "تم التحميل" بسبب التأخير`,
              data: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                oldStatus: 'جاهز للتحميل',
                newStatus: 'تم التحميل',
                reason: 'تأخير أكثر من 3 ساعات',
                overdueTime: `${hoursOverdue} ساعة و ${minutesOverdue} دقيقة`
              },
              recipients: [{ user: order.createdBy?._id }],
              createdBy: order.createdBy?._id
            });
            
            await notification.save();
            console.log(`✅ تم تحديث حالة الطلب ${order.orderNumber} تلقائياً إلى "تم التحميل" (تأخير: ${hoursOverdue} ساعة)`);
          }
        }
      }
    }
  } catch (error) {
    console.error('خطأ في مهمة التحقق من تأخير التحميل:', error);
  }
};

// ============================================
// 5. مهمة للتحقق من الطلبات المتأخرة عن الوصول
// ============================================
const checkArrivalOverdue = async () => {
  try {
    const now = new Date();
    
    // البحث عن الطلبات التي تجاوز وقت وصولها
    const orders = await Order.find({
      status: { $in: ['مخصص للعميل'] },
      arrivalNotificationSentAt: { $exists: false }
    }).populate('customer createdBy');
    
    for (const order of orders) {
      const arrivalDateTime = order.getFullArrivalDateTime();
      
      // إذا تجاوز وقت الوصول
      if (arrivalDateTime < now) {
        const hoursOverdue = Math.floor((now - arrivalDateTime) / (60 * 60 * 1000));
        
        // إذا تجاوزت 4 ساعات
        if (hoursOverdue >= 4) {
          const adminUsers = await User.find({ 
            role: { $in: ['admin', 'manager'] },
            isActive: true 
          });
          
          const notification = new Notification({
            type: 'arrival_overdue',
            title: 'تأخير في الوصول',
            message: `الطلب رقم ${order.orderNumber} تأخر في الوصول بمقدار ${hoursOverdue} ساعة`,
            data: {
              orderId: order._id,
              orderNumber: order.orderNumber,
              expectedArrival: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
              hoursOverdue: hoursOverdue,
              supplierName: order.supplierName,
              customerName: order.customer?.name
            },
            recipients: adminUsers.map(user => ({ user: user._id })),
            createdBy: order.createdBy?._id
          });
          
          await notification.save();
          console.log(`⚠️ إشعار تأخير وصول للطلب: ${order.orderNumber} (تأخير: ${hoursOverdue} ساعة)`);
        }
      }
    }
  } catch (error) {
    console.error('خطأ في مهمة التحقق من تأخير الوصول:', error);
  }
};

// ============================================
// 6. مهمة لتنظيف الإشعارات القديمة
// ============================================
const cleanupOldNotifications = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const result = await Notification.deleteMany({
      createdAt: { $lt: thirtyDaysAgo }
    });
    
    console.log(`🧹 تم حذف ${result.deletedCount} إشعار قديم`);
  } catch (error) {
    console.error('خطأ في مهمة تنظيف الإشعارات:', error);
  }
};

// ============================================
// 7. مهمة لتحديث حالة الطلبات تلقائياً
// ============================================
const autoUpdateOrderStatus = async () => {
  try {
    const now = new Date();
    
    // تحديث الطلبات التي حان وقت وصولها
    await Order.updateMany(
      {
        status: 'مخصص للعميل',
        $expr: {
          $lte: [
            { $add: ['$arrivalDate', { $multiply: [{ $toInt: { $arrayElemAt: [{ $split: ['$arrivalTime', ':'] }, 0] } }, 3600000] }, { $multiply: [{ $toInt: { $arrayElemAt: [{ $split: ['$arrivalTime', ':'] }, 1] } }, 60000] }] },
            now
          ]
        }
      },
      {
        $set: { status: 'في انتظار التحميل', updatedAt: now }
      }
    );
    
    // تحديث الطلبات التي حان وقت تحميلها
    await Order.updateMany(
      {
        status: { $in: ['في انتظار التحميل', 'مخصص للعميل'] },
        $expr: {
          $lte: [
            { $add: ['$loadingDate', { $multiply: [{ $toInt: { $arrayElemAt: [{ $split: ['$loadingTime', ':'] }, 0] } }, 3600000] }, { $multiply: [{ $toInt: { $arrayElemAt: [{ $split: ['$loadingTime', ':'] }, 1] } }, 60000] }] },
            now
          ]
        }
      },
      {
        $set: { status: 'جاهز للتحميل', updatedAt: now }
      }
    );
    
    console.log('🔄 تم تحديث حالات الطلبات تلقائياً');
  } catch (error) {
    console.error('خطأ في مهمة تحديث حالات الطلبات:', error);
  }
};

// ============================================
// تشغيل جميع المهام المجدولة
// ============================================
const startNotificationJobs = () => {
  console.log('🚀 بدء تشغيل مهام الإشعارات المجدولة...');
  
  // تشغيل كل 5 دقائق
  cron.schedule('*/5 * * * *', () => {
    console.log('⏰ تشغيل مهام الفحص كل 5 دقائق...');
    checkOverdueOrders();
    checkArrivalReminders();
    checkLoadingReminders();
  });
  
  // تشغيل كل 15 دقيقة
  cron.schedule('*/15 * * * *', () => {
    console.log('⏰ تشغيل مهام الفحص كل 15 دقيقة...');
    checkLoadingOverdue();
    checkArrivalOverdue();
    autoUpdateOrderStatus();
  });
  
  // تشغيل كل يوم في منتصف الليل
  cron.schedule('0 0 * * *', () => {
    console.log('🌙 تشغيل مهمة التنظيف اليومية...');
    cleanupOldNotifications();
  });
  
  // تشغيل فوري للمرة الأولى
  setTimeout(() => {
    console.log('⚡ تشغيل الفحص الأولي...');
    checkOverdueOrders();
    checkArrivalReminders();
    checkLoadingReminders();
    checkLoadingOverdue();
    checkArrivalOverdue();
    autoUpdateOrderStatus();
  }, 5000); // بعد 5 ثواني من بدء السيرفر
  
  console.log('✅ تم تشغيل جميع مهام الإشعارات المجدولة بنجاح');
};

// ============================================
// تصدير جميع الدوال
// ============================================
module.exports = {
  startNotificationJobs,
  checkOverdueOrders,
  checkArrivalReminders,
  checkLoadingReminders,
  checkLoadingOverdue,
  checkArrivalOverdue,
  cleanupOldNotifications,
  autoUpdateOrderStatus,
  formatDuration // تصدير دالة التنسيق للاستخدام الخارجي
};