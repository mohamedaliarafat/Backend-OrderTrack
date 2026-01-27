const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const salarySchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  // الدخل
  basicSalary: Number,
  housingAllowance: Number,
  transportationAllowance: Number,
  otherAllowances: Number,
  overtimeAmount: Number,
  bonuses: Number,
  incentives: Number,
  totalEarnings: Number,
  // الخصومات
  deductions: [{
    type: {
      type: String,
      enum: ['تأمينات', 'ضرائب', 'سلف', 'جزاءات', 'أخرى']
    },
    description: String,
    amount: Number,
    reference: String // رقم السلفة أو الجزاء
  }],
  totalDeductions: Number,
  // الصافي
  netSalary: Number,
  // حالة الراتب
  status: {
    type: String,
    enum: ['مسودة', 'معتمد', 'مصرف', 'ملغي'],
    default: 'مسودة'
  },
  // معلومات الدفع
  paymentDate: Date,
  paymentMethod: {
    type: String,
    enum: ['تحويل بنكي', 'شيك', 'نقدي']
  },
  transactionReference: String,
  // بيانات المراجعة
  preparedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  paidBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String,
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

// مركب index لمنع تكرار الراتب لنفس الشهر
salarySchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Salary', salarySchema);