/**
 * 📨 Email Queue (Rate Limit Protection)
 * يمنع إرسال أكثر من 2 إيميل في الثانية (حل مشكلة 429)
 */

let lastSentAt = 0;
const MIN_DELAY = 600; // 0.6 ثانية بين كل إرسال

async function safeSendEmail(sendFn) {
  const now = Date.now();
  const diff = now - lastSentAt;

  if (diff < MIN_DELAY) {
    await new Promise(resolve =>
      setTimeout(resolve, MIN_DELAY - diff)
    );
  }

  lastSentAt = Date.now();
  return sendFn();
}

module.exports = { safeSendEmail };
