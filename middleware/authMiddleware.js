// const jwt = require('jsonwebtoken');
// const User = require('../models/User');

// const authMiddleware = async (req, res, next) => {
//   try {
//     const token = req.header('Authorization')?.replace('Bearer ', '');

//     if (!token) {
//       throw new Error();
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
//     const user = await User.findOne({ _id: decoded.userId });

//     if (!user) {
//       throw new Error();
//     }

//     req.user = user;
//     req.token = token;
//     next();
//   } catch (error) {
//     res.status(401).json({ error: '??? ????' });
//   }
// };

// const adminMiddleware = (req, res, next) => {
//   if (req.user.role !== 'admin') {
//     return res.status(403).json({ error: '??? ????? ???????' });
//   }
//   next();
// };

// const managerMiddleware = (req, res, next) => {
//   if (req.user.role !== 'admin' && req.user.role !== 'manager') {
//     return res.status(403).json({ error: '??? ????? ???????' });
//   }
//   next();
// };

// const adminOrOwnerMiddleware = (req, res, next) => {
//   if (req.user.role !== 'admin' && req.user.role !== 'owner') {
//     return res.status(403).json({ error: '??? ????? ???????' });
//   }
//   next();
// };
// const mergePermissionMiddleware = (req, res, next) => {
//   if (!req.user) {
//     return res.status(401).json({
//       error: 'غير مصرح – لم يتم تسجيل الدخول',
//     });
//   }

//   const allowedRoles = ['admin', 'owner', 'employee'];

//   if (!allowedRoles.includes(req.user.role)) {
//     return res.status(403).json({
//       error: 'غير مسموح بدمج الطلبات',
//     });
//   }

//   next();
// };


// module.exports = {
//   authMiddleware,
//   adminMiddleware,
//   managerMiddleware,
//   adminOrOwnerMiddleware,
//   mergePermissionMiddleware,
// };



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

// ===============================
// MIDDLEWARE لنظام شؤون الموظفين
// ===============================

const hrAdminMiddleware = (req, res, next) => {
  const allowedRoles = ['admin', 'hr_admin', 'owner'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      success: false,
      error: 'غير مصرح – تحتاج صلاحيات مدير شؤون الموظفين' 
    });
  }
  next();
};

const hrManagerMiddleware = (req, res, next) => {
  const allowedRoles = ['admin', 'hr_admin', 'hr_manager', 'owner'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      success: false,
      error: 'غير مصرح – تحتاج صلاحيات إدارية' 
    });
  }
  next();
};

const hrAccountantMiddleware = (req, res, next) => {
  const allowedRoles = ['admin', 'hr_admin', 'accountant', 'owner'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      success: false,
      error: 'غير مصرح – تحتاج صلاحيات محاسب' 
    });
  }
  next();
};

const hrSupervisorMiddleware = (req, res, next) => {
  const allowedRoles = ['admin', 'hr_admin', 'hr_manager', 'supervisor', 'owner'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      success: false,
      error: 'غير مصرح – تحتاج صلاحيات مشرف' 
    });
  }
  next();
};

const employeeSelfOrManagerMiddleware = (req, res, next) => {
  // السماح للموظف بالوصول لبياناته الخاصة
  // أو للإداريين بالوصول لجميع البيانات
  const employeeId = req.params.id || req.params.employeeId;
  
  if (req.user.role === 'employee' && employeeId && employeeId !== req.user._id.toString()) {
    return res.status(403).json({ 
      success: false,
      error: 'غير مصرح – يمكنك الوصول لبياناتك فقط' 
    });
  }
  
  const allowedRoles = ['admin', 'hr_admin', 'hr_manager', 'supervisor', 'accountant', 'owner'];
  if (!allowedRoles.includes(req.user.role) && req.user.role !== 'employee') {
    return res.status(403).json({ 
      success: false,
      error: 'غير مصرح' 
    });
  }
  
  next();
};

const fingerprintAuthMiddleware = (req, res, next) => {
  // هذا الوسيط للوصول العام من أجهزة البصمة
  // يمكن إضافة تحقق بمفتاح API خاص
  const apiKey = req.headers['x-fingerprint-api-key'];
  
  if (!apiKey || apiKey !== process.env.FINGERPRINT_API_KEY) {
    return res.status(401).json({ 
      success: false,
      error: 'مفتاح API غير صالح' 
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
  
  // نظام شؤون الموظفين
  hrAdminMiddleware,
  hrManagerMiddleware,
  hrAccountantMiddleware,
  hrSupervisorMiddleware,
  employeeSelfOrManagerMiddleware,
  fingerprintAuthMiddleware
};