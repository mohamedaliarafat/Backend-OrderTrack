const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // ============================================
  // 🏢 معلومات الأساسية
  // ============================================
  orderDate: {
    type: Date,
    required: true,
    default: Date.now
  },
 orderNumber: {
  type: String,
  unique: true
},

supplierOrderNumber: {
  type: String,
  trim: true
},
  
  // ⭐ حقل حاسم: مصدر الطلب
  orderSource: {
    type: String,
    enum: ['مورد', 'عميل', 'مدمج'],
    required: true,
    default: 'مورد'
  },
  
  // ⭐ حالة الدمج (إذا كان الطلب مدمج)
  mergeStatus: {
    type: String,
    enum: ['منفصل', 'في انتظار الدمج', 'مدمج', 'مكتمل'],
    default: 'منفصل'
  },
  
  // ⭐ معرف الطلب الأصلي (للدمج)
  originalOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  
  // ⭐ معرف الطلب المدمج (إذا كان هذا هو الطلب الأصلي)
  mergedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  
  // ============================================
  // 👥 معلومات الأطراف
  // ============================================
  
  // ⭐ المورد (مطلوب للجميع)
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  
  // معلومات المورد (نسخ احتياطية)
  supplierName: {
    type: String,
    trim: true
  },
  supplierContactPerson: {
    type: String,
    trim: true
  },
  supplierPhone: {
    type: String
  },
  supplierAddress: {
    type: String
  },
  supplierCompany: {
    type: String
  },
  
  // ⭐ العميل (مطلوب للجميع)
customer: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Customer',
  required: function () {
    return this.orderSource === 'عميل';
  }
},

  
  // معلومات العميل (نسخ احتياطية)
  customerName: {
  type: String,
  required: function () {
    return this.orderSource === 'عميل';
  }
},

  customerCode: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String
  },
  customerEmail: {
    type: String
  },

 requestType: {
  type: String,
  enum: ['شراء', 'نقل'],
  required: function () {
    return this.orderSource === 'عميل';
  },
  default: function () {
    // لو طلب عميل → الافتراضي شراء
    if (this.orderSource === 'عميل') {
      return 'شراء';
    }
    // لو مورد → لا نحط قيمة
    return undefined;
  }
},

  
  // ============================================
  // 📍 معلومات الموقع
  // ============================================
city: {
  type: String,
  required: function () {
    return true; // مطلوب دايمًا لكن هيتملأ قبل التحقق
  }
},
area: {
  type: String,
  required: function () {
    return true;
  }
},
address: {
  type: String,
  required: function () {
    return true;
  }
},


deliveryDuration: {
  type: Number, // المدة بالدقائق
  min: 0
},
distance: {
  type: Number, // المسافة بالكيلومتر
  min: 0
},
driverEarnings: {
  type: Number,
  min: 0
},

// في driverSchema:
totalEarnings: {
  type: Number,
  default: 0
},
totalDistance: {
  type: Number,
  default: 0
},
totalDeliveries: {
  type: Number,
  default: 0
},
averageRating: {
  type: Number,
  min: 0,
  max: 5,
  default: 0
},


  
  // ============================================
  // ⏰ معلومات التوقيت
  // ============================================
  loadingDate: {
    type: Date,
    required: true
  },
  loadingTime: {
    type: String,
    required: true,
    default: '08:00'
  },
  arrivalDate: {
    type: Date,
    required: true
  },
  arrivalTime: {
    type: String,
    required: true,
    default: '10:00'
  },
  
  // ============================================
  // 📊 حالة الطلب
  // ============================================
  status: {
    type: String,
    enum: [
      // حالات المورد
      'في انتظار عمل طلب جديد',
      'تم التأكيد من المورد',
      'جاهز للشحن',
      
      // حالات العميل
      'في انتظار عمل طلب جديد',
      'تم إنشاء طلب العميل',
      'في انتظار تأكيد العميل',
      'تم تأكيد العميل',

       'مدمج وجاهز للتنفيذ',

       'تم دمجه',

      
      // حالات مشتركة
      'تم دمجه',
      'في انتظار التحميل',
      'مدمج وجاهز للتنفيذ',
      'تم التنفيذ',
      'في الطريق',
      'تم التنفيذ',
      'ملغى',
      'مكتمل'
    ],
    default: 'في انتظار عمل طلب جديد'
  },
  
  // ============================================
  // 🚚 معلومات الشحن
  // ============================================
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
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
  
  // ============================================
  // ⛽ معلومات المنتج
  // ============================================
  productType: {
    type: String,
    enum: ['وقود', 'صيانة', 'خدمات لوجستية', 'أخرى'],
    default: 'وقود'
  },
  
  // معلومات الوقود
  fuelType: {
    type: String,
    enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين', 'غاز طبيعي', 'أخرى']
  },
  quantity: {
    type: Number,
    min: 0,
    required: true
  },
  unit: {
    type: String,
    enum: ['لتر', 'جالون', 'برميل', 'طن', 'كجم', 'وحدة'],
    default: 'لتر'
  },
  
  // ============================================
  // 💰 معلومات السعر والدفع
  // ============================================
  unitPrice: {
    type: Number,
    min: 0
  },
  totalPrice: {
    type: Number,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['نقداً', 'تحويل بنكي', 'شيك', 'آجل', 'غير محدد'],
    default: 'غير محدد'
  },
  paymentStatus: {
    type: String,
    enum: ['مدفوع', 'غير مدفوع', 'جزئي', 'غير مطلوب'],
    default: 'غير مدفوع'
  },
  
  // ============================================
  // 📝 معلومات إضافية
  // ============================================
  notes: {
    type: String
  },
  
  supplierNotes: { // ملاحظات خاصة بالمورد
    type: String
  },
  
  customerNotes: { // ملاحظات خاصة بالعميل
    type: String
  },
  
  internalNotes: { // ملاحظات داخلية
    type: String
  },

  customerWaitingStartedAt: {
  type: Date
  },

  customerWaitingDeadline: {
    type: Date // = startedAt + 24 ساعة
  },

  customerWarningSentAt: {
    type: Date
  },

  cancellationReason: {
    type: String
  },
  
  // ============================================
  // 📎 المرفقات
  // ============================================
  attachments: [{
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  supplierDocuments: [{ // مستندات المورد
    type: { type: String, enum: ['فاتورة', 'عقد', 'شهادة', 'أخرى'] },
    filename: String,
    path: String,
    uploadedAt: Date
  }],
  
  customerDocuments: [{ // مستندات العميل
    type: { type: String, enum: ['طلب', 'موافقة', 'فاتورة', 'أخرى'] },
    filename: String,
    path: String,
    uploadedAt: Date
  }],
  
  // ============================================
  // 🔔 الإشعارات
  // ============================================
  notificationSentAt: {
    type: Date
  },
  arrivalNotificationSentAt: {
    type: Date
  },
  loadingNotificationSentAt: {
    type: Date
  },
  loadingCompletedAt: {
    type: Date
  },
  
  // إشعارات خاصة
  supplierNotifiedAt: {
    type: Date
  },
  customerNotifiedAt: {
    type: Date
  },
  
  // ============================================
  // 📊 التتبع والتأخير
  // ============================================
  actualArrivalTime: {
    type: String
  },
  loadingDuration: {
    type: Number,
    min: 0
  },
  delayReason: {
    type: String
  },
  
  // مؤقتات
  hasArrivalTimer: {
    type: Boolean,
    default: false
  },
  hasLoadingTimer: {
    type: Boolean,
    default: false
  },
  
  // ============================================
  // 👤 معلومات الإنشاء
  // ============================================
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdByName: {
    type: String
  },
  
  // منشئ الطلب الأصلي
  originalCreator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ============================================
  // 📅 التواريخ
  // ============================================
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // تواريخ خاصة
  supplierConfirmedAt: {
    type: Date
  },
  customerConfirmedAt: {
    type: Date
  },
  mergedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  }
});

// ============================================
// 📍 تعبئة الموقع قبل الـ validation (حل جذري)
// ============================================
orderSchema.pre('validate', async function (next) {
  try {
    // ===== طلب مورد =====
    if (this.orderSource === 'مورد' && this.supplier) {
      const supplier = await mongoose.model('Supplier').findById(this.supplier);

      if (supplier) {
        if (!this.city && supplier.city) {
          this.city = supplier.city;
        }

        if (!this.area && supplier.area) {
          this.area = supplier.area;
        }

        if (!this.address && supplier.address) {
          this.address = supplier.address;
        }
      }
    }

    // ===== طلب عميل =====
    if (this.orderSource === 'عميل' && this.customer) {
      const customer = await mongoose.model('Customer').findById(this.customer);

      if (customer) {
        if (!this.city && customer.city) {
          this.city = customer.city;
        }

        if (!this.area && customer.area) {
          this.area = customer.area;
        }

        if (!this.address && customer.address) {
          this.address = customer.address;
        }
      }
    }

    next();
  } catch (err) {
    console.error('❌ Error in pre-validate location:', err);
    next(err);
  }
});


// ============================================
// 📝 Middleware قبل الحفظ - تم التعديل
// ============================================

// توليد رقم طلب تلقائي
orderSchema.pre('save', async function (next) {
  // =========================
  // 🆔 توليد رقم الطلب
  // =========================
  if (!this.orderNumber) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    let prefix;
    switch (this.orderSource) {
      case 'مورد':
        prefix = 'SUP';
        break;
      case 'عميل':
        prefix = 'CUS';
        break;
      case 'مدمج':
        prefix = 'MIX';
        break;
      default:
        prefix = 'ORD';
    }

    try {
      const lastOrder = await mongoose.model('Order').findOne({
        orderNumber: new RegExp(`^${prefix}-${year}${month}${day}-`)
      }).sort({ orderNumber: -1 });

      let sequence = 1;
      if (lastOrder?.orderNumber) {
        sequence = parseInt(lastOrder.orderNumber.split('-').pop()) + 1;
      }

      this.orderNumber = `${prefix}-${year}${month}${day}-${String(sequence).padStart(4, '0')}`;
    } catch {
      this.orderNumber = `${prefix}-${year}${month}${day}-0001`;
    }
  }

  // =========================
  // 🕒 تحديث وقت التعديل
  // =========================
  this.updatedAt = new Date();

  // =========================
  // 🧾 حالة طلب العميل + المهلة
  // =========================
  if (this.orderSource === 'عميل') {
    // الحالة الافتراضية
    if (!this.status) {
      this.status = 'في انتظار إنشاء طلب العميل';
    }

    // ⏱️ بدء مهلة 24 ساعة (مرة واحدة فقط)
    if (
      this.status === 'في انتظار إنشاء طلب العميل' &&
      !this.customerWaitingStartedAt
    ) {
      const now = new Date();
      this.customerWaitingStartedAt = now;
      this.customerWaitingDeadline = new Date(
        now.getTime() + 24 * 60 * 60 * 1000
      );
    }
  }

  // =========================
  // 💰 حساب السعر
  // =========================
  if (this.quantity && this.unitPrice) {
    this.totalPrice = this.quantity * this.unitPrice;
  }

  // =========================
  // 👤 تعبئة بيانات العميل
  // =========================
  if (!this.customerName && this.customer) {
    try {
      const customer = await mongoose.model('Customer').findById(this.customer);
      if (customer) {
        this.customerName = customer.name || '';
        this.customerCode = customer.code || '';
        this.customerPhone = customer.phone || '';
        this.customerEmail = customer.email || '';

        if (!this.city && customer.city) this.city = customer.city;
        if (!this.area && customer.area) this.area = customer.area;
        if (!this.address && customer.address) this.address = customer.address;
      }
    } catch (e) {
      console.error('Error populating customer:', e);
    }
  }

  // =========================
  // 🏭 تعبئة بيانات المورد
  // =========================
  if (this.supplier) {
  try {
    const supplier = await mongoose.model('Supplier').findById(this.supplier);
    if (supplier) {
      if (!this.supplierName) this.supplierName = supplier.name || '';
      if (!this.supplierCompany) this.supplierCompany = supplier.company || '';
      if (!this.supplierContactPerson)
        this.supplierContactPerson = supplier.contactPerson || '';
      if (!this.supplierPhone) this.supplierPhone = supplier.phone || '';

      // 🔴 المهم جدًا
      if (!this.supplierAddress && supplier.address) {
        this.supplierAddress = supplier.address;
      }
    }
  } catch (e) {
    console.error('Error populating supplier:', e);
  }
}

  // =========================
  // 🚚 تعبئة بيانات السائق
  // =========================
  if (this.driver && !this.driverName) {
    try {
      const driver = await mongoose.model('Driver').findById(this.driver);
      if (driver) {
        this.driverName = driver.name || '';
        this.driverPhone = driver.phone || '';
        this.vehicleNumber = driver.vehicleNumber || '';
      }
    } catch (e) {
      console.error('Error populating driver:', e);
    }
  }

  // =========================
  // 👤 اسم منشئ الطلب
  // =========================
  if (!this.createdByName && this.createdBy) {
    try {
      const user = await mongoose.model('User').findById(this.createdBy);
      if (user) {
        this.createdByName = user.name || '';
      }
    } catch (e) {
      console.error('Error populating creator:', e);
    }
  }

  // ❌ لا نغيّر حالة طلب العميل تلقائيًا هنا
  // يتم التغيير فقط عند الدمج أو عبر cron

  next();
});



// ============================================
// 🔧 دوال المساعدة - أضف تعريفها هنا
// ============================================

// تحديث الحالة بناءً على الوقت
orderSchema.methods.updateStatusBasedOnTime = function() {
  const now = new Date();
  const arrivalDateTime = this.getFullArrivalDateTime();
  const loadingDateTime = this.getFullLoadingDateTime();
  
  // إذا كان طلب عميل وتحول من "في انتظار إنشاء" إلى "تم إنشاء"
  if (this.orderSource === 'عميل' && this.status === 'في انتظار إنشاء طلب العميل') {
    this.status = 'تم إنشاء طلب العميل';
  }
  
  // إذا حان وقت الوصول
  if (now >= arrivalDateTime && ['تم إنشاء طلب العميل', 'في انتظار عمل طلب جديد', 'تم تأكيد العميل'].includes(this.status)) {
    this.status = 'في انتظار التحميل';
  }
  
  // إذا حان وقت التحميل
  if (now >= loadingDateTime && ['في انتظار التحميل'].includes(this.status)) {
    this.status = 'مدمج وجاهز للتنفيذ';
  }
};



// تحديث المؤقتات
orderSchema.methods.updateTimers = function() {
  const now = new Date();
  const arrivalDateTime = this.getFullArrivalDateTime();
  const loadingDateTime = this.getFullLoadingDateTime();
  
  const twoAndHalfHours = 2.5 * 60 * 60 * 1000;
  const arrivalRemaining = arrivalDateTime - now;
  const loadingRemaining = loadingDateTime - now;
  
  this.hasArrivalTimer = arrivalRemaining > 0 && arrivalRemaining <= twoAndHalfHours;
  this.hasLoadingTimer = loadingRemaining > 0 && loadingRemaining <= twoAndHalfHours;
};

// الحصول على وقت التحميل الكامل
orderSchema.methods.getFullLoadingDateTime = function() {
  try {
    if (!this.loadingDate || !this.loadingTime) {
      return new Date();
    }
    
    const [hours, minutes] = this.loadingTime.split(':');
    const date = new Date(this.loadingDate);
    date.setHours(parseInt(hours) || 8, parseInt(minutes) || 0, 0, 0);
    return date;
  } catch (error) {
    return new Date();
  }
};

// الحصول على وقت الوصول الكامل
orderSchema.methods.getFullArrivalDateTime = function() {
  try {
    if (!this.arrivalDate || !this.arrivalTime) {
      return new Date();
    }
    
    const [hours, minutes] = this.arrivalTime.split(':');
    const date = new Date(this.arrivalDate);
    date.setHours(parseInt(hours) || 10, parseInt(minutes) || 0, 0, 0);
    return date;
  } catch (error) {
    return new Date();
  }
};

// وقت الإشعار قبل الوصول
orderSchema.methods.getArrivalNotificationTime = function() {
  const arrivalDateTime = this.getFullArrivalDateTime();
  const notificationTime = new Date(arrivalDateTime);
  notificationTime.setHours(notificationTime.getHours() - 2);
  notificationTime.setMinutes(notificationTime.getMinutes() - 30);
  return notificationTime;
};

// وقت الإشعار قبل التحميل
orderSchema.methods.getLoadingNotificationTime = function() {
  const loadingDateTime = this.getFullLoadingDateTime();
  const notificationTime = new Date(loadingDateTime);
  notificationTime.setHours(notificationTime.getHours() - 2);
  notificationTime.setMinutes(notificationTime.getMinutes() - 30);
  return notificationTime;
};

// الوقت المتبقي للوصول
orderSchema.methods.getArrivalRemaining = function() {
  const arrivalDateTime = this.getFullArrivalDateTime();
  const now = new Date();
  return arrivalDateTime - now;
};

// الوقت المتبقي للتحميل
orderSchema.methods.getLoadingRemaining = function() {
  const loadingDateTime = this.getFullLoadingDateTime();
  const now = new Date();
  return loadingDateTime - now;
};

// تنسيق الوقت المتبقي للوصول
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

// تنسيق الوقت المتبقي للتحميل
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

// الحصول على معلومات العرض
orderSchema.methods.getDisplayInfo = function() {
  return {
    orderNumber: this.orderNumber,
    orderSource: this.orderSource,
    orderSourceText: this.getOrderSourceText ? this.getOrderSourceText() : this.orderSource,
    supplierName: this.supplierName || 'غير محدد',
    customerName: this.customerName || 'غير محدد',
    status: this.status,
    statusColor: this.getStatusColor ? this.getStatusColor() : '#757575',
    location: this.getLocation ? this.getLocation() : 'غير محدد',
    fuelType: this.fuelType,
    quantity: this.quantity,
    unit: this.unit,
    arrivalCountdown: this.getFormattedArrivalCountdown(),
    loadingCountdown: this.getFormattedLoadingCountdown(),
    isLate: this.isArrivalOverdue ? this.isArrivalOverdue() || this.isLoadingOverdue() : false,
    mergeStatus: this.mergeStatus,
    totalPrice: this.totalPrice,
    paymentStatus: this.paymentStatus,
    createdAt: this.createdAt
  };
};

// نص مصدر الطلب
orderSchema.methods.getOrderSourceText = function() {
  switch(this.orderSource) {
    case 'مورد': return 'طلب مورد';
    case 'عميل': return 'طلب عميل';
    case 'مدمج': return 'طلب مدمج';
    default: return 'طلب';
  }
};

// لون الحالة
orderSchema.methods.getStatusColor = function() {
  switch(this.status) {
    case 'في انتظار إنشاء طلب العميل':
    case 'في انتظار عمل طلب جديد':
      return '#ff9800';
    case 'تم إنشاء طلب العميل':
    case 'تم التأكيد من المورد':
      return '#2196f3';
    case 'في انتظار تأكيد العميل':
      return '#ff5722';
    case 'تم تأكيد العميل':
      return '#4caf50';
    case 'تم دمجه':
    case 'في انتظار التحميل':
      return '#9c27b0';
    case 'مدمج وجاهز للتنفيذ':
      return '#00bcd4';
    case 'تم التنفيذ':
      return '#4caf50';
    case 'في الطريق':
      return '#3f51b5';
    case 'تم التنفيذ':
    case 'مكتمل':
      return '#8bc34a';
    case 'ملغى':
      return '#f44336';
    default:
      return '#757575';
  }
};

// الموقع الكامل
orderSchema.methods.getLocation = function() {
  if (this.city && this.area) {
    return `${this.city} - ${this.area}`;
  }
  return this.city || this.area || 'غير محدد';
};

// تحقق من تأخر الوصول
orderSchema.methods.isArrivalOverdue = function() {
  const remaining = this.getArrivalRemaining();
  return remaining < 0;
};

// تحقق من تأخر التحميل
orderSchema.methods.isLoadingOverdue = function() {
  const remaining = this.getLoadingRemaining();
  return remaining < 0;
};

// ============================================
// 📊 Indexes
// ============================================

orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderDate: 1 });
orderSchema.index({ arrivalDate: 1 });
orderSchema.index({ loadingDate: 1 });
orderSchema.index({ orderSource: 1 });
orderSchema.index({ mergeStatus: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ supplier: 1 });
orderSchema.index({ createdBy: 1 });
orderSchema.index({ driver: 1 });
orderSchema.index({ city: 1 });
orderSchema.index({ area: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

// ============================================
// 📋 Virtuals
// ============================================

orderSchema.virtual('isMerged').get(function() {
  return this.mergeStatus === 'مدمج' || this.mergeStatus === 'مكتمل';
});

orderSchema.virtual('canMerge').get(function() {
  return this.mergeStatus === 'منفصل' || this.mergeStatus === 'في انتظار الدمج';
});

orderSchema.virtual('isSupplierOrder').get(function() {
  return this.orderSource === 'مورد';
});

orderSchema.virtual('isCustomerOrder').get(function() {
  return this.orderSource === 'عميل';
});

orderSchema.virtual('isMixedOrder').get(function() {
  return this.orderSource === 'مدمج';
});

module.exports = mongoose.model('Order', orderSchema);
