const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    // 💰 قيمة المصروف
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // 🏷️ تصنيف المصروف (مفتوح)
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // 📝 وصف المصروف
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },

    // 📝 ملاحظات إضافية
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },

    // 👤 من أضاف المصروف
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // 📅 تاريخ الإضافة
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
    strict: true,
  }
);

module.exports = expenseSchema;
