const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * إرسال إيميل عام
 * @param {Object} params
 * @param {string|string[]} params.to
 * @param {string} params.subject
 * @param {string} params.html
 */
exports.sendEmail = async ({ to, subject, html }) => {
  // 🛑 حماية إضافية
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.log("⚠️ sendEmail skipped – no recipients");
    return;
  }

  try {
    const response = await resend.emails.send({
      // ✅ sender مضمون
      from: "Resend <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    console.log(
      "📧 Email sent",
      response?.id || response?.data?.id || ""
    );

    return response;
  } catch (error) {
    console.error("❌ Email error:", error);
    // لا ترمي الخطأ لو مش حابب توقف العملية
    throw error;
  }
};
