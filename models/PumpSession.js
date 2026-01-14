const mongoose = require('mongoose');

/* =========================
   Pump Reading SubSchema
========================= */
const pumpReadingSchema = new mongoose.Schema(
  {
    pumpId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    pumpNumber: {
      type: String,
      required: true,
    },

    fuelType: {
      type: String,
      enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين'],
      required: true,
    },

    // =========================
    // Opening
    // =========================
    openingReading: {
      type: Number,
      required: true,
      min: 0,
    },

    openingImageUrl: {
      type: String, // 🔗 Firebase Storage URL
    },

    openingTime: {
      type: Date,
      default: Date.now,
    },

    // =========================
    // Closing
    // =========================
    closingReading: {
      type: Number,
      min: 0,
    },

    closingImageUrl: {
      type: String, // 🔗 Firebase Storage URL
    },

    closingTime: {
      type: Date,
    },

    // =========================
    // Calculations per pump
    // =========================
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
   Pump Session Schema
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

    // ⭐ كل الطلمبات هنا
    pumps: {
      type: [pumpReadingSchema],
      required: true,
      validate: [
        (v) => Array.isArray(v) && v.length > 0,
        'يجب إدخال قراءات الطلمبات',
      ],
    },

    // =========================
    // Opening Info
    // =========================
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

    // =========================
    // Closing Info
    // =========================
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

    // =========================
    // Totals (Session Level)
    // =========================
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
    timestamps: true, // createdAt / updatedAt
  }
);

/* =========================
   Hooks
========================= */
pumpSessionSchema.pre('save', function (next) {
  let totalLiters = 0;
  let totalAmount = 0;

  // 🔢 حساب كل طلمبة
  this.pumps.forEach((pump) => {
    if (
      typeof pump.openingReading === 'number' &&
      typeof pump.closingReading === 'number'
    ) {
      pump.totalLiters = Math.max(
        pump.closingReading - pump.openingReading,
        0
      );

      if (typeof pump.unitPrice === 'number') {
        pump.totalAmount = pump.totalLiters * pump.unitPrice;
      }
    }

    totalLiters += pump.totalLiters || 0;
    totalAmount += pump.totalAmount || 0;
  });

  this.totalLiters = totalLiters;
  this.totalAmount = totalAmount;

  // 💰 إجمالي المبيعات
  this.totalSales =
    (this.paymentTypes?.cash || 0) +
    (this.paymentTypes?.card || 0) +
    (this.paymentTypes?.mada || 0) +
    (this.paymentTypes?.other || 0);

  // ⚖️ الفرق
  this.calculatedDifference = this.totalSales - this.totalAmount;

  next();
});

module.exports = mongoose.model('PumpSession', pumpSessionSchema);
