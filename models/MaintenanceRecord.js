const mongoose = require('mongoose');

const maintenanceTaskSchema = new mongoose.Schema(
  {
    taskName: { type: String, trim: true },
    description: { type: String, trim: true },
    status: { type: String, trim: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    technicianName: { type: String, trim: true },
    startTime: Date,
    endTime: Date,
    estimatedHours: { type: Number, default: 0 },
    actualHours: { type: Number, default: 0 },
    notes: { type: String, trim: true },
  },
  { _id: false },
);

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, trim: true },
    path: { type: String, trim: true },
    fileType: { type: String, trim: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, trim: true },
    uploadedAt: Date,
  },
  { _id: false },
);

const maintenanceRecordSchema = new mongoose.Schema(
  {
    stationId: { type: String, trim: true },
    stationName: { type: String, trim: true },
    maintenanceType: { type: String, trim: true },
    priority: { type: String, trim: true },
    status: { type: String, trim: true },
    description: { type: String, trim: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    technicianName: { type: String, trim: true },
    scheduledDate: Date,
    completedDate: Date,
    estimatedCost: { type: Number, default: 0 },
    actualCost: { type: Number, default: 0 },
    tasks: [maintenanceTaskSchema],
    attachments: [attachmentSchema],
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, trim: true },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
