const User = require('../models/User');

module.exports = async (order) => {
  const emails = [];

  // 👤 إيميل العميل
  if (order.customer?.email && typeof order.customer.email === 'string') {
    emails.push(order.customer.email.trim());
  }

  // 👨‍💼 إيميل منشئ الطلب
  if (order.createdBy?.email && typeof order.createdBy.email === 'string') {
    emails.push(order.createdBy.email.trim());
  }

  // 🔐 Admin فقط (حسب الموديل الفعلي)
  const admins = await User.find({
    role: 'admin',
    email: { $exists: true, $ne: null }
  }).select('email');

  admins.forEach(u => {
    if (u.email && typeof u.email === 'string') {
      emails.push(u.email.trim());
    }
  });

  // 🧹 تنظيف نهائي + إزالة التكرار
  const cleanEmails = [
    ...new Set(
      emails.filter(
        e =>
          typeof e === 'string' &&
          e.includes('@') &&
          e.includes('.')
      )
    )
  ];

  console.log('📨 Auto email recipients:', cleanEmails);

  return cleanEmails;
};
