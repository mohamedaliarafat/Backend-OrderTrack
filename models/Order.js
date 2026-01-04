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
  trim: true,
  index: true
},

  
  // ⭐ حقل حاسم: مصدر الطلب
  orderSource: {
    type: String,
    enum: ['مورد', 'عميل', 'مدمج'],
    required: true,
    default: 'مورد'
  },
  
  // ⭐ حالة الدمج
  mergeStatus: {
    type: String,
    enum: ['منفصل', 'في انتظار الدمج', 'مدمج', 'مكتمل'],
    default: 'منفصل'
  },
  
  // ⭐ معرف الطلب المدمج معه
  mergedWithOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  
  // ⭐ معلومات الطرف المدمج معه
  mergedWithInfo: {
    orderNumber: String,           // رقم طلب الطرف الآخر
    partyName: String,             // اسم الطرف الآخر
    partyType: String,             // نوع الطرف (مورد/عميل)
    mergedAt: Date                 // وقت الدمج
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
  
  // ⭐ العميل (مطلوب لطلبات العميل)
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
      if (this.orderSource === 'عميل') {
        return 'شراء';
      }
      return undefined;
    }
  },
  
  // ============================================
  // 📍 معلومات الموقع
  // ============================================
  city: {
    type: String,
    required: true
  },
  area: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  
  deliveryDuration: {
    type: Number,
    min: 0
  },
  distance: {
    type: Number,
    min: 0
  },
  driverEarnings: {
    type: Number,
    min: 0
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
  // 📊 حالة الطلب - محدثة حسب متطلباتك
  // ============================================
  status: {
    type: String,
    enum: [
      // ========== طلبات المورد ==========
      'قيد الإنشاء',              // الحالة الابتدائية
      'تم الإنشاء',               // بعد إنشاء الطلب
      'في انتظار الدمج',          // جاهز للدمج
      'تم دمجه مع العميل',        // بعد الدمج (يظهر اسم العميل ورقم طلبه)
      'جاهز للتحميل',            // جاهز للتحميل
      'تم التحميل',              // تم التحميل
      'في الطريق',               // قيد التوصيل
      'تم التسليم',              // تم التوصيل
      
      // ========== طلبات العميل ==========
      'في انتظار التخصيص',        // ينتظر تخصيص مورد
      'تم تخصيص طلب المورد',      // تم تخصيص طلب مورد (يظهر اسم المورد ورقم طلبه)
      'في انتظار الدمج',          // جاهز للدمج
      'تم دمجه مع المورد',        // بعد الدمج
      'في انتظار التحميل',       // منتظر تحميل المورد
      'في الطريق',               // قيد التوصيل
      'تم التسليم',              // تم الاستلام
      
      // ========== الطلبات المدمجة ==========
      'تم الدمج',                // مباشرة بعد الدمج
      'مخصص للعميل',             // تم تخصيصها للعميل
      'جاهز للتحميل',            // جاهز للتحميل
      'تم التحميل',              // تم التحميل
      'في الطريق',               // قيد التوصيل
      'تم التسليم',              // تم التوصيل
      'تم التنفيذ',              // بعد انتهاء الوقت
      
      // ========== حالات عامة ==========
      'ملغى',
      'مكتمل'
    ],
    default: function() {
      switch(this.orderSource) {
        case 'مورد':
          return 'قيد الإنشاء';
        case 'عميل':
          return 'في انتظار التخصيص';
        case 'مدمج':
          return 'تم الدمج';
        default:
          return 'قيد الإنشاء';
      }
    }
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
  
  supplierNotes: {
    type: String
  },
  
  customerNotes: {
    type: String
  },
  
  internalNotes: {
    type: String
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
  
  supplierDocuments: [{
    type: { type: String, enum: ['فاتورة', 'عقد', 'شهادة', 'أخرى'] },
    filename: String,
    path: String,
    uploadedAt: Date
  }],
  
  customerDocuments: [{
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
  mergedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  }
});

// ============================================
// 📍 تعبئة الموقع قبل الـ validation
// ============================================
orderSchema.pre('validate', async function (next) {
  try {
    // ===== طلب مورد =====
    if (this.orderSource === 'مورد' && this.supplier) {
      const supplier = await mongoose.model('Supplier').findById(this.supplier);
      if (supplier) {
        if (!this.city) this.city = supplier.city;
        if (!this.area) this.area = supplier.area;
        if (!this.address) this.address = supplier.address;
      }
    }

    // ===== طلب عميل =====
    if (this.orderSource === 'عميل' && this.customer) {
      const customer = await mongoose.model('Customer').findById(this.customer);
      if (customer) {
        if (!this.city) this.city = customer.city;
        if (!this.area) this.area = customer.area;
        if (!this.address) this.address = customer.address;
      }
    }

    next();
  } catch (err) {
    console.error('❌ Error in pre-validate location:', err);
    next(err);
  }
});

// ============================================
// 📝 Middleware قبل الحفظ - محدث
// ============================================
orderSchema.pre('save', async function (next) {
  try {
    // =========================
    // 🆔 توليد رقم الطلب
    // =========================
    if (!this.orderNumber) {
      await this.generateOrderNumber();
    }

    // =========================
    // 🕒 تحديث وقت التعديل
    // =========================
    this.updatedAt = new Date();

    // =========================
    // 💰 حساب السعر
    // =========================
    if (this.quantity && this.unitPrice) {
      this.totalPrice = this.quantity * this.unitPrice;
    }

    // =========================
    // 👤 تعبئة بيانات العميل
    // =========================
    if (this.customer && !this.customerName) {
      await this.populateCustomerData();
    }

    // =========================
    // 🏭 تعبئة بيانات المورد
    // =========================
    if (this.supplier) {
      await this.populateSupplierData();
    }

    // =========================
    // 🚚 تعبئة بيانات السائق
    // =========================
    if (this.driver && !this.driverName) {
      await this.populateDriverData();
    }

    // =========================
    // 👤 اسم منشئ الطلب
    // =========================
    if (!this.createdByName && this.createdBy) {
      await this.populateCreatorData();
    }

    next();
  } catch (error) {
    console.error('Error in pre-save middleware:', error);
    next(error);
  }
});

// ============================================
// 🔧 دوال المساعدة الجديدة
// ============================================

// دالة لتوليد رقم الطلب
orderSchema.methods.generateOrderNumber = async function() {
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
};

// دالة لتعبئة بيانات العميل
orderSchema.methods.populateCustomerData = async function() {
  try {
    const customer = await mongoose.model('Customer').findById(this.customer);
    if (customer) {
      this.customerName = customer.name || '';
      this.customerCode = customer.code || '';
      this.customerPhone = customer.phone || '';
      this.customerEmail = customer.email || '';
    }
  } catch (e) {
    console.error('Error populating customer:', e);
  }
};

// دالة لتعبئة بيانات المورد
orderSchema.methods.populateSupplierData = async function() {
  try {
    const supplier = await mongoose.model('Supplier').findById(this.supplier);
    if (supplier) {
      this.supplierName = supplier.name || '';
      this.supplierCompany = supplier.company || '';
      this.supplierContactPerson = supplier.contactPerson || '';
      this.supplierPhone = supplier.phone || '';
      this.supplierAddress = supplier.address || '';
    }
  } catch (e) {
    console.error('Error populating supplier:', e);
  }
};

// دالة لتعبئة بيانات السائق
orderSchema.methods.populateDriverData = async function() {
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
};

// دالة لتعبئة بيانات المنشئ
orderSchema.methods.populateCreatorData = async function() {
  try {
    const user = await mongoose.model('User').findById(this.createdBy);
    if (user) {
      this.createdByName = user.name || '';
    }
  } catch (e) {
    console.error('Error populating creator:', e);
  }
};

// دالة لتعيين معلومات الدمج
orderSchema.methods.setMergeInfo = async function(targetOrder) {
  this.mergedWithOrderId = targetOrder._id;
  this.mergedWithInfo = {
    orderNumber: targetOrder.orderNumber,
    partyName: targetOrder.orderSource === 'مورد' ? 
              targetOrder.supplierName : 
              targetOrder.customerName,
    partyType: targetOrder.orderSource,
    mergedAt: new Date()
  };
  
  // تحديث حالة الطلب بناءً على نوعه
  if (this.orderSource === 'مورد') {
    this.status = 'تم دمجه مع العميل';
    this.mergeStatus = 'مدمج';
  } else if (this.orderSource === 'عميل') {
    this.status = 'تم دمجه مع المورد';
    this.mergeStatus = 'مدمج';
  } else {
    this.status = 'تم الدمج';
    this.mergeStatus = 'مدمج';
  }
  
  this.mergedAt = new Date();
};

// دالة للحصول على معلومات الطلب المدمج
orderSchema.methods.getMergePartnerInfo = async function() {
  if (!this.mergedWithOrderId) return null;
  
  try {
    const partnerOrder = await mongoose.model('Order')
      .findById(this.mergedWithOrderId)
      .select('orderNumber customerName supplierName orderSource');
    
    if (!partnerOrder) return null;
    
    return {
      orderNumber: partnerOrder.orderNumber,
      name: partnerOrder.orderSource === 'مورد' ? 
            partnerOrder.supplierName : 
            partnerOrder.customerName,
      type: partnerOrder.orderSource === 'مورد' ? 'مورد' : 'عميل'
    };
  } catch (error) {
    console.error('Error getting merge partner info:', error);
    return null;
  }
};

// ============================================
// ⏰ دوال التوقيت (كما هي)
// ============================================
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

// ============================================
// 📊 دوال العرض
// ============================================
orderSchema.methods.getDisplayInfo = function() {
  const info = {
    orderNumber: this.orderNumber,
    orderSource: this.orderSource,
    orderSourceText: this.getOrderSourceText(),
    supplierName: this.supplierName || 'غير محدد',
    customerName: this.customerName || 'غير محدد',
    status: this.status,
    statusColor: this.getStatusColor(),
    location: this.getLocation(),
    fuelType: this.fuelType,
    quantity: this.quantity,
    unit: this.unit,
    mergeStatus: this.mergeStatus,
    totalPrice: this.totalPrice,
    paymentStatus: this.paymentStatus,
    createdAt: this.createdAt,
    mergedWithInfo: this.mergedWithInfo || null
  };
  
  // إضافة معلومات المدة
  if (this.getFormattedArrivalCountdown) {
    info.arrivalCountdown = this.getFormattedArrivalCountdown();
  }
  
  if (this.getFormattedLoadingCountdown) {
    info.loadingCountdown = this.getFormattedLoadingCountdown();
  }
  
  return info;
};

orderSchema.methods.getOrderSourceText = function() {
  switch(this.orderSource) {
    case 'مورد': return 'طلب مورد';
    case 'عميل': return 'طلب عميل';
    case 'مدمج': return 'طلب مدمج';
    default: return 'طلب';
  }
};

orderSchema.methods.getStatusColor = function() {
  // ألوان حسب الحالة
  const statusColors = {
    // طلبات المورد
    'قيد الإنشاء': '#ff9800',
    'تم الإنشاء': '#2196f3',
    'في انتظار الدمج': '#ff5722',
    'تم دمجه مع العميل': '#9c27b0',
    'جاهز للتحميل': '#00bcd4',
    'تم التحميل': '#4caf50',
    'في الطريق': '#3f51b5',
    'تم التسليم': '#8bc34a',
    
    // طلبات العميل
    'في انتظار التخصيص': '#ff9800',
    'تم تخصيص طلب المورد': '#2196f3',
    'في انتظار الدمج': '#ff5722',
    'تم دمجه مع المورد': '#9c27b0',
    'في انتظار التحميل': '#00bcd4',
    'في الطريق': '#3f51b5',
    'تم التسليم': '#8bc34a',
    
    // طلبات مدمجة
    'تم الدمج': '#9c27b0',
    'مخصص للعميل': '#2196f3',
    'جاهز للتحميل': '#00bcd4',
    'تم التحميل': '#4caf50',
    'في الطريق': '#3f51b5',
    'تم التسليم': '#8bc34a',
    'تم التنفيذ': '#4caf50',
    
    // عامة
    'ملغى': '#f44336',
    'مكتمل': '#8bc34a'
  };
  
  return statusColors[this.status] || '#757575';
};

orderSchema.methods.getLocation = function() {
  if (this.city && this.area) {
    return `${this.city} - ${this.area}`;
  }
  return this.city || this.area || 'غير محدد';
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

orderSchema.index(
  { supplier: 1, supplierOrderNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      supplier: { $exists: true },
      supplierOrderNumber: { $exists: true, $ne: null, $ne: '' }
    }
  }
);



module.exports = mongoose.model('Order', orderSchema);
