const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const locationSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['مكتب', 'مصنع', 'موقع', 'فرع'],
    required: true
  },
  address: {
    type: String,
    required: true
  },
  coordinates: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    }
  },
  radius: {
    type: Number,
    default: 100, // بالأمتار
    min: 10
  },
  // أوقات العمل
  workingHours: {
    start: {
      type: String, // "08:00"
      required: true
    },
    end: {
      type: String, // "17:00"
      required: true
    },
    flexible: {
      type: Boolean,
      default: false
    }
  },
  // الأيام المعطلة
  offDays: [{
    type: String,
    enum: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
  }],
  // إعدادات خاصة
  settings: {
    requireLocation: {
      type: Boolean,
      default: true
    },
    allowRemote: {
      type: Boolean,
      default: false
    },
    maxDistance: {
      type: Number,
      default: 500 // الحد الأقصى للمسافة بالأمتار
    }
  },
  // حالة الموقع
  isActive: {
    type: Boolean,
    default: true
  },
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

module.exports = mongoose.model('Location', locationSchema);