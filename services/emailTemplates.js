const formatDate = (date) => {
  if (!date) return 'غير محدد';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'غير محدد';
  return d.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatTime = (time) => time || 'غير محدد';

const formatDateTime = (date, time) => {
  if (!date) return 'غير محدد';
  return `${formatDate(date)} - ${formatTime(time)}`;
};

const safe = (value) => {
  if (value === null || value === undefined || value === '') return 'غير محدد';
  return String(value);
};

const renderRows = (rows) => {
  if (!rows || rows.length === 0) return '';
  return rows
    .map(
      (row) => `
        <div class="kv-item">
          <div class="kv-label">${safe(row.label)}</div>
          <div class="kv-value">${safe(row.value)}</div>
        </div>
      `
    )
    .join('');
};

const renderChanges = (changes) => {
  if (!changes || Object.keys(changes).length === 0) return '';
  const items = Object.entries(changes)
    .map(([key, value]) => `<li><strong>${safe(key)}:</strong> ${safe(value)}</li>`)
    .join('');
  return `
    <div class="section">
      <h2 class="section-title">تفاصيل التغييرات</h2>
      <ul class="changes-list">${items}</ul>
    </div>
  `;
};

const orderEventTemplate = ({
  title,
  message,
  order = {},
  actorName,
  changes,
  note,
  badge = 'تنبيه تلقائي',
  recipientsCount
}) => {
  const summaryRows = [
    { label: 'رقم الطلب', value: order.orderNumber },
    { label: 'نوع الطلب', value: order.orderSource },
    { label: 'الحالة', value: order.status },
    { label: 'حالة الدمج', value: order.mergeStatus },
    { label: 'نوع العملية', value: order.requestType },
    { label: 'نوع الوقود', value: order.fuelType },
    { label: 'الكمية', value: order.quantity ? `${order.quantity} ${order.unit || 'لتر'}` : null },
    { label: 'المدينة', value: order.city },
    { label: 'المنطقة', value: order.area }
  ].filter((row) => row.value !== null && row.value !== undefined && row.value !== '');

  const timingRows = [
    { label: 'تاريخ الطلب', value: formatDate(order.orderDate) },
    { label: 'موعد التحميل', value: formatDateTime(order.loadingDate, order.loadingTime) },
    { label: 'موعد الوصول', value: formatDateTime(order.arrivalDate, order.arrivalTime) }
  ];

  const partyRows = [
    { label: 'المورد', value: order.supplierName },
    { label: 'العميل', value: order.customerName }
  ].filter((row) => row.value);

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${safe(title)}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          background: radial-gradient(circle at top, #152238, #0b1324 70%);
          color: #0f172a;
        }
        .email-shell {
          max-width: 960px;
          margin: 30px auto;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(5, 15, 35, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.4);
        }
        .header {
          padding: 36px 40px;
          background: linear-gradient(135deg, rgba(8, 31, 64, 0.98), rgba(17, 74, 128, 0.92));
          color: #f8fafc;
          position: relative;
        }
        .header::after {
          content: '';
          position: absolute;
          right: -80px;
          top: -60px;
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.35), transparent 70%);
        }
        .header h1 {
          margin: 0 0 10px;
          font-size: 26px;
          font-weight: 700;
        }
        .header p {
          margin: 0;
          opacity: 0.85;
          font-size: 15px;
        }
        .badge {
          display: inline-block;
          margin-top: 18px;
          padding: 6px 16px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.3);
          font-size: 13px;
          letter-spacing: 0.3px;
        }
        .content {
          padding: 36px 40px 24px;
        }
        .section {
          background: rgba(255, 255, 255, 0.9);
          border-radius: 16px;
          padding: 22px 24px;
          margin-bottom: 22px;
          border: 1px solid rgba(148, 163, 184, 0.25);
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        }
        .section-title {
          font-size: 18px;
          color: #0f172a;
          margin-bottom: 16px;
          border-bottom: 2px solid rgba(148, 163, 184, 0.3);
          padding-bottom: 8px;
        }
        .message-box {
          background: linear-gradient(135deg, rgba(15, 118, 110, 0.12), rgba(14, 116, 144, 0.12));
          padding: 18px 20px;
          border-radius: 14px;
          border: 1px solid rgba(14, 116, 144, 0.2);
          color: #0f172a;
          font-size: 15px;
        }
        .kv-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }
        .kv-item {
          background: rgba(15, 23, 42, 0.04);
          border-radius: 12px;
          padding: 12px 14px;
          border: 1px solid rgba(15, 23, 42, 0.08);
        }
        .kv-label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 6px;
        }
        .kv-value {
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
        }
        .changes-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .changes-list li {
          background: rgba(30, 64, 175, 0.08);
          padding: 10px 12px;
          border-radius: 10px;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .footer {
          padding: 20px 40px 28px;
          background: linear-gradient(135deg, rgba(11, 18, 36, 0.95), rgba(15, 23, 42, 0.95));
          color: rgba(248, 250, 252, 0.8);
          text-align: center;
          font-size: 12px;
        }
        .footer strong {
          color: #f8fafc;
        }
        @media (max-width: 600px) {
          .header, .content, .footer {
            padding: 22px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-shell">
        <div class="header">
          <h1>${safe(title)}</h1>
          <p>${safe(message)}</p>
          <div class="badge">${safe(badge)}</div>
        </div>

        <div class="content">
          <div class="section">
            <h2 class="section-title">ملخص الحدث</h2>
            <div class="message-box">
              <p style="margin: 0 0 8px;">${safe(message)}</p>
              <p style="margin: 0; font-size: 13px; color: #475569;">
                تم بواسطة: ${safe(actorName || 'النظام')} • ${formatDate(new Date())}
              </p>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">بيانات الطلب</h2>
            <div class="kv-grid">${renderRows(summaryRows)}</div>
          </div>

          <div class="section">
            <h2 class="section-title">مواعيد التنفيذ</h2>
            <div class="kv-grid">${renderRows(timingRows)}</div>
          </div>

          ${partyRows.length ? `
          <div class="section">
            <h2 class="section-title">الأطراف المرتبطة</h2>
            <div class="kv-grid">${renderRows(partyRows)}</div>
          </div>
          ` : ''}

          ${renderChanges(changes)}

          ${note ? `
          <div class="section">
            <h2 class="section-title">ملاحظات إضافية</h2>
            <div class="message-box">${safe(note)}</div>
          </div>
          ` : ''}
        </div>

        <div class="footer">
          <div><strong>شركة البحيرة العربية - نظام إدارة الطلبات</strong></div>
          ${recipientsCount ? `<div>تم إرسال الإشعار إلى ${recipientsCount} مستخدم</div>` : ''}
          <div>هذه رسالة تلقائية، يرجى عدم الرد عليها.</div>
        </div>
      </div>
    </body>
    </html>
  `;
};

exports.orderEventTemplate = orderEventTemplate;

exports.orderCreatedTemplate = (order, actorName) => orderEventTemplate({
  title: `تم إنشاء الطلب ${safe(order?.orderNumber)}`,
  message: 'تم إنشاء طلب جديد داخل النظام.',
  order,
  actorName,
  badge: 'إنشاء طلب'
});

exports.orderUpdatedTemplate = (order, changes, updatedByName) => orderEventTemplate({
  title: `تم تعديل الطلب ${safe(order?.orderNumber)}`,
  message: 'تم تحديث بيانات الطلب.',
  order,
  actorName: updatedByName,
  changes,
  badge: 'تحديث طلب'
});

exports.orderStatusTemplate = (order, oldStatus, newStatus, updatedBy, reason) => orderEventTemplate({
  title: `تحديث حالة الطلب ${safe(order?.orderNumber)}`,
  message: `تم تغيير الحالة من "${safe(oldStatus)}" إلى "${safe(newStatus)}".`,
  order,
  actorName: updatedBy,
  changes: reason ? { 'سبب التغيير': reason } : null,
  badge: 'تغيير حالة'
});

exports.arrivalReminderTemplate = (order, timeRemaining) => orderEventTemplate({
  title: `تذكير بوصول الطلب ${safe(order?.orderNumber)}`,
  message: `متبقي ${safe(timeRemaining)} على موعد الوصول.`,
  order,
  badge: 'تذكير وصول'
});

exports.orderDeletedTemplate = (order, deletedByName) => orderEventTemplate({
  title: `تم حذف الطلب ${safe(order?.orderNumber)}`,
  message: 'تم حذف الطلب من النظام.',
  order,
  actorName: deletedByName,
  badge: 'حذف طلب'
});

exports.mergeSupplierTemplate = (order, partnerInfo) => orderEventTemplate({
  title: `تم دمج طلب المورد ${safe(order?.orderNumber)}`,
  message: `تم دمج الطلب مع طلب العميل ${safe(partnerInfo?.orderNumber)}.`,
  order,
  note: `العميل: ${safe(partnerInfo?.partyName)}`,
  badge: 'دمج طلبات'
});

exports.mergeCustomerTemplate = (order, partnerInfo) => orderEventTemplate({
  title: `تم دمج طلب العميل ${safe(order?.orderNumber)}`,
  message: `تم دمج الطلب مع طلب المورد ${safe(partnerInfo?.orderNumber)}.`,
  order,
  note: `المورد: ${safe(partnerInfo?.partyName)}`,
  badge: 'دمج طلبات'
});
