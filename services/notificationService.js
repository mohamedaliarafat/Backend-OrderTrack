const Notification = require('../models/Notification');
const Device = require('../models/Device');
const RealtimeService = require('./realtime.service');
const { initFirebase } = require('../config/firebase');
const { sendEmail } = require('../utils/emailService'); // Resend
const templates = require('../utils/emailTemplates');   // عندك

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
    channels = ['in_app', 'push', 'email'], // خليها حسب الحدث
  }) {
    // 1) create DB notification
    const notification = await Notification.create({
      type,
      title,
      message,
      data,
      recipients: recipients.map(user => ({ user })),
      priority,
      createdBy,
      orderId,
      platforms: platforms.filter(p => p !== 'desktop'), // push للـ desktop لا
      channels: channels.filter(Boolean),
      sendStatus: 'pending'
    });

    // 2) realtime (web/desktop)
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
          createdAt: notification.createdAt,
        }
      });
    }

    // 3) Push via FCM
    if (channels.includes('push')) {
      await this._sendPushFCM({
        notificationId: notification._id,
        title,
        message,
        data,
        recipients,
        platforms,
      });
    }

    // 4) Email
    if (channels.includes('email')) {
      await this._sendEmail({
        type,
        title,
        message,
        data,
        recipients,
      });
    }

    notification.sendStatus = 'sent';
    await notification.save();

    return notification;
  }

  static async _sendPushFCM({ notificationId, title, message, data, recipients, platforms }) {
    const admin = initFirebase();
    if (!admin) return;

    // desktop excluded by design
    const pushPlatforms = platforms.filter(p => p !== 'desktop');

    const devices = await Device.find({
      user: { $in: recipients },
      platform: { $in: pushPlatforms },
      isActive: true
    }).select('token platform user');

    const tokens = [...new Set(devices.map(d => d.token).filter(Boolean))];
    if (!tokens.length) return;

    // FCM data must be string values
    const payloadData = {};
    Object.entries({ ...data, notificationId: String(notificationId) }).forEach(([k, v]) => {
      payloadData[k] = v == null ? '' : String(v);
    });

    // multicast (limit 500 tokens)
    const chunks = [];
    for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

    for (const chunk of chunks) {
      try {
        const resp = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title, body: message },
          data: payloadData,
        });

        // لو فيه توكنات فاشلة: عطّلها
        resp.responses.forEach(async (r, idx) => {
          if (!r.success) {
            const badToken = chunk[idx];
            const errCode = r.error?.code || '';
            if (errCode.includes('registration-token-not-registered')) {
              await Device.updateOne({ token: badToken }, { $set: { isActive: false } });
            }
          }
        });
      } catch (e) {
        console.error('❌ FCM send error:', e?.message || e);
      }
    }
  }

  static async _sendEmail({ type, title, message, data, recipients }) {
    // هنا أنت عندك util getOrderRecipients للإيميل
    // الأفضل: نجيب إيميلات المستخدمين مباشرة من User
    const User = require('../models/User');
    const users = await User.find({ _id: { $in: recipients } }).select('email name');
    const emails = users.map(u => u.email).filter(Boolean);

    if (!emails.length) return;

    // استخدم templates لو تحب
    const html = `
      <div style="font-family:Arial;padding:20px">
        <h2>${title}</h2>
        <p>${message}</p>
      </div>
    `;

    try {
      await sendEmail({ to: emails, subject: title, html });
    } catch (e) {
      console.error('❌ Email send error:', e?.message || e);
    }
  }
}

module.exports = NotificationService;
