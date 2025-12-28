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
  loadingCompletedAt: { // وقت اكتمال التحميل الفعلي
    type: Date
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// دالة لتحويل التاريخ والوقت إلى كائن Date
orderSchema.methods.getFullLoadingDateTime = function() {
  const [hours, minutes] = this.loadingTime.split(':');
  const date = new Date(this.loadingDate);
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return date;
};

orderSchema.methods.getFullArrivalDateTime = function() {
  const [hours, minutes] = this.arrivalTime.split(':');
  const date = new Date(this.arrivalDate);
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return date;
};

// حساب وقت الإشعار قبل الوصول (ساعتين ونصف)
orderSchema.methods.getArrivalNotificationTime = function() {
  const arrivalDateTime = this.getFullArrivalDateTime();
  const notificationTime = new Date(arrivalDateTime);
  notificationTime.setHours(notificationTime.getHours() - 2);
  notificationTime.setMinutes(notificationTime.getMinutes() - 30);
  return notificationTime;
};

orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // تحديث الحالة بناءً على الأوقات
  if (this.isModified('loadingDate') || this.isModified('loadingTime')) {
    const now = new Date();
    const loadingDateTime = this.getFullLoadingDateTime();
    
    if (now >= loadingDateTime) {
      this.status = 'في انتظار التحميل';
    }
  }
  
  next();
});

module.exports = mongoose.model('Order', orderSchema);