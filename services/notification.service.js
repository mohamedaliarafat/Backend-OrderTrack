const Notification = require('../models/Notification');
const Device = require('../models/Device'); // لو عندك
const RealtimeService = require('./realtime.service');
// const admin = require('../config/firebase'); // عند تفعيل FCM

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
    platforms = ['web', 'android', 'ios'],
    channels = ['in_app', 'push']
  }) {
    const notification = await Notification.create({
      type,
      title,
      message,
      data,
      recipients: recipients.map(user => ({ user })),
      priority,
      createdBy,
      orderId,
      platforms,
      channels,
      sendStatus: 'pending'
    });

    // 🔔 WebSocket (Realtime)
    recipients.forEach(userId => {
      RealtimeService.sendToUser(userId, {
        type: 'notification',
        data: {
          id: notification._id,
          title,
          message,
          priority,
          createdAt: notification.createdAt
        }
      });
    });

    // 📱 Push Notification (جاهز للتفعيل)
    /*
    if (channels.includes('push')) {
      const devices = await Device.find({
        user: { $in: recipients },
        platform: { $in: platforms },
        isActive: true
      });

      const tokens = devices.map(d => d.token);

      if (tokens.length) {
        await admin.messaging().sendMulticast({
          tokens,
          notification: { title, body: message },
          data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          )
        });
      }
    }
    */

    notification.sendStatus = 'sent';
    await notification.save();

    return notification;
  }
}

module.exports = NotificationService;
