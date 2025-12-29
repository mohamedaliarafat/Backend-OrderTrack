const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    trim: true
  },
  vehicleType: {
    type: String,
    enum: ['سيارة صغيرة', 'شاحنة صغيرة', 'شاحنة كبيرة', 'تانكر', 'أخرى'],
    default: 'شاحنة كبيرة'
  },
  vehicleNumber: {
    type: String,
    trim: true
  },
  licenseExpiryDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['نشط', 'غير نشط', 'في إجازة', 'معلق'],
    default: 'نشط'
  },
  notes: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

driverSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Driver', driverSchema);