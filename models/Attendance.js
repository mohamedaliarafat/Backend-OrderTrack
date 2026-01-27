const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attendanceSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  // الحضور
  checkIn: {
    time: Date,
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    isLate: Boolean,
    lateMinutes: Number,
    isOutsideLocation: Boolean,
    locationStatus: {
      type: String,
      enum: ['مسموح', 'خارج النطاق', 'غير مسجل']
    },
    deviceId: String,
    fingerprintMatchScore: Number
  },
  // الانصراف
  checkOut: {
    time: Date,
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    isEarly: Boolean,
    earlyMinutes: Number,
    isOutsideLocation: Boolean,
    deviceId: String,
    fingerprintMatchScore: Number
  },
  // إحصائيات اليوم
  totalHours: Number,
  overtimeHours: Number,
  effectiveHours: Number,
  // حالة اليوم
  status: {
    type: String,
    enum: ['حاضر', 'متأخر', 'مبكر', 'نصف_يوم', 'غياب', 'إجازة', 'عطلة'],
    default: 'حاضر'
  },
  notes: String,
  // بيانات المراجعة
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  corrections: [{
    field: String,
    oldValue: String,
    newValue: String,
    changedBy: Schema.Types.ObjectId,
    changedAt: Date
  }],
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

// مركب index للبحث السريع
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);