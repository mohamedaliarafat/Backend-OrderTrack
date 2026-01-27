const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const penaltySchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['تأخير', 'غياب', 'سلوك', 'أداء', 'أخرى'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  // هل تم خصمها من الراتب؟
  deducted: {
    type: Boolean,
    default: false
  },
  deductionMonth: Number,
  deductionYear: Number,
  salaryId: {
    type: Schema.Types.ObjectId,
    ref: 'Salary'
  },
  // حالة الجزاء
  status: {
    type: String,
    enum: ['معلق', 'مطبق', 'ملغي', 'مسترد'],
    default: 'معلق'
  },
  // الموافقة
  issuedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  // إذا كان هناك استئناف
  appeal: {
    requested: Boolean,
    reason: String,
    decision: String,
    decidedBy: Schema.Types.ObjectId,
    decidedAt: Date
  },
  // التتبع
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Penalty', penaltySchema);