const mongoose = require('mongoose');

const alertNotificationSchema = new mongoose.Schema(
  {
    alertType: { type: String, trim: true },
    priority: { type: String, trim: true },
    target: { type: String, trim: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    technicianName: { type: String, trim: true },
    stationId: { type: String, trim: true },
    stationName: { type: String, trim: true },
    title: { type: String, trim: true },
    message: { type: String, trim: true },
    sendEmail: { type: Boolean, default: false },
    sendSMS: { type: Boolean, default: false },
    sendPush: { type: Boolean, default: false },
    status: { type: String, trim: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentByName: { type: String, trim: true },
    sentAt: { type: Date, default: Date.now },
    readAt: Date,
    actionTaken: { type: String, trim: true },
    actionTakenAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model('AlertNotification', alertNotificationSchema);
