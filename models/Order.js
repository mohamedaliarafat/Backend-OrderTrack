const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  supplierName: {
    type: String,
    required: true,
    trim: true
  },
  requestType: {
    type: String,
    required: true,
    enum: ['تزويد وقود', 'صيانة', 'خدمات لوجستية', 'مورد']
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  supplierOrderNumber: {
    type: String,
    trim: true
  },
  
  // الأوقات الجديدة
  loadingDate: {
    type: Date,
    required: true
  },
  loadingTime: { // وقت التحميل (ساعة:دقيقة)
    type: String,
    required: true,
    default: '08:00'
  },
  arrivalDate: {
    type: Date,
    required: true
  },
  arrivalTime: { // وقت الوصول المتوقع
    type: String,
    required: true,
    default: '10:00'
  },
  
  status: {
    type: String,
    enum: [
      'قيد الانتظار', 
      'مخصص للعميل', 
      'في انتظار التحميل', // جديد
      'جاهز للتحميل', 
      'تم التحميل',
      'ملغى'
    ],
    default: 'قيد الانتظار'
  },
  
  driverName: {
    type: String,
    trim: true
  },
  driverPhone: {
    type: String
  },
  vehicleNumber: {
    type: String
  },
  
  // حقل السائق كمرجع
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  
  fuelType: {
    type: String,
    enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين', 'غاز طبيعي']
  },
  quantity: {
    type: Number,
    min: 0
  },
  unit: {
    type: String,
    enum: ['لتر', 'جالون', 'برميل', 'طن']
  },
  notes: {
    type: String
  },
  
  // إضافة حقل العميل
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  
  // تتبع الإشعارات
  notificationSentAt: {
    type: Date
  },
  arrivalNotificationSentAt: { // إشعار قبل الوصول بساعتين ونصف
    type: Date
  },
  loadingNotificationSentAt: { // إشعار قبل التحميل بساعتين ونصف ⭐ جديد
    type: Date
  },
  loadingCompletedAt: { // وقت اكتمال التحميل الفعلي
    type: Date
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // معلومات المستخدم الذي أنشأ الطلب
  createdByName: {
    type: String
  },
  
  companyLogo: {
    type: String
  },
  attachments: [{
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // معلومات التتبع
  actualArrivalTime: { // وقت الوصول الفعلي
    type: String
  },
  loadingDuration: { // مدة التحميل (بالدقائق)
    type: Number,
    min: 0
  },
  delayReason: { // سبب التأخير إن وجد
    type: String
  },
  
  // ⭐ جديد: علامات للمؤقتات
  hasArrivalTimer: {
    type: Boolean,
    default: false
  },
  hasLoadingTimer: {
    type: Boolean,
    default: false
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ============================================
// دالة لتحويل التاريخ والوقت إلى كائن Date
// ============================================
orderSchema.methods.getFullLoadingDateTime = function() {
  try {
    const [hours, minutes] = this.loadingTime.split(':');
    const date = new Date(this.loadingDate);
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
  } catch (error) {
    const date = new Date(this.loadingDate);
    date.setHours(8, 0, 0, 0); // القيمة الافتراضية
    return date;
  }
};

orderSchema.methods.getFullArrivalDateTime = function() {
  try {
    const [hours, minutes] = this.arrivalTime.split(':');
    const date = new Date(this.arrivalDate);
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
  } catch (error) {
    const date = new Date(this.arrivalDate);
    date.setHours(10, 0, 0, 0); // القيمة الافتراضية
    return date;
  }
};

// ============================================
// حساب وقت الإشعار قبل الوصول (ساعتين ونصف)
// ============================================
orderSchema.methods.getArrivalNotificationTime = function() {
  const arrivalDateTime = this.getFullArrivalDateTime();
  const notificationTime = new Date(arrivalDateTime);
  notificationTime.setHours(notificationTime.getHours() - 2);
  notificationTime.setMinutes(notificationTime.getMinutes() - 30);
  return notificationTime;
};

// ⭐ جديد: حساب وقت الإشعار قبل التحميل (ساعتين ونصف)
orderSchema.methods.getLoadingNotificationTime = function() {
  const loadingDateTime = this.getFullLoadingDateTime();
  const notificationTime = new Date(loadingDateTime);
  notificationTime.setHours(notificationTime.getHours() - 2);
  notificationTime.setMinutes(notificationTime.getMinutes() - 30);
  return notificationTime;
};

// ============================================
// دوال المؤقتات (جديدة)
// ============================================

// دالة لحساب الوقت المتبقي قبل الوصول
orderSchema.methods.getArrivalRemaining = function() {
  const arrivalDateTime = this.getFullArrivalDateTime();
  const now = new Date();
  return arrivalDateTime - now;
};

// دالة لحساب الوقت المتبقي قبل التحميل
orderSchema.methods.getLoadingRemaining = function() {
  const loadingDateTime = this.getFullLoadingDateTime();
  const now = new Date();
  return loadingDateTime - now;
};

// دالة لتنسيق الوقت المتبقي قبل الوصول
orderSchema.methods.getFormattedArrivalCountdown = function() {
  const remaining = this.getArrivalRemaining();
  
  if (remaining <= 0) {
    return 'تأخر';
  }
  
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (minutes > 0) parts.push(`${minutes} دقيقة`);
  
  return parts.join(' و ') || 'أقل من دقيقة';
};

// دالة لتنسيق الوقت المتبقي قبل التحميل
orderSchema.methods.getFormattedLoadingCountdown = function() {
  const remaining = this.getLoadingRemaining();
  
  if (remaining <= 0) {
    return 'تأخر';
  }
  
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (minutes > 0) parts.push(`${minutes} دقيقة`);
  
  return parts.join(' و ') || 'أقل من دقيقة';
};

// دالة للتحقق إذا كان الطلب يحتاج إشعار قبل الوصول
orderSchema.methods.needsArrivalNotification = function() {
  const remaining = this.getArrivalRemaining();
  const twoAndHalfHours = 2.5 * 60 * 60 * 1000;
  
  return remaining > 0 && 
         remaining <= twoAndHalfHours && 
         !this.arrivalNotificationSentAt &&
         ['مخصص للعميل', 'في انتظار التحميل', 'جاهز للتحميل'].includes(this.status);
};

// ⭐ جديد: دالة للتحقق إذا كان الطلب يحتاج إشعار قبل التحميل
orderSchema.methods.needsLoadingNotification = function() {
  const remaining = this.getLoadingRemaining();
  const twoAndHalfHours = 2.5 * 60 * 60 * 1000;
  
  return remaining > 0 && 
         remaining <= twoAndHalfHours && 
         !this.loadingNotificationSentAt &&
         ['في انتظار التحميل', 'جاهز للتحميل'].includes(this.status);
};

// دالة للتحقق إذا كان الطلب يقترب من وقت الوصول (ساعتين ونصف أو أقل)
orderSchema.methods.isApproachingArrival = function() {
  const remaining = this.getArrivalRemaining();
  const twoAndHalfHours = 2.5 * 60 * 60 * 1000;
  
  return remaining > 0 && remaining <= twoAndHalfHours;
};

// دالة للتحقق إذا كان الطلب يقترب من وقت التحميل (ساعتين ونصف أو أقل)
orderSchema.methods.isApproachingLoading = function() {
  const remaining = this.getLoadingRemaining();
  const twoAndHalfHours = 2.5 * 60 * 60 * 1000;
  
  return remaining > 0 && remaining <= twoAndHalfHours;
};

// دالة للتحقق إذا كان الطلب متأخر عن وقت الوصول
orderSchema.methods.isArrivalOverdue = function() {
  const remaining = this.getArrivalRemaining();
  return remaining < 0;
};

// دالة للتحقق إذا كان الطلب متأخر عن وقت التحميل
orderSchema.methods.isLoadingOverdue = function() {
  const remaining = this.getLoadingRemaining();
  return remaining < 0;
};

// دالة لإرجاع حالة المؤقت
orderSchema.methods.getTimerStatus = function() {
  const now = new Date();
  const arrivalDateTime = this.getFullArrivalDateTime();
  const loadingDateTime = this.getFullLoadingDateTime();
  
  const arrivalRemaining = arrivalDateTime - now;
  const loadingRemaining = loadingDateTime - now;
  
  const twoAndHalfHours = 2.5 * 60 * 60 * 1000;
  
  if (this.status === 'تم التحميل' || this.status === 'ملغى') {
    return {
      hasTimer: false,
      type: 'completed',
      message: 'تم إكمال الطلب'
    };
  }
  
  if (loadingRemaining < 0) {
    return {
      hasTimer: true,
      type: 'overdue_loading',
      message: 'تأخر في التحميل',
      remaining: loadingRemaining,
      formatted: 'تأخر'
    };
  }
  
  if (arrivalRemaining < 0) {
    return {
      hasTimer: true,
      type: 'overdue_arrival',
      message: 'تأخر في الوصول',
      remaining: arrivalRemaining,
      formatted: 'تأخر'
    };
  }
  
  if (loadingRemaining <= twoAndHalfHours) {
    return {
      hasTimer: true,
      type: 'approaching_loading',
      message: 'وقت التحميل قريب',
      remaining: loadingRemaining,
      formatted: this.getFormattedLoadingCountdown()
    };
  }
  
  if (arrivalRemaining <= twoAndHalfHours) {
    return {
      hasTimer: true,
      type: 'approaching_arrival',
      message: 'وقت الوصول قريب',
      remaining: arrivalRemaining,
      formatted: this.getFormattedArrivalCountdown()
    };
  }
  
  return {
    hasTimer: true,
    type: 'normal',
    message: 'في الموعد',
    remaining: arrivalRemaining,
    formatted: this.getFormattedArrivalCountdown()
  };
};

// ============================================
// Middleware قبل الحفظ
// ============================================
orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // إضافة اسم المستخدم الذي أنشأ الطلب
  if (!this.createdByName && this.createdBy) {
    // سيتم تعبئتها من الباك إند
  }
  
  // تحديث الحالة بناءً على الأوقات
  const now = new Date();
  const arrivalDateTime = this.getFullArrivalDateTime();
  const loadingDateTime = this.getFullLoadingDateTime();
  
  // إذا حان وقت الوصول ولم يتم تغيير الحالة
  if (now >= arrivalDateTime && this.status === 'مخصص للعميل') {
    this.status = 'في انتظار التحميل';
  }
  
  // إذا حان وقت التحميل
  if (now >= loadingDateTime && ['مخصص للعميل', 'في انتظار التحميل'].includes(this.status)) {
    this.status = 'جاهز للتحميل';
  }
  
  // تحديث علامات المؤقتات
  const twoAndHalfHours = 2.5 * 60 * 60 * 1000;
  const arrivalRemaining = arrivalDateTime - now;
  const loadingRemaining = loadingDateTime - now;
  
  this.hasArrivalTimer = arrivalRemaining > 0 && arrivalRemaining <= twoAndHalfHours;
  this.hasLoadingTimer = loadingRemaining > 0 && loadingRemaining <= twoAndHalfHours;
  
  next();
});

// ============================================
// Indexes للأداء الأمثل
// ============================================
orderSchema.index({ status: 1 });
orderSchema.index({ arrivalDate: 1 });
orderSchema.index({ loadingDate: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ supplierName: 1 });
orderSchema.index({ createdBy: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ driver: 1 });

// ============================================
// Virtuals لبيانات العرض
// ============================================
orderSchema.virtual('displayInfo').get(function() {
  const timerStatus = this.getTimerStatus();
  
  return {
    orderNumber: this.orderNumber,
    supplierName: this.supplierName,
    status: this.status,
    arrivalCountdown: this.getFormattedArrivalCountdown(),
    loadingCountdown: this.getFormattedLoadingCountdown(),
    timerStatus: timerStatus,
    hasActiveTimer: timerStatus.hasTimer && !['completed', 'cancelled'].includes(timerStatus.type),
    needsAttention: ['overdue_arrival', 'overdue_loading', 'approaching_arrival', 'approaching_loading'].includes(timerStatus.type)
  };
});

module.exports = mongoose.model('Order', orderSchema);