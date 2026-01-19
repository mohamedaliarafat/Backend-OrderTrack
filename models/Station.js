const mongoose = require('mongoose');

/* =========================
   🔹 Nozzle Schema
========================= */
const NozzleSchema = new mongoose.Schema({
  nozzleNumber: {
    type: Number,
    required: true
  },
  side: {
    type: String,
    enum: ['right', 'left'],
    required: true
  },
  fuelType: {
    type: String,
    enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: true });

/* =========================
   🔹 Pump Schema
========================= */
const PumpSchema = new mongoose.Schema({
  pumpNumber: {
    type: String,
    required: true,
    trim: true
  },

  // ❌ أزلنا validator الإجباري
  nozzles: {
    type: [NozzleSchema],
    default: []
  },

  isActive: {
    type: Boolean,
    default: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

/* =========================
   🔹 Fuel Price Schema
========================= */
const FuelPriceSchema = new mongoose.Schema({
  fuelType: {
    type: String,
    enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين'],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

/* =========================
   🔹 Station Schema
========================= */
const StationSchema = new mongoose.Schema({
  stationCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  stationName: {
    type: String,
    required: true,
    trim: true
  },

  location: {
    type: String,
    required: true
  },

  city: {
    type: String,
    required: true
  },

  managerName: {
    type: String,
    required: true
  },

  managerPhone: {
    type: String,
    required: true
  },

  fuelTypes: [{
    type: String,
    enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين']
  }],

  // ✅ غير إجباري
  pumps: {
    type: [PumpSchema],
    default: []
  },

  // ✅ غير إجباري
  fuelPrices: {
    type: [FuelPriceSchema],
    default: []
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

/* =========================
   🔁 Middleware
========================= */
StationSchema.pre('save', function (next) {
  if (Array.isArray(this.fuelPrices)) {
    this.fuelPrices.forEach(p => {
      p.updatedAt = Date.now();
    });
  }
  next();
});

module.exports = mongoose.model('Station', StationSchema);
