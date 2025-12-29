// // 


// const Order = require('../models/Order');
// const Customer = require('../models/Customer');
// const Activity = require('../models/Activity');
// const Notification = require('../models/Notification');
// const mongoose = require('mongoose');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// // Configure multer for file upload
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadDir = 'uploads/';
//     if (!fs.existsSync(uploadDir)) {
//       fs.mkdirSync(uploadDir, { recursive: true });
//     }
//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// const upload = multer({ 
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
//     const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = filetypes.test(file.mimetype);
    
//     if (mimetype && extname) {
//       return cb(null, true);
//     } else {
//       cb(new Error('نوع الملف غير مدعوم'));
//     }
//   }
// }).fields([
//   { name: 'companyLogo', maxCount: 1 },
//   { name: 'attachments', maxCount: 5 }
// ]);

// exports.uploadMiddleware = upload;

// // توليد رقم طلب
// const generateOrderNumber = async () => {
//   const date = new Date();
//   const year = date.getFullYear().toString().slice(-2);
//   const month = (date.getMonth() + 1).toString().padStart(2, '0');
//   const prefix = `ORD${year}${month}`;
  
//   const lastOrder = await Order.findOne({
//     orderNumber: new RegExp(`^${prefix}`)
//   }).sort({ orderNumber: -1 });
  
//   if (!lastOrder) {
//     return `${prefix}001`;
//   }
  
//   const lastNumber = parseInt(lastOrder.orderNumber.slice(-3));
//   const newNumber = (lastNumber + 1).toString().padStart(3, '0');
//   return `${prefix}${newNumber}`;
// };

// // إنشاء طلب جديد
// exports.createOrder = async (req, res) => {
//   try {
//     upload(req, res, async (err) => {
//       if (err) {
//         return res.status(400).json({ error: err.message });
//       }

//       const orderData = req.body;
      
//       // توليد رقم طلب
//       orderData.orderNumber = await generateOrderNumber();

//       // التحقق من الأوقات
//       if (!orderData.loadingDate || !orderData.loadingTime || 
//           !orderData.arrivalDate || !orderData.arrivalTime) {
//         return res.status(400).json({ error: 'جميع الأوقات مطلوبة' });
//       }

//       // التحقق من وقت الوصول بعد وقت التحميل
//       const loadingDateTime = new Date(`${orderData.loadingDate}T${orderData.loadingTime}`);
//       const arrivalDateTime = new Date(`${orderData.arrivalDate}T${orderData.arrivalTime}`);
      
//       if (arrivalDateTime <= loadingDateTime) {
//         return res.status(400).json({ 
//           error: 'وقت الوصول يجب أن يكون بعد وقت التحميل' 
//         });
//       }

//       // Handle file uploads
//       if (req.files) {
//         if (req.files.companyLogo) {
//           orderData.companyLogo = req.files.companyLogo[0].path;
//         }
        
//         if (req.files.attachments) {
//           orderData.attachments = req.files.attachments.map(file => ({
//             filename: file.originalname,
//             path: file.path
//           }));
//         }
//       }

//       // Set createdBy
//       orderData.createdBy = req.user._id;

//       // Parse dates
//       if (orderData.orderDate) {
//         orderData.orderDate = new Date(orderData.orderDate);
//       }
//       if (orderData.loadingDate) {
//         orderData.loadingDate = new Date(orderData.loadingDate);
//       }
//       if (orderData.arrivalDate) {
//         orderData.arrivalDate = new Date(orderData.arrivalDate);
//       }

//       // إنشاء الطلب
//       const order = new Order(orderData);
//       await order.save();

//       // تسجيل النشاط
//       const activity = new Activity({
//         orderId: order._id,
//         activityType: 'إنشاء',
//         description: `تم إنشاء طلب جديد برقم ${order.orderNumber}`,
//         performedBy: req.user._id,
//         performedByName: req.user.name,
//         changes: {
//           'رقم الطلب': order.orderNumber,
//           'المورد': order.supplierName,
//           'وقت التحميل': `${order.loadingDate.toLocaleDateString('ar-SA')} ${order.loadingTime}`,
//           'وقت الوصول': `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`
//         }
//       });
//       await activity.save();

//       res.status(201).json({
//         message: 'تم إنشاء الطلب بنجاح',
//         order
//       });
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'حدث خطأ في السيرفر' });
//   }
// };

// // جلب جميع الطلبات
// exports.getOrders = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 20;
//     const skip = (page - 1) * limit;

//     // بناء عوامل التصفية
//     const filter = {};
    
//     if (req.query.status) {
//       filter.status = req.query.status;
//     }
    
//     if (req.query.supplierName) {
//       filter.supplierName = new RegExp(req.query.supplierName, 'i');
//     }
    
//     if (req.query.orderNumber) {
//       filter.orderNumber = new RegExp(req.query.orderNumber, 'i');
//     }
    
//     if (req.query.startDate) {
//       filter.orderDate = { $gte: new Date(req.query.startDate) };
//     }
    
//     if (req.query.endDate) {
//       if (filter.orderDate) {
//         filter.orderDate.$lte = new Date(req.query.endDate);
//       } else {
//         filter.orderDate = { $lte: new Date(req.query.endDate) };
//       }
//     }

//     // جلب الطلبات
//     const orders = await Order.find(filter)
//       .populate('createdBy', 'name email')
//       .populate('customer', 'name code')
//       .sort({ orderDate: -1 })
//       .skip(skip)
//       .limit(limit);

//     // العدد الإجمالي
//     const total = await Order.countDocuments(filter);

//     res.json({
//       orders,
//       pagination: {
//         page,
//         limit,
//         total,
//         pages: Math.ceil(total / limit)
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ error: 'حدث خطأ في السيرفر' });
//   }
// };

// // جلب طلب محدد
// exports.getOrder = async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id)
//       .populate('createdBy', 'name email')
//       .populate('customer', 'name code phone email');
    
//     if (!order) {
//       return res.status(404).json({ error: 'الطلب غير موجود' });
//     }

//     // جلب النشاطات لهذا الطلب
//     const activities = await Activity.find({ orderId: order._id })
//       .populate('performedBy', 'name')
//       .sort({ createdAt: -1 });

//     res.json({
//       order,
//       activities
//     });
//   } catch (error) {
//     res.status(500).json({ error: 'حدث خطأ في السيرفر' });
//   }
// };

// // تحديث الطلب (محدود للسائق والملاحظات والمرفقات فقط)
// exports.updateOrder = async (req, res) => {
//   try {
//     upload(req, res, async (err) => {
//       if (err) {
//         return res.status(400).json({ error: err.message });
//       }

//       const order = await Order.findById(req.params.id);
//       if (!order) {
//         return res.status(404).json({ error: 'الطلب غير موجود' });
//       }

//       // السماح فقط بتعديل حقول محددة
//       const allowedUpdates = [
//         'driverName',
//         'driverPhone',
//         'vehicleNumber',
//         'notes',
//         'actualArrivalTime',
//         'loadingDuration',
//         'delayReason',
//         'customer'
//       ];
      
//       const updates = {};
//       Object.keys(req.body).forEach(key => {
//         if (allowedUpdates.includes(key)) {
//           updates[key] = req.body[key];
//         }
//       });

//       // تحديث العميل إذا تم تغييره
//       if (updates.customer && updates.customer !== order.customer?.toString()) {
//         const customer = await Customer.findById(updates.customer);
//         if (!customer) {
//           return res.status(404).json({ error: 'العميل غير موجود' });
//         }
        
//         // إذا كان الطلب في حالة "قيد الانتظار" وغير مخصص لعميل
//         if (order.status === 'قيد الانتظار' && !order.customer) {
//           updates.status = 'مخصص للعميل';
//         }
//       }

//       // Handle file uploads (المرفقات فقط)
//       if (req.files) {
//         // لا نسمح بتغيير الشعار أثناء التعديل
//         if (req.files.companyLogo) {
//           return res.status(400).json({ error: 'لا يمكن تغيير شعار الشركة أثناء التعديل' });
//         }
        
//         if (req.files.attachments) {
//           const newAttachments = req.files.attachments.map(file => ({
//             filename: file.originalname,
//             path: file.path
//           }));
//           updates.attachments = [...order.attachments, ...newAttachments];
//         }
//       }

//       // إذا تم تسجيل وقت الوصول الفعلي
//       if (updates.actualArrivalTime) {
//         // التحقق من تنسيق الوقت
//         const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
//         if (!timeRegex.test(updates.actualArrivalTime)) {
//           return res.status(400).json({ error: 'تنسيق الوقت غير صحيح. استخدم HH:MM' });
//         }
        
//         // تحديث حالة الطلب إذا تم التحميل
//         if (order.status === 'جاهز للتحميل' || order.status === 'في انتظار التحميل') {
//           order.loadingCompletedAt = new Date();
//           if (!updates.status) {
//             updates.status = 'تم التحميل';
//           }
//         }
//       }

//       // Track changes
//       const oldData = { ...order.toObject() };
      
//       // تحديث الطلب
//       Object.assign(order, updates);
//       await order.save();

//       // Log changes
//       const changes = {};
//       Object.keys(updates).forEach(key => {
//         if (key !== 'attachments' && oldData[key] !== updates[key]) {
//           changes[key] = `من: ${oldData[key] || 'غير محدد'} → إلى: ${updates[key]}`;
//         }
//       });

//       if (Object.keys(changes).length > 0) {
//         const activity = new Activity({
//           orderId: order._id,
//           activityType: 'تعديل',
//           description: `تم تعديل الطلب رقم ${order.orderNumber}`,
//           performedBy: req.user._id,
//           performedByName: req.user.name,
//           changes
//         });
//         await activity.save();
//       }

//       res.json({
//         message: 'تم تحديث الطلب بنجاح',
//         order,
//         allowedFields: allowedUpdates
//       });
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'حدث خطأ في السيرفر' });
//   }
// };

// // تحديث حالة الطلب (للإداريين فقط)
// exports.updateOrderStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status } = req.body;
    
//     const order = await Order.findById(id);
//     if (!order) {
//       return res.status(404).json({ error: 'الطلب غير موجود' });
//     }

//     // السماح فقط للإداريين بتغيير الحالة
//     if (req.user.role !== 'admin' && req.user.role !== 'manager') {
//       return res.status(403).json({ error: 'غير مصرح بتغيير حالة الطلب' });
//     }

//     const oldStatus = order.status;
//     order.status = status;
    
//     // إذا تم تغيير الحالة إلى "تم التحميل"
//     if (status === 'تم التحميل' && oldStatus !== 'تم التحميل') {
//       order.loadingCompletedAt = new Date();
//     }
    
//     await order.save();

//     // تسجيل النشاط
//     const activity = new Activity({
//       orderId: order._id,
//       activityType: 'تغيير حالة',
//       description: `تم تغيير حالة الطلب رقم ${order.orderNumber}`,
//       performedBy: req.user._id,
//       performedByName: req.user.name,
//       changes: {
//         'الحالة': `من: ${oldStatus} → إلى: ${status}`
//       }
//     });
//     await activity.save();

//     res.json({
//       message: 'تم تحديث حالة الطلب بنجاح',
//       order
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'حدث خطأ في السيرفر' });
//   }
// };

// // حذف الطلب
// exports.deleteOrder = async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id);
    
//     if (!order) {
//       return res.status(404).json({ error: 'الطلب غير موجود' });
//     }

//     // السماح فقط للإداريين بالحذف
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({ error: 'غير مصرح بحذف الطلب' });
//     }

//     // Delete associated files
//     if (order.companyLogo && fs.existsSync(order.companyLogo)) {
//       fs.unlinkSync(order.companyLogo);
//     }

//     // Delete attachments
//     order.attachments.forEach(attachment => {
//       if (fs.existsSync(attachment.path)) {
//         fs.unlinkSync(attachment.path);
//       }
//     });

//     // تسجيل النشاط قبل الحذف
//     const activity = new Activity({
//       orderId: order._id,
//       activityType: 'حذف',
//       description: `تم حذف الطلب رقم ${order.orderNumber}`,
//       performedBy: req.user._id,
//       performedByName: req.user.name,
//       changes: {
//         'رقم الطلب': order.orderNumber,
//         'المورد': order.supplierName
//       }
//     });
//     await activity.save();

//     // حذف الطلب
//     await Order.findByIdAndDelete(req.params.id);

//     res.json({
//       message: 'تم حذف الطلب بنجاح'
//     });
//   } catch (error) {
//     res.status(500).json({ error: 'حدث خطأ في السيرفر' });
//   }
// };

// // حذف مرفق
// exports.deleteAttachment = async (req, res) => {
//   try {
//     const { orderId, attachmentId } = req.params;
    
//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res.status(404).json({ error: 'الطلب غير موجود' });
//     }

//     const attachment = order.attachments.id(attachmentId);
//     if (!attachment) {
//       return res.status(404).json({ error: 'الملف غير موجود' });
//     }

//     // Delete file from server
//     if (fs.existsSync(attachment.path)) {
//       fs.unlinkSync(attachment.path);
//     }

//     // إزالة من المصفوفة
//     order.attachments.pull(attachmentId);
//     await order.save();

//     // تسجيل النشاط
//     const activity = new Activity({
//       orderId: order._id,
//       activityType: 'حذف',
//       description: `تم حذف مرفق من الطلب رقم ${order.orderNumber}`,
//       performedBy: req.user._id,
//       performedByName: req.user.name,
//       changes: {
//         'اسم الملف': attachment.filename
//       }
//     });
//     await activity.save();

//     res.json({
//       message: 'تم حذف الملف بنجاح'
//     });
//   } catch (error) {
//     res.status(500).json({ error: 'حدث خطأ في السيرفر' });
//   }
// };

// // دالة للتحقق من الطلبات القريبة من وقت الوصول
// exports.checkArrivalNotifications = async () => {
//   try {
//     const now = new Date();
    
//     // البحث عن الطلبات التي وصل وقت الإشعار الخاص بها (قبل الوصول بساعتين ونصف)
//     const orders = await Order.find({
//       status: { $in: ['جاهز للتحميل', 'في انتظار التحميل', 'مخصص للعميل'] },
//       arrivalNotificationSentAt: { $exists: false }
//     }).populate('customer createdBy');
    
//     for (const order of orders) {
//       const notificationTime = order.getArrivalNotificationTime();
      
//       if (now >= notificationTime) {
//         // إرسال إشعار
//         const User = require('../models/User');
//         const adminUsers = await User.find({ 
//           role: { $in: ['admin', 'manager'] },
//           isActive: true 
//         });
        
//         const notification = new Notification({
//           type: 'arrival_reminder',
//           title: 'تذكير بقرب وقت الوصول',
//           message: `الطلب رقم ${order.orderNumber} سيصل خلال ساعتين ونصف`,
//           data: {
//             orderId: order._id,
//             orderNumber: order.orderNumber,
//             expectedArrival: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
//             supplierName: order.supplierName
//           },
//           recipients: adminUsers.map(user => ({ user: user._id })),
//           createdBy: order.createdBy?._id
//         });
        
//         await notification.save();
        
//         // تحديث وقت الإشعار
//         order.arrivalNotificationSentAt = new Date();
//         await order.save();
        
//         console.log(`إشعار وصول تم إرساله للطلب: ${order.orderNumber}`);
//       }
//     }
//   } catch (error) {
//     console.error('خطأ في التحقق من إشعارات الوصول:', error);
//   }
// };

// // دالة للتحقق من الطلبات التي انتهى وقت تحميلها
// exports.checkCompletedLoading = async () => {
//   try {
//     const now = new Date();
    
//     // البحث عن الطلبات التي انتهى وقت تحميلها ولم يتم تحديث حالتها
//     const orders = await Order.find({
//       status: { $in: ['في انتظار التحميل', 'جاهز للتحميل'] },
//       loadingCompletedAt: { $exists: false }
//     });
    
//     for (const order of orders) {
//       const loadingDateTime = order.getFullLoadingDateTime();
      
//       // إذا انقضى وقت التحميل بأكثر من ساعة
//       const oneHourAfterLoading = new Date(loadingDateTime);
//       oneHourAfterLoading.setHours(oneHourAfterLoading.getHours() + 1);
      
//       if (now >= oneHourAfterLoading) {
//         order.status = 'تم التحميل';
//         order.loadingCompletedAt = now;
//         await order.save();
        
//         console.log(`تم تحديث حالة الطلب ${order.orderNumber} إلى "تم التحميل" تلقائياً`);
//       }
//     }
//   } catch (error) {
//     console.error('خطأ في التحقق من اكتمال التحميل:', error);
//   }
// };


const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { sendEmail } = require('../services/emailService');
const EmailTemplates = require('../services/emailTemplates');
const getOrderEmails = require('../utils/getOrderEmails');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'));
    }
  }
}).fields([
  { name: 'companyLogo', maxCount: 1 },
  { name: 'attachments', maxCount: 5 }
]);

exports.uploadMiddleware = upload;

// توليد رقم طلب
const generateOrderNumber = async () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `ORD${year}${month}`;
  
  const lastOrder = await Order.findOne({
    orderNumber: new RegExp(`^${prefix}`)
  }).sort({ orderNumber: -1 });
  
  if (!lastOrder) {
    return `${prefix}001`;
  }
  
  const lastNumber = parseInt(lastOrder.orderNumber.slice(-3));
  const newNumber = (lastNumber + 1).toString().padStart(3, '0');
  return `${prefix}${newNumber}`;
};

// إنشاء طلب جديد
exports.createOrder = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const orderData = req.body;

      // توليد رقم طلب
      orderData.orderNumber = await generateOrderNumber();

      // التحقق من الأوقات
      if (
        !orderData.loadingDate ||
        !orderData.loadingTime ||
        !orderData.arrivalDate ||
        !orderData.arrivalTime
      ) {
        return res.status(400).json({ error: 'جميع الأوقات مطلوبة' });
      }

      // التحقق من وقت الوصول بعد وقت التحميل
      const loadingDateTime = new Date(
        `${orderData.loadingDate}T${orderData.loadingTime}`
      );
      const arrivalDateTime = new Date(
        `${orderData.arrivalDate}T${orderData.arrivalTime}`
      );

      if (arrivalDateTime <= loadingDateTime) {
        return res.status(400).json({
          error: 'وقت الوصول يجب أن يكون بعد وقت التحميل',
        });
      }

      // Handle file uploads
      if (req.files) {
        if (req.files.companyLogo) {
          orderData.companyLogo = req.files.companyLogo[0].path;
        }

        if (req.files.attachments) {
          orderData.attachments = req.files.attachments.map((file) => ({
            filename: file.originalname,
            path: file.path,
          }));
        }
      }

      // Set createdBy
      orderData.createdBy = req.user._id;

      // Parse dates
      if (orderData.orderDate) {
        orderData.orderDate = new Date(orderData.orderDate);
      }
      if (orderData.loadingDate) {
        orderData.loadingDate = new Date(orderData.loadingDate);
      }
      if (orderData.arrivalDate) {
        orderData.arrivalDate = new Date(orderData.arrivalDate);
      }

      // إنشاء الطلب
      const order = new Order(orderData);
      await order.save();

      // 🔥 إعادة جلب الطلب مع populate
      const populatedOrder = await Order.findById(order._id)
        .populate('customer', 'name code phone email')
        .populate('createdBy', 'name email');

      // تسجيل النشاط
      const activity = new Activity({
        orderId: order._id,
        activityType: 'إنشاء',
        description: `تم إنشاء طلب جديد برقم ${order.orderNumber}`,
        performedBy: req.user._id,
        performedByName: req.user.name,
        changes: {
          'رقم الطلب': order.orderNumber,
          'المورد': order.supplierName,
          'وقت التحميل': `${order.loadingDate.toLocaleDateString('ar-SA')} ${order.loadingTime}`,
          'وقت الوصول': `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
        },
      });
      await activity.save();

      // =========================
      // 📧 إرسال الإيميل
      // =========================
      try {
        const emails = await getOrderEmails(populatedOrder);

       if (!emails || emails.length === 0) {
          console.log('⚠️ No valid emails found for order creation');
        } else {
          await sendEmail({
            to: emails,
            subject: `📦 تم إنشاء طلب جديد - ${order.orderNumber}`,
            html: EmailTemplates.orderCreatedTemplate(populatedOrder),
          });
        }
      } catch (emailError) {
        // لا نوقف العملية لو الإيميل فشل
        console.error('❌ Email sending failed:', emailError.message);
      }

      return res.status(201).json({
        message: 'تم إنشاء الطلب بنجاح',
        order: populatedOrder,
      });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};


// جلب جميع الطلبات
exports.getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // بناء عوامل التصفية
    const filter = {};
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.supplierName) {
      filter.supplierName = new RegExp(req.query.supplierName, 'i');
    }
    
    if (req.query.orderNumber) {
      filter.orderNumber = new RegExp(req.query.orderNumber, 'i');
    }
    
    if (req.query.startDate) {
      filter.orderDate = { $gte: new Date(req.query.startDate) };
    }
    
    if (req.query.endDate) {
      if (filter.orderDate) {
        filter.orderDate.$lte = new Date(req.query.endDate);
      } else {
        filter.orderDate = { $lte: new Date(req.query.endDate) };
      }
    }

    // جلب الطلبات
    const orders = await Order.find(filter)
      .populate('createdBy', 'name email')
      .populate('customer', 'name code')
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit);

    // العدد الإجمالي
    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// جلب طلب محدد
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('customer', 'name code phone email');
    
    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    // جلب النشاطات لهذا الطلب
    const activities = await Activity.find({ orderId: order._id })
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 });

    res.json({
      order,
      activities
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

exports.getUpcomingOrders = async (req, res) => {
  try {
    const now = new Date();

    // ⏰ ساعتين قبل الوصول
    const twoHoursBefore = new Date(now.getTime() + (2 * 60 * 60 * 1000));

    // جلب الطلبات المحتملة
    const orders = await Order.find({
      status: { $in: ['في انتظار التحميل', 'جاهز للتحميل', 'مخصص للعميل'] },
    }).populate('customer createdBy driver');

    const upcomingOrders = [];

    for (const order of orders) {
      const arrivalDateTime = order.getFullArrivalDateTime();

      // الطلب داخل نطاق الإشعار (قبل الوصول بساعتين)
      if (
        arrivalDateTime > now &&
        arrivalDateTime <= twoHoursBefore
      ) {
        upcomingOrders.push(order);

        // 🟢 إرسال الإيميل مرة واحدة فقط
        if (!order.arrivalEmailSentAt) {
          try {
            const timeRemainingMs = arrivalDateTime - now;
            const timeRemaining = formatDuration(timeRemainingMs);

            const emails = await getOrderEmails(order);

           if (!emails || emails.length === 0) {
              console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
            } else {
              await sendEmail({
                to: emails,
                subject: `⏰ تذكير: اقتراب وصول الطلب ${order.orderNumber}`,
                html: EmailTemplates.arrivalReminderTemplate(
                  order,
                  timeRemaining
                ),
              });
            }


            // تحديث وقت الإرسال
            order.arrivalEmailSentAt = new Date();
            await order.save();

            console.log(
              `📧 Arrival email sent for order ${order.orderNumber}`
            );
          } catch (emailError) {
            console.error(
              `❌ Failed to send arrival email for order ${order.orderNumber}`,
              emailError.message
            );
          }
        }
      }
    }

    return res.json(upcomingOrders);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: 'حدث خطأ في جلب الطلبات القريبة' });
  }
};


exports.getOrdersWithTimers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.supplierName) {
      filter.supplierName = new RegExp(req.query.supplierName, 'i');
    }

    // جلب الطلبات
    const orders = await Order.find(filter)
      .populate('customer', 'name code email')
      .populate('driver', 'name phone vehicleNumber')
      .populate('createdBy', 'name email')
      .sort({ arrivalDate: 1, arrivalTime: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);
    const now = new Date();

    const ordersWithTimers = [];

    for (const order of orders) {
      const arrivalDateTime = order.getFullArrivalDateTime();
      const loadingDateTime = order.getFullLoadingDateTime();

      const arrivalRemaining = arrivalDateTime - now;
      const loadingRemaining = loadingDateTime - now;

      const arrivalCountdown =
        arrivalRemaining > 0 ? formatDuration(arrivalRemaining) : 'تأخر';

      const loadingCountdown =
        loadingRemaining > 0 ? formatDuration(loadingRemaining) : 'تأخر';

      // ⏰ قبل الوصول بساعتين
      const isApproachingArrival =
        arrivalRemaining > 0 &&
        arrivalRemaining <= 2 * 60 * 60 * 1000;

      const isApproachingLoading =
        loadingRemaining > 0 &&
        loadingRemaining <= 2.5 * 60 * 60 * 1000;

      // 📧 إرسال الإيميل (مرة واحدة فقط)
      if (isApproachingArrival && !order.arrivalEmailSentAt) {
        try {
          const emails = await getOrderEmails(order);

          if (!emails || emails.length === 0) {
              console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
            } else {
              await sendEmail({
                to: emails,
                subject: `⏰ تذكير: اقتراب وصول الطلب ${order.orderNumber}`,
                html: EmailTemplates.arrivalReminderTemplate(
                  order,
                  formatDuration(arrivalRemaining)
                ),
              });
            }


          order.arrivalEmailSentAt = new Date();
          await order.save();

          console.log(
            `📧 Arrival reminder email sent for order ${order.orderNumber}`
          );
        } catch (emailError) {
          console.error(
            `❌ Failed to send arrival email for order ${order.orderNumber}`,
            emailError.message
          );
        }
      }

      ordersWithTimers.push({
        ...order.toObject(),
        arrivalDateTime,
        loadingDateTime,
        arrivalRemaining,
        loadingRemaining,
        arrivalCountdown,
        loadingCountdown,
        needsArrivalNotification:
          isApproachingArrival && !order.arrivalEmailSentAt,
        isApproachingArrival,
        isApproachingLoading,
      });
    }

    return res.json({
      orders: ordersWithTimers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: 'حدث خطأ في جلب الطلبات' });
  }
};


// وظيفة مساعدة لتنسيق المدة
function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (minutes > 0) parts.push(`${minutes} دقيقة`);
  
  return parts.join(' و ') || 'أقل من دقيقة';
}

exports.sendArrivalReminder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('customer', 'name email')
      .populate('createdBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const User = require('../models/User');
    const Notification = require('../models/Notification');
    const Activity = require('../models/Activity');

    // 🧑‍💼 المستخدمين المستهدفين (منشئ الطلب + الإداريين)
    const usersToNotify = await User.find({
      $or: [
        { _id: order.createdBy?._id },
        { role: { $in: ['admin', 'manager'] } }
      ],
      isActive: true
    });

    if (usersToNotify.length === 0) {
      return res.status(400).json({ error: 'لا يوجد مستخدمون للإشعار' });
    }

    const arrivalDateTime = order.getFullArrivalDateTime();
    const timeRemainingMs = arrivalDateTime - new Date();
    const timeRemaining = formatDuration(timeRemainingMs);

    // =========================
    // 🔔 إنشاء Notification
    // =========================
    const notification = new Notification({
      type: 'arrival_reminder',
      title: 'تذكير بقرب وقت الوصول',
      message: `الطلب رقم ${order.orderNumber} سيصل خلال ${timeRemaining}`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        supplierName: order.supplierName,
        arrivalTime: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
        timeRemaining,
        isManual: true
      },
      recipients: usersToNotify.map(user => ({ user: user._id })),
      createdBy: req.user._id
    });

    await notification.save();

    // =========================
    // 📧 إرسال الإيميل لكل المستخدمين
    // =========================
   try {
  const emails = await getOrderEmails(order);

  if (!emails || emails.length === 0) {
    console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
  } else {
    await sendEmail({
      to: emails,
      subject: `⏰ تذكير بوصول الطلب ${order.orderNumber}`,
      html: EmailTemplates.arrivalReminderTemplate(order, timeRemaining),
    });
  }
} catch (emailError) {
  console.error(
    `❌ Failed to send arrival reminder email for order ${order.orderNumber}:`,
    emailError.message
  );
}


    // =========================
    // 🕒 تحديث حالة الإرسال
    // =========================
    order.arrivalNotificationSentAt = new Date();
    order.arrivalEmailSentAt = new Date();
    await order.save();

    // =========================
    // 📝 تسجيل النشاط
    // =========================
    const activity = new Activity({
      orderId: order._id,
      activityType: 'إشعار',
      description: `تم إرسال إشعار وإيميل تذكير قبل الوصول للطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'وقت الإشعار': new Date().toLocaleString('ar-SA'),
        'وقت الوصول المتبقي': timeRemaining
      }
    });
    await activity.save();

    return res.json({
      message: 'تم إرسال الإشعار والإيميل بنجاح',
      notification,
      timeRemaining
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'حدث خطأ في إرسال الإشعار' });
  }
};



// تحديث الطلب (محدود للسائق والملاحظات والمرفقات فقط)
exports.updateOrder = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const order = await Order.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }

      // الحقول المسموح تعديلها
      const allowedUpdates = [
        'driverName',
        'driverPhone',
        'vehicleNumber',
        'notes',
        'actualArrivalTime',
        'loadingDuration',
        'delayReason',
        'customer',
      ];

      const updates = {};
      Object.keys(req.body).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key] !== undefined ? req.body[key] : null;
        }
      });

      // ===== معالجة تغيير العميل =====
      if ('customer' in updates) {
        if (!updates.customer) {
          updates.customer = null;
          if (order.status === 'مخصص للعميل') {
            updates.status = 'قيد الانتظار';
          }
        } else {
          const customer = await Customer.findById(updates.customer);
          if (!customer) {
            return res.status(404).json({ error: 'العميل غير موجود' });
          }
          if (order.status === 'قيد الانتظار' && !order.customer) {
            updates.status = 'مخصص للعميل';
          }
        }
      }

      // ===== معالجة بيانات السائق =====
      if ('driverName' in updates && !updates.driverName) {
        updates.driverName = null;
        updates.driverPhone = null;
      }

      if ('driverPhone' in updates && !updates.driverPhone) {
        updates.driverPhone = null;
      }

      if ('vehicleNumber' in updates && !updates.vehicleNumber) {
        updates.vehicleNumber = null;
      }

      // ===== الملاحظات =====
      if ('notes' in updates) {
        updates.notes = updates.notes || null;
      }

      // ===== المرفقات =====
      if (req.files) {
        if (req.files.companyLogo) {
          return res.status(400).json({
            error: 'لا يمكن تغيير شعار الشركة أثناء التعديل',
          });
        }

        if (req.files.attachments) {
          const newAttachments = req.files.attachments.map((file) => ({
            filename: file.originalname,
            path: file.path,
          }));
          updates.attachments = [...order.attachments, ...newAttachments];
        }
      }

      // ===== وقت الوصول الفعلي =====
      if ('actualArrivalTime' in updates) {
        if (!updates.actualArrivalTime) {
          updates.actualArrivalTime = null;
        } else {
          const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
          if (!timeRegex.test(updates.actualArrivalTime)) {
            return res.status(400).json({
              error: 'تنسيق الوقت غير صحيح. استخدم HH:MM',
            });
          }

          if (
            order.status === 'جاهز للتحميل' ||
            order.status === 'في انتظار التحميل'
          ) {
            order.loadingCompletedAt = new Date();
            if (!updates.status) {
              updates.status = 'تم التحميل';
            }
          }
        }
      }

      if ('loadingDuration' in updates && !updates.loadingDuration) {
        updates.loadingDuration = null;
      }

      if ('delayReason' in updates && !updates.delayReason) {
        updates.delayReason = null;
      }

      // ===== حفظ القيم القديمة =====
      const oldData = { ...order.toObject() };

      // ===== تحديث الطلب =====
      Object.assign(order, updates);
      await order.save();

      // ===== حساب التغييرات =====
      const changes = {};
      Object.keys(updates).forEach((key) => {
        if (key !== 'attachments') {
          const oldVal = oldData[key];
          const newVal = updates[key];

          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            const oldStr =
              oldVal !== null && oldVal !== undefined && oldVal !== ''
                ? oldVal.toString()
                : 'غير محدد';

            const newStr =
              newVal !== null && newVal !== undefined && newVal !== ''
                ? newVal.toString()
                : 'غير محدد';

            changes[key] = `من: ${oldStr} → إلى: ${newStr}`;
          }
        }
      });

      // ===== تسجيل Activity =====
      if (Object.keys(changes).length > 0) {
        const activity = new Activity({
          orderId: order._id,
          activityType: 'تعديل',
          description: `تم تعديل الطلب رقم ${order.orderNumber}`,
          performedBy: req.user._id,
          performedByName: req.user.name,
          changes,
        });
        await activity.save();
      }

      // ===== إرسال الإيميل =====
      if (Object.keys(changes).length > 0) {
        try {
          const populatedForEmail = await Order.findById(order._id)
            .populate('customer', 'name email')
            .populate('createdBy', 'name email');

          const emails = await getOrderEmails(populatedForEmail);

         if (!emails || emails.length === 0) {
  console.log(`⚠️ No valid emails for order update - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `✏️ تحديث على الطلب ${order.orderNumber}`,
    html: EmailTemplates.orderUpdatedTemplate(
      populatedForEmail,
      changes,
      req.user.name
    ),
  });
}

        } catch (emailError) {
          console.error(
            '❌ Failed to send update email:',
            emailError.message
          );
        }
      }

      // ===== إرجاع البيانات =====
      const populatedOrder = await Order.findById(order._id)
        .populate('customer', 'name code phone email')
        .populate('createdBy', 'name email');

      return res.json({
        message: 'تم تحديث الطلب بنجاح',
        order: populatedOrder,
        allowedFields: allowedUpdates,
        changes: Object.keys(changes).length > 0 ? changes : null,
      });
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};



// تحديث حالة الطلب (للإداريين فقط)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    // السماح فقط للإداريين بتغيير الحالة
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'غير مصرح بتغيير حالة الطلب' });
    }

    const oldStatus = order.status;

    // لو الحالة لم تتغير فعليًا
    if (oldStatus === status) {
      return res.json({
        message: 'الحالة لم تتغير',
        order,
      });
    }

    order.status = status;

    // إذا تم تغيير الحالة إلى "تم التحميل"
    if (status === 'تم التحميل' && oldStatus !== 'تم التحميل') {
      order.loadingCompletedAt = new Date();
    }

    await order.save();

    // =========================
    // 📝 تسجيل النشاط
    // =========================
    const activity = new Activity({
      orderId: order._id,
      activityType: 'تغيير حالة',
      description: `تم تغيير حالة الطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        الحالة: `من: ${oldStatus} → إلى: ${status}`,
      },
    });
    await activity.save();

    // =========================
    // 📧 إرسال الإيميل
    // =========================
    try {
      const populatedForEmail = await Order.findById(order._id)
        .populate('customer', 'name email')
        .populate('createdBy', 'name email');

      const emails = await getOrderEmails(populatedForEmail);

     if (!emails || emails.length === 0) {
  console.log(`⚠️ No valid emails for order status update - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `🔄 تحديث حالة الطلب ${order.orderNumber}`,
    html: EmailTemplates.orderStatusTemplate(
      populatedForEmail,
      oldStatus,
      status,
      req.user.name
    ),
  });
}

    } catch (emailError) {
      console.error(
        '❌ Failed to send order status email:',
        emailError.message
      );
    }

    return res.json({
      message: 'تم تحديث حالة الطلب بنجاح',
      order,
      oldStatus,
      newStatus: status,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};


// حذف الطلب
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email')
      .populate('createdBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    // السماح فقط للإداريين بالحذف
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح بحذف الطلب' });
    }

    // =========================
    // 📧 إرسال إيميل قبل الحذف
    // =========================
    try {
      const emails = await getOrderEmails(order);

      if (!emails || emails.length === 0) {
  console.log(`⚠️ No valid emails for order deletion - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `🗑️ تم حذف الطلب ${order.orderNumber}`,
    html: EmailTemplates.orderDeletedTemplate(
      order,
      req.user.name
    ),
  });
}

    } catch (emailError) {
      console.error(
        '❌ Failed to send delete order email:',
        emailError.message
      );
    }

    // =========================
    // 🗑️ حذف الملفات المرتبطة
    // =========================
    if (order.companyLogo && fs.existsSync(order.companyLogo)) {
      fs.unlinkSync(order.companyLogo);
    }

    order.attachments.forEach((attachment) => {
      if (fs.existsSync(attachment.path)) {
        fs.unlinkSync(attachment.path);
      }
    });

    // =========================
    // 📝 تسجيل النشاط
    // =========================
    const activity = new Activity({
      orderId: order._id,
      activityType: 'حذف',
      description: `تم حذف الطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'رقم الطلب': order.orderNumber,
        'المورد': order.supplierName,
      },
    });
    await activity.save();

    // =========================
    // ❌ حذف الطلب
    // =========================
    await Order.findByIdAndDelete(req.params.id);

    return res.json({
      message: 'تم حذف الطلب بنجاح',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};


// حذف مرفق
exports.deleteAttachment = async (req, res) => {
  try {
    const { orderId, attachmentId } = req.params;

    const order = await Order.findById(orderId)
      .populate('customer', 'name email')
      .populate('createdBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const attachment = order.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }

    // =========================
    // 📧 إرسال إيميل قبل/بعد الحذف
    // =========================
    try {
      const emails = await getOrderEmails(order);

     if (!emails || emails.length === 0) {
  console.log(`⚠️ No valid emails for attachment deletion - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `📎 حذف مرفق من الطلب ${order.orderNumber}`,
    html: EmailTemplates.attachmentDeletedTemplate(
      order,
      attachment.filename,
      req.user.name
    ),
  });
}

    } catch (emailError) {
      console.error(
        '❌ Failed to send attachment delete email:',
        emailError.message
      );
    }

    // =========================
    // 🗑️ حذف الملف من السيرفر
    // =========================
    if (fs.existsSync(attachment.path)) {
      fs.unlinkSync(attachment.path);
    }

    // إزالة المرفق من الطلب
    order.attachments.pull(attachmentId);
    await order.save();

    // =========================
    // 📝 تسجيل النشاط
    // =========================
    const activity = new Activity({
      orderId: order._id,
      activityType: 'حذف',
      description: `تم حذف مرفق من الطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'اسم الملف': attachment.filename,
      },
    });
    await activity.save();

    return res.json({
      message: 'تم حذف الملف بنجاح',
      fileName: attachment.filename,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};


// دالة للتحقق من الطلبات القريبة من وقت الوصول
exports.checkArrivalNotifications = async () => {
  try {
    const now = new Date();

    // الطلبات التي لم يُرسل لها إشعار بعد
    const orders = await Order.find({
      status: { $in: ['جاهز للتحميل', 'في انتظار التحميل', 'مخصص للعميل'] },
      arrivalNotificationSentAt: { $exists: false },
    }).populate('customer', 'name email')
      .populate('createdBy', 'name email');

    const User = require('../models/User');
    const Notification = require('../models/Notification');

    for (const order of orders) {
      const notificationTime = order.getArrivalNotificationTime();

      if (now >= notificationTime) {
        // =========================
        // 🧑‍💼 Admin + Manager
        // =========================
        const adminUsers = await User.find({
          role: { $in: ['admin', 'manager'] },
          isActive: true,
        });

        // =========================
        // 🔔 إنشاء Notification
        // =========================
        const notification = new Notification({
          type: 'arrival_reminder',
          title: 'تذكير بقرب وقت الوصول',
          message: `الطلب رقم ${order.orderNumber} سيصل خلال ساعتين ونصف`,
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            expectedArrival: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
            supplierName: order.supplierName,
            auto: true,
          },
          recipients: adminUsers.map((user) => ({ user: user._id })),
          createdBy: order.createdBy?._id,
        });

        await notification.save();

        // =========================
        // 📧 إرسال الإيميل
        // =========================
        try {
          const arrivalDateTime = order.getFullArrivalDateTime();
          const timeRemainingMs = arrivalDateTime - now;

          const emails = await getOrderEmails(order);

          if (!emails || emails.length === 0) {
  console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `⏰ تذكير بوصول الطلب ${order.orderNumber}`,
    html: EmailTemplates.arrivalReminderTemplate(
      order,
      formatDuration(timeRemainingMs)
    ),
  });
}

        } catch (emailError) {
          console.error(
            `❌ Email failed for order ${order.orderNumber}:`,
            emailError.message
          );
        }

        // =========================
        // 🕒 تحديث حالة الإرسال
        // =========================
        order.arrivalNotificationSentAt = new Date();
        order.arrivalEmailSentAt = new Date();
        await order.save();

        console.log(
          `🔔📧 Arrival notification + email sent for order ${order.orderNumber}`
        );
      }
    }
  } catch (error) {
    console.error('❌ خطأ في التحقق من إشعارات الوصول:', error);
  }
};


// دالة للتحقق من الطلبات التي انتهى وقت تحميلها
exports.checkCompletedLoading = async () => {
  try {
    const now = new Date();

    // الطلبات التي انتهى وقت تحميلها ولم تُحدّث حالتها
    const orders = await Order.find({
      status: { $in: ['في انتظار التحميل', 'جاهز للتحميل'] },
      loadingCompletedAt: { $exists: false },
    })
      .populate('customer', 'name email')
      .populate('createdBy', 'name email');

    const Notification = require('../models/Notification');
    const Activity = require('../models/Activity');
    const User = require('../models/User');

    for (const order of orders) {
      const loadingDateTime = order.getFullLoadingDateTime();

      // ⏰ بعد ساعة من وقت التحميل
      const oneHourAfterLoading = new Date(loadingDateTime);
      oneHourAfterLoading.setHours(oneHourAfterLoading.getHours() + 1);

      if (now >= oneHourAfterLoading) {
        const oldStatus = order.status;

        // =========================
        // 🔄 تحديث حالة الطلب
        // =========================
        order.status = 'تم التحميل';
        order.loadingCompletedAt = now;
        await order.save();

        // =========================
        // 🧑‍💼 Admin + Manager
        // =========================
        const adminUsers = await User.find({
          role: { $in: ['admin', 'manager'] },
          isActive: true,
        });

        // =========================
        // 🔔 Notification
        // =========================
        const notification = new Notification({
          type: 'loading_completed',
          title: 'اكتمل التحميل تلقائيًا',
          message: `تم تحديث حالة الطلب ${order.orderNumber} إلى "تم التحميل" تلقائيًا`,
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            oldStatus,
            newStatus: 'تم التحميل',
            auto: true,
          },
          recipients: adminUsers.map((u) => ({ user: u._id })),
          createdBy: order.createdBy?._id,
        });
        await notification.save();

        // =========================
        // 📝 Activity Log
        // =========================
        const activity = new Activity({
          orderId: order._id,
          activityType: 'تغيير حالة',
          description: `تم تحديث حالة الطلب ${order.orderNumber} تلقائيًا إلى "تم التحميل"`,
          performedBy: null, // نظام
          performedByName: 'النظام',
          changes: {
            الحالة: `من: ${oldStatus} → إلى: تم التحميل`,
          },
        });
        await activity.save();

        // =========================
        // 📧 Email
        // =========================
        try {
          const emails = await getOrderEmails(order);

          if (!emails || emails.length === 0) {
  console.log(`⚠️ No valid emails for loading completion - order ${order.orderNumber}`);
} else {
  await sendEmail({
    to: emails,
    subject: `✅ تم اكتمال تحميل الطلب ${order.orderNumber}`,
    html: EmailTemplates.orderStatusTemplate(
      order,
      oldStatus,
      'تم التحميل',
      'النظام'
    ),
  });
}

        } catch (emailError) {
          console.error(
            `❌ Email failed for order ${order.orderNumber}:`,
            emailError.message
          );
        }

        console.log(
          `✅🔔📧 Order ${order.orderNumber} marked as "تم التحميل" automatically`
        );
      }
    }
  } catch (error) {
    console.error('❌ خطأ في التحقق من اكتمال التحميل:', error);
  }
};
