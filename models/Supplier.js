const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'البريد الإلكتروني غير صالح']
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  secondaryPhone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true,
    default: 'السعودية'
  },
  taxNumber: {
    type: String,
    trim: true
  },
  commercialNumber: {
    type: String,
    trim: true
  },
  bankName: {
    type: String,
    trim: true
  },
  bankAccountNumber: {
    type: String,
    trim: true
  },
  bankAccountName: {
    type: String,
    trim: true
  },
  iban: {
    type: String,
    trim: true
  },
  supplierType: {
    type: String,
    enum: ['وقود', 'صيانة', 'خدمات لوجستية', 'أخرى'],
    default: 'وقود'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  contractStartDate: {
    type: Date
  },
  contractEndDate: {
    type: Date
  },
  documents: [{
    filename: String,
    path: String,
    documentType: {
      type: String,
      enum: ['عقد', 'رخصة', 'هوية', 'شهادة', 'أخرى']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
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

supplierSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better performance
supplierSchema.index({ name: 1 });
supplierSchema.index({ company: 1 });
supplierSchema.index({ isActive: 1 });
supplierSchema.index({ supplierType: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);