const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false,
  },

  activityType: {
    type: String,
    enum: [
      'إنشاء',
      'تعديل',
      'حذف',
      'تغيير حالة',
      'إضافة ملاحظة',
      'رفع ملف',
      'دمج',
      "إغلاق" // ✅ أضفناها
    ],
    required: true
  },

  description: {
    type: String,
    required: true
  },

  // 👇 لم يعد إجباري
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },

  // 👇 نعتمد عليه
  performedByName: {
    type: String,
    required: true,
    default: 'النظام'
  },

  changes: {
    type: Map,
    of: String
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Activity', activitySchema);
