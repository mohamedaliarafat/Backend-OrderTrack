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

      // 🔥🔥 الحل هنا: إعادة جلب الطلب مع populate 🔥🔥
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
          'وقت التحميل': `${order.loadingDate.toLocaleDateString(
            'ar-SA'
          )} ${order.loadingTime}`,
          'وقت الوصول': `${order.arrivalDate.toLocaleDateString(
            'ar-SA'
          )} ${order.arrivalTime}`,
        },
      });
      await activity.save();

      return res.status(201).json({
        message: 'تم إنشاء الطلب بنجاح',
        order: populatedOrder, // ✅ مهم جدًا
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
    const twoAndHalfHoursLater = new Date(now.getTime() + (2.5 * 60 * 60 * 1000));
    
    // البحث عن الطلبات التي موعدها خلال الساعتين ونصف القادمة
    const orders = await Order.find({
      status: { $in: ['في انتظار التحميل', 'جاهز للتحميل', 'مخصص للعميل'] }
    }).populate('customer createdBy driver');
    
    const upcomingOrders = orders.filter(order => {
      const arrivalDateTime = order.getFullArrivalDateTime();
      return arrivalDateTime >= now && arrivalDateTime <= twoAndHalfHoursLater;
    });
    
    res.json(upcomingOrders);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب الطلبات القريبة' });
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
      .populate('customer', 'name code')
      .populate('driver', 'name phone vehicleNumber')
      .sort({ arrivalDate: 1, arrivalTime: 1 }) // ترتيب حسب وقت الوصول
      .skip(skip)
      .limit(limit);
    
    const total = await Order.countDocuments(filter);
    
    // إضافة معلومات المؤقت لكل طلب
    const ordersWithTimers = orders.map(order => {
      const arrivalDateTime = order.getFullArrivalDateTime();
      const loadingDateTime = order.getFullLoadingDateTime();
      const now = new Date();
      
      const arrivalRemaining = arrivalDateTime - now;
      const loadingRemaining = loadingDateTime - now;
      
      const arrivalCountdown = arrivalRemaining > 0 ? 
        formatDuration(arrivalRemaining) : 'تأخر';
      
      const loadingCountdown = loadingRemaining > 0 ? 
        formatDuration(loadingRemaining) : 'تأخر';
      
      // تحديد إذا كان الطلب يحتاج إشعار قبل الوصول
      const needsArrivalNotification = 
        arrivalRemaining > 0 && 
        arrivalRemaining <= (2.5 * 60 * 60 * 1000) &&
        !order.arrivalNotificationSentAt;
      
      return {
        ...order.toObject(),
        arrivalDateTime,
        loadingDateTime,
        arrivalRemaining,
        loadingRemaining,
        arrivalCountdown,
        loadingCountdown,
        needsArrivalNotification,
        isApproachingArrival: arrivalRemaining > 0 && arrivalRemaining <= (2.5 * 60 * 60 * 1000),
        isApproachingLoading: loadingRemaining > 0 && loadingRemaining <= (2.5 * 60 * 60 * 1000)
      };
    });
    
    res.json({
      orders: ordersWithTimers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب الطلبات' });
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
      .populate('customer createdBy');
    
    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }
    
    const User = require('../models/User');
    const Notification = require('../models/Notification');
    
    // جلب المستخدمين الذين يجب إرسال إشعار لهم
    const usersToNotify = await User.find({
      $or: [
        { _id: order.createdBy._id },
        { role: { $in: ['admin', 'manager'] } }
      ],
      isActive: true
    });
    
    if (usersToNotify.length === 0) {
      return res.status(400).json({ error: 'لا يوجد مستخدمون للإشعار' });
    }
    
    const arrivalDateTime = order.getFullArrivalDateTime();
    const timeRemaining = formatDuration(arrivalDateTime - new Date());
    
    // إنشاء الإشعار
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
    
    // تحديث وقت الإشعار في الطلب
    order.arrivalNotificationSentAt = new Date();
    await order.save();
    
    // تسجيل النشاط
    const Activity = require('../models/Activity');
    const activity = new Activity({
      orderId: order._id,
      activityType: 'إشعار',
      description: `تم إرسال إشعار تذكير قبل الوصول للطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'وقت الإشعار': new Date().toLocaleString('ar-SA'),
        'وقت الوصول المتبقي': timeRemaining
      }
    });
    await activity.save();
    
    res.json({
      message: 'تم إرسال الإشعار بنجاح',
      notification,
      timeRemaining
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في إرسال الإشعار' });
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

      // السماح بتعديل حقول أكثر مرونة
      const allowedUpdates = [
        'driverName',
        'driverPhone', 
        'vehicleNumber',
        'notes',
        'actualArrivalTime',
        'loadingDuration',
        'delayReason',
        'customer', // يسمح بتغيير العميل
      ];

      const updates = {};
      Object.keys(req.body).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          // السماح بقيم فارغة لحذف البيانات (null أو '')
          updates[key] = req.body[key] !== undefined ? req.body[key] : null;
        }
      });

      // 🌟 معالجة تغيير العميل 🌟
      if ('customer' in updates) {
        if (updates.customer === null || updates.customer === '') {
          // حالة حذف العميل
          updates.customer = null;
          
          // إذا كان الطلب في حالة "مخصص للعميل" وتم حذف العميل
          if (order.status === 'مخصص للعميل') {
            updates.status = 'قيد الانتظار';
          }
          
        } else if (updates.customer) {
          // حالة تغيير العميل
          const customer = await Customer.findById(updates.customer);
          if (!customer) {
            return res.status(404).json({ error: 'العميل غير موجود' });
          }

          // إذا كان الطلب في حالة "قيد الانتظار" وغير مخصص لعميل
          if (order.status === 'قيد الانتظار' && !order.customer) {
            updates.status = 'مخصص للعميل';
          }
        }
      }

      // 🌟 معالجة تغيير السائق 🌟
      // السماح بحذف بيانات السائق إذا تم إرسال قيم فارغة
      if ('driverName' in updates && (updates.driverName === null || updates.driverName === '')) {
        updates.driverName = null;
        // حذف رقم هاتف السائق إذا تم حذف السائق
        updates.driverPhone = null;
      }
      
      if ('driverPhone' in updates && (updates.driverPhone === null || updates.driverPhone === '')) {
        updates.driverPhone = null;
      }

      // 🌟 معالجة الملاحظات 🌟
      // السماح بحذف الملاحظات أو تغييرها
      if ('notes' in updates) {
        updates.notes = updates.notes || null;
      }

      // 🌟 معالجة رقم السيارة 🌟
      if ('vehicleNumber' in updates && (updates.vehicleNumber === null || updates.vehicleNumber === '')) {
        updates.vehicleNumber = null;
      }

      // معالجة المرفقات (تظل كما هي)
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

      // 🌟 معالجة وقت الوصول الفعلي 🌟
      if ('actualArrivalTime' in updates) {
        if (updates.actualArrivalTime === null || updates.actualArrivalTime === '') {
          // السماح بحذف وقت الوصول
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

      // 🌟 معالجة مدة التحميل 🌟
      if ('loadingDuration' in updates && (updates.loadingDuration === null || updates.loadingDuration === '')) {
        updates.loadingDuration = null;
      }

      // 🌟 معالجة سبب التأخير 🌟
      if ('delayReason' in updates && (updates.delayReason === null || updates.delayReason === '')) {
        updates.delayReason = null;
      }

      // حفظ البيانات القديمة لتتبع التغييرات
      const oldData = { ...order.toObject() };

      // تحديث الطلب
      Object.assign(order, updates);
      await order.save();

      // 🌟 تسجيل التعديلات 🌟
      const changes = {};
      Object.keys(updates).forEach((key) => {
        // استبعاد المرفقات من سجل التغييرات
        if (key !== 'attachments') {
          const oldValue = oldData[key];
          const newValue = updates[key];
          
          // تسجيل التغيير فقط إذا اختلفت القيمة
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            let oldValueStr = 'غير محدد';
            let newValueStr = 'غير محدد';
            
            if (oldValue !== null && oldValue !== undefined && oldValue !== '') {
              oldValueStr = oldValue.toString();
            }
            
            if (newValue !== null && newValue !== undefined && newValue !== '') {
              newValueStr = newValue.toString();
            }
            
            changes[key] = `من: ${oldValueStr} → إلى: ${newValueStr}`;
          }
        }
      });

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

      // جلب البيانات المحدثة مع العلاقات
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
    order.status = status;
    
    // إذا تم تغيير الحالة إلى "تم التحميل"
    if (status === 'تم التحميل' && oldStatus !== 'تم التحميل') {
      order.loadingCompletedAt = new Date();
    }
    
    await order.save();

    // تسجيل النشاط
    const activity = new Activity({
      orderId: order._id,
      activityType: 'تغيير حالة',
      description: `تم تغيير حالة الطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'الحالة': `من: ${oldStatus} → إلى: ${status}`
      }
    });
    await activity.save();

    res.json({
      message: 'تم تحديث حالة الطلب بنجاح',
      order
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// حذف الطلب
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    // السماح فقط للإداريين بالحذف
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح بحذف الطلب' });
    }

    // Delete associated files
    if (order.companyLogo && fs.existsSync(order.companyLogo)) {
      fs.unlinkSync(order.companyLogo);
    }

    // Delete attachments
    order.attachments.forEach(attachment => {
      if (fs.existsSync(attachment.path)) {
        fs.unlinkSync(attachment.path);
      }
    });

    // تسجيل النشاط قبل الحذف
    const activity = new Activity({
      orderId: order._id,
      activityType: 'حذف',
      description: `تم حذف الطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'رقم الطلب': order.orderNumber,
        'المورد': order.supplierName
      }
    });
    await activity.save();

    // حذف الطلب
    await Order.findByIdAndDelete(req.params.id);

    res.json({
      message: 'تم حذف الطلب بنجاح'
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// حذف مرفق
exports.deleteAttachment = async (req, res) => {
  try {
    const { orderId, attachmentId } = req.params;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const attachment = order.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }

    // Delete file from server
    if (fs.existsSync(attachment.path)) {
      fs.unlinkSync(attachment.path);
    }

    // إزالة من المصفوفة
    order.attachments.pull(attachmentId);
    await order.save();

    // تسجيل النشاط
    const activity = new Activity({
      orderId: order._id,
      activityType: 'حذف',
      description: `تم حذف مرفق من الطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'اسم الملف': attachment.filename
      }
    });
    await activity.save();

    res.json({
      message: 'تم حذف الملف بنجاح'
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// دالة للتحقق من الطلبات القريبة من وقت الوصول
exports.checkArrivalNotifications = async () => {
  try {
    const now = new Date();
    
    // البحث عن الطلبات التي وصل وقت الإشعار الخاص بها (قبل الوصول بساعتين ونصف)
    const orders = await Order.find({
      status: { $in: ['جاهز للتحميل', 'في انتظار التحميل', 'مخصص للعميل'] },
      arrivalNotificationSentAt: { $exists: false }
    }).populate('customer createdBy');
    
    for (const order of orders) {
      const notificationTime = order.getArrivalNotificationTime();
      
      if (now >= notificationTime) {
        // إرسال إشعار
        const User = require('../models/User');
        const adminUsers = await User.find({ 
          role: { $in: ['admin', 'manager'] },
          isActive: true 
        });
        
        const notification = new Notification({
          type: 'arrival_reminder',
          title: 'تذكير بقرب وقت الوصول',
          message: `الطلب رقم ${order.orderNumber} سيصل خلال ساعتين ونصف`,
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            expectedArrival: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
            supplierName: order.supplierName
          },
          recipients: adminUsers.map(user => ({ user: user._id })),
          createdBy: order.createdBy?._id
        });
        
        await notification.save();
        
        // تحديث وقت الإشعار
        order.arrivalNotificationSentAt = new Date();
        await order.save();
        
        console.log(`إشعار وصول تم إرساله للطلب: ${order.orderNumber}`);
      }
    }
  } catch (error) {
    console.error('خطأ في التحقق من إشعارات الوصول:', error);
  }
};

// دالة للتحقق من الطلبات التي انتهى وقت تحميلها
exports.checkCompletedLoading = async () => {
  try {
    const now = new Date();
    
    // البحث عن الطلبات التي انتهى وقت تحميلها ولم يتم تحديث حالتها
    const orders = await Order.find({
      status: { $in: ['في انتظار التحميل', 'جاهز للتحميل'] },
      loadingCompletedAt: { $exists: false }
    });
    
    for (const order of orders) {
      const loadingDateTime = order.getFullLoadingDateTime();
      
      // إذا انقضى وقت التحميل بأكثر من ساعة
      const oneHourAfterLoading = new Date(loadingDateTime);
      oneHourAfterLoading.setHours(oneHourAfterLoading.getHours() + 1);
      
      if (now >= oneHourAfterLoading) {
        order.status = 'تم التحميل';
        order.loadingCompletedAt = now;
        await order.save();
        
        console.log(`تم تحديث حالة الطلب ${order.orderNumber} إلى "تم التحميل" تلقائياً`);
      }
    }
  } catch (error) {
    console.error('خطأ في التحقق من اكتمال التحميل:', error);
  }
};