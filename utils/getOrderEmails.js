const User = require('../models/User');

module.exports = async (order) => {
  const emails = new Set();

  if (order.customer?.email) emails.add(order.customer.email);
  if (order.createdBy?.email) emails.add(order.createdBy.email);

  const admins = await User.find({
    role: { $in: ['admin', 'manager'] },
    isActive: true,
    email: { $exists: true }
  });

  admins.forEach(u => emails.add(u.email));

  return [...emails];
};
