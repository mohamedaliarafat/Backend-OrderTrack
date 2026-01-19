const mongoose = require('mongoose');

const fuelSupplySchema = new mongoose.Schema(
  {
    fuelType: {
      type: String,
      enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين'],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    supplyType: {
      type: String,
      enum: ['شراء', 'تحويل', 'إرجاع', 'تسوية'],
      required: true,
    },

    tankerNumber: String,
    supplierName: String,

    notes: String,

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

module.exports = fuelSupplySchema;
