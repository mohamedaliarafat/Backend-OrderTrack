const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const employeeSchema = new Schema({
  // معلومات أساسية
  employeeId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  nameEnglish: String,
  nationalId: {
    type: String,
    required: true,
    unique: true
  },
  gender: {
    type: String,
    enum: ['ذكر', 'أنثى'],
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  nationality: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  address: String,
  
  // معلومات العمل
  department: {
    type: String,
    required: true
  },
  position: {
    type: String,
    required: true
  },
  jobTitle: String,
  employmentType: {
    type: String,
    enum: ['مؤقت', 'دائم', 'عقد', 'تدريب'],
    required: true
  },
  hireDate: {
    type: Date,
    required: true
  },
  contractStartDate: {
    type: Date,
    required: true
  },
  contractEndDate: Date,
  probationPeriodEnd: Date,
  workSchedule: {
    type: String,
    enum: ['دوام كامل', 'دوام جزئي', 'ورديات'],
    default: 'دوام كامل'
  },
  weeklyHours: {
    type: Number,
    default: 48
  },
  
  // معلومات الإقامة
  residencyNumber: String,
  residencyIssueDate: Date,
  residencyExpiryDate: Date,
  passportNumber: String,
  passportExpiryDate: Date,
  
  // معلومات مالية
  basicSalary: {
    type: Number,
    required: true
  },
  housingAllowance: {
    type: Number,
    default: 0
  },
  transportationAllowance: {
    type: Number,
    default: 0
  },
  otherAllowances: {
    type: Number,
    default: 0
  },
  bankName: String,
  iban: String,
  accountNumber: String,
  
  // معلومات البصمة
  fingerprintData: {
    type: String,
    required: true,
    unique: true
  },
  fingerprintEnrolled: {
    type: Boolean,
    default: false
  },
  fingerprintLastUpdate: Date,
  
  // موقع العمل المسموح به
  allowedLocations: [{
    locationName: String,
    latitude: Number,
    longitude: Number,
    radius: { // نصف القطر المسموح به بالأمتار
      type: Number,
      default: 100
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // حالة الموظف
  status: {
    type: String,
    enum: ['نشط', 'موقف', 'استقال', 'مفصول', 'إجازة'],
    default: 'نشط'
  },
  terminationDate: Date,
  terminationReason: String,
  
  // بيانات تتبع
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
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

// تحديث updatedAt قبل الحفظ
employeeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Employee', employeeSchema);