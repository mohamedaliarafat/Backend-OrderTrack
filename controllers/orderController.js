const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Driver = require('../models/Driver');
const { sendEmail } = require('../services/emailService');
const EmailTemplates = require('../services/emailTemplates');
const getOrderEmails = require('../utils/getOrderEmails');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');

const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|zip/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'));
    }
  }
}).fields([
  { name: 'attachments', maxCount: 5 },
  { name: 'supplierDocuments', maxCount: 5 },
  { name: 'customerDocuments', maxCount: 5 }
]);

exports.uploadMiddleware = upload;


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



exports.createOrder = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const orderData = { ...req.body };


      delete orderData.status;
      delete orderData.orderNumber;


      orderData.orderSource = orderData.customer ? 'عميل' : 'مورد';


      if (orderData.orderSource !== 'مورد') {
        delete orderData.supplierOrderNumber;
        delete orderData.supplier;
      }


      if (orderData.orderSource === 'عميل' && !orderData.customer) {
        return res.status(400).json({
          error: 'العميل مطلوب لطلبات العملاء',
        });
      }

      const allowedRequestTypes = ['شراء', 'نقل'];

      if (orderData.orderSource === 'عميل') {
        orderData.requestType = orderData.requestType || 'شراء';

        if (!allowedRequestTypes.includes(orderData.requestType)) {
          return res.status(400).json({
            error: 'نوع العملية غير صحيح (يجب أن يكون شراء أو نقل)',
          });
        }
      } else {
        delete orderData.requestType;
      }

 
      if (
        orderData.orderSource === 'عميل' &&
        orderData.requestType === 'نقل' &&
        !orderData.driver
      ) {
        return res.status(400).json({
          error: 'طلبات النقل تتطلب تعيين سائق',
        });
      }

      if (
        !orderData.loadingDate ||
        !orderData.loadingTime ||
        !orderData.arrivalDate ||
        !orderData.arrivalTime
      ) {
        return res.status(400).json({ error: 'جميع الأوقات مطلوبة' });
      }

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


      orderData.createdBy = req.user._id;
      orderData.createdByName = req.user.name;

      if (orderData.orderSource === 'عميل') {
        const customerDoc = await Customer.findById(orderData.customer);
        if (!customerDoc) {
          return res.status(400).json({ error: 'العميل غير موجود' });
        }

        orderData.customerName = customerDoc.name;
        orderData.customerCode = customerDoc.code;
        orderData.customerPhone = customerDoc.phone;
        orderData.customerEmail = customerDoc.email;

        orderData.city = orderData.city || customerDoc.city;
        orderData.area = orderData.area || customerDoc.area;
        orderData.address = orderData.address ?? null;
      }

      if (orderData.orderSource === 'مورد') {
        if (!orderData.supplier) {
          return res.status(400).json({ error: 'المورد مطلوب لطلبات المورد' });
        }

        const supplierDoc = await Supplier.findById(orderData.supplier);
        if (!supplierDoc) {
          return res.status(400).json({ error: 'المورد غير موجود' });
        }

        orderData.supplierName = supplierDoc.name;
        orderData.supplierCompany = supplierDoc.company;
        orderData.supplierContactPerson = supplierDoc.contactPerson;
        orderData.supplierPhone = supplierDoc.phone;
        orderData.supplierEmail = supplierDoc.email || null;

        orderData.city = orderData.city || supplierDoc.city;
        orderData.area = orderData.area || supplierDoc.area;
        orderData.address = orderData.address ?? null;
      }

      if (!orderData.city || !orderData.area) {
        return res.status(400).json({
          error: 'المدينة والمنطقة مطلوبة لإنشاء الطلب',
          debug: {
            city: orderData.city,
            area: orderData.area,
          },
        });
      }


      orderData.orderDate = new Date(orderData.orderDate || new Date());
      orderData.loadingDate = new Date(orderData.loadingDate);
      orderData.arrivalDate = new Date(orderData.arrivalDate);

      if (req.files?.attachments) {
        orderData.attachments = req.files.attachments.map((file) => ({
          filename: file.originalname,
          path: file.path,
          uploadedAt: new Date(),
          uploadedBy: req.user._id,
        }));
      }

      const order = new Order(orderData);

      try {
        await order.save();
      } catch (error) {

        if (
          error.code === 11000 &&
          (
            error.keyPattern?.supplierOrderNumber ||
            error.keyPattern?.supplier ||
            error.keyValue?.supplierOrderNumber
          )
        ) {
          return res.status(400).json({
            error: 'رقم طلب المورد مستخدم من قبل لهذا المورد'
          });
        }

        console.error('❌ Error saving order:', error);
        return res.status(500).json({
          error: 'فشل في حفظ الطلب'
        });
      }

      const populatedOrder = await Order.findById(order._id)
        .populate('customer', 'name code phone city area email')
        .populate('supplier', 'name company city area email contactPerson phone')
        .populate('createdBy', 'name email')
        .populate('driver', 'name phone vehicleNumber');

      const createOrderCreationEmailTemplate = (order, user) => {
        const formatDate = (date) => {
          if (!date) return 'غير محدد';
          return new Date(date).toLocaleDateString('ar-SA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        };

        const formatTime = (time) => time || 'غير محدد';
        
        const formatCurrency = (amount) => {
          if (!amount) return '0.00 ريال';
          return amount.toLocaleString('ar-SA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }) + ' ريال';
        };

        const getOrderTypeIcon = () => {
          if (order.orderSource === 'عميل') {
            return order.requestType === 'نقل' ? '🚚' : '🛒';
          }
          return '🏭';
        };

        const getOrderTypeText = () => {
          if (order.orderSource === 'عميل') {
            return order.requestType === 'نقل' ? 'طلب نقل' : 'طلب شراء';
          }
          return 'طلب مورد';
        };

        return `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${getOrderTypeIcon()} ${getOrderTypeText()} جديد - نظام إدارة الطلبات</title>
              <style>
                  * {
                      margin: 0;
                      padding: 0;
                      box-sizing: border-box;
                      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  }
                  
                  body {
                      background-color: #f5f7fa;
                      line-height: 1.6;
                      color: #333;
                  }
                  
                  .email-container {
                      max-width: 700px;
                      margin: 20px auto;
                      background-color: #ffffff;
                      border-radius: 12px;
                      overflow: hidden;
                      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
                  }
                  
                  .header {
                      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                      color: white;
                      padding: 30px;
                      text-align: center;
                      border-bottom: 4px solid #ffcc00;
                  }
                  
                  .company-logo {
                      font-size: 24px;
                      font-weight: bold;
                      margin-bottom: 15px;
                      color: #ffcc00;
                  }
                  
                  .header h1 {
                      font-size: 26px;
                      margin-bottom: 10px;
                      font-weight: 700;
                  }
                  
                  .header .subtitle {
                      font-size: 16px;
                      opacity: 0.9;
                      margin-top: 5px;
                  }
                  
                  .order-number-badge {
                      background: #4CAF50;
                      color: white;
                      padding: 10px 25px;
                      border-radius: 25px;
                      display: inline-block;
                      margin-top: 15px;
                      font-weight: bold;
                      font-size: 18px;
                      letter-spacing: 1px;
                  }
                  
                  .content {
                      padding: 30px;
                  }
                  
                  .summary-card {
                      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                      color: white;
                      padding: 25px;
                      border-radius: 10px;
                      margin-bottom: 30px;
                      text-align: center;
                  }
                  
                  .summary-card h3 {
                      font-size: 22px;
                      margin-bottom: 10px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      gap: 10px;
                  }
                  
                  .summary-details {
                      display: grid;
                      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                      gap: 15px;
                      margin-top: 20px;
                  }
                  
                  .summary-item {
                      background: rgba(255, 255, 255, 0.1);
                      padding: 15px;
                      border-radius: 8px;
                      backdrop-filter: blur(10px);
                  }
                  
                  .section {
                      margin-bottom: 30px;
                      padding: 20px;
                      border-radius: 10px;
                      background-color: #f8f9fa;
                      border-left: 4px solid #2a5298;
                  }
                  
                  .section-title {
                      color: #2d3748;
                      font-size: 18px;
                      margin-bottom: 15px;
                      padding-bottom: 10px;
                      border-bottom: 2px solid #e2e8f0;
                      font-weight: 600;
                      display: flex;
                      align-items: center;
                      gap: 10px;
                  }
                  
                  .info-grid {
                      display: grid;
                      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                      gap: 15px;
                      margin-top: 15px;
                  }
                  
                  .info-item {
                      background: white;
                      padding: 15px;
                      border-radius: 8px;
                      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
                  }
                  
                  .info-label {
                      color: #718096;
                      font-size: 13px;
                      margin-bottom: 5px;
                      font-weight: 500;
                  }
                  
                  .info-value {
                      color: #2d3748;
                      font-size: 15px;
                      font-weight: 600;
                  }
                  
                  .timeline {
                      position: relative;
                      padding: 20px 0;
                  }
                  
                  .timeline-item {
                      position: relative;
                      padding: 12px 0 12px 30px;
                      margin-bottom: 15px;
                      background: white;
                      border-radius: 8px;
                      padding: 15px 15px 15px 40px;
                  }
                  
                  .timeline-item:before {
                      content: '';
                      position: absolute;
                      left: 15px;
                      top: 20px;
                      width: 10px;
                      height: 10px;
                      border-radius: 50%;
                      background: #2a5298;
                  }
                  
                  .timeline-item:after {
                      content: '';
                      position: absolute;
                      left: 19px;
                      top: 20px;
                      width: 2px;
                      height: calc(100% + 15px);
                      background: #e2e8f0;
                  }
                  
                  .timeline-item:last-child:after {
                      display: none;
                  }
                  
                  .footer {
                      background: #1a202c;
                      color: white;
                      padding: 25px;
                      text-align: center;
                      margin-top: 30px;
                      border-top: 4px solid #ffcc00;
                  }
                  
                  .footer p {
                      margin: 10px 0;
                      opacity: 0.8;
                  }
                  
                  .footer-logo {
                      font-size: 22px;
                      font-weight: bold;
                      color: #ffcc00;
                      margin-bottom: 10px;
                  }
                  
                  .status-badge {
                      display: inline-block;
                      padding: 4px 12px;
                      border-radius: 20px;
                      font-size: 12px;
                      font-weight: 600;
                  }
                  
                  .status-new {
                      background: #d4edda;
                      color: #155724;
                  }
                  
                  .action-button {
                      display: inline-block;
                      background: #2a5298;
                      color: white;
                      padding: 12px 30px;
                      border-radius: 25px;
                      text-decoration: none;
                      font-weight: 600;
                      margin: 20px 0;
                      transition: all 0.3s ease;
                  }
                  
                  .action-button:hover {
                      background: #1e3c72;
                      transform: translateY(-2px);
                      box-shadow: 0 4px 12px rgba(42, 82, 152, 0.3);
                  }
                  
                  .contact-info {
                      background: #f0f9ff;
                      padding: 15px;
                      border-radius: 8px;
                      margin-top: 15px;
                      border-right: 4px solid #2a5298;
                  }
                  
                  @media (max-width: 600px) {
                      .content {
                          padding: 20px;
                      }
                      
                      .header {
                          padding: 20px 15px;
                      }
                      
                      .header h1 {
                          font-size: 20px;
                      }
                      
                      .info-grid {
                          grid-template-columns: 1fr;
                      }
                      
                      .summary-details {
                          grid-template-columns: 1fr;
                      }
                      
                      .order-number-badge {
                          font-size: 16px;
                          padding: 8px 20px;
                      }
                  }
              </style>
          </head>
          <body>
              <div class="email-container">
                  <div class="header">
                      <div class="company-logo">شركة البحيرة العربية</div>
                      <h1>${getOrderTypeIcon()} ${getOrderTypeText()} جديد</h1>
                      <p class="subtitle">نظام إدارة الطلبات - تأكيد إنشاء طلب</p>
                      <div class="order-number-badge">${order.orderNumber}</div>
                  </div>
                  
                  <div class="content">
                      <div class="summary-card">
                          <h3>${getOrderTypeIcon()} ملخص الطلب الجديد</h3>
                          <div class="summary-details">
                              <div class="summary-item">
                                  <div class="info-label">نوع الطلب</div>
                                  <div class="info-value">${getOrderTypeText()}</div>
                              </div>
                              <div class="summary-item">
                                  <div class="info-label">تاريخ الإنشاء</div>
                                  <div class="info-value">${formatDate(new Date())}</div>
                              </div>
                              <div class="summary-item">
                                  <div class="info-label">الحالة</div>
                                  <div class="info-value">
                                      <span class="status-badge status-new">🆕 جديد</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                      
                      <div class="section">
                          <h2 class="section-title">👤 معلومات ${order.orderSource === 'عميل' ? 'العميل' : 'المورد'}</h2>
                          <div class="info-grid">
                              <div class="info-item">
                                  <div class="info-label">${order.orderSource === 'عميل' ? 'اسم العميل' : 'اسم المورد'}</div>
                                  <div class="info-value">${order.orderSource === 'عميل' ? order.customerName : order.supplierName}</div>
                              </div>
                              
                              ${order.orderSource === 'عميل' ? `
                              <div class="info-item">
                                  <div class="info-label">كود العميل</div>
                                  <div class="info-value">${order.customerCode || 'غير محدد'}</div>
                              </div>
                              ` : `
                              <div class="info-item">
                                  <div class="info-label">الشركة</div>
                                  <div class="info-value">${order.supplierCompany || 'غير محدد'}</div>
                              </div>
                              `}
                              
                              <div class="info-item">
                                  <div class="info-label">📞 الهاتف</div>
                                  <div class="info-value">${order.orderSource === 'عميل' ? order.customerPhone : order.supplierPhone}</div>
                              </div>
                              
                              ${order.orderSource === 'عميل' && order.customerEmail ? `
                              <div class="info-item">
                                  <div class="info-label">✉️ الإيميل</div>
                                  <div class="info-value">${order.customerEmail}</div>
                              </div>
                              ` : ''}
                              
                              ${order.orderSource === 'مورد' && order.supplierContactPerson ? `
                              <div class="info-item">
                                  <div class="info-label">الشخص المسؤول</div>
                                  <div class="info-value">${order.supplierContactPerson}</div>
                              </div>
                              ` : ''}
                          </div>
                      </div>
                      
                      <div class="section">
                          <h2 class="section-title">📍 معلومات الموقع</h2>
                          <div class="info-grid">
                              <div class="info-item">
                                  <div class="info-label">المدينة</div>
                                  <div class="info-value">${order.city || 'غير محدد'}</div>
                              </div>
                              <div class="info-item">
                                  <div class="info-label">المنطقة</div>
                                  <div class="info-value">${order.area || 'غير محدد'}</div>
                              </div>
                              ${order.address ? `
                              <div class="info-item">
                                  <div class="info-label">العنوان التفصيلي</div>
                                  <div class="info-value">${order.address}</div>
                              </div>
                              ` : ''}
                          </div>
                      </div>
                      
                      ${order.orderSource === 'عميل' && order.requestType ? `
                      <div class="section">
                          <h2 class="section-title">📦 معلومات الطلب</h2>
                          <div class="info-grid">
                              <div class="info-item">
                                  <div class="info-label">نوع العملية</div>
                                  <div class="info-value">${order.requestType}</div>
                              </div>
                              ${order.quantity ? `
                              <div class="info-item">
                                  <div class="info-label">الكمية</div>
                                  <div class="info-value">${order.quantity} ${order.unit || 'لتر'}</div>
                              </div>
                              ` : ''}
                              ${order.productType ? `
                              <div class="info-item">
                                  <div class="info-label">نوع المنتج</div>
                                  <div class="info-value">${order.productType}</div>
                              </div>
                              ` : ''}
                              ${order.fuelType ? `
                              <div class="info-item">
                                  <div class="info-label">نوع الوقود</div>
                                  <div class="info-value">${order.fuelType}</div>
                              </div>
                              ` : ''}
                          </div>
                      </div>
                      ` : ''}
                      
                      <div class="section">
                          <h2 class="section-title">⏰ الجدول الزمني</h2>
                          <div class="timeline">
                              <div class="timeline-item">
                                  <strong>وقت التحميل:</strong><br>
                                  ${formatDate(order.loadingDate)} - ${order.loadingTime}
                              </div>
                              <div class="timeline-item">
                                  <strong>وقت الوصول المتوقع:</strong><br>
                                  ${formatDate(order.arrivalDate)} - ${order.arrivalTime}
                              </div>
                              <div class="timeline-item">
                                  <strong>تم الإنشاء في:</strong><br>
                                  ${formatDate(new Date())} - ${new Date().toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}
                              </div>
                          </div>
                      </div>
                      
                      <div class="section">
                          <h2 class="section-title">👷 معلومات الإنشاء</h2>
                          <div class="info-grid">
                              <div class="info-item">
                                  <div class="info-label">تم الإنشاء بواسطة</div>
                                  <div class="info-value">${user.name}</div>
                              </div>
                              <div class="info-item">
                                  <div class="info-label">📧 إيميل المنشئ</div>
                                  <div class="info-value">${user.email}</div>
                              </div>
                              <div class="info-item">
                                  <div class="info-label">تاريخ الإنشاء</div>
                                  <div class="info-value">${formatDate(new Date())}</div>
                              </div>
                              <div class="info-item">
                                  <div class="info-label">وقت الإنشاء</div>
                                  <div class="info-value">${new Date().toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}</div>
                              </div>
                          </div>
                      </div>
                      
                      ${order.notes ? `
                      <div class="section">
                          <h2 class="section-title">📝 ملاحظات إضافية</h2>
                          <div class="contact-info">
                              <p style="font-size: 14px; line-height: 1.6; color: #2c5282;">${order.notes}</p>
                          </div>
                      </div>
                      ` : ''}
                      
                      <div style="text-align: center; margin: 30px 0;">
                          <a href="#" class="action-button">👁️ عرض تفاصيل الطلب</a>
                          <p style="color: #718096; font-size: 13px; margin-top: 15px;">
                              يمكنك تتبع حالة الطلب عبر لوحة التحكم في النظام
                          </p>
                      </div>
                      
                      <div class="contact-info">
                          <h4 style="color: #2a5298; margin-bottom: 10px;">📞 للاستفسار والدعم</h4>
                          <p style="font-size: 14px; margin-bottom: 5px;">
                              <strong>شركة البحيرة العربية</strong><br>
                              نظام إدارة الطلبات المتكامل
                          </p>
                          <p style="font-size: 13px; color: #4a5568;">
                              هذه رسالة تلقائية، يرجى عدم الرد عليها مباشرة
                          </p>
                      </div>
                  </div>
                  
                  <div class="footer">
                      <div class="footer-logo">شركة البحيرة العربية</div>
                      <p>نظام إدارة الطلبات المتكامل</p>
                      <p>© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
                      <p style="font-size: 12px; opacity: 0.6; margin-top: 15px;">
                          تم إرسال هذه الرسالة تلقائيًا من النظام، يرجى التواصل مع فريق الدعم لأي استفسار
                      </p>
                  </div>
              </div>
          </body>
          </html>
        `;
      };


      try {
        const emails = await getOrderEmails(order);

        if (emails && emails.length > 0) {

          const emailPromise = sendEmail({
            to: emails,
            subject:
              order.orderSource === 'عميل'
                ? `🆕 طلب عميل جديد تم إنشاؤه (${order.orderNumber}) - شركة البحيرة العربية`
                : `🆕 طلب مورد جديد تم إنشاؤه (${order.orderNumber}) - شركة البحيرة العربية`,
            html: createOrderCreationEmailTemplate(order, req.user),
          });


          emailPromise
            .then(() => {
              console.log(`✅ Email sent successfully for order ${order.orderNumber}`);
            })
            .catch((emailError) => {
              console.warn(`⚠️ Email sending warning for ${order.orderNumber}:`, emailError.message);

            });
        }
      } catch (emailError) {
        console.warn(`⚠️ Email warning for ${order.orderNumber}:`, emailError.message);

      }


      return res.status(201).json({
        message:
          order.orderSource === 'عميل'
            ? 'تم إنشاء طلب العميل بنجاح'
            : 'تم إنشاء طلب المورد بنجاح',
        order: populatedOrder,
        emailSent: true
      });
    });
  } catch (error) {
    console.error('❌ Error creating order:', error);
    return res.status(500).json({ 
      error: 'حدث خطأ في السيرفر',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



exports.getOrders = async (req, res) => {
  try {
     const hasPagination = req.query.page || req.query.limit;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 0; 
    const skip = limit ? (page - 1) * limit : 0;


    const filter = {};
    
    // تصفية حسب مصدر الطلب
    if (req.query.orderSource) {
      filter.orderSource = req.query.orderSource;
    }
    
    // تصفية حسب حالة الدمج
    if (req.query.mergeStatus) {
      filter.mergeStatus = req.query.mergeStatus;
    }
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.supplierName) {
      filter.supplierName = new RegExp(req.query.supplierName, 'i');
    }
    
    if (req.query.customerName) {
      filter.customerName = new RegExp(req.query.customerName, 'i');
    }
    
    if (req.query.orderNumber) {
      filter.orderNumber = new RegExp(req.query.orderNumber, 'i');
    }
    
    if (req.query.supplierOrderNumber) {
      filter.supplierOrderNumber = new RegExp(req.query.supplierOrderNumber, 'i');
    }
    
    if (req.query.city) {
      filter.city = new RegExp(req.query.city, 'i');
    }
    
    if (req.query.area) {
      filter.area = new RegExp(req.query.area, 'i');
    }
    
    if (req.query.productType) {
      filter.productType = req.query.productType;
    }
    
    if (req.query.fuelType) {
      filter.fuelType = req.query.fuelType;
    }
    
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }
    
    if (req.query.driverName) {
      filter.driverName = new RegExp(req.query.driverName, 'i');
    }
    
    if (req.query.createdByName) {
      filter.createdByName = new RegExp(req.query.createdByName, 'i');
    }
    
    // تصفية حسب التواريخ
    if (req.query.startDate || req.query.endDate) {
      const dateField = req.query.dateField || 'orderDate';
      filter[dateField] = {};
      
      if (req.query.startDate) {
        const startDate = new Date(req.query.startDate);
        startDate.setHours(0, 0, 0, 0);
        filter[dateField].$gte = startDate;
      }
      
      if (req.query.endDate) {
        const endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999);
        filter[dateField].$lte = endDate;
      }
    }

    // تصفية حسب حالة التحميل/التوصيل
    if (req.query.isOverdue) {
      const now = new Date();
      if (req.query.isOverdue === 'arrival') {
        filter.$expr = {
          $lt: [
            {
              $dateFromParts: {
                year: { $year: '$arrivalDate' },
                month: { $month: '$arrivalDate' },
                day: { $dayOfMonth: '$arrivalDate' },
                hour: { $toInt: { $arrayElemAt: [{ $split: ['$arrivalTime', ':'] }, 0] } },
                minute: { $toInt: { $arrayElemAt: [{ $split: ['$arrivalTime', ':'] }, 1] } }
              }
            },
            now
          ]
        };
      } else if (req.query.isOverdue === 'loading') {
        filter.$expr = {
          $lt: [
            {
              $dateFromParts: {
                year: { $year: '$loadingDate' },
                month: { $month: '$loadingDate' },
                day: { $dayOfMonth: '$loadingDate' },
                hour: { $toInt: { $arrayElemAt: [{ $split: ['$loadingTime', ':'] }, 0] } },
                minute: { $toInt: { $arrayElemAt: [{ $split: ['$loadingTime', ':'] }, 1] } }
              }
            },
            now
          ]
        };
      }
    }

    // جلب الطلبات مع جميع العلاقات
    const orders = await Order.find(filter)
      .populate('customer', 'name code phone email city area address')
      .populate('supplier', 'name company contactPerson phone email address city area')
      .populate('createdBy', 'name email role')
      .populate('driver', 'name phone vehicleNumber licenseNumber')
      .populate('mergedWithOrderId', 'orderNumber customerName supplierName')
      .sort({ orderDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // معالجة كل طلب للحصول على معلومات إضافية
    const ordersWithDisplayInfo = await Promise.all(
      orders.map(async (order) => {
        // الحصول على معلومات العرض الأساسية
        const displayInfo = order.getDisplayInfo ? order.getDisplayInfo() : {
          orderNumber: order.orderNumber,
          orderSource: order.orderSource,
          orderSourceText: getOrderSourceText(order.orderSource),
          supplierName: order.supplierName || 'غير محدد',
          customerName: order.customerName || 'غير محدد',
          status: order.status,
          statusColor: getStatusColor(order.status),
          location: getLocation(order),
          fuelType: order.fuelType,
          quantity: order.quantity,
          unit: order.unit,
          mergeStatus: order.mergeStatus,
          totalPrice: order.totalPrice,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt
        };

        // حساب المؤقتات
        let arrivalCountdown = 'غير متاح';
        let loadingCountdown = 'غير متاح';
        let isArrivalOverdue = false;
        let isLoadingOverdue = false;

        if (order.getFullArrivalDateTime) {
          const arrivalDateTime = order.getFullArrivalDateTime();
          const now = new Date();
          const arrivalRemaining = arrivalDateTime - now;
          
          if (arrivalRemaining <= 0) {
            arrivalCountdown = 'تأخر';
            isArrivalOverdue = true;
          } else {
            arrivalCountdown = formatDuration(arrivalRemaining);
          }
        }

        if (order.getFullLoadingDateTime) {
          const loadingDateTime = order.getFullLoadingDateTime();
          const now = new Date();
          const loadingRemaining = loadingDateTime - now;
          
          if (loadingRemaining <= 0) {
            loadingCountdown = 'تأخر';
            isLoadingOverdue = true;
          } else {
            loadingCountdown = formatDuration(loadingRemaining);
          }
        }

        // الحصول على معلومات الطرف المدمج معه
        let mergePartnerInfo = null;
        if (order.mergedWithOrderId && typeof order.mergedWithOrderId === 'object') {
          mergePartnerInfo = {
            orderNumber: order.mergedWithOrderId.orderNumber,
            name: order.orderSource === 'مورد' 
              ? order.mergedWithOrderId.customerName 
              : order.mergedWithOrderId.supplierName,
            type: order.orderSource === 'مورد' ? 'عميل' : 'مورد'
          };
        } else if (order.mergedWithInfo) {
          mergePartnerInfo = order.mergedWithInfo;
        }

        // الحصول على معلومات إضافية حسب نوع الطلب
        let additionalInfo = {};
        
        if (order.orderSource === 'مورد') {
          additionalInfo = {
            supplierOrder: {
              orderNumber: order.orderNumber,
              supplierName: order.supplierName,
              supplierCompany: order.supplierCompany,
              supplierPhone: order.supplierPhone,
              status: order.status,
              mergeStatus: order.mergeStatus,
              mergedWith: mergePartnerInfo
            }
          };
        } else if (order.orderSource === 'عميل') {
          additionalInfo = {
            customerOrder: {
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              customerCode: order.customerCode,
              customerPhone: order.customerPhone,
              requestType: order.requestType,
              status: order.status,
              mergeStatus: order.mergeStatus,
              mergedWith: mergePartnerInfo
            }
          };
        } else if (order.orderSource === 'مدمج') {
          additionalInfo = {
            mergedOrder: {
              orderNumber: order.orderNumber,
              supplierName: order.supplierName,
              customerName: order.customerName,
              quantity: order.quantity,
              unit: order.unit,
              status: order.status,
              mergeStatus: order.mergeStatus
            }
          };
        }

        return {
          ...order.toObject(),
          displayInfo: {
            ...displayInfo,
            arrivalCountdown,
            loadingCountdown,
            isArrivalOverdue,
            isLoadingOverdue
          },
          mergePartnerInfo,
          additionalInfo,
          timelines: {
            orderDate: order.orderDate,
            loadingDate: order.loadingDate,
            arrivalDate: order.arrivalDate,
            loadingTime: order.loadingTime,
            arrivalTime: order.arrivalTime,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            mergedAt: order.mergedAt,
            completedAt: order.completedAt
          },
          financials: {
            unitPrice: order.unitPrice,
            totalPrice: order.totalPrice,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            driverEarnings: order.driverEarnings
          },
          logistics: {
            driverName: order.driverName,
            driverPhone: order.driverPhone,
            vehicleNumber: order.vehicleNumber,
            deliveryDuration: order.deliveryDuration,
            distance: order.distance
          }
        };
      })
    );

    // الحصول على العدد الإجمالي
    const total = await Order.countDocuments(filter);
    const stats = {
  totalOrders: total,
  bySource: {
    supplier: await Order.countDocuments({
      ...filter,
      orderSource: 'مورد'
    }),

    // ⭐ طلبات العميل + الطلبات المدمجة اللي فيها عميل
    customer: await Order.countDocuments({
      ...filter,
      $or: [
        { orderSource: 'عميل' },
        { orderSource: 'مدمج', customer: { $ne: null } }
      ]
    }),

    merged: await Order.countDocuments({
      ...filter,
      orderSource: 'مدمج'
    })
  },

      byStatus: {
        pending: await Order.countDocuments({ 
          ...filter, 
          status: { 
            $in: ['قيد الإنشاء', 'في انتظار التخصيص', 'في انتظار الدمج'] 
          } 
        }),
        inProgress: await Order.countDocuments({ 
          ...filter, 
          status: { 
            $in: ['تم الإنشاء', 'تم تخصيص طلب المورد', 'تم دمجه مع العميل', 
                  'تم دمجه مع المورد', 'جاهز للتحميل', 'في انتظار التحميل'] 
          } 
        }),
        active: await Order.countDocuments({ 
          ...filter, 
          status: { 
            $in: ['تم التحميل', 'في الطريق'] 
          } 
        }),
        completed: await Order.countDocuments({ 
          ...filter, 
          status: { 
            $in: ['تم التسليم', 'تم التنفيذ', 'مكتمل'] 
          } 
        }),
        cancelled: await Order.countDocuments({ 
          ...filter, 
          status: 'ملغى' 
        })
      }
    };

    res.json({
      success: true,
      orders: ordersWithDisplayInfo,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats,
      filters: req.query
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ 
      success: false,
      error: 'حدث خطأ في السيرفر',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// 🔧 دوال مساعدة محلية
// ============================================

function getOrderSourceText(orderSource) {
  switch(orderSource) {
    case 'مورد': return 'طلب مورد';
    case 'عميل': return 'طلب عميل';
    case 'مدمج': return 'طلب مدمج';
    default: return 'طلب';
  }
}

function getStatusColor(status) {
  const statusColors = {
    // طلبات المورد
    'قيد الإنشاء': '#ff9800',
    'تم الإنشاء': '#2196f3',
    'في انتظار الدمج': '#ff5722',
    'تم دمجه مع العميل': '#9c27b0',
    'جاهز للتحميل': '#00bcd4',
    'تم التحميل': '#4caf50',
    'في الطريق': '#3f51b5',
    'تم التسليم': '#8bc34a',
    
    // طلبات العميل
    'في انتظار التخصيص': '#ff9800',
    'تم تخصيص طلب المورد': '#2196f3',
    'في انتظار الدمج': '#ff5722',
    'تم دمجه مع المورد': '#9c27b0',
    'في انتظار التحميل': '#00bcd4',
    'في الطريق': '#3f51b5',
    'تم التسليم': '#8bc34a',
    
    // طلبات مدمجة
    'تم الدمج': '#9c27b0',
    'مخصص للعميل': '#2196f3',
    'جاهز للتحميل': '#00bcd4',
    'تم التحميل': '#4caf50',
    'في الطريق': '#3f51b5',
    'تم التسليم': '#8bc34a',
    'تم التنفيذ': '#4caf50',
    
    // عامة
    'ملغى': '#f44336',
    'مكتمل': '#8bc34a'
  };
  
  return statusColors[status] || '#757575';
}

function getLocation(order) {
  if (order.city && order.area) {
    return `${order.city} - ${order.area}`;
  }
  return order.city || order.area || 'غير محدد';
}

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
// ============================================
// 🔍 جلب طلب محدد
// ============================================

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name code phone email city area address')
      .populate('supplier', 'name company contactPerson phone address email')
      .populate('createdBy', 'name email')
      .populate('driver', 'name phone vehicleNumber licenseNumber')
      .populate('originalOrderId', 'orderNumber orderSource customerName')
      .populate('mergedOrderId', 'orderNumber orderSource customerName');
    
    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    // جلب النشاطات لهذا الطلب
    const activities = await Activity.find({ orderId: order._id })
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 });

    // جلب الطلبات المرتبطة (إذا كان مدمج)
    let relatedOrders = [];
    if (order.mergeStatus === 'مدمج' && order.mergedOrderId) {
      relatedOrders = await Order.find({
        $or: [
          { originalOrderId: order._id },
          { mergedOrderId: order._id }
        ]
      }).populate('customer', 'name code');
    }

    res.json({
      order: {
        ...order.toObject(),
        displayInfo: order.getDisplayInfo ? order.getDisplayInfo() : null
      },
      activities,
      relatedOrders
    });
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// ============================================
// 📅 جلب الطلبات القادمة
// ============================================

exports.getUpcomingOrders = async (req, res) => {
  try {
    const now = new Date();

    // ساعتين قبل الوصول
    const twoHoursBefore = new Date(now.getTime() + (2 * 60 * 60 * 1000));

    // جلب الطلبات المحتملة
    const orders = await Order.find({
      status: { $in: ['في انتظار التحميل', 'جاهز للتحميل', 'مخصص للعميل', 'في الطريق'] },
    })
    .populate('customer', 'name code phone email')
    .populate('supplier', 'name company contactPerson')
    .populate('createdBy', 'name email')
    .populate('driver', 'name phone vehicleNumber');

    const upcomingOrders = [];

    for (const order of orders) {
      const arrivalDateTime = order.getFullArrivalDateTime();

      // الطلب داخل نطاق الإشعار (قبل الوصول بساعتين)
      if (arrivalDateTime > now && arrivalDateTime <= twoHoursBefore) {
        upcomingOrders.push({
          ...order.toObject(),
          arrivalDateTime,
          timeRemaining: formatDuration(arrivalDateTime - now)
        });

        // إرسال الإيميل مرة واحدة فقط
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
                html: EmailTemplates.arrivalReminderTemplate(order, timeRemaining),
              });
            }

            // تحديث وقت الإرسال
            order.arrivalEmailSentAt = new Date();
            await order.save();

            console.log(`📧 Arrival email sent for order ${order.orderNumber}`);
          } catch (emailError) {
            console.error(`❌ Failed to send arrival email for order ${order.orderNumber}:`, emailError.message);
          }
        }
      }
    }

    return res.json(upcomingOrders);
  } catch (error) {
    console.error('Error getting upcoming orders:', error);
    return res.status(500).json({ error: 'حدث خطأ في جلب الطلبات القريبة' });
  }
};

// ============================================
// ⏱️ جلب الطلبات مع المؤقتات
// ============================================

exports.getOrdersWithTimers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.orderSource) {
      filter.orderSource = req.query.orderSource;
    }

    if (req.query.supplierName) {
      filter.supplierName = new RegExp(req.query.supplierName, 'i');
    }

    if (req.query.customerName) {
      filter.customerName = new RegExp(req.query.customerName, 'i');
    }

    // جلب الطلبات
    const orders = await Order.find(filter)
      .populate('customer', 'name code email')
      .populate('supplier', 'name company contactPerson')
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

      const arrivalCountdown = arrivalRemaining > 0 ? formatDuration(arrivalRemaining) : 'تأخر';
      const loadingCountdown = loadingRemaining > 0 ? formatDuration(loadingRemaining) : 'تأخر';

      // قبل الوصول بساعتين ونصف
      const isApproachingArrival = arrivalRemaining > 0 && arrivalRemaining <= 2.5 * 60 * 60 * 1000;
      const isApproachingLoading = loadingRemaining > 0 && loadingRemaining <= 2.5 * 60 * 60 * 1000;

      // إرسال الإيميل (مرة واحدة فقط)
      if (isApproachingArrival && !order.arrivalEmailSentAt) {
        try {
          const emails = await getOrderEmails(order);

          if (!emails || emails.length === 0) {
            console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
          } else {
            await sendEmail({
              to: emails,
              subject: `⏰ تذكير: اقتراب وصول الطلب ${order.orderNumber}`,
              html: EmailTemplates.arrivalReminderTemplate(order, formatDuration(arrivalRemaining)),
            });
          }

          order.arrivalEmailSentAt = new Date();
          await order.save();

          console.log(`📧 Arrival reminder email sent for order ${order.orderNumber}`);
        } catch (emailError) {
          console.error(`❌ Failed to send arrival email for order ${order.orderNumber}:`, emailError.message);
        }
      }

      ordersWithTimers.push({
        ...order.toObject(),
        displayInfo: order.getDisplayInfo ? order.getDisplayInfo() : null,
        arrivalDateTime,
        loadingDateTime,
        arrivalRemaining,
        loadingRemaining,
        arrivalCountdown,
        loadingCountdown,
        needsArrivalNotification: isApproachingArrival && !order.arrivalEmailSentAt,
        isApproachingArrival,
        isApproachingLoading,
        isArrivalOverdue: arrivalRemaining < 0,
        isLoadingOverdue: loadingRemaining < 0
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
    console.error('Error getting orders with timers:', error);
    return res.status(500).json({ error: 'حدث خطأ في جلب الطلبات' });
  }
};

// ============================================
// 🔔 إرسال تذكير بالوصول
// ============================================

exports.sendArrivalReminder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('customer', 'name email phone')
      .populate('supplier', 'name email contactPerson')
      .populate('createdBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const User = require('../models/User');
    const Notification = require('../models/Notification');
    const Activity = require('../models/Activity');

    // المستخدمين المستهدفين (منشئ الطلب + الإداريين + العميل إذا كان له إيميل)
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

    // إنشاء Notification
    const notification = new Notification({
      type: 'arrival_reminder',
      title: 'تذكير بقرب وقت الوصول',
      message: `الطلب رقم ${order.orderNumber} (${order.customerName}) سيصل خلال ${timeRemaining}`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        supplierName: order.supplierName,
        arrivalTime: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
        timeRemaining,
        isManual: true
      },
      recipients: usersToNotify.map(user => ({ user: user._id })),
      createdBy: req.user._id
    });

    await notification.save();

    // إرسال الإيميل
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
      console.error(`❌ Failed to send arrival reminder email for order ${order.orderNumber}:`, emailError.message);
    }

    // تحديث حالة الإرسال
    order.arrivalNotificationSentAt = new Date();
    order.arrivalEmailSentAt = new Date();
    await order.save();

    // تسجيل النشاط
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
    console.error('Error sending arrival reminder:', error);
    return res.status(500).json({ error: 'حدث خطأ في إرسال الإشعار' });
  }
};

// ============================================
// ✏️ تحديث الطلب
// ============================================

exports.updateOrder = async (req, res) => {

  console.log('🔥 UPDATE ORDER HIT');
  console.log('BODY:', req.body);
  console.log('FILE:', req.file);
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const order = await Order.findById(req.params.id)
        .populate('customer', 'name code phone email city area address')
        .populate('supplier', 'name company contactPerson phone address')
        .populate('driver', 'name phone vehicleNumber');

      if (!order) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }

      // ============================================
      // 🧠 تحديد نوع الطلب
      // ============================================
      const isCustomerOrder = order.orderSource === 'عميل';
      const isSupplierOrder = order.orderSource === 'مورد';

      // ============================================
      // 🧩 الحقول المسموح تعديلها
      // ============================================
      const baseAllowedUpdates = [
        'customer',
        'driver', 'driverName', 'driverPhone', 'vehicleNumber',
        'notes', 'supplierNotes', 'customerNotes', 'internalNotes',
        'actualArrivalTime', 'loadingDuration', 'delayReason',
        'quantity', 'unit', 'fuelType', 'productType',
        'unitPrice', 'totalPrice', 'paymentMethod', 'paymentStatus',
        'city', 'area', 'address',
        'loadingDate', 'loadingTime', 'arrivalDate', 'arrivalTime',
        'status', 'mergeStatus',
        'requestType',
        'orderDate'
      ];

      const forbiddenForSupplier = ['supplierOrderNumber', 'supplierName'];

      const allowedUpdates = isSupplierOrder
        ? baseAllowedUpdates.filter(
            (f) => !forbiddenForSupplier.includes(f)
          )
        : baseAllowedUpdates;

      if (isSupplierOrder && 'requestType' in req.body) {
        delete req.body.requestType;
      }

      // حماية إضافية
      forbiddenForSupplier.forEach((field) => delete req.body[field]);

      const updates = {};
      Object.keys(req.body).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key] !== undefined ? req.body[key] : null;
        }
      });

      // ============================================
      // 👤 تغيير العميل
      // ============================================
      const oldCustomerId = order.customer?._id?.toString();

      if (updates.customer && updates.customer !== oldCustomerId) {
        const newCustomer = await Customer.findById(updates.customer);
        if (!newCustomer) {
          return res.status(400).json({ error: 'العميل الجديد غير موجود' });
        }

        order.customer = newCustomer._id;
        order.customerName = newCustomer.name;
        order.customerCode = newCustomer.code;
        order.customerPhone = newCustomer.phone;
        order.customerEmail = newCustomer.email ?? null;

        order.city = updates.city ?? newCustomer.city;
        order.area = updates.area ?? newCustomer.area;
        order.address = updates.address ?? newCustomer.address;
      }

      // ============================================
      // 🚚 تغيير السائق
      // ============================================
      if ('driver' in updates) {
        if (updates.driver) {
          const driver = await Driver.findById(updates.driver);
          if (driver) {
            updates.driverName = driver.name;
            updates.driverPhone = driver.phone;
            updates.vehicleNumber = driver.vehicleNumber;
          }
        } else {
          updates.driverName = null;
          updates.driverPhone = null;
          updates.vehicleNumber = null;
        }
      }

      // ============================================
      // 🔄 تغيير نوع العملية (شراء / نقل)
      // ============================================
      if ('requestType' in updates) {
        order.requestType = updates.requestType;
        if (updates.requestType === 'شراء') {
          order.driver = null;
          order.driverName = null;
          order.driverPhone = null;
          order.vehicleNumber = null;
        }
      }

      // ============================================
      // 📍 تحديث موقع العميل
      // ============================================
      if (
        ('city' in updates || 'area' in updates || 'address' in updates) &&
        order.customer
      ) {
        await Customer.findByIdAndUpdate(order.customer._id, {
          city: updates.city ?? order.customer.city,
          area: updates.area ?? order.customer.area,
          address: updates.address ?? order.customer.address,
        });
      }

      // ============================================
      // 📅 التواريخ
      // ============================================
      if (updates.loadingDate) updates.loadingDate = new Date(updates.loadingDate);
      if (updates.arrivalDate) updates.arrivalDate = new Date(updates.arrivalDate);
      if (updates.orderDate) updates.orderDate = new Date(updates.orderDate);

      // ============================================
      // 📎 الملفات
      // ============================================
      if (req.files?.attachments) {
        const newAttachments = req.files.attachments.map((file) => ({
          filename: file.originalname,
          path: file.path,
          uploadedAt: new Date(),
          uploadedBy: req.user._id,
        }));
        updates.attachments = [...order.attachments, ...newAttachments];
      }

      // ============================================
      // 🧾 حفظ القيم القديمة
      // ============================================
      const oldData = { ...order.toObject() };

      // ============================================
      // 💾 حفظ الطلب
      // ============================================
      Object.assign(order, updates);
      order.updatedAt = new Date();
      await order.save();

      // ============================================
      // 📝 حساب التغييرات
      // ============================================
      const changes = {};
      const excluded = ['attachments', 'updatedAt'];

      Object.keys(updates).forEach((key) => {
        if (!excluded.includes(key)) {
          if (JSON.stringify(oldData[key]) !== JSON.stringify(order[key])) {
            changes[key] = `من: ${oldData[key] ?? 'غير محدد'} → إلى: ${order[key] ?? 'غير محدد'}`;
          }
        }
      });

      // ============================================
      // 📋 Activity
      // ============================================
      if (Object.keys(changes).length) {
        await Activity.create({
          orderId: order._id,
          activityType: 'تعديل',
          description: `تم تعديل الطلب رقم ${order.orderNumber}`,
          performedBy: req.user._id,
          performedByName: req.user.name,
          changes,
        });
      }

      // ============================================
      // 📧 إرسال الإيميل
      // ============================================
      if (Object.keys(changes).length && order.customerEmail) {
        await sendEmail({
          to: order.customerEmail,
          subject: `تم تعديل طلبك رقم ${order.orderNumber}`,
          html: `
            <h3>مرحبًا ${order.customerName}</h3>
            <p>تم تعديل طلبك، وهذه أهم التغييرات:</p>
            <ul>
              ${Object.values(changes).map(c => `<li>${c}</li>`).join('')}
            </ul>
            <p>شكراً لتعاملكم معنا</p>
          `,
        });
      }

      // ============================================
      // 📤 الرد
      // ============================================
      const populatedOrder = await Order.findById(order._id)
        .populate('customer', 'name code phone email city area address')
        .populate('supplier', 'name company contactPerson phone address')
        .populate('driver', 'name phone vehicleNumber')
        .populate('createdBy', 'name email');

      return res.json({
        message: 'تم تحديث الطلب بنجاح',
        order: populatedOrder,
        changes: Object.keys(changes).length ? changes : null,
      });
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};


// ============================================
// 🔄 تحديث حالة الطلب
// ============================================

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const order = await Order.findById(id)
      .populate('customer', 'name email phone')
      .populate('supplier', 'name email contactPerson phone')
      .populate('createdBy', 'name email')
      .populate('driver', 'name phone vehicleNumber');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const oldStatus = order.status;

    const isSystemAuto =
      req.headers['x-system-auto'] === 'true' ||
      req.user?.role === 'system';

    if (
      isSystemAuto &&
      order.orderSource === 'مدمج' &&
      status === 'تم التنفيذ'
    ) {
      order.status = 'تم التنفيذ';
      order.mergeStatus = 'مكتمل';
      order.completedAt = new Date();
      order.updatedAt = new Date();

      await order.save();

      const activity = new Activity({
        orderId: order._id,
        activityType: 'تغيير حالة',
        description: `تم تنفيذ الطلب ${order.orderNumber} تلقائيًا بواسطة النظام`,
        performedBy: null,
        performedByName: 'النظام',
        changes: {
          الحالة: `من: ${oldStatus} → إلى: تم التنفيذ`,
        },
      });
      await activity.save();

      return res.json({
        success: true,
        message: 'تم تنفيذ الطلب المدمج تلقائيًا',
        data: {
          order,
          oldStatus,
          newStatus: 'تم التنفيذ',
          auto: true,
        },
      });
    }

    // التحقق من أن الحالة لم تتغير
    if (oldStatus === status) {
      return res.json({
        message: 'الحالة لم تتغير',
        order,
      });
    }

    // ============================================
    // 🔐 التحقق من الصلاحيات
    // ============================================
    const user = req.user;
    
    if (user.role !== 'admin' && user.role !== 'manager') {
      if (user.role === 'driver') {
        // السماح للسائق فقط بتغيير حالات معينة
        const allowedDriverStatuses = ['في الطريق', 'تم التسليم', 'تم التحميل'];
        if (!allowedDriverStatuses.includes(status)) {
          return res.status(403).json({ 
            error: 'غير مصرح للسائق بتغيير الحالة إلى هذا الوضع' 
          });
        }
        
        // التحقق من أن السائق هو المسؤول عن هذا الطلب
        if (order.driver && order.driver._id.toString() !== user._id.toString()) {
          return res.status(403).json({ 
            error: 'أنت لست السائق المسؤول عن هذا الطلب' 
          });
        }
      } else {
        return res.status(403).json({ 
          error: 'غير مصرح لك بتغيير حالة الطلب' 
        });
      }
    }

    // ============================================
    // 🔄 التحقق من التسلسل المنطقي للحالات
    // ============================================
    const statusFlow = {
      // ========== طلبات المورد ==========
      'قيد الإنشاء': ['تم الإنشاء', 'ملغى'],
      'تم الإنشاء': ['في انتظار الدمج', 'ملغى'],
      'في انتظار الدمج': ['تم دمجه مع العميل', 'ملغى'],
      'تم دمجه مع العميل': ['جاهز للتحميل', 'ملغى'],
      'جاهز للتحميل': ['تم التحميل', 'ملغى'],
      'تم التحميل': ['في الطريق', 'ملغى'],
      'في الطريق': ['تم التسليم', 'ملغى'],
      'تم التسليم': ['مكتمل'],
      
      // ========== طلبات العميل ==========
      'في انتظار التخصيص': ['تم تخصيص طلب المورد', 'ملغى'],
      'تم تخصيص طلب المورد': ['في انتظار الدمج', 'ملغى'],
      'في انتظار الدمج': ['تم دمجه مع المورد', 'ملغى'],
      'تم دمجه مع المورد': ['في انتظار التحميل', 'ملغى'],
      'في انتظار التحميل': ['في الطريق', 'ملغى'],
      'في الطريق': ['تم التسليم', 'ملغى'],
      'تم التسليم': ['مكتمل'],
      
      // ========== طلبات مدمجة ==========
      'تم الدمج': ['مخصص للعميل', 'ملغى'],
      'مخصص للعميل': ['جاهز للتحميل', 'ملغى'],
      'جاهز للتحميل': ['تم التحميل', 'ملغى'],
      'تم التحميل': ['في الطريق', 'ملغى'],
      'في الطريق': ['تم التسليم', 'ملغى'],
      'تم التسليم': ['تم التنفيذ', 'ملغى'],
'تم التنفيذ': ['مكتمل'],
    };

    // التحقق من أن الانتقال مسموح
    if (!statusFlow[oldStatus] || !statusFlow[oldStatus].includes(status)) {
      return res.status(400).json({
        error: `غير مسموح بتغيير الحالة من "${oldStatus}" إلى "${status}"`,
        allowedStatuses: statusFlow[oldStatus] || []
      });
    }

    // ============================================
    // 📝 تحديث الحالة ومعالجة الحالات الخاصة
    // ============================================
    order.status = status;
    order.updatedAt = new Date();

    switch(status) {
      case 'تم التحميل':
        order.loadingCompletedAt = new Date();
        if (order.driver) {
          try {
            // تحديث إحصائيات السائق
            await mongoose.model('Driver').findByIdAndUpdate(
              order.driver._id,
              {
                $inc: {
                  totalDeliveries: 1,
                  totalEarnings: order.driverEarnings || 0,
                  totalDistance: order.distance || 0
                }
              }
            );
          } catch (statsError) {
            console.error('❌ Error updating driver stats:', statsError);
          }
        }
        break;
        
      case 'في الطريق':
        // بدء التتبع
        order.trackingStartedAt = new Date();
        break;
        
      case 'تم التسليم':
        order.completedAt = new Date();
        order.actualArrivalTime = new Date().toLocaleTimeString('ar-SA', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        break;
        
      case 'تم التنفيذ':
        order.completedAt = new Date();
        break;
        
      case 'ملغى':
        order.cancelledAt = new Date();
        if (reason) {
          order.cancellationReason = reason;
          order.notes = (order.notes || '') + `\nسبب الإلغاء: ${reason}`;
        }
        break;
        
      case 'مكتمل':
        order.completedAt = new Date();
        order.mergeStatus = 'مكتمل';
        break;
    }

    // ============================================
    // 💾 حفظ التغييرات
    // ============================================
    await order.save();

    // ============================================
    // 📋 تسجيل النشاط
    // ============================================
    const activity = new Activity({
      orderId: order._id,
      activityType: 'تغيير حالة',
      description: `تم تغيير حالة الطلب رقم ${order.orderNumber} من "${oldStatus}" إلى "${status}"`,
      performedBy: user._id,
      performedByName: user.name,
      changes: {
        الحالة: `من: ${oldStatus} → إلى: ${status}`,
        ...(reason ? { 'سبب التغيير': reason } : {}),
        ...(status === 'تم التحميل' ? { 'وقت التحميل الفعلي': new Date().toLocaleString('ar-SA') } : {}),
        ...(status === 'تم التسليم' ? { 'وقت التسليم الفعلي': new Date().toLocaleString('ar-SA') } : {})
      },
    });
    await activity.save();

    // ============================================
    // 📧 إرسال الإيميلات
    // ============================================
    try {
      const emails = await getOrderEmails(order);

      if (!emails || emails.length === 0) {
        console.log(`⚠️ No valid emails for order status update - order ${order.orderNumber}`);
      } else {
        // تحديد قالب الإيميل المناسب
        let emailTemplate;
        
        if (status === 'تم دمجه مع العميل' || status === 'تم تخصيص طلب المورد') {
          // إيميل خاص بالدمج
          const partnerInfo = await order.getMergePartnerInfo();
          if (partnerInfo) {
            if (order.orderSource === 'مورد') {
              emailTemplate = EmailTemplates.mergeSupplierTemplate(order, partnerInfo);
            } else {
              emailTemplate = EmailTemplates.mergeCustomerTemplate(order, partnerInfo);
            }
          } else {
            emailTemplate = EmailTemplates.orderStatusTemplate(order, oldStatus, status, user.name, reason);
          }
        } else {
          // إيميل حالة عادي
          emailTemplate = EmailTemplates.orderStatusTemplate(order, oldStatus, status, user.name, reason);
        }

        await sendEmail({
          to: emails,
          subject: `🔄 تحديث حالة الطلب ${order.orderNumber}`,
          html: emailTemplate,
        });
        
        console.log(`📧 Status update email sent for order ${order.orderNumber}`);
      }
    } catch (emailError) {
      console.error('❌ Failed to send order status email:', emailError.message);
    }

    // ============================================
    // 🔔 إرسال إشعارات إذا لزم الأمر
    // ============================================
    if (['في الطريق', 'تم التسليم', 'تم التحميل'].includes(status)) {
      try {
        const Notification = require('../models/Notification');
        const User = require('../models/User');
        
        // مستخدمين للإشعار (المسؤولين + صاحب الطلب)
        const usersToNotify = await User.find({
          $or: [
            { role: { $in: ['admin', 'manager'] } },
            { _id: order.createdBy?._id }
          ],
          isActive: true
        });

        if (usersToNotify.length > 0) {
          const notification = new Notification({
            type: 'order_status_update',
            title: `تحديث حالة الطلب ${order.orderNumber}`,
            message: `تم تحديث حالة الطلب ${order.orderNumber} إلى "${status}"`,
            data: {
              orderId: order._id,
              orderNumber: order.orderNumber,
              oldStatus,
              newStatus: status,
              updatedBy: user.name,
              customerName: order.customerName,
              supplierName: order.supplierName
            },
            recipients: usersToNotify.map(u => ({ user: u._id })),
            createdBy: user._id
          });
          
          await notification.save();
        }
      } catch (notifError) {
        console.error('❌ Failed to create notification:', notifError.message);
      }
    }

    // ============================================
    // 📦 تحديث الطلب المدمج المرتبط إذا وجد
    // ============================================
    if (order.mergedWithOrderId && ['تم التسليم', 'تم التحميل', 'في الطريق'].includes(status)) {
      try {
        const mergedOrder = await Order.findById(order.mergedWithOrderId);
        if (mergedOrder) {
          // تحديث حالة الطلب المدمج بناءً على حالة الطلب الحالي
          if (status === 'تم التسليم' && mergedOrder.status !== 'تم التسليم') {
            mergedOrder.status = 'تم التسليم';
            mergedOrder.completedAt = new Date();
            await mergedOrder.save();
            
            // تسجيل نشاط في الطلب المدمج
            const mergedActivity = new Activity({
              orderId: mergedOrder._id,
              activityType: 'تغيير حالة',
              description: `تم تحديث حالة الطلب المدمج تلقائياً إلى "تم التسليم" بناءً على حالة الطلب ${order.orderNumber}`,
              performedBy: user._id,
              performedByName: user.name
            });
            await mergedActivity.save();
          }
        }
      } catch (mergeError) {
        console.error('❌ Error updating merged order:', mergeError.message);
      }
    }

    // ============================================
    // 📊 إرجاع النتيجة
    // ============================================
    const updatedOrder = await Order.findById(order._id)
      .populate('customer', 'name code phone email')
      .populate('supplier', 'name company contactPerson phone')
      .populate('driver', 'name phone vehicleNumber')
      .populate('createdBy', 'name email');

    return res.json({
      success: true,
      message: 'تم تحديث حالة الطلب بنجاح',
      data: {
        order: {
          ...updatedOrder.toObject(),
          displayInfo: updatedOrder.getDisplayInfo ? updatedOrder.getDisplayInfo() : null
        },
        oldStatus,
        newStatus: status,
        updatedBy: {
          id: user._id,
          name: user.name,
          role: user.role
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error updating order status:', error);
    return res.status(500).json({ 
      error: 'حدث خطأ في السيرفر',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// // ============================================
// // 🔗 دمج الطلبات - محدثة حسب المتطلبات
// // ============================================

// exports.mergeOrders = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
  
//   try {
//     const { supplierOrderId, customerOrderId } = req.body;

//     // =========================
//     // 1️⃣ التحقق من المدخلات
//     // =========================
//     if (!supplierOrderId || !customerOrderId) {
//       await session.abortTransaction();
//       session.endSession();
      
//       return res.status(400).json({
//         success: false,
//         message: 'معرف طلب المورد ومعرف طلب العميل مطلوبان',
//       });
//     }

//     if (supplierOrderId === customerOrderId) {
//       await session.abortTransaction();
//       session.endSession();
      
//       return res.status(400).json({
//         success: false,
//         message: 'لا يمكن دمج الطلب مع نفسه',
//       });
//     }

//     // =========================
//     // 2️⃣ جلب الطلبات مع session
//     // =========================
//     const supplierOrder = await Order.findById(supplierOrderId).session(session);
//     const customerOrder = await Order.findById(customerOrderId).session(session);

//     if (!supplierOrder || !customerOrder) {
//       await session.abortTransaction();
//       session.endSession();
      
//       return res.status(404).json({
//         success: false,
//         message: 'أحد الطلبات غير موجود',
//       });
//     }

//     // =========================
//     // 3️⃣ التحقق من أنواع الطلبات
//     // =========================
//     if (supplierOrder.orderSource !== 'مورد') {
//       await session.abortTransaction();
//       session.endSession();
      
//       return res.status(400).json({
//         success: false,
//         message: 'الطلب الأول يجب أن يكون طلب مورد',
//       });
//     }

//     if (customerOrder.orderSource !== 'عميل') {
//       await session.abortTransaction();
//       session.endSession();
      
//       return res.status(400).json({
//         success: false,
//         message: 'الطلب الثاني يجب أن يكون طلب عميل',
//       });
//     }

//     // =========================
//     // 4️⃣ التحقق من حالة الدمج
//     // =========================
//     if (supplierOrder.mergeStatus !== 'منفصل' || customerOrder.mergeStatus !== 'منفصل') {
//       await session.abortTransaction();
//       session.endSession();
      
//       return res.status(400).json({
//         success: false,
//         message: 'أحد الطلبات تم دمجه مسبقًا',
//       });
//     }

//     // =========================
//     // 5️⃣ التحقق من التوافق
//     // =========================
//     if (supplierOrder.fuelType !== customerOrder.fuelType) {
//       await session.abortTransaction();
//       session.endSession();
      
//       return res.status(400).json({
//         success: false,
//         message: 'نوع الوقود غير متطابق',
//       });
//     }

//     const supplierQty = Number(supplierOrder.quantity || 0);
//     const customerQty = Number(customerOrder.quantity || 0);

//     if (supplierQty < customerQty) {
//       await session.abortTransaction();
//       session.endSession();
      
//       return res.status(400).json({
//         success: false,
//         message: 'كمية المورد أقل من كمية طلب العميل',
//       });
//     }

//     // =========================
//     // 6️⃣ إنشاء رقم الطلب المدموج
//     // =========================
//     const today = new Date();
//     const y = today.getFullYear();
//     const m = String(today.getMonth() + 1).padStart(2, '0');
//     const d = String(today.getDate()).padStart(2, '0');
//     const rand = Math.floor(1000 + Math.random() * 9000);
//     const mergedOrderNumber = `MIX-${y}${m}${d}-${rand}`;

//     // =========================
//     // 7️⃣ تحديد الموقع
//     // =========================
//     let city, area, address;

//     if (customerOrder.city && customerOrder.area) {
//       city = customerOrder.city;
//       area = customerOrder.area;
//       address = customerOrder.address || `${city} - ${area}`;
//     } else if (supplierOrder.city && supplierOrder.area) {
//       city = supplierOrder.city;
//       area = supplierOrder.area;
//       address = supplierOrder.address || `${city} - ${area}`;
//     } else {
//       city = 'غير محدد';
//       area = 'غير محدد';
//       address = 'غير محدد';
//     }

//     // =========================
//     // 8️⃣ إنشاء الطلب المدموج
//     // =========================
//     const mergedOrderData = {
//       orderSource: 'مدمج',
//       mergeStatus: 'مدمج',
//       orderNumber: mergedOrderNumber,
      
//       // معلومات الدمج
//       mergedWithOrderId: null,
//       mergedWithInfo: {
//         supplierOrderNumber: supplierOrder.orderNumber,
//         customerOrderNumber: customerOrder.orderNumber,
//         supplierName: supplierOrder.supplierName,
//         customerName: customerOrder.customerName,
//         mergedAt: new Date()
//       },
      
//       // معلومات المورد
//       supplierOrderNumber: supplierOrder.supplierOrderNumber,
//       supplier: supplierOrder.supplier,
//       supplierName: supplierOrder.supplierName,
//       supplierPhone: supplierOrder.supplierPhone,
//       supplierCompany: supplierOrder.supplierCompany,
//       supplierContactPerson: supplierOrder.supplierContactPerson,
//       supplierAddress: supplierOrder.supplierAddress,
      
//       // معلومات العميل
//       customer: customerOrder.customer,
//       customerName: customerOrder.customerName,
//       customerCode: customerOrder.customerCode,
//       customerPhone: customerOrder.customerPhone,
//       customerEmail: customerOrder.customerEmail,
      
//       // معلومات المنتج
//       productType: supplierOrder.productType,
//       fuelType: supplierOrder.fuelType,
//       quantity: customerQty,
//       unit: supplierOrder.unit || 'لتر',
      
//       // معلومات الموقع
//       city,
//       area,
//       address,
      
//       // معلومات التوقيت
//       orderDate: new Date(),
//       loadingDate: supplierOrder.loadingDate || new Date(),
//       loadingTime: supplierOrder.loadingTime || '08:00',
//       arrivalDate: customerOrder.arrivalDate || new Date(),
//       arrivalTime: customerOrder.arrivalTime || '10:00',
      
//       // معلومات الشحن
//       driver: supplierOrder.driver,
//       driverName: supplierOrder.driverName,
//       driverPhone: supplierOrder.driverPhone,
//       vehicleNumber: supplierOrder.vehicleNumber,
      
//       // معلومات السعر
//       unitPrice: supplierOrder.unitPrice,
//       totalPrice: supplierOrder.unitPrice ? supplierOrder.unitPrice * customerQty : 0,
//       paymentMethod: supplierOrder.paymentMethod,
//       paymentStatus: supplierOrder.paymentStatus,
      
//       // حالة الطلب المدمج
//       status: 'تم الدمج',
      
//       // ملاحظات
//       notes: `طلب مدمج من:\n• طلب المورد: ${supplierOrder.orderNumber} (${supplierOrder.supplierName})\n• طلب العميل: ${customerOrder.orderNumber} (${customerOrder.customerName})\n${supplierOrder.notes ? 'ملاحظات المورد: ' + supplierOrder.notes + '\n' : ''}${customerOrder.notes ? 'ملاحظات العميل: ' + customerOrder.notes : ''}`.trim(),
      
//       supplierNotes: supplierOrder.supplierNotes,
//       customerNotes: customerOrder.customerNotes,
      
//       // معلومات الإنشاء
//       createdBy: req.user._id,
//       createdByName: req.user.name || 'النظام',
      
//       createdAt: new Date(),
//       updatedAt: new Date(),
//     };

//     const mergedOrder = new Order(mergedOrderData);
//     await mergedOrder.save({ session });

//     // =========================
//     // 9️⃣ تحديث الطلبات الأصلية
//     // =========================
    
//     // تحديث طلب المورد
//     supplierOrder.mergeStatus = 'مدمج';
//     supplierOrder.status = 'تم دمجه مع العميل';
//     supplierOrder.mergedWithOrderId = mergedOrder._id;
//     supplierOrder.mergedWithInfo = {
//       orderNumber: customerOrder.orderNumber,
//       partyName: customerOrder.customerName,
//       partyType: 'عميل',
//       mergedAt: new Date()
//     };
//     supplierOrder.mergedAt = new Date();
//     supplierOrder.updatedAt = new Date();
//     supplierOrder.notes = (supplierOrder.notes || '') + 
//       `\n[${new Date().toLocaleString('ar-SA')}] تم دمجه مع طلب العميل: ${customerOrder.orderNumber} (${customerOrder.customerName})`;
    
//     await supplierOrder.save({ session });

//     // تحديث طلب العميل
//     customerOrder.mergeStatus = 'مدمج';
//     customerOrder.status = 'تم دمجه مع المورد';
//     customerOrder.mergedWithOrderId = mergedOrder._id;
//     customerOrder.mergedWithInfo = {
//       orderNumber: supplierOrder.orderNumber,
//       partyName: supplierOrder.supplierName,
//       partyType: 'مورد',
//       mergedAt: new Date()
//     };
//     customerOrder.supplierOrderNumber = supplierOrder.supplierOrderNumber;
//     customerOrder.mergedAt = new Date();
//     customerOrder.updatedAt = new Date();
//     customerOrder.notes = (customerOrder.notes || '') + 
//       `\n[${new Date().toLocaleString('ar-SA')}] تم دمجه مع طلب المورد: ${supplierOrder.orderNumber} (${supplierOrder.supplierName})`;
    
//     await customerOrder.save({ session });

//     // =========================
//     // 🔟 تسجيل النشاطات
//     // =========================
//     try {
//       // نشاط للطلب المدموج
//       const mergedActivity = new Activity({
//         orderId: mergedOrder._id,
//         activityType: 'دمج',
//         description: `تم دمج طلب المورد ${supplierOrder.orderNumber} مع طلب العميل ${customerOrder.orderNumber}`,
//         details: {
//           supplierOrder: supplierOrder.orderNumber,
//           customerOrder: customerOrder.orderNumber,
//           mergedBy: req.user.name || 'النظام',
//           quantity: customerQty,
//           fuelType: supplierOrder.fuelType
//         },
//         performedBy: req.user._id,
//         performedByName: req.user.name || 'النظام',
//       });
//       await mergedActivity.save({ session });

//       // نشاط لطلب المورد
//       const supplierActivity = new Activity({
//         orderId: supplierOrder._id,
//         activityType: 'دمج',
//         description: `تم دمج الطلب مع طلب العميل ${customerOrder.orderNumber} (${customerOrder.customerName})`,
//         details: {
//           mergedOrder: mergedOrder.orderNumber,
//           customerOrder: customerOrder.orderNumber,
//           customerName: customerOrder.customerName,
//           mergedBy: req.user.name || 'النظام'
//         },
//         performedBy: req.user._id,
//         performedByName: req.user.name || 'النظام',
//       });
//       await supplierActivity.save({ session });

//       // نشاط لطلب العميل
//       const customerActivity = new Activity({
//         orderId: customerOrder._id,
//         activityType: 'دمج',
//         description: `تم دمج الطلب مع طلب المورد ${supplierOrder.orderNumber} (${supplierOrder.supplierName})`,
//         details: {
//           mergedOrder: mergedOrder.orderNumber,
//           supplierOrder: supplierOrder.orderNumber,
//           supplierName: supplierOrder.supplierName,
//           mergedBy: req.user.name || 'النظام'
//         },
//         performedBy: req.user._id,
//         performedByName: req.user.name || 'النظام',
//       });
//       await customerActivity.save({ session });

//     } catch (err) {
//       console.warn('⚠️ بعض النشاطات لم يتم حفظها:', err.message);
//     }

//     // =========================
//     // 📧 إرسال الإيميلات
//     // =========================
//     try {
//       const sendEmailPromises = [];
      
//       // إيميل للمورد
//       if (supplierOrder.supplierEmail || supplierOrder.supplier?.email) {
//         const supplierEmail = supplierOrder.supplierEmail || supplierOrder.supplier?.email;
//         const emailTemplate = `
//           <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
//             <h2 style="color: #4CAF50;">✅ تم دمج طلبك مع عميل</h2>
//             <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
//               <h3>تفاصيل الدمج</h3>
//               <p><strong>رقم طلبك:</strong> ${supplierOrder.orderNumber}</p>
//               <p><strong>اسم العميل:</strong> ${customerOrder.customerName}</p>
//               <p><strong>رقم طلب العميل:</strong> ${customerOrder.orderNumber}</p>
//               <p><strong>الكمية:</strong> ${customerQty} ${supplierOrder.unit}</p>
//               <p><strong>نوع الوقود:</strong> ${supplierOrder.fuelType}</p>
//               <p><strong>رقم الطلب المدموج:</strong> ${mergedOrder.orderNumber}</p>
//             </div>
//             <p>تم تحديث حالة طلبك إلى: <strong style="color: #9c27b0;">تم دمجه مع العميل</strong></p>
//           </div>
//         `;
        
//         sendEmailPromises.push(
//           sendEmail({
//             to: supplierEmail,
//             subject: `✅ تم دمج طلبك ${supplierOrder.orderNumber} مع عميل`,
//             html: emailTemplate,
//           })
//         );
//       }
      
//       // إيميل للعميل
//       if (customerOrder.customerEmail) {
//         const emailTemplate = `
//           <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
//             <h2 style="color: #4CAF50;">✅ تم تخصيص مورد لطلبك</h2>
//             <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
//               <h3>تفاصيل التخصيص</h3>
//               <p><strong>رقم طلبك:</strong> ${customerOrder.orderNumber}</p>
//               <p><strong>اسم المورد:</strong> ${supplierOrder.supplierName}</p>
//               <p><strong>رقم طلب المورد:</strong> ${supplierOrder.orderNumber}</p>
//               <p><strong>رقم طلب المورد (الخاص بالمورد):</strong> ${supplierOrder.supplierOrderNumber}</p>
//               <p><strong>الكمية:</strong> ${customerQty} ${supplierOrder.unit}</p>
//               <p><strong>نوع الوقود:</strong> ${supplierOrder.fuelType}</p>
//               <p><strong>رقم الطلب المدموج:</strong> ${mergedOrder.orderNumber}</p>
//             </div>
//             <p>تم تحديث حالة طلبك إلى: <strong style="color: #9c27b0;">تم دمجه مع المورد</strong></p>
//           </div>
//         `;
        
//         sendEmailPromises.push(
//           sendEmail({
//             to: customerOrder.customerEmail,
//             subject: `✅ تم تخصيص مورد لطلبك ${customerOrder.orderNumber}`,
//             html: emailTemplate,
//           })
//         );
//       }
      
//       // إيميل للمسؤولين
//       const adminUsers = await mongoose.model('User').find({
//         role: { $in: ['admin', 'manager'] },
//         isActive: true,
//         email: { $exists: true, $ne: '' }
//       }).session(session);
      
//       if (adminUsers.length > 0) {
//         const adminEmails = adminUsers.map(user => user.email);
//         const adminEmailTemplate = `
//           <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
//             <h2 style="color: #2196F3;">📋 تقرير دمج طلبات</h2>
//             <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
//               <h3>تفاصيل الدمج</h3>
//               <p><strong>تم بواسطة:</strong> ${req.user.name || 'النظام'}</p>
//               <p><strong>وقت الدمج:</strong> ${new Date().toLocaleString('ar-SA')}</p>
//               <hr>
//               <p><strong>طلب المورد:</strong> ${supplierOrder.orderNumber} (${supplierOrder.supplierName})</p>
//               <p><strong>طلب العميل:</strong> ${customerOrder.orderNumber} (${customerOrder.customerName})</p>
//               <p><strong>الطلب المدموج:</strong> ${mergedOrder.orderNumber}</p>
//               <p><strong>الكمية:</strong> ${customerQty} ${supplierOrder.unit}</p>
//               <p><strong>القيمة:</strong> ${mergedOrder.totalPrice ? mergedOrder.totalPrice.toLocaleString('ar-SA') : 0} ريال</p>
//             </div>
//           </div>
//         `;
        
//         sendEmailPromises.push(
//           sendEmail({
//             to: adminEmails,
//             subject: `📋 تم دمج طلبين: ${supplierOrder.orderNumber} مع ${customerOrder.orderNumber}`,
//             html: adminEmailTemplate,
//           })
//         );
//       }
      
//       // إرسال جميع الإيميلات
//       await Promise.all(sendEmailPromises);
      
//     } catch (emailError) {
//       console.error('❌ Failed to send merge emails:', emailError.message);
//       // لا نوقف العملية إذا فشل الإيميل
//     }

//     // =========================
//     // ✅ تأكيد العملية
//     // =========================
//     await session.commitTransaction();
//     session.endSession();

//     // =========================
//     // 📊 الاستجابة
//     // =========================
//     return res.status(200).json({
//       success: true,
//       message: 'تم دمج الطلبات بنجاح',
//       data: {
//         mergedOrder: {
//           _id: mergedOrder._id,
//           orderNumber: mergedOrder.orderNumber,
//           status: mergedOrder.status,
//           mergeStatus: mergedOrder.mergeStatus,
//           supplierName: mergedOrder.supplierName,
//           customerName: mergedOrder.customerName,
//           quantity: mergedOrder.quantity,
//           unit: mergedOrder.unit,
//           fuelType: mergedOrder.fuelType,
//           totalPrice: mergedOrder.totalPrice,
//           createdAt: mergedOrder.createdAt
//         },
//         supplierOrder: {
//           _id: supplierOrder._id,
//           orderNumber: supplierOrder.orderNumber,
//           status: supplierOrder.status,
//           mergeStatus: supplierOrder.mergeStatus,
//           mergedWith: supplierOrder.mergedWithInfo,
//           updatedAt: supplierOrder.updatedAt
//         },
//         customerOrder: {
//           _id: customerOrder._id,
//           orderNumber: customerOrder.orderNumber,
//           status: customerOrder.status,
//           mergeStatus: customerOrder.mergeStatus,
//           mergedWith: customerOrder.mergedWithInfo,
//           supplierOrderNumber: customerOrder.supplierOrderNumber,
//           updatedAt: customerOrder.updatedAt
//         }
//       }
//     });

//   } catch (error) {
//     // =========================
//     // ❌ معالجة الأخطاء
//     // =========================
//     await session.abortTransaction();
//     session.endSession();
    
//     console.error('❌ Error merging orders:', error);
    
//     return res.status(500).json({
//       success: false,
//       message: 'حدث خطأ أثناء دمج الطلبات',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };





exports.mergeOrders = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { supplierOrderId, customerOrderId, mergeNotes } = req.body;

    // =========================
    // 1️⃣ التحقق من المدخلات
    // =========================
    if (!supplierOrderId || !customerOrderId) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'معرف طلب المورد ومعرف طلب العميل مطلوبان',
      });
    }

    if (supplierOrderId === customerOrderId) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'لا يمكن دمج الطلب مع نفسه',
      });
    }

    // =========================
    // 2️⃣ جلب الطلبات مع جميع البيانات
    // =========================
    const supplierOrder = await Order.findById(supplierOrderId)
      .populate('supplier', 'name company contactPerson phone email address')
      .populate('createdBy', 'name email')
      .session(session);
    
    const customerOrder = await Order.findById(customerOrderId)
      .populate('customer', 'name code phone email city area address')
      .populate('createdBy', 'name email')
      .session(session);

    if (!supplierOrder || !customerOrder) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(404).json({
        success: false,
        message: 'أحد الطلبات غير موجود',
      });
    }

    // =========================
    // 3️⃣ التحقق من أنواع الطلبات
    // =========================
    if (supplierOrder.orderSource !== 'مورد') {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'الطلب الأول يجب أن يكون طلب مورد',
      });
    }

    if (customerOrder.orderSource !== 'عميل') {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'الطلب الثاني يجب أن يكون طلب عميل',
      });
    }

    // =========================
    // 4️⃣ التحقق من حالة الدمج
    // =========================
    if (supplierOrder.mergeStatus !== 'منفصل' || customerOrder.mergeStatus !== 'منفصل') {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'أحد الطلبات تم دمجه مسبقًا',
      });
    }

    // =========================
    // 5️⃣ التحقق من التوافق
    // =========================
    if (supplierOrder.fuelType !== customerOrder.fuelType) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'نوع الوقود غير متطابق',
      });
    }

    const supplierQty = Number(supplierOrder.quantity || 0);
    const customerQty = Number(customerOrder.quantity || 0);

    if (supplierQty < customerQty) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: 'كمية المورد أقل من كمية طلب العميل',
      });
    }

    // =========================
    // 6️⃣ إنشاء رقم الطلب المدموج
    // =========================
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const mergedOrderNumber = `MIX-${y}${m}${d}-${rand}`;

    // =========================
    // 7️⃣ تحديد الموقع
    // =========================
    let city, area, address;

    if (customerOrder.city && customerOrder.area) {
      city = customerOrder.city;
      area = customerOrder.area;
      address = customerOrder.address || `${city} - ${area}`;
    } else if (supplierOrder.city && supplierOrder.area) {
      city = supplierOrder.city;
      area = supplierOrder.area;
      address = supplierOrder.address || `${city} - ${area}`;
    } else {
      city = 'غير محدد';
      area = 'غير محدد';
      address = 'غير محدد';
    }

    // =========================
    // 8️⃣ إنشاء الطلب المدموج
    // =========================
    const mergedOrderData = {
      orderSource: 'مدمج',
      mergeStatus: 'مدمج',
      orderNumber: mergedOrderNumber,
      
      // معلومات الدمج
      mergedWithOrderId: null,
      mergedWithInfo: {
        supplierOrderNumber: supplierOrder.orderNumber,
        customerOrderNumber: customerOrder.orderNumber,
        supplierName: supplierOrder.supplierName,
        customerName: customerOrder.customerName,
        mergedAt: new Date(),
        mergedBy: req.user.name || req.user.email
      },
      
      // معلومات المورد
      supplierOrderNumber: supplierOrder.supplierOrderNumber,
      supplier: supplierOrder.supplier?._id || supplierOrder.supplier,
      supplierName: supplierOrder.supplierName,
      supplierPhone: supplierOrder.supplierPhone,
      supplierCompany: supplierOrder.supplierCompany,
      supplierContactPerson: supplierOrder.supplierContactPerson,
      supplierAddress: supplierOrder.supplierAddress,
      supplierEmail: supplierOrder.supplier?.email || supplierOrder.supplierEmail,
      
      // معلومات العميل
      customer: customerOrder.customer?._id || customerOrder.customer,
      customerName: customerOrder.customerName,
      customerCode: customerOrder.customerCode,
      customerPhone: customerOrder.customerPhone,
      customerEmail: customerOrder.customer?.email || customerOrder.customerEmail,
      customerAddress: customerOrder.customer?.address || customerOrder.address,
      
      // معلومات المنتج
      productType: supplierOrder.productType,
      fuelType: supplierOrder.fuelType,
      quantity: customerQty,
      unit: supplierOrder.unit || 'لتر',
      
      // معلومات الموقع
      city,
      area,
      address,
      
      // معلومات التوقيت
      orderDate: new Date(),
      loadingDate: supplierOrder.loadingDate || new Date(),
      loadingTime: supplierOrder.loadingTime || '08:00',
      arrivalDate: customerOrder.arrivalDate || new Date(),
      arrivalTime: customerOrder.arrivalTime || '10:00',
      
      // معلومات الشحن
      driver: supplierOrder.driver,
      driverName: supplierOrder.driverName,
      driverPhone: supplierOrder.driverPhone,
      vehicleNumber: supplierOrder.vehicleNumber,
      
      // معلومات السعر
      unitPrice: supplierOrder.unitPrice,
      totalPrice: supplierOrder.unitPrice ? supplierOrder.unitPrice * customerQty : 0,
      paymentMethod: supplierOrder.paymentMethod,
      paymentStatus: supplierOrder.paymentStatus,
      driverEarnings: supplierOrder.driverEarnings || 0,
      
      // حالة الطلب المدمج
      status: 'تم الدمج',
      
      // ملاحظات
      notes: `طلب مدمج من:
• طلب المورد: ${supplierOrder.orderNumber} (${supplierOrder.supplierName})
• طلب العميل: ${customerOrder.orderNumber} (${customerOrder.customerName})
${mergeNotes ? 'ملاحظات الدمج: ' + mergeNotes + '\n' : ''}
${supplierOrder.notes ? 'ملاحظات المورد: ' + supplierOrder.notes + '\n' : ''}
${customerOrder.notes ? 'ملاحظات العميل: ' + customerOrder.notes : ''}`.trim(),
      
      supplierNotes: supplierOrder.supplierNotes,
      customerNotes: customerOrder.customerNotes,
      mergeNotes: mergeNotes,
      
      // معلومات الإنشاء
      createdBy: req.user._id,
      createdByName: req.user.name || req.user.email,
      
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mergedOrder = new Order(mergedOrderData);
    await mergedOrder.save({ session });

    // =========================
    // 9️⃣ تحديث الطلبات الأصلية
    // =========================
    
    // تحديث طلب المورد
    supplierOrder.mergeStatus = 'مدمج';
    supplierOrder.status = 'تم دمجه مع العميل';
    supplierOrder.mergedWithOrderId = mergedOrder._id;
    supplierOrder.mergedWithInfo = {
      orderNumber: customerOrder.orderNumber,
      partyName: customerOrder.customerName,
      partyType: 'عميل',
      mergedAt: new Date(),
      mergedBy: req.user.name || req.user.email,
      mergedOrderNumber: mergedOrder.orderNumber
    };
    supplierOrder.mergedAt = new Date();
    supplierOrder.updatedAt = new Date();
    supplierOrder.notes = (supplierOrder.notes || '') + 
      `\n[${new Date().toLocaleString('ar-SA')}] تم دمجه مع طلب العميل: ${customerOrder.orderNumber} (${customerOrder.customerName})`;
    
    await supplierOrder.save({ session });

    // تحديث طلب العميل
    customerOrder.mergeStatus = 'مدمج';
    customerOrder.status = 'تم دمجه مع المورد';
    customerOrder.mergedWithOrderId = mergedOrder._id;
    customerOrder.mergedWithInfo = {
      orderNumber: supplierOrder.orderNumber,
      partyName: supplierOrder.supplierName,
      partyType: 'مورد',
      mergedAt: new Date(),
      mergedBy: req.user.name || req.user.email,
      mergedOrderNumber: mergedOrder.orderNumber
    };
    customerOrder.supplierOrderNumber = supplierOrder.supplierOrderNumber;
    customerOrder.mergedAt = new Date();
    customerOrder.updatedAt = new Date();
    customerOrder.notes = (customerOrder.notes || '') + 
      `\n[${new Date().toLocaleString('ar-SA')}] تم دمجه مع طلب المورد: ${supplierOrder.orderNumber} (${supplierOrder.supplierName})`;
    
    await customerOrder.save({ session });

    // =========================
    // 🔟 تسجيل النشاطات
    // =========================
    try {
      // نشاط للطلب المدموج
      const mergedActivity = new Activity({
        orderId: mergedOrder._id,
        activityType: 'دمج',
        description: `تم دمج طلب المورد ${supplierOrder.orderNumber} مع طلب العميل ${customerOrder.orderNumber}`,
        details: {
          supplierOrder: supplierOrder.orderNumber,
          customerOrder: customerOrder.orderNumber,
          mergedOrder: mergedOrder.orderNumber,
          mergedBy: req.user.name || req.user.email,
          quantity: customerQty,
          fuelType: supplierOrder.fuelType,
          totalPrice: mergedOrder.totalPrice
        },
        performedBy: req.user._id,
        performedByName: req.user.name || req.user.email,
      });
      await mergedActivity.save({ session });

      // نشاط لطلب المورد
      const supplierActivity = new Activity({
        orderId: supplierOrder._id,
        activityType: 'دمج',
        description: `تم دمج الطلب مع طلب العميل ${customerOrder.orderNumber} (${customerOrder.customerName})`,
        details: {
          mergedOrder: mergedOrder.orderNumber,
          customerOrder: customerOrder.orderNumber,
          customerName: customerOrder.customerName,
          mergedBy: req.user.name || req.user.email,
          quantityUsed: customerQty,
          remainingQuantity: supplierQty - customerQty
        },
        performedBy: req.user._id,
        performedByName: req.user.name || req.user.email,
      });
      await supplierActivity.save({ session });

      // نشاط لطلب العميل
      const customerActivity = new Activity({
        orderId: customerOrder._id,
        activityType: 'دمج',
        description: `تم دمج الطلب مع طلب المورد ${supplierOrder.orderNumber} (${supplierOrder.supplierName})`,
        details: {
          mergedOrder: mergedOrder.orderNumber,
          supplierOrder: supplierOrder.orderNumber,
          supplierName: supplierOrder.supplierName,
          mergedBy: req.user.name || req.user.email,
          quantity: customerQty,
          unitPrice: supplierOrder.unitPrice,
          totalPrice: mergedOrder.totalPrice
        },
        performedBy: req.user._id,
        performedByName: req.user.name || req.user.email,
      });
      await customerActivity.save({ session });

    } catch (err) {
      console.warn('⚠️ بعض النشاطات لم يتم حفظها:', err.message);
    }

    // =========================
    // 📧 جلب جميع المستخدمين المسجلين من نموذج User
    // =========================
    const User = mongoose.model('User');
    const allUsers = await User.find({
      email: { $exists: true, $ne: '' }
    }).select('name email role company').lean();

    console.log(`📋 جاري إرسال بريد الدمج إلى ${allUsers.length} مستخدم مسجل`);

    // =========================
    // 📧 إنشاء قالب البريد الإلكتروني الشامل
    // =========================
    const createMergeEmailTemplate = () => {
      const formatDate = (date) => {
        if (!date) return 'غير محدد';
        const d = new Date(date);
        return d.toLocaleDateString('ar-SA', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      const formatTime = (time) => time || 'غير محدد';
      
      const formatCurrency = (amount) => {
        if (!amount) return '0.00 ريال';
        return amount.toLocaleString('ar-SA', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }) + ' ريال';
      };

      const formatRole = (role) => {
        const roles = {
          'admin': 'مدير النظام',
          'employee': 'موظف',
          'viewer': 'مشاهد'
        };
        return roles[role] || role;
      };

      return `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>📊 إشعار دمج طلبات</title>
         <style>
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    body {
        background-color: #f5f7fa;
        line-height: 1.6;
        color: #333;
    }
    
    .email-container {
        max-width: 900px;
        margin: 30px auto;
        background-color: #ffffff;
        border-radius: 15px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    }
    
    .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 40px 30px;
        text-align: center;
        border-bottom: 5px solid #4a5568;
    }
    
    .header h1 {
        font-size: 28px;
        margin-bottom: 10px;
        font-weight: 700;
    }
    
    .header .subtitle {
        font-size: 16px;
        opacity: 0.9;
        margin-top: 5px;
    }
    
    .order-number {
        background: #4CAF50;
        color: white;
        padding: 8px 20px;
        border-radius: 25px;
        display: inline-block;
        margin-top: 15px;
        font-weight: bold;
        font-size: 18px;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
    }
    
    .content {
        padding: 40px;
    }
    
    .user-badge {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        margin-bottom: 30px;
    }
    
    .user-badge h3 {
        font-size: 22px;
        margin-bottom: 10px;
    }
    
    .user-count {
        font-size: 28px;
        font-weight: bold;
        margin: 10px 0;
    }
    
    .section {
        margin-bottom: 35px;
        padding: 25px;
        border-radius: 10px;
        background-color: #f8f9fa;
        border-left: 5px solid #667eea;
    }
    
    .section-title {
        color: #2d3748;
        font-size: 20px;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e2e8f0;
        font-weight: 600;
    }
    
    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 15px;
    }
    
    .info-item {
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.08);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        border-top: 4px solid transparent;
    }
    
    .info-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    
    .info-label {
        color: #718096;
        font-size: 14px;
        margin-bottom: 8px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .info-value {
        color: #2d3748;
        font-size: 17px;
        font-weight: 600;
        margin-bottom: 12px;
    }
    
    .info-details {
        font-size: 13px;
        color: #4a5568;
        line-height: 1.5;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #e2e8f0;
    }
    
    .info-details div {
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .info-details strong {
        color: #2d3748;
        min-width: 90px;
        font-size: 12px;
    }
    
    .highlight {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        color: white;
        padding: 25px;
        border-radius: 10px;
        text-align: center;
        margin: 30px 0;
    }
    
    .highlight h3 {
        font-size: 22px;
        margin-bottom: 10px;
    }
    
    .footer {
        background: #2d3748;
        color: white;
        padding: 25px;
        text-align: center;
        margin-top: 40px;
        border-top: 5px solid #4a5568;
    }
    
    .footer p {
        margin: 10px 0;
        opacity: 0.8;
    }
    
    .logo {
        font-size: 24px;
        font-weight: bold;
        color: #667eea;
        margin-bottom: 10px;
    }
    
    .timeline {
        position: relative;
        padding: 20px 0;
    }
    
    .timeline-item {
        position: relative;
        padding-left: 30px;
        margin-bottom: 20px;
    }
    
    .timeline-item:before {
        content: '';
        position: absolute;
        left: 0;
        top: 5px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #667eea;
    }
    
    .timeline-item:after {
        content: '';
        position: absolute;
        left: 5px;
        top: 5px;
        width: 2px;
        height: 100%;
        background: #e2e8f0;
    }
    
    .timeline-item:last-child:after {
        display: none;
    }
    
    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        margin-right: 8px;
    }
    
    .status-completed {
        background: #d4edda;
        color: #155724;
    }
    
    .status-active {
        background: #d1ecf1;
        color: #0c5460;
    }
    
    .status-merged {
        background: #e2e3e5;
        color: #383d41;
    }
    
    .payment-status {
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        display: inline-block;
    }
    
    .payment-paid {
        background: #d4edda;
        color: #155724;
    }
    
    .payment-partial {
        background: #fff3cd;
        color: #856404;
    }
    
    .payment-pending {
        background: #f8d7da;
        color: #721c24;
    }
    
    .icon {
        font-size: 14px;
        margin-right: 5px;
    }
    
    .supplier-item {
        border-top-color: #1890ff;
    }
    
    .customer-item {
        border-top-color: #52c41a;
    }
    
    .driver-item {
        border-top-color: #fa8c16;
    }
    
    .product-item {
        border-top-color: #722ed1;
    }
    
    .timing-item {
        border-top-color: #13c2c2;
    }
    
    .payment-item {
        border-top-color: #fa541c;
    }
    
    .compact-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }
    
    .compact-item {
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
    
    @media (max-width: 768px) {
        .content {
            padding: 20px;
        }
        
        .header {
            padding: 30px 20px;
        }
        
        .header h1 {
            font-size: 22px;
        }
        
        .info-grid {
            grid-template-columns: 1fr;
            gap: 15px;
        }
        
        .info-item {
            padding: 15px;
        }
        
        .compact-grid {
            grid-template-columns: 1fr;
            gap: 10px;
        }
        
        .user-count {
            font-size: 24px;
        }
        
        .section-title {
            font-size: 18px;
        }
        
        .info-value {
            font-size: 16px;
        }
        
        .info-details {
            font-size: 12px;
        }
    }
    
    @media (max-width: 480px) {
        .email-container {
            margin: 10px;
            border-radius: 10px;
        }
        
        .header {
            padding: 20px 15px;
        }
        
        .content {
            padding: 15px;
        }
        
        .section {
            padding: 15px;
            margin-bottom: 25px;
        }
        
        .info-details div {
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
        }
        
        .info-details strong {
            min-width: auto;
        }
    }
    
    .contact-info {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 15px;
        margin-top: 15px;
        border-left: 4px solid #4CAF50;
    }
    
    .contact-info h4 {
        margin-bottom: 10px;
        color: #2d3748;
        font-size: 16px;
    }
    
    .qr-code {
        text-align: center;
        margin: 20px 0;
        padding: 20px;
        background: white;
        border-radius: 10px;
        border: 2px dashed #cbd5e0;
    }
    
    .qr-code h4 {
        margin-bottom: 15px;
        color: #4a5568;
    }
</style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <h1>📊 إشعار دمج طلبات</h1>
                    <p class="subtitle"></p>
                    <div class="order-number">${mergedOrder.orderNumber}</div>
                </div>
                
                <div class="content">
                    <div class="user-badge">
                        <h3></h3>
                        <div class="user-count">${allUsers.length} مستخدم</div>
                        <p></p>
                    </div>
                    
                  <div class="section">
    <h2 class="section-title">📋 ملخص عملية الدمج</h2>
    <div class="info-grid">
        <div class="info-item">
            <div class="info-label">تاريخ الدمج</div>
            <div class="info-value">${formatDate(new Date())}</div>
        </div>
        <div class="info-item">
            <div class="info-label">تم الدمج بواسطة</div>
            <div class="info-value">${req.user.name || req.user.email}</div>
        </div>
        <div class="info-item">
            <div class="info-label">حالة الدمج</div>
            <div class="info-value">
                <span class="status-badge status-completed">✅ تم بنجاح</span>
            </div>
        </div>
        <div class="info-item">
            <div class="info-label">رقم الطلب المدموج</div>
            <div class="info-value">${mergedOrder.orderNumber}</div>
        </div>
        
        <!-- بيانات المورد -->
        <div class="info-item" style="background: #f0f9ff; border-right: 4px solid #1890ff;">
            <div class="info-label">🏭 المورد</div>
            <div class="info-value">${supplierOrder.supplierName || 'غير محدد'}</div>
            <div style="margin-top: 8px; font-size: 13px; color: #4a5568;">
                ${supplierOrder.supplierCompany ? `<div><strong>الشركة:</strong> ${supplierOrder.supplierCompany}</div>` : ''}
                ${supplierOrder.supplierContactPerson ? `<div><strong>الشخص المسؤول:</strong> ${supplierOrder.supplierContactPerson}</div>` : ''}
                ${supplierOrder.supplierPhone ? `<div><strong>📞 الهاتف:</strong> ${supplierOrder.supplierPhone}</div>` : ''}
                ${supplierOrder.supplier?.email ? `<div><strong>✉️ الإيميل:</strong> ${supplierOrder.supplier.email}</div>` : ''}
                ${supplierOrder.supplierOrderNumber ? `<div><strong>رقم طلب المورد:</strong> ${supplierOrder.supplierOrderNumber}</div>` : ''}
            </div>
        </div>
        
        <!-- بيانات العميل -->
        <div class="info-item" style="background: #f0fff4; border-right: 4px solid #52c41a;">
            <div class="info-label">👤 العميل</div>
            <div class="info-value">${customerOrder.customerName || 'غير محدد'}</div>
            <div style="margin-top: 8px; font-size: 13px; color: #4a5568;">
                ${customerOrder.customerCode ? `<div><strong>الكود:</strong> ${customerOrder.customerCode}</div>` : ''}
                ${customerOrder.customerPhone ? `<div><strong>📞 الهاتف:</strong> ${customerOrder.customerPhone}</div>` : ''}
                ${customerOrder.customer?.email ? `<div><strong>✉️ الإيميل:</strong> ${customerOrder.customer.email}</div>` : ''}
                ${customerOrder.requestType ? `<div><strong>نوع الطلب:</strong> ${customerOrder.requestType}</div>` : ''}
                <div><strong>الموقع:</strong> ${city || 'غير محدد'} - ${area || 'غير محدد'}</div>
            </div>
        </div>
        
        <!-- بيانات السائق -->
        <div class="info-item" style="background: #fff7e6; border-right: 4px solid #fa8c16;">
            <div class="info-label">🚚 السائق</div>
            <div class="info-value">${supplierOrder.driverName || 'لم يتم التحديد بعد'}</div>
            <div style="margin-top: 8px; font-size: 13px; color: #4a5568;">
                ${supplierOrder.driverPhone ? `<div><strong>📞 الهاتف:</strong> ${supplierOrder.driverPhone}</div>` : ''}
                ${supplierOrder.vehicleNumber ? `<div><strong>رقم المركبة:</strong> ${supplierOrder.vehicleNumber}</div>` : ''}
                ${supplierOrder.driver ? `
                    <div><strong>أجر السائق:</strong> ${supplierOrder.driverEarnings ? formatCurrency(supplierOrder.driverEarnings) : 'غير محدد'}</div>
                ` : ''}
                ${supplierOrder.deliveryDuration ? `<div><strong>مدة التوصيل:</strong> ${supplierOrder.deliveryDuration}</div>` : ''}
                ${supplierOrder.distance ? `<div><strong>المسافة:</strong> ${supplierOrder.distance} كم</div>` : ''}
            </div>
        </div>
        
        <!-- معلومات المنتج والكمية -->
        <div class="info-item" style="background: #f9f0ff; border-right: 4px solid #722ed1;">
            <div class="info-label">⛽ المنتج</div>
            <div class="info-value">${supplierOrder.fuelType || 'غير محدد'}</div>
            <div style="margin-top: 8px; font-size: 13px; color: #4a5568;">
                <div><strong>نوع المنتج:</strong> ${supplierOrder.productType || 'غير محدد'}</div>
                <div><strong>الكمية المدموجة:</strong> ${customerQty} ${supplierOrder.unit || 'لتر'}</div>
                <div><strong>السعر للوحدة:</strong> ${formatCurrency(supplierOrder.unitPrice)}</div>
                <div><strong>القيمة الإجمالية:</strong> ${formatCurrency(mergedOrder.totalPrice)}</div>
            </div>
        </div>
        
        <!-- معلومات التوقيت -->
        <div class="info-item" style="background: #e6fffb; border-right: 4px solid #13c2c2;">
            <div class="info-label">⏰ مواعيد التسليم</div>
            <div style="margin-top: 5px; font-size: 13px;">
                <div style="margin-bottom: 10px; padding: 8px; background: white; border-radius: 6px;">
                    <div><strong>التحميل:</strong></div>
                    <div>${formatDate(supplierOrder.loadingDate)}</div>
                    <div>${supplierOrder.loadingTime}</div>
                </div>
                <div style="padding: 8px; background: white; border-radius: 6px;">
                    <div><strong>الوصول المتوقع:</strong></div>
                    <div>${formatDate(customerOrder.arrivalDate)}</div>
                    <div>${customerOrder.arrivalTime}</div>
                </div>
            </div>
        </div>
        
        <!-- معلومات الدفع -->
        <div class="info-item" style="background: #fff2e8; border-right: 4px solid #fa541c;">
            <div class="info-label">💳 معلومات الدفع</div>
            <div style="margin-top: 8px; font-size: 13px; color: #4a5568;">
                <div><strong>طريقة الدفع:</strong> ${supplierOrder.paymentMethod || 'غير محدد'}</div>
                <div><strong>حالة الدفع:</strong> 
                    <span style="
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                        ${supplierOrder.paymentStatus === 'مدفوع' ? 'background: #d4edda; color: #155724;' : 
                          supplierOrder.paymentStatus === 'جزئي' ? 'background: #fff3cd; color: #856404;' : 
                          'background: #f8d7da; color: #721c24;'}
                    ">
                        ${supplierOrder.paymentStatus || 'غير محدد'}
                    </span>
                </div>
                <div><strong>المبلغ الإجمالي:</strong> ${formatCurrency(mergedOrder.totalPrice)}</div>
                <div><strong>تاريخ الاستحقاق:</strong> ${formatDate(mergedOrder.orderDate)}</div>
            </div>
        </div>
    </div>
</div>
                    
                    <div class="section">
                        <h2 class="section-title">🔄 تفاصيل الطلبات المدمجة</h2>
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">📦 طلب المورد</div>
                                <div class="info-value">${supplierOrder.orderNumber}</div>
                                <div style="margin-top: 8px; font-size: 14px; color: #4a5568;">
                                    <div><strong>المورد:</strong> ${supplierOrder.supplierName}</div>
                                    <div><strong>الشركة:</strong> ${supplierOrder.supplierCompany || 'غير محدد'}</div>
                                    <div><strong>الكمية الأصلية:</strong> ${supplierQty} ${supplierOrder.unit || 'لتر'}</div>
                                    <div><strong>الحالة:</strong> <span class="status-badge status-merged">تم الدمج</span></div>
                                    ${supplierOrder.supplierOrderNumber ? 
                                        `<div><strong>رقم طلب المورد:</strong> ${supplierOrder.supplierOrderNumber}</div>` : ''}
                                </div>
                            </div>
                            
                            <div class="info-item">
                                <div class="info-label">👤 طلب العميل</div>
                                <div class="info-value">${customerOrder.orderNumber}</div>
                                <div style="margin-top: 8px; font-size: 14px; color: #4a5568;">
                                    <div><strong>العميل:</strong> ${customerOrder.customerName}</div>
                                    <div><strong>الكود:</strong> ${customerOrder.customerCode || 'غير محدد'}</div>
                                    <div><strong>الكمية المطلوبة:</strong> ${customerQty} ${customerOrder.unit || supplierOrder.unit || 'لتر'}</div>
                                    <div><strong>نوع الطلب:</strong> ${customerOrder.requestType || 'غير محدد'}</div>
                                    <div><strong>الحالة:</strong> <span class="status-badge status-merged">تم الدمج</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="highlight">
                        <h3>💰 القيمة الإجمالية للطلب المدموج</h3>
                        <p style="font-size: 32px; font-weight: bold; margin: 10px 0;">
                            ${formatCurrency(mergedOrder.totalPrice)}
                        </p>
                        <p>${customerQty} ${supplierOrder.unit || 'لتر'} × ${formatCurrency(supplierOrder.unitPrice)}</p>
                    </div>
                    
                    <div class="section">
                        <h2 class="section-title">⛽ تفاصيل المنتج</h2>
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">نوع المنتج</div>
                                <div class="info-value">${supplierOrder.productType || 'غير محدد'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">نوع الوقود</div>
                                <div class="info-value">${supplierOrder.fuelType || 'غير محدد'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">الكمية المدموجة</div>
                                <div class="info-value">${customerQty} ${supplierOrder.unit || 'لتر'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">الوحدة</div>
                                <div class="info-value">${supplierOrder.unit || 'لتر'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2 class="section-title">📍 معلومات التوصيل</h2>
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">الموقع</div>
                                <div class="info-value">${city} - ${area}</div>
                                ${address ? `<div style="margin-top: 5px; font-size: 14px; color: #718096;">${address}</div>` : ''}
                            </div>
                            <div class="info-item">
                                <div class="info-label">مواعيد التسليم</div>
                                <div style="margin-top: 5px;">
                                    <div style="margin-bottom: 8px;">
                                        <strong style="color: #2d3748;">التحميل:</strong><br>
                                        ${formatDate(supplierOrder.loadingDate)} - ${supplierOrder.loadingTime}
                                    </div>
                                    <div>
                                        <strong style="color: #2d3748;">الوصول المتوقع:</strong><br>
                                        ${formatDate(customerOrder.arrivalDate)} - ${customerOrder.arrivalTime}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${mergeNotes ? `
                    <div class="section">
                        <h2 class="section-title">📝 ملاحظات الدمج</h2>
                        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-right: 4px solid #1890ff;">
                            <p style="font-size: 15px; line-height: 1.6; color: #2c5282;">${mergeNotes}</p>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="section">
                        <h2 class="section-title">👥 معلومات الجهات المعنية</h2>
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">🏭 معلومات المورد</div>
                                <div style="margin-top: 8px; font-size: 14px; color: #4a5568;">
                                    <div><strong>الشخص المسؤول:</strong> ${supplierOrder.supplierContactPerson || 'غير محدد'}</div>
                                    ${supplierOrder.supplierPhone ? `<div><strong>📞 الهاتف:</strong> ${supplierOrder.supplierPhone}</div>` : ''}
                                    ${supplierOrder.supplier?.email ? `<div><strong>✉️ الإيميل:</strong> ${supplierOrder.supplier.email}</div>` : ''}
                                </div>
                            </div>
                            
                            <div class="info-item">
                                <div class="info-label">👤 معلومات العميل</div>
                                <div style="margin-top: 8px; font-size: 14px; color: #4a5568;">
                                    ${customerOrder.customerPhone ? `<div><strong>📞 الهاتف:</strong> ${customerOrder.customerPhone}</div>` : ''}
                                    ${customerOrder.customer?.email ? `<div><strong>✉️ الإيميل:</strong> ${customerOrder.customer.email}</div>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2 class="section-title">⏰ الجدول الزمني</h2>
                        <div class="timeline">
                            <div class="timeline-item">
                                <strong>وقت التحميل:</strong><br>
                                ${formatDate(supplierOrder.loadingDate)} - ${supplierOrder.loadingTime}
                            </div>
                            <div class="timeline-item">
                                <strong>وقت الوصول المتوقع:</strong><br>
                                ${formatDate(customerOrder.arrivalDate)} - ${customerOrder.arrivalTime}
                            </div>
                            <div class="timeline-item">
                                <strong>تاريخ إنشاء الطلب المدموج:</strong><br>
                                ${formatDate(new Date())} - ${new Date().toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center; border: 2px dashed #cbd5e0;">
                        <p style="color: #4a5568; font-size: 15px;">
                            📊 <strong>تتبع الطلب:</strong> يمكنك تتبع حالة هذا الطلب المدموج عبر لوحة التحكم في النظام
                        </p>
                        <p style="color: #718096; font-size: 13px; margin-top: 10px;">
                            هذه عملية تلقائية، لا حاجة للرد على هذا البريد
                        </p>
                    </div>
                </div>
                
                <div class="footer">
                    <div class="logo">شركة البحيرة العربية نظام ادارة الطلبات</div>
                    <p>تم إرسال هذه الرسالة تلقائيًا إلى جميع المستخدمين المسجلين في النظام</p>
                    <p>📧 إجمالي المستلمين: <strong>${allUsers.length} مستخدم</strong></p>
                    <p>© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
                    <p style="font-size: 12px; opacity: 0.6; margin-top: 15px;">
                        هذا إشعار نظامي، يرجى عدم الرد على هذا البريد الإلكتروني
                    </p>
                </div>
            </div>
        </body>
        </html>
      `;
    };

    // =========================
    // 📧 إرسال البريد لجميع المستخدمين المسجلين
    // =========================
    let emailStats = {
      totalUsers: allUsers.length,
      sent: 0,
      failed: 0,
      failedEmails: []
    };

    try {
      if (allUsers.length > 0) {
        // تجميع جميع عناوين البريد
        const allUserEmails = allUsers.map(user => user.email).filter(email => email && email.includes('@'));
        
        if (allUserEmails.length > 0) {
          const emailTemplate = createMergeEmailTemplate();
          
          // طريقة 1: إرسال بريد واحد إلى الجميع (BCC)
          await sendEmail({
            to: [], // لا نضع مستلم رئيسي
            bcc: allUserEmails, // جميع المستخدمين كمستلمين مخفيين
            subject: `📊 إشعار دمج طلبات: ${supplierOrder.orderNumber} ↔ ${customerOrder.orderNumber} (مرسل لـ ${allUserEmails.length} مستخدم)`,
            html: emailTemplate
          });
          
          emailStats.sent = allUserEmails.length;
          console.log(`✅ تم إرسال بريد الدمج إلى ${allUserEmails.length} مستخدم`);
          
          // طريقة بديلة: إرسال لكل مستخدم بشكل منفصل (اختياري)
          /*
          const emailPromises = allUserEmails.map(email => 
            sendEmail({
              to: email,
              subject: `📊 إشعار دمج طلبات: ${supplierOrder.orderNumber} ↔ ${customerOrder.orderNumber}`,
              html: emailTemplate
            }).catch(err => {
              console.error(`❌ فشل إرسال إلى ${email}:`, err.message);
              emailStats.failed++;
              emailStats.failedEmails.push(email);
              return null;
            })
          );
          
          await Promise.allSettled(emailPromises);
          emailStats.sent = allUserEmails.length - emailStats.failed;
          */
        } else {
          console.warn('⚠️ لم يتم العثور على عناوين بريد صالحة للمستخدمين');
        }
      }

      // إرسال بريد إضافي للمورد والعميل (إن وجد)
      const additionalEmails = [];
      
      // بريد المورد
      if (supplierOrder.supplier?.email) {
        additionalEmails.push({
          email: supplierOrder.supplier.email,
          name: supplierOrder.supplierName,
          type: 'مورد'
        });
      }
      
      // بريد العميل
      if (customerOrder.customer?.email) {
        additionalEmails.push({
          email: customerOrder.customer.email,
          name: customerOrder.customerName,
          type: 'عميل'
        });
      }
      
      // إرسال بريد خاص للمورد والعميل
      for (const recipient of additionalEmails) {
        try {
          const personalizedTemplate = `
            <div dir="rtl" style="font-family: Arial; padding:20px">
              <h2>${recipient.type === 'مورد' ? '✅ تأكيد دمج طلبك' : '✅ تأكيد تخصيص مورد'}</h2>
              <p>عزيزي ${recipient.name},</p>
              <p>${recipient.type === 'مورد' 
                ? `تم دمج طلبك <strong>${supplierOrder.orderNumber}</strong> مع طلب العميل <strong>${customerOrder.orderNumber}</strong> بنجاح.` 
                : `تم تخصيص مورد لطلبك <strong>${customerOrder.orderNumber}</strong> بنجاح.`}</p>
              <div style="background:#f0f8ff; padding:15px; margin:15px 0; border-radius:8px">
                <p><strong>الطلب المدموج:</strong> ${mergedOrder.orderNumber}</p>
                <p><strong>${recipient.type === 'مورد' ? 'العميل' : 'المورد'}:</strong> ${recipient.type === 'مورد' ? customerOrder.customerName : supplierOrder.supplierName}</p>
                <p><strong>الكمية:</strong> ${customerQty} ${supplierOrder.unit || 'لتر'}</p>
                <p><strong>القيمة:</strong> ${formatCurrency(mergedOrder.totalPrice)}</p>
              </div>
              <p>تم إرسال إشعار عام لهذا الدمج إلى جميع المستخدمين المسجلين في النظام.</p>
            </div>
          `;
          
          await sendEmail({
            to: recipient.email,
            subject: recipient.type === 'مورد' 
              ? `✅ تم دمج طلبك ${supplierOrder.orderNumber} مع عميل` 
              : `✅ تم تخصيص مورد لطلبك ${customerOrder.orderNumber}`,
            html: personalizedTemplate
          });
          
          console.log(`📧 تم إرسال بريد إضافي إلى ${recipient.type}: ${recipient.email}`);
        } catch (error) {
          console.error(`❌ فشل إرسال بريد إضافي إلى ${recipient.type} ${recipient.email}:`, error.message);
        }
      }

    } catch (emailError) {
      console.error('❌ فشل إرسال بريد الدمج:', emailError.message);
      emailStats.failed = allUsers.length;
    }

    // =========================
    // ✅ تأكيد العملية
    // =========================
    await session.commitTransaction();
    session.endSession();

    // =========================
    // 📊 الاستجابة
    // =========================
    return res.status(200).json({
      success: true,
      message: `تم دمج الطلبات بنجاح وإرسال الإشعار إلى ${emailStats.sent} مستخدم`,
      data: {
        mergedOrder: {
          _id: mergedOrder._id,
          orderNumber: mergedOrder.orderNumber,
          status: mergedOrder.status,
          mergeStatus: mergedOrder.mergeStatus,
          supplierName: mergedOrder.supplierName,
          customerName: mergedOrder.customerName,
          quantity: mergedOrder.quantity,
          unit: mergedOrder.unit,
          fuelType: mergedOrder.fuelType,
          totalPrice: mergedOrder.totalPrice,
          createdAt: mergedOrder.createdAt
        },
        emailStats: {
          totalUsers: emailStats.totalUsers,
          emailsSent: emailStats.sent,
          emailsFailed: emailStats.failed,
          sentToAllUsers: emailStats.sent > 0,
          percentage: emailStats.totalUsers > 0 ? Math.round((emailStats.sent / emailStats.totalUsers) * 100) : 0
        },
        timestamp: new Date().toISOString(),
        mergeDetails: {
          supplierOrder: supplierOrder.orderNumber,
          customerOrder: customerOrder.orderNumber,
          mergedOrder: mergedOrder.orderNumber,
          mergedBy: req.user.name || req.user.email
        }
      }
    });

  } catch (error) {
    // =========================
    // ❌ معالجة الأخطاء
    // =========================
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ Error merging orders:', error);
    
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء دمج الطلبات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// دالة مساعدة لتنسيق العملة
function formatCurrency(amount) {
  if (!amount) return '0.00 ريال';
  return amount.toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' ريال';
}


// ============================================
// 🗑️ حذف الطلب
// ============================================

exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email')
      .populate('supplier', 'name email contactPerson')
      .populate('createdBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    // السماح فقط للإداريين بالحذف
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح بحذف الطلب' });
    }

    // التحقق من حالة الدمج
    if (order.mergeStatus === 'مدمج') {
      return res.status(400).json({ 
        error: 'لا يمكن حذف طلب مدمج. الرجاء فك الدمج أولاً.' 
      });
    }

    // إرسال إيميل قبل الحذف
    try {
      const emails = await getOrderEmails(order);

      if (!emails || emails.length === 0) {
        console.log(`⚠️ No valid emails for order deletion - order ${order.orderNumber}`);
      } else {
        await sendEmail({
          to: emails,
          subject: `🗑️ تم حذف الطلب ${order.orderNumber}`,
          html: EmailTemplates.orderDeletedTemplate(order, req.user.name),
        });
      }
    } catch (emailError) {
      console.error('❌ Failed to send delete order email:', emailError.message);
    }

    const deleteFile = (filePath) => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Failed to delete file: ${filePath}`, err);
        }
      }
    };

    order.attachments.forEach((attachment) => {
      deleteFile(attachment.path);
    });

    order.supplierDocuments.forEach((doc) => {
      deleteFile(doc.path);
    });

    order.customerDocuments.forEach((doc) => {
      deleteFile(doc.path);
    });

    const activity = new Activity({
      orderId: order._id,
      activityType: 'حذف',
      description: `تم حذف الطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'رقم الطلب': order.orderNumber,
        'نوع الطلب': order.orderSource === 'عميل' ? 'طلب عميل' : 'طلب مورد',
        'العميل': order.customerName,
        'المورد': order.supplierName,
      },
    });
    await activity.save();

    await Order.findByIdAndDelete(req.params.id);

    return res.json({
      message: 'تم حذف الطلب بنجاح',
      orderNumber: order.orderNumber
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    return res.status(500).json({ error: 'حدث خطأ في حذف الطلب' });
  }
};



exports.deleteAttachment = async (req, res) => {
  try {
    const { orderId, attachmentId, docType } = req.params;

    const order = await Order.findById(orderId)
      .populate('customer', 'name email')
      .populate('createdBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    let attachment = null;
    let collection = null;

    if (docType === 'supplier') {
      collection = order.supplierDocuments;
    } else if (docType === 'customer') {
      collection = order.customerDocuments;
    } else {
      collection = order.attachments;
    }

    attachment = collection.id(attachmentId);
    
    if (!attachment) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }

    try {
      const emails = await getOrderEmails(order);

      if (!emails || emails.length === 0) {
        console.log(`⚠️ No valid emails for attachment deletion - order ${order.orderNumber}`);
      } else {
        await sendEmail({
          to: emails,
          subject: `📎 حذف مرفق من الطلب ${order.orderNumber}`,
          html: EmailTemplates.attachmentDeletedTemplate(order, attachment.filename, req.user.name, docType),
        });
      }
    } catch (emailError) {
      console.error('❌ Failed to send attachment delete email:', emailError.message);
    }


    if (fs.existsSync(attachment.path)) {
      fs.unlinkSync(attachment.path);
    }


    collection.pull(attachmentId);
    await order.save();


    const activity = new Activity({
      orderId: order._id,
      activityType: 'حذف',
      description: `تم حذف مرفق من الطلب رقم ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'اسم الملف': attachment.filename,
        'نوع الملف': docType === 'supplier' ? 'مستند مورد' : docType === 'customer' ? 'مستند عميل' : 'مرفق عام'
      },
    });
    await activity.save();

    return res.json({
      message: 'تم حذف الملف بنجاح',
      fileName: attachment.filename,
      docType
    });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return res.status(500).json({ error: 'حدث خطأ في حذف الملف' });
  }
};



const { safeSendEmail } = require('../services/emailQueue');

exports.checkArrivalNotifications = async () => {
  try {
    const now = new Date();

    const orders = await Order.find({
      status: { $in: ['جاهز للتحميل', 'في انتظار التحميل', 'مخصص للعميل', 'في الطريق'] },
      arrivalNotificationSentAt: { $exists: false },
    })
      .populate('customer', 'name email')
      .populate('supplier', 'name email contactPerson')
      .populate('createdBy', 'name email');

    if (!orders.length) {
      return;
    }

    const User = require('../models/User');
    const Notification = require('../models/Notification');


    const adminUsers = await User.find({
      role: { $in: ['admin', 'manager'] },
      isActive: true,
    });

    for (const order of orders) {
      try {
        const notificationTime = order.getArrivalNotificationTime();

        if (now < notificationTime) {
          continue;
        }

        if (adminUsers.length > 0) {
          const notification = new Notification({
            type: 'arrival_reminder',
            title: 'تذكير بقرب وقت الوصول',
            message: `الطلب رقم ${order.orderNumber} (${order.customerName}) سيصل خلال ساعتين ونصف`,
            data: {
              orderId: order._id,
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              expectedArrival: `${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}`,
              supplierName: order.supplierName,
              auto: true,
            },
            recipients: adminUsers.map((user) => ({ user: user._id })),
            createdBy: order.createdBy?._id,
          });

          await notification.save();
        }


        try {
          const arrivalDateTime = order.getFullArrivalDateTime();
          const timeRemainingMs = arrivalDateTime - now;
          const timeRemaining = formatDuration(timeRemainingMs);

          const emails = await getOrderEmails(order);

          if (emails && emails.length > 0) {
            await safeSendEmail(() =>
              sendEmail({
                to: emails,
                subject: `⏰ تذكير بوصول الطلب ${order.orderNumber}`,
                html: EmailTemplates.arrivalReminderTemplate(order, timeRemaining),
              })
            );
          } else {
            console.log(`⚠️ No valid emails for arrival reminder - order ${order.orderNumber}`);
          }
        } catch (emailError) {
          console.error(
            `❌ Email failed for order ${order.orderNumber}:`,
            emailError.message
          );
        }


        order.arrivalNotificationSentAt = new Date();
        order.arrivalEmailSentAt = new Date();
        await order.save();

        console.log(
          `🔔📧 Arrival notification + email sent for order ${order.orderNumber}`
        );
      } catch (orderError) {
        console.error(
          `❌ Error processing arrival notification for order ${order.orderNumber}:`,
          orderError.message
        );
      }
    }
  } catch (error) {
    console.error('❌ خطأ في التحقق من إشعارات الوصول:', error);
  }
};



exports.checkCompletedLoading = async () => {
  try {
    const now = new Date();

    const orders = await Order.find({
      orderSource: 'مدمج',
      status: {
        $in: [
          'تم الدمج',
          'مخصص للعميل',
          'جاهز للتحميل',
          'في انتظار التحميل',
          'تم التحميل',
          'في الطريق',
          'تم التسليم'
        ]
      },
      completedAt: { $exists: false }
    })
      .populate('customer', 'name email')
      .populate('supplier', 'name email')
      .populate('createdBy', 'name email');

    if (!orders.length) return;

    const User = require('../models/User');
    const Notification = require('../models/Notification');
    const Activity = require('../models/Activity');

    for (const order of orders) {

      if (typeof order.getFullArrivalDateTime !== 'function') continue;

      const arrivalDateTime = order.getFullArrivalDateTime();
      if (!arrivalDateTime) continue;

      if (now < arrivalDateTime) continue;

   
      const oldStatus = order.status;

      order.status = 'تم التنفيذ';
      order.mergeStatus = 'مكتمل';
      order.completedAt = now;
      order.updatedAt = now;

      await order.save();

      console.log(
        `✅ Auto executed merged order ${order.orderNumber} from "${oldStatus}" to "تم التنفيذ"`
      );

      if (order.mergedWithOrderId) {
        const relatedOrders = await Order.find({
          _id: { $ne: order._id },
          mergedWithOrderId: order._id
        });

        for (const related of relatedOrders) {
          if (related.status === 'تم التنفيذ') continue;

          const oldRelatedStatus = related.status;

          related.status = 'تم التنفيذ';
          related.mergeStatus = 'مكتمل';
          related.completedAt = now;
          related.updatedAt = now;

          await related.save();

          console.log(
            `🔁 Related order ${related.orderNumber} auto executed from "${oldRelatedStatus}"`
          );

          await Activity.create({
            orderId: related._id,
            activityType: 'تغيير حالة',
            description: `تم تنفيذ الطلب تلقائيًا بسبب تنفيذ الطلب المدمج ${order.orderNumber}`,
            performedBy: null,
            performedByName: 'النظام',
            changes: {
              الحالة: `من: ${oldRelatedStatus} → إلى: تم التنفيذ`
            }
          });
        }
      }

   
      const adminUsers = await User.find({
        role: { $in: ['admin', 'manager'] },
        isActive: true
      });

      if (adminUsers.length) {
        await Notification.create({
          type: 'execution_completed',
          title: 'تم التنفيذ',
          message: `تم تنفيذ الطلب ${order.orderNumber} تلقائيًا بعد انتهاء وقت التوصيل`,
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            oldStatus,
            newStatus: 'تم التنفيذ',
            auto: true,
            isMerged: true
          },
          recipients: adminUsers.map(u => ({ user: u._id })),
          createdBy: order.createdBy?._id
        });
      }

      await Activity.create({
        orderId: order._id,
        activityType: 'تغيير حالة',
        description: `تم تنفيذ الطلب تلقائيًا بعد انتهاء وقت التوصيل (طلب مدمج)`,
        performedBy: null,
        performedByName: 'النظام',
        changes: {
          الحالة: `من: ${oldStatus} → إلى: تم التنفيذ`
        }
      });

      try {
        const emails = await getOrderEmails(order);
        if (emails && emails.length) {
          await sendEmail({
            to: emails,
            subject: `✅ تم تنفيذ الطلب ${order.orderNumber}`,
            html: EmailTemplates.orderStatusTemplate(
              order,
              oldStatus,
              'تم التنفيذ',
              'النظام'
            )
          });
        }
      } catch (e) {
        console.error(`❌ Email failed for ${order.orderNumber}`, e.message);
      }
    }

  } catch (error) {
    console.error('❌ Error in checkCompletedLoading:', error);
  }
};




exports.getOrderStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const match = {};

    if (startDate || endDate) {
      match.orderDate = {};
      if (startDate) match.orderDate.$gte = new Date(startDate);
      if (endDate) match.orderDate.$lte = new Date(endDate);
    }

    const stats = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSupplierOrders: {
            $sum: { $cond: [{ $eq: ['$orderSource', 'مورد'] }, 1, 0] }
          },
          totalCustomerOrders: {
            $sum: { $cond: [{ $eq: ['$orderSource', 'عميل'] }, 1, 0] }
          },
          totalMergedOrders: {
            $sum: { $cond: [{ $eq: ['$orderSource', 'مدمج'] }, 1, 0] }
          },
          totalQuantity: { $sum: '$quantity' },
          totalPrice: { $sum: '$totalPrice' },
          pendingOrders: {
            $sum: { $cond: [{ $in: ['$status', ['قيد الانتظار', 'في انتظار إنشاء طلب العميل']] }, 1, 0] }
          },
          inProgressOrders: {
  $sum: {
    $cond: [
      {
        $or: [
          { $in: ['$status', ['مخصص للعميل', 'في انتظار التحميل', 'جاهز للتحميل', 'في الطريق']] },
          { $eq: ['$orderSource', 'مدمج'] }
        ]
      },
      1,
      0
    ]
  }
}
,
          completedOrders: {
            $sum: { $cond: [{ $in: ['$status', ['تم التسليم', 'مكتمل']] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'ملغى'] }, 1, 0] }
          }
        }
      }
    ]);

    const cityStats = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalPrice: { $sum: '$totalPrice' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const statusStats = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const productStats = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$productType',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      overall: stats[0] || {
        totalOrders: 0,
        totalSupplierOrders: 0,
        totalCustomerOrders: 0,
        totalMergedOrders: 0,
        totalQuantity: 0,
        totalPrice: 0,
        pendingOrders: 0,
        inProgressOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0
      },
      byCity: cityStats,
      byStatus: statusStats,
      byProduct: productStats,
      period: {
        startDate: startDate || null,
        endDate: endDate || null
      }
    });
  } catch (error) {
    console.error('Error getting order stats:', error);
    res.status(500).json({ error: 'حدث خطأ في جلب الإحصائيات' });
  }
};


exports.advancedSearch = async (req, res) => {
  try {
    const {
      searchType,
      keyword,
      dateField,
      startDate,
      endDate,
      statuses,
      minAmount,
      maxAmount,
      cities,
      areas,
      productTypes,
      fuelTypes,
      paymentStatuses,
      sortBy = 'orderDate',
      sortOrder = 'desc',
      page = 1,
      limit = 50
    } = req.query;

    const filter = {};
    const skip = (page - 1) * limit;

    if (searchType === 'customer') filter.orderSource = 'عميل';
    if (searchType === 'supplier') filter.orderSource = 'مورد';
    if (searchType === 'mixed') filter.orderSource = 'مدمج';

    if (keyword) {
      const r = new RegExp(keyword, 'i');
      filter.$or = [
        { orderNumber: r },
        { customerName: r },
        { supplierName: r },
        { driverName: r },
        { customerCode: r },
        { supplierOrderNumber: r }
      ];
    }

    if (dateField && (startDate || endDate)) {
      filter[dateField] = {};
      if (startDate) filter[dateField].$gte = new Date(startDate);
      if (endDate) filter[dateField].$lte = new Date(endDate);
    }

    if (statuses) {
      filter.status = { $in: Array.isArray(statuses) ? statuses : [statuses] };
    }

    if (minAmount || maxAmount) {
      filter.totalPrice = {};
      if (minAmount) filter.totalPrice.$gte = Number(minAmount);
      if (maxAmount) filter.totalPrice.$lte = Number(maxAmount);
    }

    if (cities) {
      filter.city = { $in: (Array.isArray(cities) ? cities : [cities]).map(c => new RegExp(c, 'i')) };
    }

    if (areas) {
      filter.area = { $in: (Array.isArray(areas) ? areas : [areas]).map(a => new RegExp(a, 'i')) };
    }

    if (productTypes) filter.productType = { $in: [].concat(productTypes) };
    if (fuelTypes) filter.fuelType = { $in: [].concat(fuelTypes) };
    if (paymentStatuses) filter.paymentStatus = { $in: [].concat(paymentStatuses) };

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const orders = await Order.find(filter)
      .populate('customer supplier driver createdBy')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في البحث المتقدم' });
  }
};

exports.updateStatistics = async (req, res) => {
  try {
    const drivers = await Driver.find({ status: 'نشط' });

    for (const driver of drivers) {
      const stats = await Order.aggregate([
        { $match: { driver: driver._id } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalEarnings: { $sum: { $ifNull: ['$driverEarnings', 0] } },
            totalDistance: { $sum: { $ifNull: ['$distance', 0] } },
            avgRating: { $avg: { $ifNull: ['$driverRating', 0] } }
          }
        }
      ]);

      if (stats[0]) {
        Object.assign(driver, {
          totalDeliveries: stats[0].totalOrders,
          totalEarnings: stats[0].totalEarnings,
          totalDistance: stats[0].totalDistance,
          averageRating: stats[0].avgRating || 0
        });
        await driver.save();
      }
    }

    res.json({ success: true, message: 'تم تحديث الإحصائيات بنجاح' });
  } catch (error) {
    console.error('Update statistics error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في تحديث الإحصائيات' });
  }
};



