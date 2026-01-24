const mongoose = require('mongoose');

const CUSTOMER_DOCUMENT_TYPES = [
  'commercialRecord',
  'energyCertificate',
  'taxCertificate',
  'safetyCertificate',
  'municipalLicense',
  'additionalDocument',
];

const customerDocumentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true,
  },
  label: {
    type: String,
    trim: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
  },
  storagePath: {
    type: String,
    required: true,
    trim: true,
  },
  docType: {
    type: String,
    enum: CUSTOMER_DOCUMENT_TYPES,
    required: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadedByName: {
    type: String,
    trim: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  phone: {
    type: String,
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
  contactPerson: {
    type: String,
    trim: true
  },
  contactPersonPhone: {
    type: String,
    trim: true
  },
  notes: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
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
  },
  documents: [customerDocumentSchema]
});

customerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Customer', customerSchema);
