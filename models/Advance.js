const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const advanceSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    required: true
  },
  repaymentMonths: {
    type: Number,
    default: 1,
    min: 1
  },
  monthlyInstallment: Number,
  // حالة السلفة
  status: {
    type: String,
    enum: ['معلق', 'معتمد', 'مرفوض', 'مسدد', 'قسط', 'متأخر'],
    default: 'معلق'
  },
  // الموافقة
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  approvalNotes: String,
  // الدفع
  paidAt: Date,
  paidBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  paymentMethod: {
    type: String,
    enum: ['نقدي', 'تحويل بنكي', 'شيك']
  },
  // التسديد
  repayments: [{
    month: Number,
    year: Number,
    amount: Number,
    paidAt: Date,
    salaryId: {
      type: Schema.Types.ObjectId,
      ref: 'Salary'
    },
    status: {
      type: String,
      enum: ['مستحق', 'مسدد', 'متأخر']
    }
  }],
  remainingAmount: Number,
  nextDueDate: Date,
  // التتبع
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
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

module.exports = mongoose.model('Advance', advanceSchema);