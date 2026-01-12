const mongoose = require('mongoose');

const approvalAttachmentSchema = new mongoose.Schema(
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

const approvalRequestSchema = new mongoose.Schema(
  {
    requestType: { type: String, trim: true },
    stationId: { type: String, trim: true },
    stationName: { type: String, trim: true },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'SAR' },
    attachments: [approvalAttachmentSchema],
    status: { type: String, trim: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedByName: { type: String, trim: true },
    requestedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedByName: { type: String, trim: true },
    reviewedAt: Date,
    reviewNotes: { type: String, trim: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedByName: { type: String, trim: true },
    approvedAt: Date,
    approvalNotes: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ApprovalRequest', approvalRequestSchema);
