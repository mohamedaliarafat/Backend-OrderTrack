const nodemailer = require('nodemailer');

// ===============================
// ⚙️ SMTP Configuration
// ===============================
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


// ===============================
// 📧 Email Constants
// ===============================
const VERIFIED_DOMAIN = 'albuheiraalarabia.com';
const DEFAULT_FROM = 'شركة البحيرة العربية <nasser_mo@albuhairaalarabia.com>';
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
exports.sendEmail = async ({ to, subject, html, replyTo }) => {
  const recipients = normalizeEmails(to);

  if (recipients.length === 0) {
    console.log('⚠️ sendEmail skipped – no valid recipients');
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
      to: recipients.join(','),
      subject,
      html,
      replyTo: replyTo || DEFAULT_REPLY_TO,
    });

    console.log('📧 Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Email error:', error.message);
    throw error;
  }
};
