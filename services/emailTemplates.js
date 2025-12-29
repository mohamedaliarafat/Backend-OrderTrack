exports.orderCreatedTemplate = (order) => `
<div style="font-family:Arial;padding:20px">
  <h2>📦 تم إنشاء طلب جديد</h2>
  <p><strong>رقم الطلب:</strong> ${order.orderNumber}</p>
  <p><strong>المورد:</strong> ${order.supplierName || '-'}</p>
  <p><strong>وقت التحميل:</strong> ${order.loadingDate.toLocaleDateString('ar-SA')} ${order.loadingTime}</p>
  <p><strong>وقت الوصول:</strong> ${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}</p>
  <hr/>
  <p>نظام إدارة الطلبات</p>
</div>
`;

exports.orderStatusTemplate = (order, oldStatus) => `
<div style="font-family:Arial;padding:20px">
  <h2>🔄 تحديث حالة الطلب</h2>
  <p><strong>رقم الطلب:</strong> ${order.orderNumber}</p>
  <p><strong>الحالة السابقة:</strong> ${oldStatus}</p>
  <p><strong>الحالة الجديدة:</strong> ${order.status}</p>
</div>
`;

exports.orderUpdatedTemplate = (order, changes, updatedByName) => `
<div style="font-family:Arial;padding:20px">
  <h2>✏️ تم تحديث الطلب</h2>

  <p><strong>رقم الطلب:</strong> ${order.orderNumber}</p>
  <p><strong>تم التحديث بواسطة:</strong> ${updatedByName}</p>

  <h3>التغييرات:</h3>
  <ul>
    ${Object.entries(changes)
      .map(
        ([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`
      )
      .join('')}
  </ul>

  <hr/>
  <p>نظام إدارة الطلبات</p>
</div>
`;

exports.orderStatusTemplate = (order, oldStatus, newStatus, updatedBy) => `
<div style="font-family:Arial;padding:20px">
  <h2>🔄 تحديث حالة الطلب</h2>

  <p><strong>رقم الطلب:</strong> ${order.orderNumber}</p>
  <p><strong>تم التحديث بواسطة:</strong> ${updatedBy}</p>

  <p><strong>الحالة السابقة:</strong> ${oldStatus}</p>
  <p><strong>الحالة الجديدة:</strong> ${newStatus}</p>

  <hr/>
  <p>نظام إدارة الطلبات</p>
</div>
`;



exports.arrivalReminderTemplate = (order, timeRemaining) => `
<div style="font-family:Arial;padding:20px">
  <h2>⏰ تذكير بقرب وقت الوصول</h2>
  <p>الطلب <strong>${order.orderNumber}</strong></p>
  <p>سيصل خلال: <strong>${timeRemaining}</strong></p>
  <p>وقت الوصول المتوقع:</p>
  <p>${order.arrivalDate.toLocaleDateString('ar-SA')} ${order.arrivalTime}</p>
</div>
`;

exports.orderDeletedTemplate = (orderNumber) => `
<div style="font-family:Arial;padding:20px">
  <h2>🗑️ تم حذف طلب</h2>
  <p>رقم الطلب: <strong>${orderNumber}</strong></p>
</div>
`;
