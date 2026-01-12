const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findOne({ _id: decoded.userId });

    if (!user) {
      throw new Error();
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: '??? ????' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '??? ????? ???????' });
  }
  next();
};

const managerMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: '??? ????? ???????' });
  }
  next();
};

const adminOrOwnerMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: '??? ????? ???????' });
  }
  next();
};
const mergePermissionMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'غير مصرح – لم يتم تسجيل الدخول',
    });
  }

  const allowedRoles = ['admin', 'owner', 'employee'];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'غير مسموح بدمج الطلبات',
    });
  }

  next();
};


module.exports = {
  authMiddleware,
  adminMiddleware,
  managerMiddleware,
  adminOrOwnerMiddleware,
  mergePermissionMiddleware,
};
