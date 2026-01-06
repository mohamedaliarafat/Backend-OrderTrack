const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const reshape = require('arabic-persian-reshaper');
const bidi = require('bidi-js');

const FONT_AR = path.join(__dirname, '../assets/fonts/Cairo-Regular.ttf');

// ===============================
// 🅰️ RTL Helpers
// ===============================
function rtl(text) {
  if (!text) return '';
  const reshaped = reshape(text.toString());
  return bidi.fromString(reshaped).toString();
}

function drawRTLText(doc, text, x, y, width, options = {}) {
  doc.text(
    rtl(text),
    x,
    y,
    {
      width,
      align: 'right',
      lineGap: 4,
      ...options,
    }
  );
}

// ===============================
// 📄 Generate Order PDF
// ===============================
exports.generateOrderPDF = async (order, activities) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        bufferPages: true,
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Register Arabic font
      doc.registerFont('Arabic', FONT_AR);
      doc.font('Arabic');

      const pageWidth = doc.page.width - 100;
      let y = 50;

      // ===============================
      // 🏢 Logo
      // ===============================
      if (order.companyLogo && fs.existsSync(order.companyLogo)) {
        doc.image(order.companyLogo, 50, y, { width: 90 });
      }

      // ===============================
      // 📌 Header
      // ===============================
      drawRTLText(doc, 'نظام متابعة طلبات الوقود', 50, y, pageWidth, {
        align: 'center',
      });
      y += 30;

      drawRTLText(doc, 'تفاصيل الطلب', 50, y, pageWidth, {
        align: 'center',
      });
      y += 40;

      // ===============================
      // 📦 Order Info (Two Columns RTL-safe)
      // ===============================
      const boxWidth = (pageWidth / 2) - 10;
      const rightX = 50 + boxWidth + 20;
      const leftX = 50;

      drawRTLText(doc, `رقم الطلب: ${order.orderNumber}`, rightX, y, boxWidth);
      drawRTLText(
        doc,
        `تاريخ الطلب: ${new Date(order.orderDate).toLocaleDateString('ar-SA')}`,
        leftX,
        y,
        boxWidth
      );

      y += 22;
      drawRTLText(doc, `المورد: ${order.supplierName}`, rightX, y, boxWidth);
      drawRTLText(doc, `الحالة: ${order.status}`, leftX, y, boxWidth);

      y += 22;
      drawRTLText(doc, `نوع الطلب: ${order.requestType}`, rightX, y, boxWidth);
      drawRTLText(
        doc,
        `تاريخ التحميل: ${
          order.loadingDate
            ? new Date(order.loadingDate).toLocaleDateString('ar-SA')
            : '—'
        }`,
        leftX,
        y,
        boxWidth
      );

      y += 22;
      drawRTLText(
        doc,
        `اسم السائق: ${order.driverName || 'غير محدد'}`,
        rightX,
        y,
        boxWidth
      );
      drawRTLText(
        doc,
        `رقم المركبة: ${order.vehicleNumber || 'غير محدد'}`,
        leftX,
        y,
        boxWidth
      );

      // ===============================
      // 🔍 Additional Details
      // ===============================
      y += 40;
      drawRTLText(doc, 'تفاصيل إضافية', 50, y, pageWidth);
      y += 20;

      drawRTLText(
        doc,
        `نوع الوقود: ${order.fuelType || 'غير محدد'}`,
        50,
        y,
        pageWidth
      );
      y += 18;

      drawRTLText(
        doc,
        `الكمية: ${order.quantity || 0} ${order.unit || ''}`,
        50,
        y,
        pageWidth
      );
      y += 18;

      drawRTLText(
        doc,
        `الملاحظات: ${order.notes || 'لا توجد ملاحظات'}`,
        50,
        y,
        pageWidth
      );

      // ===============================
      // 👤 Created By
      // ===============================
      y += 30;
      drawRTLText(
        doc,
        `تم الإنشاء بواسطة: ${order.createdBy?.name || 'غير معروف'}`,
        50,
        y,
        pageWidth
      );
      y += 18;

      drawRTLText(
        doc,
        `تاريخ الإنشاء: ${new Date(order.createdAt).toLocaleString('ar-SA')}`,
        50,
        y,
        pageWidth
      );

      // ===============================
      // 🔄 Activities
      // ===============================
      if (activities && activities.length > 0) {
        doc.addPage();
        y = 50;

        drawRTLText(doc, 'سجل الحركات', 50, y, pageWidth, {
          align: 'center',
        });
        y += 30;

        activities.forEach((activity) => {
          if (y > doc.page.height - 120) {
            doc.addPage();
            y = 50;
          }

          drawRTLText(
            doc,
            `النوع: ${activity.activityType}`,
            50,
            y,
            pageWidth
          );
          y += 16;

          drawRTLText(
            doc,
            `الوصف: ${activity.description}`,
            50,
            y,
            pageWidth
          );
          y += 16;

          drawRTLText(
            doc,
            `بواسطة: ${activity.performedByName}`,
            50,
            y,
            pageWidth
          );
          y += 16;

          drawRTLText(
            doc,
            `التاريخ: ${new Date(activity.createdAt).toLocaleString('ar-SA')}`,
            50,
            y,
            pageWidth
          );

          y += 20;
          doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
          y += 20;
        });
      }

      // ===============================
      // 📎 Footer
      // ===============================
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8);

        drawRTLText(
          doc,
          `صفحة ${i + 1} من ${range.count}`,
          50,
          doc.page.height - 45,
          pageWidth,
          { align: 'center' }
        );

        drawRTLText(
          doc,
          `تم الإنشاء في: ${new Date().toLocaleString('ar-SA')}`,
          50,
          doc.page.height - 30,
          pageWidth,
          { align: 'center' }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
