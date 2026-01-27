const mongoose = require('mongoose');
const expenseSchema = require('./Expense');


/* =========================
   🔹 Nozzle Reading Schema
========================= */
const nozzleReadingSchema = new mongoose.Schema(
  {
    // 🔗 الربط بالطلمبة
    pumpId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    pumpNumber: {
      type: String,
      required: true,
    },

    // 🔢 بيانات الليّة
    nozzleNumber: {
      type: Number,
      required: true,
    },

    side: {
      type: String,
      enum: ['right', 'left'],
      required: true,
    },

    fuelType: {
      type: String,
      enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين'],
      required: true,
    },

    /* =========================
       Opening
    ========================= */
    openingReading: {
      type: Number,
      required: true,
      min: 0,
    },

    openingImageUrl: String,

    openingTime: {
      type: Date,
      default: Date.now,
    },

    /* =========================
       Closing
    ========================= */
    closingReading: {
      type: Number,
      min: 0,
    },

    closingImageUrl: String,

    closingTime: Date,

    /* =========================
       Calculations (per nozzle)
    ========================= */
    totalLiters: {
      type: Number,
      default: 0,
      min: 0,
    },

    unitPrice: {
      type: Number,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    differenceReason: {
      type: String,
      enum: ['عادي', 'تهوية', 'تسريب', 'خطأ في القراءة', 'أخرى'],
    },

    notes: String,
  },
  { _id: false }
);

/* =========================
   🔹 Pump Session Schema
========================= */
const pumpSessionSchema = new mongoose.Schema(
  {
    sessionNumber: {
      type: String,
      required: true,
      unique: true,
    },

    stationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
    },

    stationName: {
      type: String,
      required: true,
    },

    shiftType: {
      type: String,
      enum: ['صباحية', 'مسائية'],
      required: true,
    },

    sessionDate: {
      type: Date,
      required: true,
    },
    expenses: {
      type: [expenseSchema],
      default: [],
    },

    expensesTotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    carriedForwardBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

netSales: {
  type: Number,
  default: 0,
},


    /* ⭐⭐ كل القراءات هنا (لكل لِيّة) ⭐⭐ */
    nozzleReadings: {
      type: [nozzleReadingSchema],
      required: true,
      validate: [
        (v) => Array.isArray(v) && v.length > 0,
        'يجب إدخال قراءات الليّات',
      ],
    },

    /* =========================
       Opening Info
    ========================= */
    openingEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    openingEmployeeName: String,

    openingApproved: {
      type: Boolean,
      default: false,
    },

    openingApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    openingApprovedAt: Date,

    /* =========================
       Closing Info
    ========================= */
    closingEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    closingEmployeeName: String,

    closingApproved: {
      type: Boolean,
      default: false,
    },

    closingApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    closingApprovedAt: Date,

    /* =========================
       Totals (Session Level)
    ========================= */
    totalLiters: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentTypes: {
      cash: { type: Number, default: 0, min: 0 },
      card: { type: Number, default: 0, min: 0 },
      mada: { type: Number, default: 0, min: 0 },
      other: { type: Number, default: 0, min: 0 },
    },

    totalSales: {
      type: Number,
      default: 0,
      min: 0,
    },

    calculatedDifference: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ['مفتوحة', 'مغلقة', 'قيد المراجعة', 'معتمدة', 'ملغاة'],
      default: 'مفتوحة',
    },

    notes: String,
  },
  {
    timestamps: true,
  }
);

/* =========================
   🔁 Hooks (الحسابات)
========================= */
pumpSessionSchema.pre('save', function (next) {
  let totalLiters = 0;
  let totalAmount = 0;
  let expensesTotal = 0;

  // ✅ حساب الوقود (لكل لِيّة)
  this.nozzleReadings.forEach((nozzle) => {
    if (
      typeof nozzle.openingReading === 'number' &&
      typeof nozzle.closingReading === 'number'
    ) {
      nozzle.totalLiters = Math.max(
        nozzle.closingReading - nozzle.openingReading,
        0
      );

      if (typeof nozzle.unitPrice === 'number') {
        nozzle.totalAmount = nozzle.totalLiters * nozzle.unitPrice;
      }
    }

    totalLiters += nozzle.totalLiters || 0;
    totalAmount += nozzle.totalAmount || 0;
  });

  // ✅ حساب المصروفات
  if (Array.isArray(this.expenses)) {
    this.expenses.forEach((e) => {
      expensesTotal += e.amount || 0;
    });
  }

  this.totalLiters = totalLiters;
  this.totalAmount = totalAmount;
  this.expensesTotal = expensesTotal;

  // 💰 التحصيل
  this.totalSales =
    (this.paymentTypes?.cash || 0) +
    (this.paymentTypes?.card || 0) +
    (this.paymentTypes?.mada || 0) +
    (this.paymentTypes?.other || 0);

  // 🧮 صافي المبيعات
  this.netSales = this.totalSales - expensesTotal;

  // ⚖️ الفرق النهائي
  this.calculatedDifference = this.netSales - this.totalAmount;

  next();
});


module.exports = mongoose.model('PumpSession', pumpSessionSchema);
