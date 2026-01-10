const Maintenance = require('../models/Maintenance');
const User = require('../models/User');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment');
const fs = require('fs');
const { sendEmail } = require('../services/emailService');
const path = require('path');

const NOT_DONE_VALUE = 'U,U. USO?U.';
const NOT_DONE_VALUES = new Set([
  NOT_DONE_VALUE,
  'لم يتم',
  '?? ???'
]);
const CHECK_FIELDS = [
  { key: 'vehicleSafety', label: 'فحص سلامة المركبة' },
  { key: 'driverSafety', label: 'فحص سلامة السائق' },
  { key: 'electricalMaintenance', label: 'فحص الصيانة الكهربائية' },
  { key: 'mechanicalMaintenance', label: 'فحص الصيانة الميكانيكية' },
  { key: 'tankInspection', label: 'فحص التانكي' },
  { key: 'tiresInspection', label: 'فحص الإطارات' },
  { key: 'brakesInspection', label: 'فحص الفرامل' },
  { key: 'lightsInspection', label: 'فحص الأضواء' },
  { key: 'fluidsCheck', label: 'فحص السوائل' },
  { key: 'emergencyEquipment', label: 'فحص معدات الطوارئ' }
];

// ===================== قوالب البريد الإلكتروني الاحترافية =====================

const emailTemplates = {
  // القالب الأساسي باللون الكحلي الزجاجي
  baseTemplate: (content) => `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>نظام الصيانة الدورية - شركة البحيرة العربية</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Cairo', sans-serif;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          padding: 20px;
          color: #333;
        }
        
        .email-container {
          max-width: 700px;
          margin: 0 auto;
          background: rgba(30, 58, 138, 0.85);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 15px 35px rgba(30, 58, 138, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .email-header {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          padding: 30px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        
        .header-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0,0 L100,0 L100,100 Z" fill="rgba(255,255,255,0.1)"/></svg>');
          opacity: 0.1;
        }
        
        .company-logo {
          font-size: 28px;
          font-weight: 700;
          color: white;
          margin-bottom: 10px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .system-name {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 300;
          margin-bottom: 15px;
        }
        
        .notification-title {
          font-size: 22px;
          color: white;
          font-weight: 600;
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          display: inline-block;
          margin-top: 10px;
        }
        
        .email-body {
          padding: 40px;
          background: rgba(255, 255, 255, 0.95);
        }
        
        .greeting {
          font-size: 18px;
          color: #1e3a8a;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 2px solid rgba(30, 58, 138, 0.1);
        }
        
        .message-content {
          font-size: 16px;
          line-height: 1.8;
          color: #444;
          margin-bottom: 30px;
        }
        
        .details-card {
          background: white;
          border-radius: 15px;
          padding: 25px;
          margin: 25px 0;
          border-left: 5px solid #3b82f6;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
        }
        
        .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid rgba(30, 58, 138, 0.1);
        }
        
        .detail-item:last-child {
          border-bottom: none;
        }
        
        .detail-label {
          font-weight: 600;
          color: #1e3a8a;
          min-width: 150px;
        }
        
        .detail-value {
          color: #333;
          text-align: left;
          flex: 1;
        }
        
        .status-badge {
          display: inline-block;
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin: 2px;
        }
        
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-approved { background: #d1fae5; color: #065f46; }
        .status-rejected { background: #fee2e2; color: #991b1b; }
        .status-under-review { background: #dbeafe; color: #1e40af; }
        
        .action-required {
          background: #fef3c7;
          border: 2px solid #f59e0b;
          border-radius: 10px;
          padding: 20px;
          margin: 25px 0;
        }
        
        .email-footer {
          padding: 30px;
          background: rgba(30, 58, 138, 0.9);
          color: white;
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .footer-text {
          font-size: 14px;
          opacity: 0.9;
          line-height: 1.6;
          margin-bottom: 15px;
        }
        
        .timestamp {
          font-size: 12px;
          opacity: 0.7;
          margin-top: 10px;
        }
        
        .contact-info {
          font-size: 13px;
          opacity: 0.8;
          margin-top: 15px;
        }
        
        @media (max-width: 600px) {
          .email-body, .email-header {
            padding: 20px;
          }
          
          .detail-item {
            flex-direction: column;
          }
          
          .detail-label {
            margin-bottom: 5px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <div class="header-overlay"></div>
          <div class="company-logo">شركة البحيرة العربية</div>
          <div class="system-name">نظام الصيانة الدورية للمركبات</div>
          ${content.header || ''}
        </div>
        
        <div class="email-body">
          ${content.greeting || ''}
          ${content.message || ''}
          ${content.details || ''}
          ${content.actions || ''}
        </div>
        
        <div class="email-footer">
          <div class="footer-text">
            هذا البريد الإلكتروني تم إنشاؤه تلقائياً من قبل النظام الآلي للصيانة<br>
            يرجى عدم الرد على هذا البريد
          </div>
          <div class="timestamp">
            ${content.timestamp || ''}
          </div>
          <div class="contact-info">
            للاستفسارات: support@albuhera.com | هاتف: 9200000000
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  // إنشاء سجل صيانة جديد
  maintenanceCreated: (data) => {
    const timestamp = moment().locale('ar').format('dddd، DD MMMM YYYY [الساعة] HH:mm');
    return emailTemplates.baseTemplate({
      header: `<div class="notification-title">📋 تم إنشاء سجل صيانة جديد</div>`,
      greeting: `
        <div class="greeting">
          السلام عليكم ورحمة الله وبركاته<br>
          <strong>الأستاذ/ة ${data.userName}</strong>،
        </div>
      `,
      message: `
        <div class="message-content">
          <p>نود إبلاغكم بأنه <strong>تم إنشاء سجل صيانة دورية جديد</strong> بنجاح في النظام.</p>
          <p>يرجى متابعة الفحوصات اليومية واعتمادها في مواعيدها المحددة.</p>
        </div>
      `,
      details: `
        <div class="details-card">
          <h3 style="color: #1e3a8a; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            📄 تفاصيل سجل الصيانة
          </h3>
          <div class="detail-item">
            <span class="detail-label">رقم اللوحة:</span>
            <span class="detail-value">${data.plateNumber}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">رقم التانكي:</span>
            <span class="detail-value">${data.tankNumber}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">شهر الفحص:</span>
            <span class="detail-value">${data.inspectionMonth}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">اسم السائق:</span>
            <span class="detail-value">${data.driverName}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">عدد أيام الشهر:</span>
            <span class="detail-value">${data.totalDays} يوم</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الإنشاء:</span>
            <span class="detail-value">${moment(data.createdAt).locale('ar').format('DD/MM/YYYY HH:mm')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تم الإنشاء بواسطة:</span>
            <span class="detail-value">${data.createdByName}</span>
          </div>
        </div>
      `,
      actions: `
        <div class="action-required">
          <h4 style="color: #92400e; margin-bottom: 10px;">✅ الإجراء المطلوب:</h4>
          <p>البدء في إجراء الفحوصات اليومية اعتباراً من اليوم الأول من الشهر.</p>
        </div>
      `,
      timestamp: `تم إرسال هذا الإشعار في ${timestamp}`
    });
  },

  // إضافة فحص يومي
  dailyCheckAdded: (data) => {
    const timestamp = moment().locale('ar').format('dddd، DD MMMM YYYY [الساعة] HH:mm');
    return emailTemplates.baseTemplate({
      header: `<div class="notification-title">🔍 فحص يومي جديد بانتظار المراجعة</div>`,
      greeting: `
        <div class="greeting">
          السلام عليكم ورحمة الله وبركاته<br>
          <strong>السادة المشرفين</strong>،
        </div>
      `,
      message: `
        <div class="message-content">
          <p>تم إرسال <strong>فحص يومي جديد</strong> للمراجعة والاعتماد.</p>
          <p>يرجى مراجعة الفحص وأخذ الإجراء المناسب.</p>
        </div>
      `,
      details: `
        <div class="details-card">
          <h3 style="color: #1e3a8a; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            📋 تفاصيل الفحص اليومي
          </h3>
          <div class="detail-item">
            <span class="detail-label">رقم اللوحة:</span>
            <span class="detail-value">${data.plateNumber}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">اسم السائق:</span>
            <span class="detail-value">${data.driverName}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الفحص:</span>
            <span class="detail-value">${moment(data.checkDate).locale('ar').format('dddd، DD/MM/YYYY')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تم الإرسال بواسطة:</span>
            <span class="detail-value">${data.checkedByName}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">حالة الفحص:</span>
            <span class="detail-value">
              <span class="status-badge status-under-review">قيد المراجعة</span>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">شهر الفحص:</span>
            <span class="detail-value">${data.inspectionMonth}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">نوع الفحص:</span>
            <span class="detail-value">فحص يومي روتيني</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">وقت الإرسال:</span>
            <span class="detail-value">${moment(data.submittedAt).locale('ar').format('HH:mm')}</span>
          </div>
        </div>
      `,
      actions: `
        <div class="action-required">
          <h4 style="color: #92400e; margin-bottom: 10px;">⚡ الإجراء المطلوب:</h4>
          <p>يرجى مراجعة الفحص اليومي والموافقة عليه أو رفضه في أقرب وقت ممكن.</p>
          <p style="margin-top: 10px; font-size: 14px;">
            رابط المراجعة: <a href="${data.reviewLink}" style="color: #3b82f6;">الذهاب إلى صفحة المراجعة</a>
          </p>
        </div>
      `,
      timestamp: `تم إرسال هذا الإشعار في ${timestamp}`
    });
  },

  // اعتماد الفحص
  checkApproved: (data) => {
    const timestamp = moment().locale('ar').format('dddd، DD MMMM YYYY [الساعة] HH:mm');
    return emailTemplates.baseTemplate({
      header: `<div class="notification-title">✅ تمت الموافقة على الفحص اليومي</div>`,
      greeting: `
        <div class="greeting">
          السلام عليكم ورحمة الله وبركاته<br>
          <strong>الأستاذ/ة ${data.employeeName}</strong>،
        </div>
      `,
      message: `
        <div class="message-content">
          <p>نود إبلاغكم بأنه <strong>تمت الموافقة على الفحص اليومي</strong> الذي قمت بإرساله.</p>
          <p>نشكر لكم التزامكم بإجراء الفحوصات الدورية.</p>
        </div>
      `,
      details: `
        <div class="details-card">
          <h3 style="color: #1e3a8a; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            📄 تفاصيل الفحص المعتمد
          </h3>
          <div class="detail-item">
            <span class="detail-label">رقم اللوحة:</span>
            <span class="detail-value">${data.plateNumber}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الفحص:</span>
            <span class="detail-value">${moment(data.checkDate).locale('ar').format('dddd، DD/MM/YYYY')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">حالة الفحص:</span>
            <span class="detail-value">
              <span class="status-badge status-approved">معتمد ✓</span>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تم الاعتماد بواسطة:</span>
            <span class="detail-value">${data.approvedByName} (مشرف)</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الاعتماد:</span>
            <span class="detail-value">${moment(data.approvedAt).locale('ar').format('DD/MM/YYYY HH:mm')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">ملاحظات المشرف:</span>
            <span class="detail-value">${data.supervisorNotes || 'لا توجد ملاحظات'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">الإنجاز الشهري:</span>
            <span class="detail-value">${data.completedDays} من ${data.totalDays} يوم (${data.completionRate}%)</span>
          </div>
        </div>
      `,
      timestamp: `تم إرسال هذا الإشعار في ${timestamp}`
    });
  },

  // رفض الفحص
  checkRejected: (data) => {
    const timestamp = moment().locale('ar').format('dddd، DD MMMM YYYY [الساعة] HH:mm');
    return emailTemplates.baseTemplate({
      header: `<div class="notification-title">❌ تم رفض الفحص اليومي</div>`,
      greeting: `
        <div class="greeting">
          السلام عليكم ورحمة الله وبركاته<br>
          <strong>الأستاذ/ة ${data.employeeName}</strong>،
        </div>
      `,
      message: `
        <div class="message-content">
          <p>نود إبلاغكم بأنه <strong>تم رفض الفحص اليومي</strong> الذي قمت بإرساله.</p>
          <p>يرجى الاطلاع على الملاحظات أدناه وتصحيح الأخطاء.</p>
        </div>
      `,
      details: `
        <div class="details-card">
          <h3 style="color: #1e3a8a; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            📋 تفاصيل الفحص المرفوض
          </h3>
          <div class="detail-item">
            <span class="detail-label">رقم اللوحة:</span>
            <span class="detail-value">${data.plateNumber}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الفحص:</span>
            <span class="detail-value">${moment(data.checkDate).locale('ar').format('dddd، DD/MM/YYYY')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">حالة الفحص:</span>
            <span class="detail-value">
              <span class="status-badge status-rejected">مرفوض ✗</span>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">سبب الرفض:</span>
            <span class="detail-value" style="color: #dc2626; font-weight: 500;">${data.rejectionReason}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">ملاحظات المشرف:</span>
            <span class="detail-value">${data.supervisorNotes || 'لا توجد ملاحظات'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تم الرفض بواسطة:</span>
            <span class="detail-value">${data.rejectedByName} (مشرف)</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الرفض:</span>
            <span class="detail-value">${moment(data.rejectedAt).locale('ar').format('DD/MM/YYYY HH:mm')}</span>
          </div>
        </div>
      `,
      actions: `
        <div class="action-required">
          <h4 style="color: #92400e; margin-bottom: 10px;">🔧 الإجراء المطلوب:</h4>
          <p>يرجى تصحيح الأخطاء المذكورة أعلاه وإعادة إرسال الفحص للمراجعة.</p>
          <p style="margin-top: 10px; font-size: 14px;">
            رابط التعديل: <a href="${data.editLink}" style="color: #3b82f6;">الذهاب إلى صفحة التعديل</a>
          </p>
        </div>
      `,
      timestamp: `تم إرسال هذا الإشعار في ${timestamp}`
    });
  },

  // تحذير من المشرف
  supervisorWarning: (data) => {
    const timestamp = moment().locale('ar').format('dddd، DD MMMM YYYY [الساعة] HH:mm');
    return emailTemplates.baseTemplate({
      header: `<div class="notification-title">⚠️ تحذير من المشرف</div>`,
      greeting: `
        <div class="greeting">
          السلام عليكم ورحمة الله وبركاته<br>
          <strong>الأستاذ/ة ${data.employeeName}</strong>،
        </div>
      `,
      message: `
        <div class="message-content">
          <p>نود إبلاغكم بأنه <strong>تم إرسال تحذير رسمي</strong> من المشرف المختص.</p>
          <p>يرجى أخذ هذا التحذير على محمل الجد واتخاذ الإجراءات اللازمة.</p>
        </div>
      `,
      details: `
        <div class="details-card">
          <h3 style="color: #1e3a8a; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            📢 تفاصيل التحذير
          </h3>
          <div class="detail-item">
            <span class="detail-label">نوع الإجراء:</span>
            <span class="detail-value" style="color: #dc2626; font-weight: 600;">تحذير رسمي</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">رقم اللوحة:</span>
            <span class="detail-value">${data.plateNumber}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">شهر الفحص:</span>
            <span class="detail-value">${data.inspectionMonth}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الفحص:</span>
            <span class="detail-value">${data.checkDate ? moment(data.checkDate).locale('ar').format('DD/MM/YYYY') : 'غير محدد'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">نص التحذير:</span>
            <span class="detail-value" style="color: #dc2626; font-weight: 500;">${data.message}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تم الإرسال بواسطة:</span>
            <span class="detail-value">${data.sentByName} (مشرف)</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الإرسال:</span>
            <span class="detail-value">${moment().locale('ar').format('DD/MM/YYYY HH:mm')}</span>
          </div>
        </div>
      `,
      actions: `
        <div class="action-required">
          <h4 style="color: #92400e; margin-bottom: 10px;">🚨 الإجراء المطلوب:</h4>
          <p><strong>مطلوب تصحيح الفوراً:</strong> ${data.actionRequired || 'يرجى الالتزام بالتعليمات واتخاذ اللازم في أسرع وقت.'}</p>
          <p style="margin-top: 10px; font-size: 14px;">
            المهلة المحددة: ${data.deadline || '24 ساعة من استلام هذا التحذير'}
          </p>
        </div>
      `,
      timestamp: `تم إرسال هذا الإشعار في ${timestamp}`
    });
  },

  // ملاحظة من المشرف
  supervisorNote: (data) => {
    const timestamp = moment().locale('ar').format('dddd، DD MMMM YYYY [الساعة] HH:mm');
    return emailTemplates.baseTemplate({
      header: `<div class="notification-title">📝 ملاحظة من المشرف</div>`,
      greeting: `
        <div class="greeting">
          السلام عليكم ورحمة الله وبركاته<br>
          <strong>الأستاذ/ة ${data.employeeName}</strong>،
        </div>
      `,
      message: `
        <div class="message-content">
          <p>نود إبلاغكم بأنه <strong>تم إرسال ملاحظة إرشادية</strong> من المشرف المختص.</p>
          <p>يمكن الاطلاع على التفاصيل أدناه.</p>
        </div>
      `,
      details: `
        <div class="details-card">
          <h3 style="color: #1e3a8a; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            📄 تفاصيل الملاحظة
          </h3>
          <div class="detail-item">
            <span class="detail-label">نوع الإجراء:</span>
            <span class="detail-value" style="color: #3b82f6; font-weight: 600;">ملاحظة إرشادية</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">رقم اللوحة:</span>
            <span class="detail-value">${data.plateNumber}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">شهر الفحص:</span>
            <span class="detail-value">${data.inspectionMonth}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">نص الملاحظة:</span>
            <span class="detail-value" style="color: #1e40af;">${data.message}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تم الإرسال بواسطة:</span>
            <span class="detail-value">${data.sentByName} (مشرف)</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الإرسال:</span>
            <span class="detail-value">${moment().locale('ar').format('DD/MM/YYYY HH:mm')}</span>
          </div>
        </div>
      `,
      actions: `
        <div style="background: #dbeafe; border: 2px solid #3b82f6; border-radius: 10px; padding: 20px; margin: 25px 0;">
          <h4 style="color: #1e40af; margin-bottom: 10px;">💡 ملاحظة:</h4>
          <p>هذه ملاحظة إرشادية ولا تتطلب رداً فورياً، ولكن يرجى أخذها بعين الاعتبار.</p>
        </div>
      `,
      timestamp: `تم إرسال هذا الإشعار في ${timestamp}`
    });
  },

  // نواقص في الفحص
  missingChecks: (data) => {
    const timestamp = moment().locale('ar').format('dddd، DD MMMM YYYY [الساعة] HH:mm');
    return emailTemplates.baseTemplate({
      header: `<div class="notification-title">⚠️ نواقص في الفحص اليومي</div>`,
      greeting: `
        <div class="greeting">
          السلام عليكم ورحمة الله وبركاته<br>
          <strong>الأستاذ/ة ${data.checkedByName}</strong>،
        </div>
      `,
      message: `
        <div class="message-content">
          <p>تم اكتشاف <strong>نواقص في الفحص اليومي</strong> الذي قمت بإرساله.</p>
          <p>يرجى الانتباه إلى النواقص المذكورة أدناه.</p>
        </div>
      `,
      details: `
        <div class="details-card">
          <h3 style="color: #1e3a8a; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            📋 تفاصيل النواقص
          </h3>
          <div class="detail-item">
            <span class="detail-label">رقم اللوحة:</span>
            <span class="detail-value">${data.plateNumber}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">اسم السائق:</span>
            <span class="detail-value">${data.driverName}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الفحص:</span>
            <span class="detail-value">${moment(data.checkDate).locale('ar').format('dddd، DD/MM/YYYY')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">عدد النواقص:</span>
            <span class="detail-value">${data.missingFields.length} فحص</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">النواقص المحددة:</span>
            <span class="detail-value">
              <ul style="margin: 10px 0; padding-right: 20px; color: #dc2626;">
                ${data.missingFields.map(field => `<li>${field}</li>`).join('')}
              </ul>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">توقيت الاكتشاف:</span>
            <span class="detail-value">${moment(data.detectedAt).locale('ar').format('HH:mm')}</span>
          </div>
        </div>
      `,
      actions: `
        <div class="action-required">
          <h4 style="color: #92400e; margin-bottom: 10px;">🔧 الإجراء المطلوب:</h4>
          <p>يرجى إكمال النواقص المذكورة أعلاه وإعادة إرسال الفحص.</p>
          <p style="margin-top: 10px; font-size: 14px;">
            المهلة المحددة: قبل نهاية اليوم
          </p>
        </div>
      `,
      timestamp: `تم إرسال هذا الإشعار في ${timestamp}`
    });
  },

  // حذف سجل صيانة
  maintenanceDeleted: (data) => {
    const timestamp = moment().locale('ar').format('dddd، DD MMMM YYYY [الساعة] HH:mm');
    return emailTemplates.baseTemplate({
      header: `<div class="notification-title">🗑️ تم حذف سجل صيانة</div>`,
      greeting: `
        <div class="greeting">
          السلام عليكم ورحمة الله وبركاته<br>
          <strong>الأستاذ/ة ${data.userName}</strong>،
        </div>
      `,
      message: `
        <div class="message-content">
          <p>نود إبلاغكم بأنه <strong>تم حذف سجل صيانة</strong> من النظام.</p>
          <p>التفاصيل كاملة موضحة أدناه.</p>
        </div>
      `,
      details: `
        <div class="details-card">
          <h3 style="color: #1e3a8a; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            📄 تفاصيل السجل المحذوف
          </h3>
          <div class="detail-item">
            <span class="detail-label">رقم اللوحة:</span>
            <span class="detail-value">${data.plateNumber}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">رقم التانكي:</span>
            <span class="detail-value">${data.tankNumber}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">شهر الفحص:</span>
            <span class="detail-value">${data.inspectionMonth}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">اسم السائق:</span>
            <span class="detail-value">${data.driverName}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">عدد الفحوصات المحذوفة:</span>
            <span class="detail-value">${data.dailyChecksCount} فحص يومي</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الإنشاء الأصلي:</span>
            <span class="detail-value">${moment(data.createdAt).locale('ar').format('DD/MM/YYYY HH:mm')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تم الحذف بواسطة:</span>
            <span class="detail-value">${data.deletedByName}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">سبب الحذف:</span>
            <span class="detail-value">${data.reason || 'غير محدد'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">تاريخ الحذف:</span>
            <span class="detail-value">${moment(data.deletedAt).locale('ar').format('DD/MM/YYYY HH:mm')}</span>
          </div>
        </div>
      `,
      timestamp: `تم إرسال هذا الإشعار في ${timestamp}`
    });
  }
};

// ===================== دوال المساعدة =====================

const isNotDoneValue = (value) => {
  if (value === null || value === undefined) return true;
  const normalized = String(value).trim();
  if (!normalized) return true;
  return NOT_DONE_VALUES.has(normalized);
};

const getNotDoneFields = (check) => {
  if (!check) return [];
  return CHECK_FIELDS
    .filter((field) => isNotDoneValue(check[field.key]))
    .map((field) => field.label);
};

const formatInvoices = (invoices = []) =>
  invoices
    .map((inv) => {
      const title = inv?.title || 'فاتورة';
      const url = inv?.url || '';
      return url ? `${title}: ${url}` : title;
    })
    .join(' | ');

// ===================== دالة إرسال البريد المعدلة =====================

const sendNotificationEmail = async (templateName, data, recipients, bccRecipients = []) => {
  try {
    console.log(`📧 === محاولة إرسال بريد ===`);
    console.log(`القالب: ${templateName}`);
    console.log(`العنوان: ${data.subject || 'بدون عنوان'}`);
    
    // معالجة المستلمين الرئيسيين (to)
    let toEmails = '';
    if (recipients) {
      if (!Array.isArray(recipients)) recipients = [recipients];
      
      const validEmails = recipients.filter(email => 
        email && typeof email === 'string' && email.includes('@')
      );
      
      if (validEmails.length > 0) {
        toEmails = validEmails.join(',');
      }
    }
    
    // معالجة المستلمين المخفيين (bcc)
    let bccEmails = '';
    if (bccRecipients && bccRecipients.length > 0) {
      if (!Array.isArray(bccRecipients)) bccRecipients = [bccRecipients];
      
      const validBccEmails = bccRecipients.filter(email => 
        email && typeof email === 'string' && email.includes('@')
      );
      
      if (validBccEmails.length > 0) {
        bccEmails = validBccEmails.join(',');
      }
    }
    
    // إذا لا يوجد أي مستلمين
    if (!toEmails && !bccEmails) {
      console.log(`⚠️ لا يوجد مستلمين صالحين للقالب: ${templateName}`);
      return;
    }
    
    const template = emailTemplates[templateName];
    if (!template) {
      console.error(`❌ القالب ${templateName} غير موجود`);
      return;
    }
    
    const htmlContent = template(data);
    
    console.log(`📧 تفاصيل الإرسال:`);
    console.log(`- To: ${toEmails || 'لا يوجد'}`);
    console.log(`- BCC: ${bccEmails || 'لا يوجد'}`);
    console.log(`- الموضوع: ${data.subject}`);
    
    await sendEmail({
      to: toEmails || undefined,
      bcc: bccEmails || undefined,
      subject: data.subject || 'إشعار من نظام الصيانة الدورية',
      html: htmlContent
    });
    
    console.log(`✅ تم إرسال البريد | القالب: ${templateName}`);
    
  } catch (error) {
    console.error(`❌ خطأ في إرسال البريد (${templateName}):`, error.message);
  }
};

const notifyMissingChecksByEmail = async ({ maintenance, check, checkedByName, checkedByEmail }) => {
  try {
    const missingFields = getNotDoneFields(check);
    if (missingFields.length === 0) return;

    const admins = await User.find({ role: 'admin' }).select('name email');
    const adminEmails = admins.map((u) => u.email).filter(Boolean);

    // التحقق من وجود مستلمين
    const hasRecipients = (checkedByEmail && checkedByEmail.includes('@')) || adminEmails.length > 0;
    if (!hasRecipients) {
      console.log('⚠️ لا يوجد مستلمين لإشعار النواقص');
      return;
    }

    const data = {
      checkedByName: checkedByName || 'فاحص',
      plateNumber: maintenance?.plateNumber || 'غير محدد',
      driverName: maintenance?.driverName || 'غير محدد',
      checkDate: check?.date || new Date(),
      missingFields,
      detectedAt: new Date(),
      subject: 'تنبيه: نواقص في الفحص اليومي'
    };

    // إرسال البريد مع BCC للمشرفين
    if (checkedByEmail && checkedByEmail.includes('@')) {
      await sendNotificationEmail('missingChecks', data, checkedByEmail, adminEmails);
    } else if (adminEmails.length > 0) {
      // إذا لا يوجد بريد للمستخدم، أرسل للمشرفين فقط
      await sendNotificationEmail('missingChecks', {
        ...data,
        subject: 'تنبيه للمشرفين: نواقص في الفحص اليومي',
        checkedByName: 'نظام المراقبة'
      }, undefined, adminEmails);
    }
    
  } catch (error) {
    console.error('❌ خطأ في notifyMissingChecksByEmail:', error.message);
  }
};

// ===================== التحكمات الرئيسية =====================

// إنشاء سجل صيانة جديد
exports.createMaintenance = async (req, res) => {
  try {
    const maintenanceData = req.body;
    
    // إضافة معلومات المنشئ
    maintenanceData.inspectedBy = req.user._id;
    maintenanceData.inspectedByName = req.user.name;
    
    // توليد شهر التفتيش إذا لم يتم توفيره
    if (!maintenanceData.inspectionMonth) {
      maintenanceData.inspectionMonth = moment().format('YYYY-MM');
    }
    
    // تهيئة الفحوصات اليومية للشهر
    const yearMonth = maintenanceData.inspectionMonth.split('-');
    const year = parseInt(yearMonth[0]);
    const month = parseInt(yearMonth[1]) - 1;
    
    maintenanceData.dailyChecks = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      maintenanceData.dailyChecks.push({
        date: new Date(year, month, day),
        status: 'pending'
      });
    }
    
    // تعيين الإجماليات
    maintenanceData.totalDays = daysInMonth;
    maintenanceData.completedDays = 0;
    maintenanceData.pendingDays = daysInMonth;
    
    const maintenance = new Maintenance(maintenanceData);
    await maintenance.save();
    
    // إرسال إشعار البريد الإلكتروني
    if (req.user?.email && req.user.email.includes('@')) {
      const data = {
        userName: req.user.name,
        plateNumber: maintenance.plateNumber,
        tankNumber: maintenance.tankNumber,
        inspectionMonth: maintenance.inspectionMonth,
        driverName: maintenance.driverName,
        totalDays: maintenance.totalDays,
        createdAt: maintenance.createdAt,
        createdByName: req.user.name,
        subject: 'تم إنشاء سجل صيانة جديد'
      };
      
      // إرسال للمستخدم
      await sendNotificationEmail('maintenanceCreated', data, req.user.email);
      
      // إرسال نسخة مخفية للمشرفين
      const supervisors = await User.find({ role: 'supervisor' }).select('email');
      const supervisorEmails = supervisors
        .map(s => s.email)
        .filter(email => email && email.includes('@') && email !== req.user.email);
      
      if (supervisorEmails.length > 0) {
        await sendNotificationEmail('maintenanceCreated', {
          ...data,
          subject: 'تم إنشاء سجل صيانة جديد - إشعار للمشرفين'
        }, undefined, supervisorEmails);
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء سجل الصيانة بنجاح',
      data: maintenance
    });
  } catch (error) {
    console.error('Error creating maintenance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء سجل الصيانة',
      error: error.message
    });
  }
};

// دالة لاختبار إرسال البريد
exports.testEmailSending = async (req, res) => {
  try {
    const testEmails = req.body.emails || [req.user?.email];
    const validTestEmails = testEmails.filter(email => email && email.includes('@'));
    
    if (validTestEmails.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم تقديم بريد إلكتروني صالح للاختبار'
      });
    }
    
    const data = {
      userName: req.user?.name || 'مستخدم الاختبار',
      plateNumber: 'TEST-123',
      tankNumber: 'TANK-456',
      inspectionMonth: moment().format('YYYY-MM'),
      driverName: 'سائق الاختبار',
      totalDays: 30,
      createdAt: new Date(),
      createdByName: req.user?.name || 'النظام',
      subject: 'اختبار إرسال البريد الإلكتروني'
    };
    
    console.log('🔧 === بدء اختبار إرسال البريد ===');
    console.log('المستخدم:', req.user?.email);
    console.log('البريد الإلكتروني للاختبار:', validTestEmails);
    
    const results = [];
    
    for (const email of validTestEmails) {
      try {
        console.log(`📤 محاولة إرسال إلى: ${email}`);
        await sendNotificationEmail('maintenanceCreated', data, email);
        results.push({ email, status: '✅ تم الإرسال' });
        console.log(`✅ تم إرسال بنجاح إلى: ${email}`);
      } catch (error) {
        results.push({ email, status: '❌ فشل', error: error.message });
        console.error(`❌ فشل الإرسال إلى ${email}:`, error.message);
      }
    }
    
    console.log('📊 === نتائج اختبار البريد ===');
    results.forEach(result => {
      console.log(`${result.status} - ${result.email}`);
    });
    
    res.json({
      success: true,
      message: 'تم اختبار إرسال البريد',
      results,
      details: {
        total: results.length,
        success: results.filter(r => r.status.includes('✅')).length,
        failed: results.filter(r => r.status.includes('❌')).length
      }
    });
    
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في اختبار البريد',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// إضافة فحص يومي
exports.addDailyCheck = async (req, res) => {
  try {
    const { id } = req.params;
    const dailyCheckData = req.body;

    const maintenance = await Maintenance.findById(id);
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }

    // التحقق من وجود فحص اليوم
    const existingCheckIndex = maintenance.dailyChecks.findIndex(
      (check) =>
        moment(check.date).format('YYYY-MM-DD') ===
        moment(dailyCheckData.date).format('YYYY-MM-DD')
    );

    if (existingCheckIndex !== -1) {
      // تحديث فحص موجود
      maintenance.dailyChecks[existingCheckIndex] = {
        ...maintenance.dailyChecks[existingCheckIndex].toObject(),
        ...dailyCheckData,
        checkedBy: req.user._id,
        checkedByName: req.user.name,
        status: 'under_review',
        submittedAt: new Date()
      };
    } else {
      // إضافة فحص جديد
      maintenance.dailyChecks.push({
        ...dailyCheckData,
        checkedBy: req.user._id,
        checkedByName: req.user.name,
        status: 'under_review',
        submittedAt: new Date()
      });
    }

    // تحديث العدادات
    maintenance.completedDays = maintenance.dailyChecks.filter(
      (check) => check.status === 'approved'
    ).length;

    maintenance.pendingDays =
      maintenance.totalDays - maintenance.completedDays;

    await maintenance.save();

    // الرد الفوري للمستخدم
    res.json({
      success: true,
      message: 'تم إرسال الفحص اليومي للمراجعة',
      data: maintenance,
    });

    // ===============================
    // العمل في الخلفية بعد الرد
    // ===============================
    setImmediate(async () => {
      try {
        console.log('🔄 بدء إرسال الإشعارات في الخلفية');
        
        const updatedCheck =
          existingCheckIndex !== -1
            ? maintenance.dailyChecks[existingCheckIndex]
            : maintenance.dailyChecks[maintenance.dailyChecks.length - 1];

        let checkedByEmail = req.user?.email;
        let checkedByName = req.user?.name;

        if (!checkedByEmail) {
          const checkedUser = await User.findById(req.user._id).select('name email');
          checkedByEmail = checkedUser?.email;
          checkedByName = checkedByName || checkedUser?.name;
        }

        // إشعار النواقص
        console.log('📧 إرسال إشعار النواقص...');
        await notifyMissingChecksByEmail({
          maintenance,
          check: updatedCheck,
          checkedByName,
          checkedByEmail,
        });

        // إرسال إشعار للمشرفين
        console.log('📧 إرسال إشعار للمشرفين...');
        const supervisors = await User.find({ role: 'supervisor' }).select('name email');

        if (supervisors.length > 0) {
          const supervisorEmails = supervisors.map(s => s.email).filter(email => email && email.includes('@'));
          
          if (supervisorEmails.length > 0) {
            const data = {
              plateNumber: maintenance.plateNumber,
              driverName: maintenance.driverName,
              checkDate: dailyCheckData.date,
              checkedByName: req.user.name,
              inspectionMonth: maintenance.inspectionMonth,
              submittedAt: new Date(),
              reviewLink: `${process.env.FRONTEND_URL || 'https://yourdomain.com'}/maintenance/${id}/review`,
              subject: 'فحص يومي جديد بانتظار المراجعة'
            };

            // إرسال كـ BCC للمشرفين
            await sendNotificationEmail('dailyCheckAdded', data, undefined, supervisorEmails);
            console.log(`✅ تم إرسال إشعار إلى ${supervisorEmails.length} مشرف`);
          }
        }
        
        console.log('✅ اكتملت إرسال الإشعارات في الخلفية');
      } catch (bgError) {
        console.error('❌ خطأ في إرسال الإشعارات في الخلفية:', bgError.message);
        console.error('تفاصيل الخطأ:', bgError);
      }
    });
  } catch (error) {
    console.error('Error adding daily check:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إضافة الفحص اليومي',
      error: error.message,
    });
  }
};

// اعتماد الفحص اليومي
exports.approveCheck = async (req, res) => {
  try {
    const { id, checkId } = req.params;
    const { notes } = req.body;
    
    const maintenance = await Maintenance.findById(id);
    
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }
    
    const checkIndex = maintenance.dailyChecks.findIndex(
      check => check._id.toString() === checkId
    );
    
    if (checkIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'الفحص غير موجود'
      });
    }
    
    // تحديث حالة الفحص
    maintenance.dailyChecks[checkIndex].status = 'approved';
    maintenance.dailyChecks[checkIndex].supervisorNotes = notes || '';
    maintenance.dailyChecks[checkIndex].approvedAt = new Date();
    maintenance.dailyChecks[checkIndex].approvedBy = req.user._id;
    
    // تحديث العدادات
    maintenance.completedDays = maintenance.dailyChecks.filter(
      check => check.status === 'approved'
    ).length;
    maintenance.pendingDays = maintenance.totalDays - maintenance.completedDays;
    
    await maintenance.save();
    
    // إرسال إشعار للموظف في الخلفية
    setImmediate(async () => {
      try {
        const checkedBy = maintenance.dailyChecks[checkIndex].checkedBy;
        if (checkedBy) {
          const checkedUser = await User.findById(checkedBy).select('name email');
          
          if (checkedUser?.email) {
            const completionRate = ((maintenance.completedDays / maintenance.totalDays) * 100).toFixed(2);
            
            const data = {
              employeeName: checkedUser.name,
              plateNumber: maintenance.plateNumber,
              checkDate: maintenance.dailyChecks[checkIndex].date,
              approvedByName: req.user.name,
              supervisorNotes: notes || 'لا توجد ملاحظات',
              approvedAt: new Date(),
              completedDays: maintenance.completedDays,
              totalDays: maintenance.totalDays,
              completionRate: `${completionRate}%`,
              subject: 'تمت الموافقة على الفحص اليومي'
            };
            
            console.log(`📧 إرسال إشعار اعتماد إلى: ${checkedUser.email}`);
            await sendNotificationEmail('checkApproved', data, checkedUser.email);
          }
        }
        
        // إرسال إشعار للمشرفين الآخرين
        const otherSupervisors = await User.find({ 
          role: 'supervisor',
          _id: { $ne: req.user._id }
        }).select('email');
        
        if (otherSupervisors.length > 0) {
          const supervisorEmails = otherSupervisors
            .map(s => s.email)
            .filter(email => email && email.includes('@'));
          
          if (supervisorEmails.length > 0) {
            await sendNotificationEmail('checkApproved', {
              plateNumber: maintenance.plateNumber,
              checkDate: maintenance.dailyChecks[checkIndex].date,
              approvedByName: req.user.name,
              subject: 'تمت الموافقة على فحص يومي'
            }, undefined, supervisorEmails);
          }
        }
      } catch (emailError) {
        console.error('❌ خطأ في إرسال إشعار الاعتماد:', emailError.message);
      }
    });
    
    res.json({
      success: true,
      message: 'تمت الموافقة على الفحص بنجاح',
      data: maintenance
    });
  } catch (error) {
    console.error('Error approving check:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الموافقة على الفحص',
      error: error.message
    });
  }
};

// رفض الفحص اليومي
exports.rejectCheck = async (req, res) => {
  try {
    const { id, checkId } = req.params;
    const { notes, reason } = req.body;
    
    const maintenance = await Maintenance.findById(id);
    
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }
    
    const checkIndex = maintenance.dailyChecks.findIndex(
      check => check._id.toString() === checkId
    );
    
    if (checkIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'الفحص غير موجود'
      });
    }
    
    // تحديث حالة الفحص
    maintenance.dailyChecks[checkIndex].status = 'rejected';
    maintenance.dailyChecks[checkIndex].supervisorNotes = notes || '';
    maintenance.dailyChecks[checkIndex].rejectionReason = reason || 'غير محدد';
    maintenance.dailyChecks[checkIndex].rejectedAt = new Date();
    maintenance.dailyChecks[checkIndex].rejectedBy = req.user._id;
    
    await maintenance.save();
    
    // إرسال إشعار للموظف في الخلفية
    setImmediate(async () => {
      try {
        const checkedBy = maintenance.dailyChecks[checkIndex].checkedBy;
        if (checkedBy) {
          const checkedUser = await User.findById(checkedBy).select('name email');

          if (checkedUser?.email) {
            const data = {
              employeeName: checkedUser.name,
              plateNumber: maintenance.plateNumber,
              checkDate: maintenance.dailyChecks[checkIndex].date,
              rejectedByName: req.user.name,
              supervisorNotes: notes || 'لا توجد ملاحظات',
              rejectionReason: reason || 'غير محدد',
              rejectedAt: new Date(),
              editLink: `${process.env.FRONTEND_URL || 'https://yourdomain.com'}/maintenance/${id}/edit/${checkId}`,
              subject: 'تم رفض الفحص اليومي'
            };
            
            console.log(`📧 إرسال إشعار رفض إلى: ${checkedUser.email}`);
            await sendNotificationEmail('checkRejected', data, checkedUser.email);
          }
        }
      } catch (emailError) {
        console.error('❌ خطأ في إرسال إشعار الرفض:', emailError.message);
      }
    });
    
    res.json({
      success: true,
      message: 'تم رفض الفحص بنجاح',
      data: maintenance
    });
  } catch (error) {
    console.error('Error rejecting check:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في رفض الفحص',
      error: error.message
    });
  }
};

// إرسال تحذير للموظف
exports.sendWarning = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, checkDate, actionRequired, deadline } = req.body;
    
    const maintenance = await Maintenance.findById(id);
    
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }
    
    // إضافة إجراء المشرف
    maintenance.supervisorActions.push({
      actionType: 'warning',
      message: message,
      sentTo: [maintenance.inspectedBy],
      sentByName: req.user.name,
      sentAt: new Date(),
      metadata: { actionRequired, deadline }
    });
    
    await maintenance.save();
    
    // إرسال إشعار في الخلفية
    setImmediate(async () => {
      try {
        const inspectedUser = await User.findById(maintenance.inspectedBy)
          .select('name email');

        if (inspectedUser?.email) {
          const data = {
            employeeName: inspectedUser.name,
            plateNumber: maintenance.plateNumber,
            inspectionMonth: maintenance.inspectionMonth,
            checkDate: checkDate || null,
            message: message,
            sentByName: req.user.name,
            actionRequired: actionRequired || 'يرجى الالتزام بالتعليمات واتخاذ اللازم في أسرع وقت.',
            deadline: deadline || '24 ساعة من استلام هذا التحذير',
            subject: 'تحذير من المشرف – نظام الصيانة'
          };
          
          console.log(`📧 إرسال تحذير إلى: ${inspectedUser.email}`);
          await sendNotificationEmail('supervisorWarning', data, inspectedUser.email);
          
          // إرسال نسخة للمشرفين الآخرين
          const otherSupervisors = await User.find({ 
            role: 'supervisor',
            _id: { $ne: req.user._id }
          }).select('email');
          
          if (otherSupervisors.length > 0) {
            const supervisorEmails = otherSupervisors
              .map(s => s.email)
              .filter(email => email && email.includes('@'));
            
            if (supervisorEmails.length > 0) {
              await sendNotificationEmail('supervisorWarning', {
                ...data,
                subject: 'تحذير تم إرساله من مشرف'
              }, undefined, supervisorEmails);
            }
          }
        }
      } catch (emailError) {
        console.error('❌ خطأ في إرسال التحذير:', emailError.message);
      }
    });
    
    res.json({
      success: true,
      message: 'تم إرسال التحذير بنجاح'
    });
  } catch (error) {
    console.error('Error sending warning:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إرسال التحذير',
      error: error.message
    });
  }
};

// إرسال ملاحظة للموظف
exports.sendNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    const maintenance = await Maintenance.findById(id);
    
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }
    
    // إضافة إجراء المشرف
    maintenance.supervisorActions.push({
      actionType: 'note',
      message: message,
      sentTo: [maintenance.inspectedBy],
      sentByName: req.user.name,
      sentAt: new Date()
    });
    
    await maintenance.save();
    
    // إرسال إشعار في الخلفية
    setImmediate(async () => {
      try {
        const inspectedUser = await User.findById(maintenance.inspectedBy)
          .select('name email');

        if (inspectedUser?.email) {
          const data = {
            employeeName: inspectedUser.name,
            plateNumber: maintenance.plateNumber,
            inspectionMonth: maintenance.inspectionMonth,
            message: message,
            sentByName: req.user.name,
            subject: 'ملاحظة من المشرف – نظام الصيانة'
          };
          
          console.log(`📧 إرسال ملاحظة إلى: ${inspectedUser.email}`);
          await sendNotificationEmail('supervisorNote', data, inspectedUser.email);
        }
      } catch (emailError) {
        console.error('❌ خطأ في إرسال الملاحظة:', emailError.message);
      }
    });
    
    res.json({
      success: true,
      message: 'تم إرسال الملاحظة بنجاح'
    });
  } catch (error) {
    console.error('Error sending note:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إرسال الملاحظة',
      error: error.message
    });
  }
};

// حذف سجل الصيانة
exports.deleteMaintenance = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const maintenance = await Maintenance.findById(id);
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }

    // حفظ البيانات قبل الحذف للإشعارات
    const deletedData = {
      plateNumber: maintenance.plateNumber,
      tankNumber: maintenance.tankNumber,
      inspectionMonth: maintenance.inspectionMonth,
      driverName: maintenance.driverName,
      dailyChecksCount: maintenance.dailyChecks.length,
      createdAt: maintenance.createdAt,
      deletedByName: req.user.name,
      reason: reason || 'غير محدد',
      deletedAt: new Date()
    };

    await Maintenance.findByIdAndDelete(id);

    // إرسال إشعارات الحذف في الخلفية
    setImmediate(async () => {
      try {
        const inspectedUser = await User.findById(maintenance.inspectedBy).select('name email');
        if (inspectedUser?.email) {
          const data = {
            userName: inspectedUser.name,
            ...deletedData,
            subject: 'تم حذف سجل الصيانة'
          };
          
          console.log(`📧 إرسال إشعار حذف إلى: ${inspectedUser.email}`);
          await sendNotificationEmail('maintenanceDeleted', data, inspectedUser.email);
        }

        // إرسال إشعار للمشرفين
        const supervisors = await User.find({ role: 'supervisor' }).select('email');
        const supervisorEmails = supervisors
          .map(s => s.email)
          .filter(email => email && email.includes('@'));
        
        if (supervisorEmails.length > 0) {
          await sendNotificationEmail('maintenanceDeleted', {
            ...deletedData,
            subject: 'تم حذف سجل صيانة'
          }, undefined, supervisorEmails);
        }
      } catch (emailError) {
        console.error('❌ خطأ في إرسال إشعار الحذف:', emailError.message);
      }
    });

    res.json({
      success: true,
      message: 'تم حذف سجل الصيانة بنجاح'
    });
  } catch (error) {
    console.error('Error deleting maintenance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف سجل الصيانة',
      error: error.message
    });
  }
};

// تحديث الفحص اليومي
exports.updateDailyCheck = async (req, res) => {
  try {
    const { id, checkId } = req.params;

    const maintenance = await Maintenance.findById(id);
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }

    const checkIndex = maintenance.dailyChecks.findIndex(
      c => c._id.toString() === checkId
    );

    if (checkIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'الفحص اليومي غير موجود'
      });
    }

    maintenance.dailyChecks[checkIndex] = {
      ...maintenance.dailyChecks[checkIndex].toObject(),
      ...req.body,
      status: 'under_review',
      checkedBy: req.user._id,
      checkedByName: req.user.name,
      updatedAt: new Date()
    };

    await maintenance.save();

    // العمل في الخلفية
    setImmediate(async () => {
      try {
        const updatedCheck = maintenance.dailyChecks[checkIndex];

        let checkedByEmail = req.user?.email;
        let checkedByName = req.user?.name;

        if (!checkedByEmail) {
          const checkedUser = await User.findById(req.user._id).select('name email');
          checkedByEmail = checkedUser?.email;
          checkedByName = checkedByName || checkedUser?.name;
        }

        await notifyMissingChecksByEmail({
          maintenance,
          check: updatedCheck,
          checkedByName,
          checkedByEmail
        });

        // إرسال إشعار للمشرفين بالتحديث
        const supervisors = await User.find({ role: 'supervisor' }).select('email');
        const supervisorEmails = supervisors
          .map(s => s.email)
          .filter(email => email && email.includes('@'));
        
        if (supervisorEmails.length > 0) {
          const data = {
            plateNumber: maintenance.plateNumber,
            driverName: maintenance.driverName,
            checkDate: updatedCheck.date,
            checkedByName: req.user.name,
            subject: 'تم تحديث فحص يومي'
          };
          
          await sendNotificationEmail('dailyCheckAdded', data, undefined, supervisorEmails);
        }
      } catch (bgError) {
        console.error('❌ خطأ في الخلفية لتحديث الفحص:', bgError.message);
      }
    });

    res.json({
      success: true,
      message: 'تم تحديث الفحص اليومي وإرساله للمراجعة',
      data: maintenance
    });
  } catch (error) {
    console.error('Error updating daily check:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث الفحص اليومي',
      error: error.message
    });
  }
};

// حذف الفحص اليومي
exports.deleteDailyCheck = async (req, res) => {
  try {
    const { id, checkId } = req.params;
    const { reason } = req.body;

    const maintenance = await Maintenance.findById(id);
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }

    const checkToDelete = maintenance.dailyChecks.find(
      c => c._id.toString() === checkId
    );

    if (!checkToDelete) {
      return res.status(404).json({
        success: false,
        message: 'الفحص اليومي غير موجود'
      });
    }

    maintenance.dailyChecks = maintenance.dailyChecks.filter(
      c => c._id.toString() !== checkId
    );

    maintenance.completedDays = maintenance.dailyChecks.filter(
      c => c.status === 'approved'
    ).length;

    maintenance.pendingDays =
      maintenance.totalDays - maintenance.completedDays;

    await maintenance.save();

    // إرسال إشعار الحذف في الخلفية
    setImmediate(async () => {
      try {
        const checkedUser = await User.findById(checkToDelete.checkedBy).select('name email');
        if (checkedUser?.email) {
          const data = {
            userName: checkedUser.name,
            plateNumber: maintenance.plateNumber,
            checkDate: checkToDelete.date,
            deletedByName: req.user.name,
            reason: reason || 'غير محدد',
            deletedAt: new Date(),
            subject: 'تم حذف فحص يومي'
          };
          
          await sendNotificationEmail('maintenanceDeleted', data, checkedUser.email);
        }
      } catch (emailError) {
        console.error('❌ خطأ في إرسال إشعار حذف الفحص:', emailError.message);
      }
    });

    res.json({
      success: true,
      message: 'تم حذف الفحص اليومي بنجاح',
      data: maintenance
    });
  } catch (error) {
    console.error('Error deleting daily check:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف الفحص اليومي',
      error: error.message
    });
  }
};

// ===================== التحكمات الأخرى (بدون تغيير) =====================

// الحصول على جميع سجلات الصيانة
exports.getAllMaintenance = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      month,
      plateNumber,
      driverId,
      status,
      vehicleType
    } = req.query;
    
    const filter = {};
    
    if (month) filter.inspectionMonth = month;
    if (plateNumber) filter.plateNumber = new RegExp(plateNumber, 'i');
    if (driverId) filter.driverId = driverId;
    if (status) filter.status = status;
    if (vehicleType) filter.vehicleType = vehicleType;
    
    const skip = (page - 1) * limit;
    
    const maintenance = await Maintenance.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('inspectedBy', 'name email')
      .populate('dailyChecks.checkedBy', 'name');
    
    const total = await Maintenance.countDocuments(filter);
    
    res.json({
      success: true,
      data: maintenance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting maintenance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب سجلات الصيانة',
      error: error.message
    });
  }
};

// الحصول على سجل صيانة بواسطة المعرف
exports.getMaintenanceById = async (req, res) => {
  try {
    const maintenance = await Maintenance.findById(req.params.id)
      .populate('inspectedBy', 'name email')
      .populate('dailyChecks.checkedBy', 'name')
      .populate('supervisorActions.sentTo', 'name email');
    
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }
    
    res.json({
      success: true,
      data: maintenance
    });
  } catch (error) {
    console.error('Error getting maintenance by ID:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب سجل الصيانة',
      error: error.message
    });
  }
};

// تحديث سجل الصيانة
exports.updateMaintenance = async (req, res) => {
  try {
    const maintenance = await Maintenance.findById(req.params.id);
    
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }
    
    // تحديث الحقول
    Object.keys(req.body).forEach(key => {
      if (key !== '_id' && key !== 'dailyChecks' && key !== 'supervisorActions') {
        maintenance[key] = req.body[key];
      }
    });
    
    maintenance.updatedAt = new Date();
    
    await maintenance.save();
    
    res.json({
      success: true,
      message: 'تم تحديث سجل الصيانة بنجاح',
      data: maintenance
    });
  } catch (error) {
    console.error('Error updating maintenance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث سجل الصيانة',
      error: error.message
    });
  }
};

// إضافة إجراء مشرف
exports.addSupervisorAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionType, message } = req.body;

    if (!['warning', 'note'].includes(actionType)) {
      return res.status(400).json({
        success: false,
        message: 'نوع الإجراء غير صالح'
      });
    }

    const maintenance = await Maintenance.findById(id);
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }

    maintenance.supervisorActions.push({
      actionType,
      message,
      sentTo: [maintenance.inspectedBy],
      sentByName: req.user.name,
      sentAt: new Date()
    });

    await maintenance.save();

    // إرسال الإشعار المناسب حسب نوع الإجراء في الخلفية
    setImmediate(async () => {
      try {
        const inspectedUser = await User.findById(maintenance.inspectedBy)
          .select('name email');

        if (inspectedUser?.email) {
          const data = {
            employeeName: inspectedUser.name,
            plateNumber: maintenance.plateNumber,
            inspectionMonth: maintenance.inspectionMonth,
            message: message,
            sentByName: req.user.name,
            subject: actionType === 'warning' 
              ? 'تحذير من المشرف – نظام الصيانة' 
              : 'ملاحظة من المشرف – نظام الصيانة'
          };
          
          await sendNotificationEmail(
            actionType === 'warning' ? 'supervisorWarning' : 'supervisorNote',
            data,
            inspectedUser.email
          );
        }
      } catch (emailError) {
        console.error('❌ خطأ في إرسال إشعار إجراء المشرف:', emailError.message);
      }
    });

    res.json({
      success: true,
      message: 'تم تنفيذ إجراء المشرف بنجاح'
    });
  } catch (error) {
    console.error('Error adding supervisor action:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تنفيذ إجراء المشرف',
      error: error.message
    });
  }
};

// تصدير إلى PDF
exports.exportToPDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    const maintenance = await Maintenance.findById(id)
      .populate('inspectedBy', 'name email');
    
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }
    
    const doc = new PDFDocument({ margin: 50, size: 'A4', rtl: true });
    
    // تعيين رؤوس الاستجابة
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="maintenance-${maintenance.plateNumber}-${maintenance.inspectionMonth}.pdf"`);
    
    // توصيل PDF بالاستجابة
    doc.pipe(res);
    
    // إضافة المحتوى
    this._generatePDFContent(doc, maintenance);
    
    // إنهاء PDF
    doc.end();
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تصدير PDF',
      error: error.message
    });
  }
};

// تصدير إلى Excel
exports.exportToExcel = async (req, res) => {
  try {
    const { id } = req.params;
    
    const maintenance = await Maintenance.findById(id);
    
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الصيانة غير موجود'
      });
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('سجل الصيانة');
    
    // إضافة الرؤوس
    worksheet.columns = [
      { header: 'التاريخ', key: 'date', width: 15 },
      { header: 'رقم الهوية', key: 'driverId', width: 15 },
      { header: 'اسم السائق', key: 'driverName', width: 20 },
      { header: 'رقم التانكي', key: 'tankNumber', width: 15 },
      { header: 'رقم اللوحة', key: 'plateNumber', width: 15 },
      { header: 'سلامة المركبة', key: 'vehicleSafety', width: 15 },
      { header: 'سلامة السائق', key: 'driverSafety', width: 15 },
      { header: 'صيانة الكهرباء', key: 'electricalMaintenance', width: 15 },
      { header: 'صيانة الميكانيكا', key: 'mechanicalMaintenance', width: 15 },
      { header: 'فحص التانكي', key: 'tankInspection', width: 15 },
      { header: 'الملاحظات', key: 'notes', width: 30 },
      { header: 'الحالة', key: 'status', width: 15 }
    ];
    
    // إضافة صفوف البيانات
    maintenance.dailyChecks.forEach(check => {
      worksheet.addRow({
        date: moment(check.date).format('YYYY-MM-DD'),
        driverId: maintenance.driverId,
        driverName: maintenance.driverName,
        tankNumber: maintenance.tankNumber,
        plateNumber: maintenance.plateNumber,
        vehicleSafety: check.vehicleSafety || 'لم يتم',
        driverSafety: check.driverSafety || 'لم يتم',
        electricalMaintenance: check.electricalMaintenance || 'لم يتم',
        mechanicalMaintenance: check.mechanicalMaintenance || 'لم يتم',
        tankInspection: check.tankInspection || 'لم يتم',
        notes: check.notes || '',
        status: this._translateStatus(check.status)
      });
    });
    
    // تعيين رؤوس الاستجابة
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="maintenance-${maintenance.plateNumber}-${maintenance.inspectionMonth}.xlsx"`);
    
    // الكتابة إلى الاستجابة
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تصدير Excel',
      error: error.message
    });
  }
};

// تصدير التقرير الشهري
exports.exportMonthlyReport = async (req, res) => {
  try {
    const { month } = req.params;
    
    const maintenanceRecords = await Maintenance.find({ inspectionMonth: month })
      .populate('inspectedBy', 'name');
    
    if (maintenanceRecords.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد سجلات صيانة لهذا الشهر'
      });
    }
    
    const workbook = new ExcelJS.Workbook();
    
    // ورقة الملخص
    const summarySheet = workbook.addWorksheet('ملخص الشهر');
    
    summarySheet.columns = [
      { header: 'رقم اللوحة', key: 'plateNumber', width: 15 },
      { header: 'اسم السائق', key: 'driverName', width: 20 },
      { header: 'إجمالي الأيام', key: 'totalDays', width: 15 },
      { header: 'الأيام المكتملة', key: 'completedDays', width: 15 },
      { header: 'الأيام المعلقة', key: 'pendingDays', width: 15 },
      { header: 'نسبة الإنجاز', key: 'completionRate', width: 15 },
      { header: 'الحالة', key: 'monthlyStatus', width: 15 }
    ];
    
    maintenanceRecords.forEach(record => {
      const completionRate = ((record.completedDays / record.totalDays) * 100).toFixed(2);
      
      summarySheet.addRow({
        plateNumber: record.plateNumber,
        driverName: record.driverName,
        totalDays: record.totalDays,
        completedDays: record.completedDays,
        pendingDays: record.pendingDays,
        completionRate: `${completionRate}%`,
        monthlyStatus: record.monthlyStatus
      });
    });
    
    // ورقة مفصلة لكل مركبة
    maintenanceRecords.forEach(record => {
      const vehicleSheet = workbook.addWorksheet(record.plateNumber);
      
      vehicleSheet.columns = [
        { header: 'التاريخ', key: 'date', width: 15 },
        { header: 'سلامة المركبة', key: 'vehicleSafety', width: 15 },
        { header: 'سلامة السائق', key: 'driverSafety', width: 15 },
        { header: 'صيانة الكهرباء', key: 'electricalMaintenance', width: 15 },
        { header: 'صيانة الميكانيكا', key: 'mechanicalMaintenance', width: 15 },
        { header: 'فحص التانكي', key: 'tankInspection', width: 15 },
        { header: 'فحص الإطارات', key: 'tiresInspection', width: 15 },
        { header: 'فحص الفرامل', key: 'brakesInspection', width: 15 },
        { header: 'فحص الأضواء', key: 'lightsInspection', width: 15 },
        { header: 'فحص السوائل', key: 'fluidsCheck', width: 15 },
        { header: 'معدات الطوارئ', key: 'emergencyEquipment', width: 15 },
        { header: 'الملاحظات', key: 'notes', width: 30 },
        { header: 'نتيجة الفحص', key: 'inspectionResult', width: 18 },
        { header: 'نوع الصيانة', key: 'maintenanceType', width: 18 },
        { header: 'تكلفة الصيانة', key: 'maintenanceCost', width: 15 },
        { header: 'فواتير الصيانة', key: 'maintenanceInvoices', width: 30 },
        { header: 'تم بواسطة', key: 'checkedByName', width: 20 },
        { header: 'الحالة', key: 'status', width: 15 }
      ];
      
      record.dailyChecks.forEach(check => {
        vehicleSheet.addRow({
          date: moment(check.date).format('YYYY-MM-DD'),
          vehicleSafety: check.vehicleSafety || 'لم يتم',
          driverSafety: check.driverSafety || 'لم يتم',
          electricalMaintenance: check.electricalMaintenance || 'لم يتم',
          mechanicalMaintenance: check.mechanicalMaintenance || 'لم يتم',
          tankInspection: check.tankInspection || 'لم يتم',
          tiresInspection: check.tiresInspection || 'لم يتم',
          brakesInspection: check.brakesInspection || 'لم يتم',
          lightsInspection: check.lightsInspection || 'لم يتم',
          fluidsCheck: check.fluidsCheck || 'لم يتم',
          emergencyEquipment: check.emergencyEquipment || 'لم يتم',
          notes: check.notes || '',
          inspectionResult: check.inspectionResult || '',
          maintenanceType: check.maintenanceType || '',
          maintenanceCost: check.maintenanceCost != null ? check.maintenanceCost : '',
          maintenanceInvoices: formatInvoices(check.maintenanceInvoices || []),
          checkedByName: check.checkedByName || '',
          status: this._translateStatus(check.status)
        });
      });
    });
    
    // تعيين رؤوس الاستجابة
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="maintenance-report-${month}.xlsx"`);
    
    // الكتابة إلى الاستجابة
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting monthly report:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تصدير التقرير الشهري',
      error: error.message
    });
  }
};

// الحصول على إحصائيات شهرية
exports.getMonthlyStats = async (req, res) => {
  try {
    const { month } = req.params;
    
    const maintenanceRecords = await Maintenance.find({ inspectionMonth: month });
    
    const stats = {
      totalVehicles: maintenanceRecords.length,
      totalDays: 0,
      completedDays: 0,
      pendingDays: 0,
      completionRate: 0,
      vehiclesByStatus: {
        مكتمل: 0,
        غير_مكتمل: 0,
        تحت_المراجعة: 0,
        مرفوض: 0
      },
      checksByType: {
        vehicleSafety: { تم: 0, لم_يتم: 0, غير_مطلوب: 0 },
        driverSafety: { تم: 0, لم_يتم: 0, غير_مطلوب: 0 },
        electricalMaintenance: { تم: 0, لم_يتم: 0, غير_مطلوب: 0 },
        mechanicalMaintenance: { تم: 0, لم_يتم: 0, غير_مطلوب: 0 }
      }
    };
    
    maintenanceRecords.forEach(record => {
      stats.totalDays += record.totalDays;
      stats.completedDays += record.completedDays;
      stats.pendingDays += record.pendingDays;
      
      if (record.monthlyStatus) {
        stats.vehiclesByStatus[record.monthlyStatus] = 
          (stats.vehiclesByStatus[record.monthlyStatus] || 0) + 1;
      }
      
      // تجميع أنواع الفحوصات
      record.dailyChecks.forEach(check => {
        if (check.status === 'approved') {
          ['vehicleSafety', 'driverSafety', 'electricalMaintenance', 'mechanicalMaintenance'].forEach(type => {
            if (check[type]) {
              stats.checksByType[type][check[type]] = 
                (stats.checksByType[type][check[type]] || 0) + 1;
            }
          });
        }
      });
    });
    
    stats.completionRate = stats.totalDays > 0 
      ? ((stats.completedDays / stats.totalDays) * 100).toFixed(2)
      : 0;
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting monthly stats:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الإحصائيات',
      error: error.message
    });
  }
};

// الحصول على إحصائيات المركبة
exports.getVehicleStats = async (req, res) => {
  try {
    const { plateNumber } = req.params;

    const records = await Maintenance.find({ plateNumber });
    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد سجلات لهذه المركبة'
      });
    }

    let totalDays = 0;
    let completedDays = 0;

    records.forEach(r => {
      totalDays += r.totalDays;
      completedDays += r.completedDays;
    });

    const completionRate =
      totalDays > 0 ? ((completedDays / totalDays) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        plateNumber,
        totalRecords: records.length,
        totalDays,
        completedDays,
        completionRate: `${completionRate}%`
      }
    });
  } catch (error) {
    console.error('Error getting vehicle stats:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب إحصائيات المركبة',
      error: error.message
    });
  }
};

// ===================== دوال المساعدة الداخلية =====================

exports._generatePDFContent = (doc, maintenance) => {
  // العنوان
  doc.fontSize(20).text('تقرير الصيانة الدورية', { align: 'center' });
  doc.moveDown();
  const formatDate = (value) => (value ? moment(value).format('YYYY-MM-DD') : '-');
  
  // معلومات المركبة والسائق
  doc.fontSize(14).text('معلومات المركبة والسائق', { underline: true });
  doc.moveDown();
  
  const infoRows = [
    ['رقم اللوحة:', maintenance.plateNumber],
    ['رقم التانكي:', maintenance.tankNumber],
    ['اسم السائق:', maintenance.driverName],
    ['رقم هوية السائق:', maintenance.driverId],
    ['نوع المركبة:', maintenance.vehicleType],
    ['شهر التفتيش:', maintenance.inspectionMonth],
    ['المفتش:', maintenance.inspectedByName]
  ];
  
  infoRows.forEach(row => {
    doc.fontSize(12).text(`${row[0]} ${row[1]}`);
  });
  
  doc.moveDown();
  
  // جدول الفحوصات اليومية
  doc.fontSize(14).text('سجل الفحوصات اليومية', { underline: true });
  doc.moveDown();
  
  // رؤوس الجدول
  const tableTop = doc.y;
  const tableLeft = 50;
  const colWidths = [60, 70, 70, 70, 70, 100];
  
  const headers = ['التاريخ', 'سلامة المركبة', 'سلامة السائق', 'كهرباء', 'ميكانيكا', 'الملاحظات'];
  
  headers.forEach((header, i) => {
    doc.fontSize(10).text(header, tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop, {
      width: colWidths[i],
      align: 'center'
    });
  });
  
  // صفوف الجدول
  let y = tableTop + 20;
  
  maintenance.dailyChecks.forEach(check => {
    if (y > 700) { // صفحة جديدة إذا اقتربنا من الأسفل
      doc.addPage();
      y = 50;
    }
    
    const maintenanceSummaryParts = [];
    if (check.inspectionResult) {
      maintenanceSummaryParts.push(`نتيجة: ${check.inspectionResult}`);
    }
    if (check.maintenanceType) {
      maintenanceSummaryParts.push(`نوع: ${check.maintenanceType}`);
    }
    if (check.maintenanceCost != null) {
      maintenanceSummaryParts.push(`تكلفة: ${check.maintenanceCost}`);
    }
    if (check.maintenanceInvoices && check.maintenanceInvoices.length > 0) {
      maintenanceSummaryParts.push(`فواتير: ${formatInvoices(check.maintenanceInvoices)}`);
    }

    const notesText = [check.notes, maintenanceSummaryParts.join(' | ')]
      .filter(Boolean)
      .join(' | ');

    const row = [
      moment(check.date).format('DD/MM'),
      check.vehicleSafety || 'لم يتم',
      check.driverSafety || 'لم يتم',
      check.electricalMaintenance || 'لم يتم',
      check.mechanicalMaintenance || 'لم يتم',
      notesText
    ];
    
    row.forEach((cell, i) => {
      doc.fontSize(9).text(cell, tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, {
        width: colWidths[i],
        align: 'center'
      });
    });
    
    y += 20;
  });
  
  // الملخص
  doc.addPage();
  doc.fontSize(14).text('ملخص الشهر', { underline: true });
  doc.moveDown();
  
  const summaryRows = [
    ['إجمالي أيام الشهر:', maintenance.totalDays],
    ['الأيام المكتملة:', maintenance.completedDays],
    ['الأيام المعلقة:', maintenance.pendingDays],
    ['نسبة الإنجاز:', `${((maintenance.completedDays / maintenance.totalDays) * 100).toFixed(2)}%`],
    ['الحالة النهائية:', maintenance.monthlyStatus]
  ];
  
  summaryRows.forEach(row => {
    doc.fontSize(12).text(`${row[0]} ${row[1]}`);
  });
  
  // التذييل
  doc.fontSize(10);
  doc.text('تاريخ التصدير: ' + moment().format('YYYY-MM-DD HH:mm'), 50, doc.page.height - 50, {
    align: 'center'
  });
};

exports._translateStatus = (status) => {
  const translations = {
    'pending': 'معلق',
    'approved': 'معتمد',
    'rejected': 'مرفوض',
    'under_review': 'قيد المراجعة'
  };
  return translations[status] || status;
};

exports._getSupervisors = async () => {
  try {
    const supervisors = await User.find({ role: 'supervisor' }).select('_id');
    return supervisors.map(s => s._id);
  } catch (error) {
    console.error('Error getting supervisors:', error);
    return [];
  }
};
