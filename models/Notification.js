const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'order_created',
      'order_updated',
      'order_assigned',
      'order_overdue',
      'loading_reminder',
      'arrival_reminder',
      'loading_completed',
      'order_cancelled',
      'status_changed',
      'order_merged',
      'order_unmerged',
      'order_deleted',
      'attachment_added',
      'attachment_removed',
      'system_alert'
    ],
    required: true
  },

  title: {
    type: String,
    required: true,
    trim: true
  },

  message: {
    type: String,
    required: true,
    trim: true
  },

  data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  recipients: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    read: {
      type: Boolean,
      default: false
    },
    readAt: Date,
    delivered: {
      type: Boolean,
      default: false
    },
    deliveredAt: Date
  }],

  platforms: {
    type: [String],
    enum: ['web', 'android', 'ios', 'desktop'],
    default: ['web', 'android', 'ios']
  },

  channels: {
    type: [String],
    enum: ['in_app', 'push', 'email'],
    default: ['in_app', 'push']
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  sendStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },

  sendError: String,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },

  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
notificationSchema.index({ 'recipients.user': 1, createdAt: -1 });
notificationSchema.index({ orderId: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ sendStatus: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
