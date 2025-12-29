const { Resend } = require("resend");

// تهيئة Resend
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * دالة إرسال إيميل عامة
 * @param {Object} params
 * @param {string|string[]} params.to - البريد المستلم
 * @param {string} params.subject - عنوان الإيميل
 * @param {string} params.html - محتوى HTML
 */
exports.sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM || "ALBUHAIRA <no-reply@yourdomain.com>",
      to,
      subject,
      html,
    });

    console.log("📧 Email sent successfully:", response.id);
    return response;
  } catch (error) {
    console.error("❌ Email error:", error);
    throw error;
  }
};
