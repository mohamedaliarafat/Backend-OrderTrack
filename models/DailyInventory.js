const mongoose = require('mongoose');

const dailyInventorySchema = new mongoose.Schema({
  stationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    required: true
  },

  stationName: {
    type: String,
    required: true
  },

  inventoryDate: {
    type: Date,
    required: true
  },

  arabicDate: {
    type: String
  },

  fuelType: {
    type: String,
    required: true
  },

  // ✅ الرصيد السابق (قد يكون 0)
  previousBalance: {
    type: Number,
    default: 0,
    min: 0
  },

  // ✅ كمية التوريد
  receivedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },

  tankerCount: {
    type: Number,
    default: 0
  },

  // ✅ المبيعات من الجلسات
  totalSales: {
    type: Number,
    default: 0,
    min: 0
  },

  pumpCount: {
    type: Number,
    default: 0
  },

  // ✅ يتحسب تلقائي
  calculatedBalance: {
    type: Number,
    default: 0
  },

  // ✅ قراءة فعلية (اختياري وقت الإنشاء)
  actualBalance: {
    type: Number,
    default: 0,
    min: 0
  },

  // ✅ فرق المخزون
  difference: {
    type: Number,
    default: 0
  },

  differencePercentage: {
    type: Number,
    default: 0
  },

  differenceReason: {
    type: String,
    enum: ['عادي', 'تهوية', 'تسريب', 'خطأ في القياس', 'أخرى'],
    default: 'عادي'
  },

  // ✅ المصروفات (اختياري)
  expenses: [{
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    description: {
      type: String,
      default: ''
    },
    category: {
      type: String,
      enum: ['مرتبات', 'صيانة', 'كهرباء', 'إيجار', 'أخرى'],
      default: 'أخرى'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  totalExpenses: {
    type: Number,
    default: 0
  },

  totalRevenue: {
    type: Number,
    default: 0
  },

  netRevenue: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    enum: ['مسودة', 'مكتمل', 'معتمد', 'ملغى'],
    default: 'مسودة'
  },

  preparedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  notes: {
    type: String,
    default: ''
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


// ===============================
// 🔄 حسابات تلقائية قبل الحفظ
// ===============================
dailyInventorySchema.pre('save', function (next) {
  this.updatedAt = Date.now();

  // الرصيد بعد البيع
  this.calculatedBalance =
    (this.previousBalance || 0) +
    (this.receivedQuantity || 0) -
    (this.totalSales || 0);

  // الفرق
  this.difference = (this.actualBalance || 0) - this.calculatedBalance;

  if (this.calculatedBalance > 0) {
    this.differencePercentage =
      (this.difference / this.calculatedBalance) * 100;
  } else {
    this.differencePercentage = 0;
  }

  // مجموع المصروفات
  if (Array.isArray(this.expenses)) {
    this.totalExpenses = this.expenses.reduce(
      (sum, e) => sum + (e.amount || 0),
      0
    );
  }

  // صافي الإيراد
  this.netRevenue = (this.totalRevenue || 0) - (this.totalExpenses || 0);

  next();
});

module.exports = mongoose.model('DailyInventory', dailyInventorySchema);
