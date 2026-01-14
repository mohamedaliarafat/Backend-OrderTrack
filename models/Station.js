// const mongoose = require('mongoose');

// /* =========================
//    🔹 Nozzle Schema
// ========================= */
// const nozzleSchema = new mongoose.Schema({
//   nozzleNumber: {
//     type: Number,
//     required: true
//   },
//   side: {
//     type: String,
//     enum: ['right', 'left'],
//     required: true
//   },
//   fuelType: {
//     type: String,
//     enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين'],
//     required: true
//   },
//   isActive: {
//     type: Boolean,
//     default: true
//   }
// }, { _id: true });

// /* =========================
//    🔹 Pump Schema
// ========================= */
// const pumpSchema = new mongoose.Schema({
//   pumpNumber: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   nozzles: {
//     type: [nozzleSchema],
//     validate: {
//       validator: v => Array.isArray(v) && v.length > 0,
//       message: 'يجب إضافة ليّة واحدة على الأقل لكل طلمبة'
//     }
//   },
//   isActive: {
//     type: Boolean,
//     default: true
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// /* =========================
//    🔹 Fuel Price Schema
// ========================= */
// const fuelPriceSchema = new mongoose.Schema({
//   fuelType: {
//     type: String,
//     enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين'],
//     required: true
//   },
//   price: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// /* =========================
//    🔹 Station Schema
// ========================= */
// const stationSchema = new mongoose.Schema({
//   stationCode: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true
//   },
//   stationName: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   location: {
//     type: String,
//     required: true
//   },
//   city: {
//     type: String,
//     required: true
//   },
//   managerName: {
//     type: String,
//     required: true
//   },
//   managerPhone: {
//     type: String,
//     required: true
//   },

//   fuelTypes: [{
//     type: String,
//     enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين']
//   }],

//   pumps: {
//     type: [pumpSchema],
//     validate: {
//       validator: v => Array.isArray(v) && v.length > 0,
//       message: 'يجب إضافة طلمبة واحدة على الأقل'
//     }
//   },

//   fuelPrices: {
//     type: [fuelPriceSchema],
//     validate: {
//       validator: v => Array.isArray(v) && v.length > 0,
//       message: 'يجب إدخال أسعار الوقود'
//     }
//   },

//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },

//   isActive: {
//     type: Boolean,
//     default: true
//   }
// }, {
//   timestamps: true
// });

// /* =========================
//    🔁 Middleware
// ========================= */
// stationSchema.pre('save', function (next) {
//   if (this.fuelPrices?.length) {
//     this.fuelPrices.forEach(p => {
//       p.updatedAt = Date.now();
//     });
//   }
//   next();
// });

// module.exports = mongoose.model('Station', stationSchema);

const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
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
  pumps: [{
    pumpNumber: {
      type: String,
      required: true
    },
    fuelType: {
      type: String,
      required: true,
      enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين']
    },
    nozzleCount: {
      type: Number,
      default: 1
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  fuelPrices: [{
  fuelType: {
    type: String,
    required: true,
    enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين'],
    unique: false // uniqueness منطقية هتتظبط في الكود
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
}],

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
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

stationSchema.pre('save', function (next) {
  this.updatedAt = Date.now();

  if (this.fuelPrices && this.fuelPrices.length) {
    this.fuelPrices.forEach(p => {
      p.updatedAt = Date.now();
    });
  }

  next();
});


module.exports = mongoose.model('Station', stationSchema);