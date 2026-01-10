const Notification = require('../models/Notification');
const Device = require('../models/Device');
const RealtimeService = require('./realtime.service');
const { initFirebase } = require('../config/firebase');
const { sendEmail } = require('./emailService');
const templates = require('./emailTemplates');

class NotificationService {
  static async send({
    type,
    title,
    message,
    data = {},
    recipients = [],
    priority = 'medium',
    createdBy,
    orderId,
    platforms = ['web', 'android', 'ios', 'desktop'],
    channels = ['in_app', 'push', 'email'],
    extraEmails = []
  }) {
    const notification = await Notification.create({
      type,
      title,
      message,
      data,
      recipients: recipients.map((user) => ({ user })),
      priority,
      createdBy,
      orderId,
      platforms: platforms.filter((p) => p !== 'desktop'),
      channels: channels.filter(Boolean),
      sendStatus: 'pending'
    });

    // realtime in-app
    for (const userId of recipients) {
      RealtimeService.sendToUser(userId, {
        type: 'notification',
        data: {
          id: notification._id,
          type,
          title,
          message,
          priority,
          orderId,
          createdAt: notification.createdAt
        }
      });
    }

    if (channels.includes('push')) {
      await this._sendPushFCM({
        notificationId: notification._id,
        title,
        message,
        data,
        recipients,
        platforms
      });
    }

    if (channels.includes('email')) {
      await this._sendEmail({
        type,
        title,
        message,
        data,
        recipients,
        extraEmails
      });
    }

    notification.sendStatus = 'sent';
    await notification.save();

    return notification;
  }

  static async sendToAll({
    type,
    title,
    message,
    data = {},
    priority = 'medium',
    createdBy,
    orderId,
    platforms,
    channels,
    extraEmails = []
  }) {
    const User = require('../models/User');
    const users = await User.find({}).select('_id email').lean();
    const recipients = users.map((user) => user._id);

    return this.send({
      type,
      title,
      message,
      data: {
        ...data,
        recipientsCount: users.length
      },
      recipients,
      priority,
      createdBy,
      orderId,
      platforms,
      channels,
      extraEmails
    });
  }

  static async notifyLoadingReminder(order, minutes) {
    return this.sendToAll({
      type: 'loading_reminder',
      title: `تذكير بتحميل الطلب ${order.orderNumber}`,
      message: `باقي ${minutes} دقيقة على موعد التحميل.`,
      data: {
        order: order,
        note: `موعد التحميل: ${order.loadingDate} ${order.loadingTime}`
      },
      orderId: order._id,
      priority: 'medium'
    });
  }

  static async notifyArrivalReminder(order, hours) {
    return this.sendToAll({
      type: 'arrival_reminder',
      title: `تذكير بوصول الطلب ${order.orderNumber}`,
      message: `باقي ${hours} ساعة على موعد الوصول.`,
      data: {
        order: order,
        note: `موعد الوصول: ${order.arrivalDate} ${order.arrivalTime}`
      },
      orderId: order._id,
      priority: 'medium'
    });
  }

  static async notifyOrderOverdue(order) {
    return this.sendToAll({
      type: 'order_overdue',
      title: `طلب متأخر ${order.orderNumber}`,
      message: 'تم رصد طلب متأخر عن الجدول الزمني.',
      data: { order },
      orderId: order._id,
      priority: 'high'
    });
  }

  static async notifyLoadingCompleted(order, actor) {
    return this.sendToAll({
      type: 'loading_completed',
      title: `اكتمال تحميل الطلب ${order.orderNumber}`,
      message: 'تم اكتمال تحميل الطلب بنجاح.',
      data: {
        order,
        actorName: actor?.name || 'النظام'
      },
      orderId: order._id,
      priority: 'medium'
    });
  }

  static async notifySystemAlert(title, message, priority = 'urgent') {
    return this.sendToAll({
      type: 'system_alert',
      title,
      message,
      priority,
      channels: ['in_app', 'email']
    });
  }

  static async _sendPushFCM({
    notificationId,
    title,
    message,
    data,
    recipients,
    platforms
  }) {
    const admin = initFirebase();
    if (!admin) return;

    const pushPlatforms = (platforms || []).filter((p) => p !== 'desktop');

    const devices = await Device.find({
      user: { $in: recipients },
      platform: { $in: pushPlatforms },
      isActive: true
    }).select('token platform user');

    const tokens = [...new Set(devices.map((d) => d.token).filter(Boolean))];
    if (!tokens.length) return;

    const payloadData = {};
    Object.entries({ ...data, notificationId: String(notificationId) }).forEach(
      ([k, v]) => {
        payloadData[k] = v == null ? '' : String(v);
      }
    );

    const chunks = [];
    for (let i = 0; i < tokens.length; i += 500) {
      chunks.push(tokens.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      try {
        const resp = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title, body: message },
          data: payloadData
        });

        resp.responses.forEach(async (r, idx) => {
          if (!r.success) {
            const badToken = chunk[idx];
            const errCode = r.error?.code || '';
            if (errCode.includes('registration-token-not-registered')) {
              await Device.updateOne(
                { token: badToken },
                { $set: { isActive: false } }
              );
            }
          }
        });
      } catch (e) {
        console.error('FCM send error:', e?.message || e);
      }
    }
  }

  static async _sendEmail({ type, title, message, data, recipients, extraEmails }) {
    const User = require('../models/User');
    const users = await User.find({ _id: { $in: recipients } }).select('email');
    const baseEmails = users.map((u) => u.email).filter(Boolean);
    const allEmails = [...new Set([...baseEmails, ...(extraEmails || [])])];

    if (!allEmails.length) return;

    const html = templates.orderEventTemplate({
      title,
      message,
      order: data?.order,
      actorName: data?.actorName,
      changes: data?.changes,
      note: data?.note,
      recipientsCount: data?.recipientsCount,
      badge: data?.badge || 'إشعار تلقائي'
    });

    try {
      await sendEmail({
        to: [],
        bcc: allEmails,
        subject: title,
        html
      });
    } catch (e) {
      console.error('Email send error:', e?.message || e);
    }
  }
}

module.exports = NotificationService;
