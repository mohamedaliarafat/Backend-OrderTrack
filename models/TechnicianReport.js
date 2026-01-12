const mongoose = require('mongoose');

const reportIssueSchema = new mongoose.Schema(
  {
    issueType: { type: String, trim: true },
    severity: { type: String, trim: true },
    description: { type: String, trim: true },
    status: { type: String, trim: true },
    discoveryDate: Date,
    resolutionDate: Date,
    resolutionNotes: { type: String, trim: true },
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

const technicianReportSchema = new mongoose.Schema(
  {
    stationId: { type: String, trim: true },
    stationName: { type: String, trim: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    technicianName: { type: String, trim: true },
    reportType: { type: String, trim: true },
    reportTitle: { type: String, trim: true },
    description: { type: String, trim: true },
    issues: [reportIssueSchema],
    attachments: [attachmentSchema],
    recommendations: { type: String, trim: true },
    status: { type: String, trim: true },
    reportDate: Date,
    approvalDate: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedByName: { type: String, trim: true },
    approvalNotes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, trim: true },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('TechnicianReport', technicianReportSchema);
