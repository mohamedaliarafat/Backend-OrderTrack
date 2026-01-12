const User = require('../models/User');

module.exports = async (order) => {
  try {
    // 1️⃣ هات منشئ الطلب (عشان نحدد الحساب)
    const creator = await User.findById(order.createdBy).select('companyId role email');

    if (!creator) {
      console.log('❌ Order creator not found');
      return [];
    }

    // 2️⃣ هات الـ Owner من نفس الحساب
    const owner = await User.findOne({
      role: 'owner',
      companyId: creator.companyId // ✳️ غيّر الاسم لو مختلف عندك
    }).select('email');

    if (!owner || !owner.email) {
      console.log('❌ Owner not found or has no email');
      return [];
    }

    const emails = [owner.email.trim()];

    console.log('📨 Auto email recipients (OWNER ONLY):', emails);
    return emails;

  } catch (err) {
    console.error('❌ getOrderEmails error:', err);
    return [];
  }
};
