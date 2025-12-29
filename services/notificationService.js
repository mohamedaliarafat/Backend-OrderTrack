const notificationController = require('../controllers/notificationController');
const Order = require('../models/Order');
const User = require('../models/User');

// إنشاء إشعارات تلقائية عند الأحداث

// 1. عند إنشاء طلب جديد
exports.notifyOrderCreated = async (order, createdBy) => {
  const adminUsers = await User.find({
    role: { $in: ['admin', 'manager'] },
    isActive: true
  }).select('_id');

  await notificationController.createNotification({
    type: 'order_created',
    title: 'طلب جديد',
    message: `تم إنشاء طلب جديد برقم ${order.orderNumber}`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      supplierName: order.supplierName,
      loadingTime: `${order.loadingDate.toLocaleDateString('ar-SA')} ${order.loadingTime}`,
      arrivalTime: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`
    },
    recipients: adminUsers.map(user => user._id),
    priority: 'medium',
    createdBy: createdBy._id,
    orderId: order._id
  });
};

// 2. عند تحديث الطلب
exports.notifyOrderUpdated = async (order, updatedBy, changes) => {
  const recipients = await getOrderRecipients(order);
  
  await notificationController.createNotification({
    type: 'order_updated',
    title: 'تم تحديث الطلب',
    message: `تم تحديث الطلب رقم ${order.orderNumber}`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      changes: changes,
      updatedBy: updatedBy.name
    },
    recipients,
    priority: 'low',
    createdBy: updatedBy._id,
    orderId: order._id
  });
};

// 3. عند تعيين طلب للعميل
exports.notifyOrderAssigned = async (order, customer, assignedBy) => {
  const recipients = await getOrderRecipients(order);
  
  await notificationController.createNotification({
    type: 'order_assigned',
    title: 'تم تعيين طلب للعميل',
    message: `تم تعيين الطلب رقم ${order.orderNumber} للعميل ${customer.name}`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerName: customer.name,
      customerCode: customer.code
    },
    recipients,
    priority: 'high',
    createdBy: assignedBy._id,
    orderId: order._id
  });
};

// 4. عند تأخر الطلب
exports.notifyOrderOverdue = async (order) => {
  const adminUsers = await User.find({
    role: { $in: ['admin', 'manager'] },
    isActive: true
  }).select('_id');

  await notificationController.createNotification({
    type: 'order_overdue',
    title: 'طلب متأخر',
    message: `الطلب رقم ${order.orderNumber} متأخر ولم يتم تعيينه للعميل`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      overdueSince: order.createdAt,
      supplierName: order.supplierName
    },
    recipients: adminUsers.map(user => user._id),
    priority: 'urgent',
    orderId: order._id
  });
};

// 5. تذكير قبل التحميل
exports.notifyLoadingReminder = async (order, minutesBefore) => {
  const recipients = await getOrderRecipients(order);
  
  await notificationController.createNotification({
    type: 'loading_reminder',
    title: 'تذكير بموعد التحميل',
    message: `موعد تحميل الطلب رقم ${order.orderNumber} بعد ${minutesBefore} دقيقة`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      loadingTime: `${order.loadingDate.toLocaleDateString('ar-SA')} ${order.loadingTime}`,
      minutesLeft: minutesBefore
    },
    recipients,
    priority: 'high',
    orderId: order._id
  });
};

// 6. تذكير قبل الوصول
exports.notifyArrivalReminder = async (order, hoursBefore) => {
  const recipients = await getOrderRecipients(order);
  
  await notificationController.createNotification({
    type: 'arrival_reminder',
    title: 'تذكير بموعد الوصول',
    message: `الطلب رقم ${order.orderNumber} سيصل بعد ${hoursBefore} ساعة`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      arrivalTime: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
      hoursLeft: hoursBefore
    },
    recipients,
    priority: 'medium',
    orderId: order._id
  });
};

// 7. عند اكتمال التحميل
exports.notifyLoadingCompleted = async (order, completedBy) => {
  const recipients = await getOrderRecipients(order);
  
  await notificationController.createNotification({
    type: 'loading_completed',
    title: 'تم اكتمال التحميل',
    message: `تم اكتمال تحميل الطلب رقم ${order.orderNumber}`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      completedAt: new Date(),
      completedBy: completedBy.name
    },
    recipients,
    priority: 'medium',
    createdBy: completedBy._id,
    orderId: order._id
  });
};

// 8. عند تغيير حالة الطلب
exports.notifyStatusChanged = async (order, oldStatus, newStatus, changedBy) => {
  const recipients = await getOrderRecipients(order);
  
  await notificationController.createNotification({
    type: 'status_changed',
    title: 'تغيير حالة الطلب',
    message: `تم تغيير حالة الطلب ${order.orderNumber} من ${oldStatus} إلى ${newStatus}`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      oldStatus,
      newStatus,
      changedBy: changedBy.name
    },
    recipients,
    priority: 'medium',
    createdBy: changedBy._id,
    orderId: order._id
  });
};

// دالة مساعدة للحصول على المستلمين
const getOrderRecipients = async (order) => {
  const recipients = new Set();
  
  // إضافة المنشئ
  if (order.createdBy) {
    recipients.add(order.createdBy.toString());
  }
  
  // إضافة الإداريين
  const adminUsers = await User.find({
    role: { $in: ['admin', 'manager'] },
    isActive: true
  }).select('_id');
  
  adminUsers.forEach(user => recipients.add(user._id.toString()));
  
  // إضافة المستخدمين المشتركين في الطلب
  // يمكنك توسيع هذه الدالة حسب الحاجة
  
  return Array.from(recipients);
};

// إشعارات النظام
exports.notifySystemAlert = async (title, message, priority = 'high') => {
  const adminUsers = await User.find({
    role: { $in: ['admin', 'manager'] },
    isActive: true
  }).select('_id');

  await notificationController.createNotification({
    type: 'system_alert',
    title,
    message,
    data: {
      alertTime: new Date(),
      severity: priority
    },
    recipients: adminUsers.map(user => user._id),
    priority,
    createdAt: new Date()
  });
};