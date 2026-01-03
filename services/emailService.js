const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * إرسال إيميل عام
 */
exports.sendEmail = async ({ to, subject, html }) => {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.log("⚠️ sendEmail skipped – no recipients");
    return;
  }

  try {
    const response = await resend.emails.send({
      from: "شركة البحيرة العربية <no-reply@albuheiraalarabia.com>", // ✅ مهم جدًا
      to,
      subject,
      html,
    });

    console.log("📧 Email sent:", response?.id || "");
    return response;
  } catch (error) {
    console.error("❌ Email error:", error.message);
    throw error;
  }
};
