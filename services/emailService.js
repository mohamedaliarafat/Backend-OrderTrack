const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// الدومين المعتمد
const VERIFIED_DOMAIN = "albuheiraalarabia.com";
const DEFAULT_FROM = "شركة البحيرة العربية <no-reply@albuheiraalarabia.com>";
const DEFAULT_REPLY_TO = "nasser@albuheiraalarabia.com";

/**
 * تنظيف الإيميلات (تحويلها لمصفوفة + إزالة الفارغ + lowercase)
 */
const normalizeEmails = (to) => {
  if (!to) return [];

  const emails = Array.isArray(to) ? to : [to];

  return emails
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => e && e.includes("@"));
};

/**
 * إرسال إيميل عام (Production Safe)
 */
exports.sendEmail = async ({ to, subject, html, replyTo }) => {
  const recipients = normalizeEmails(to);

  if (recipients.length === 0) {
    console.log("⚠️ sendEmail skipped – no valid recipients");
    return;
  }

  // حماية من إرسال دومين غير موثّق
  const fromDomain = DEFAULT_FROM.split("@")[1]?.replace(">", "");
  if (fromDomain !== VERIFIED_DOMAIN) {
    console.error("❌ Invalid FROM domain:", fromDomain);
    return;
  }

  try {
    const response = await resend.emails.send({
      from: DEFAULT_FROM,
      to: recipients,
      subject,
      html,
      reply_to: replyTo || DEFAULT_REPLY_TO,
    });

    console.log(
      "📧 Email sent:",
      response?.id || response?.data?.id || ""
    );

    return response;
  } catch (error) {
    console.error("❌ Email error:", error.message);
    throw error;
  }
};
