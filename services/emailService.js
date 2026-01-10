const nodemailer = require('nodemailer');

// ===============================
// ⚙️ SMTP Configuration
// ===============================
<<<<<<< HEAD
const SMTP_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'mail-eu.smtp2go.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 2525);
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS;
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || SMTP_PORT === 465;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

=======
const transporter = nodemailer.createTransport({
  host: 'mail-eu.smtp2go.com',
  port: 2525, // 🔥 غيرنا البورت
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

>>>>>>> 5503bbbd402f0b8d6a6b4a5fd0ef7236f0c28257

// ===============================
// 📧 Email Constants
// ===============================
const VERIFIED_DOMAIN = 'albuhairaalarabia.com';
const DEFAULT_FROM = 'شركة البحيرة العربية <no-replay@albuhairaalarabia.com>';
const DEFAULT_REPLY_TO = 'nasser@albuheiraalarabia.com';

// ===============================
// 🧹 Normalize Emails
// ===============================
const normalizeEmails = (to) => {
  if (!to) return [];

  const emails = Array.isArray(to) ? to : [to];

  return emails
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => e && e.includes('@'));
};

// ===============================
// 📤 Send Email (Production Safe)
// ===============================
// ===============================
// 📤 Send Email (Supports TO + BCC)
// ===============================
exports.sendEmail = async ({ to, bcc, subject, html, replyTo }) => {
  const toRecipients = normalizeEmails(to);
  const bccRecipients = normalizeEmails(bcc);

  // ❌ لا يوجد أي مستلمين
  if (toRecipients.length === 0 && bccRecipients.length === 0) {
    console.log('⚠️ sendEmail skipped – no valid recipients (to & bcc empty)');
    return;
  }

  // 🛡️ حماية من إرسال من دومين غير موثّق
  const fromDomain = DEFAULT_FROM.split('@')[1]?.replace('>', '');
  if (fromDomain !== VERIFIED_DOMAIN) {
    console.error('❌ Invalid FROM domain:', fromDomain);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: DEFAULT_FROM,

      // ✅ لازم يكون فيه to حتى لو وهمي
      to: toRecipients.length > 0
        ? toRecipients.join(',')
        : 'no-reply@albuhairaalarabia.com',

      // ✅ إرسال جماعي مخفي
      bcc: bccRecipients.length > 0 ? bccRecipients.join(',') : undefined,

      subject,
      html,
      replyTo: replyTo || DEFAULT_REPLY_TO,
    });

    console.log(
      `📧 Email sent | to:${toRecipients.length} | bcc:${bccRecipients.length} | id:${info.messageId}`
    );

    return info;
  } catch (error) {
    console.error('❌ Email error:', error.message);
    throw error;
  }
};

<<<<<<< HEAD

=======
>>>>>>> 5503bbbd402f0b8d6a6b4a5fd0ef7236f0c28257
