const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  // =========================
  // Basic Information
  // =========================
  driverId: {
    type: String,
    required: true,
    trim: true
  },
  driverName: {
    type: String,
    required: true,
    trim: true
  },
  tankNumber: {
    type: String,
    required: true,
    trim: true
  },
  plateNumber: {
    type: String,
    required: true,
    trim: true
  },
  driverLicenseNumber: {
    type: String,
    required: true
  },
  driverLicenseExpiry: {
    type: Date,
    required: true
  },
  vehicleLicenseNumber: {
    type: String,
    required: true
  },
  vehicleLicenseExpiry: {
    type: Date,
    required: true
  },

  // =========================
  // Monthly Inspection Data
  // =========================
  inspectionMonth: {
    type: String, // YYYY-MM
    required: true
  },
  inspectionDate: {
    type: Date,
    default: Date.now
  },
  inspectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  inspectedByName: {
    type: String,
    required: true
  },

  // =========================
  // 🚗 GLOBAL ODOMETER / OIL STATE (جديد)
  // =========================
  lastOdometerReading: {
    type: Number,
    default: 0,
    min: 0
  },
  lastOilChangeOdometer: {
    type: Number,
    default: 0,
    min: 0
  },
  totalDistanceSinceOilChange: {
    type: Number,
    default: 0,
    min: 0
  },

  // =========================
  // Daily Checks
  // =========================
  dailyChecks: [{
    date: {
      type: Date,
      required: true
    },

    // ---------- Safety ----------
    vehicleSafety: {
      type: String,
      enum: ['تم', 'لم يتم', 'غير مطلوب'],
      default: 'لم يتم'
    },
    driverSafety: {
      type: String,
      enum: ['تم', 'لم يتم', 'غير مطلوب'],
      default: 'لم يتم'
    },
    electricalMaintenance: {
      type: String,
      enum: ['تم', 'لم يتم', 'غير مطلوب'],
      default: 'لم يتم'
    },
    mechanicalMaintenance: {
      type: String,
      enum: ['تم', 'لم يتم', 'غير مطلوب'],
      default: 'لم يتم'
    },
    tankInspection: {
      type: String,
      enum: ['تم', 'لم يتم', 'غير مطلوب'],
      default: 'لم يتم'
    },
    tiresInspection: {
      type: String,
      enum: ['تم', 'لم يتم', 'غير مطلوب'],
      default: 'لم يتم'
    },
    brakesInspection: {
      type: String,
      enum: ['تم', 'لم يتم', 'غير مطلوب'],
      default: 'لم يتم'
    },
    lightsInspection: {
      type: String,
      enum: ['تم', 'لم يتم', 'غير مطلوب'],
      default: 'لم يتم'
    },
    fluidsCheck: {
      type: String,
      enum: ['تم', 'لم يتم', 'غير مطلوب'],
      default: 'لم يتم'
    },
    emergencyEquipment: {
      type: String,
      enum: ['تم', 'لم يتم', 'غير مطلوب'],
      default: 'لم يتم'
    },

    inspectionResult: {
      type: String,
      trim: true,
      default: 'pending'
    },

    // =========================
    // 🚗 ODOMETER (جديد)
    // =========================
    odometerReading: {
      type: Number,
      min: 0
    },
    previousOdometer: {
      type: Number,
      min: 0
    },
    dailyDistance: {
      type: Number,
      min: 0
    },

    // =========================
    // 🛢️ OIL TRACKING (جديد)
    // =========================
    oilStatus: {
      type: String,
      enum: ['طبيعي', 'قارب على التغيير', 'يحتاج تغيير'],
      default: 'طبيعي'
    },
    oilChangeApproved: {
      type: Boolean,
      default: false
    },
    oilChangeApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    oilChangeApprovedAt: Date,

    // ---------- Maintenance ----------
    maintenanceType: String,
    maintenanceCost: Number,
    maintenanceInvoices: [{
      title: String,
      url: String
    }],
    notes: String,

    // ---------- Workflow ----------
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    checkedByName: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'under_review'],
      default: 'pending'
    },
    supervisorNotes: String,
    supervisorAction: {
      type: String,
      enum: ['none', 'warning_sent', 'maintenance_scheduled', 'vehicle_stopped'],
      default: 'none'
    }
  }],

  // =========================
  // Monthly Summary
  // =========================
  monthlyStatus: {
    type: String,
    enum: ['مكتمل', 'غير مكتمل', 'تحت المراجعة', 'مرفوض'],
    default: 'غير مكتمل'
  },
  totalDays: {
    type: Number,
    default: 30
  },
  completedDays: {
    type: Number,
    default: 0
  },
  pendingDays: {
    type: Number,
    default: 30
  },

  // =========================
  // Supervisor Actions
  // =========================
  supervisorActions: [{
    date: {
      type: Date,
      default: Date.now
    },
    actionType: {
      type: String,
      enum: ['warning', 'note', 'approval', 'rejection', 'maintenance_scheduled']
    },
    message: String,
    sentTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    sentByName: String,
    readBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      readAt: Date
    }]
  }],

  // =========================
  // Additional Information
  // =========================
  vehicleType: {
    type: String,
    enum: ['صهريج وقود', 'ناقلة غاز', 'مركبة خفيفة', 'مركبة ثقيلة'],
    required: true
  },
  vehicleModel: String,
  vehicleYear: Number,
  fuelType: {
    type: String,
    enum: ['بنزين', 'ديزل', 'غاز طبيعي', 'كهرباء']
  },

  vehicleOperatingCardNumber: String,
  vehicleOperatingCardIssueDate: Date,
  vehicleOperatingCardExpiryDate: Date,

  driverOperatingCardName: String,
  driverOperatingCardNumber: String,
  driverOperatingCardIssueDate: Date,
  driverOperatingCardExpiryDate: Date,

  vehicleRegistrationSerialNumber: String,
  vehicleRegistrationNumber: String,
  vehicleRegistrationIssueDate: Date,
  vehicleRegistrationExpiryDate: Date,

  driverInsurancePolicyNumber: String,
  driverInsuranceIssueDate: Date,
  driverInsuranceExpiryDate: Date,

  vehicleInsurancePolicyNumber: String,
  vehicleInsuranceIssueDate: Date,
  vehicleInsuranceExpiryDate: Date,

  insuranceNumber: String,
  insuranceExpiry: Date,

  // =========================
  // Status and Tracking
  // =========================
  status: {
    type: String,
    enum: ['active', 'inactive', 'under_maintenance', 'out_of_service'],
    default: 'active'
  },
  lastMaintenanceDate: Date,
  nextMaintenanceDate: Date,

  // =========================
  // Notifications
  // =========================
  notifications: [{
    type: {
      type: String,
      enum: [
        'daily_check_missing',
        'supervisor_warning',
        'license_expiry',
        'insurance_expiry',
        'maintenance_due'
      ]
    },
    message: String,
    sentTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    sentAt: {
      type: Date,
      default: Date.now
    },
    read: {
      type: Boolean,
      default: false
    }
  }],

  // =========================
  // Timestamps
  // =========================
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// =========================
// Hooks
// =========================
maintenanceSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// =========================
// Indexes
// =========================
maintenanceSchema.index({ inspectionMonth: 1, plateNumber: 1 });
maintenanceSchema.index({ driverId: 1 });
maintenanceSchema.index({ status: 1 });
maintenanceSchema.index({ 'dailyChecks.date': 1 });

module.exports = mongoose.model('Maintenance', maintenanceSchema);
