const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM || "ALBUHAIRA <no-reply@resend.dev>",
      to,
      subject,
      html,
    });

    console.log("📧 Email sent:", response.id);
    return response;
  } catch (error) {
    console.error("❌ Email error:", error);
    throw error;
  }
};
