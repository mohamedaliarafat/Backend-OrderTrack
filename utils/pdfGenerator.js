const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

exports.generateOrderPDF = async (order, activities) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Add company logo if exists
      if (order.companyLogo && fs.existsSync(order.companyLogo)) {
        doc.image(order.companyLogo, 50, 45, { width: 100 });
      }

      // Header
      doc.fontSize(20).text('نظام متابعة طلبات الوقود', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text('تفاصيل الطلب', { align: 'center' });
      doc.moveDown(2);

      // Order details
      doc.fontSize(12);
      
      // First column
      let y = 150;
      doc.text(`رقم الطلب: ${order.orderNumber}`, 50, y);
      doc.text(`تاريخ الطلب: ${new Date(order.orderDate).toLocaleDateString('ar-SA')}`, 50, y + 20);
      doc.text(`المورد: ${order.supplierName}`, 50, y + 40);
      doc.text(`نوع الطلب: ${order.requestType}`, 50, y + 60);
      
      // Second column
      doc.text(`تاريخ التحميل: ${new Date(order.loadingDate).toLocaleDateString('ar-SA')}`, 300, y);
      doc.text(`الحالة: ${order.status}`, 300, y + 20);
      doc.text(`اسم السائق: ${order.driverName || 'غير محدد'}`, 300, y + 40);
      doc.text(`رقم المركبة: ${order.vehicleNumber || 'غير محدد'}`, 300, y + 60);
      
      // Additional details
      y += 100;
      doc.text('تفاصيل إضافية:', 50, y);
      doc.moveDown();
      doc.text(`نوع الوقود: ${order.fuelType || 'غير محدد'}`, 70, y + 20);
      doc.text(`الكمية: ${order.quantity || 0} ${order.unit || ''}`, 70, y + 40);
      doc.text(`الملاحظات: ${order.notes || 'لا توجد ملاحظات'}`, 70, y + 60);
      
      // Created by
      doc.text(`تم الإنشاء بواسطة: ${order.createdBy?.name || 'غير معروف'}`, 50, y + 100);
      doc.text(`تاريخ الإنشاء: ${new Date(order.createdAt).toLocaleString('ar-SA')}`, 50, y + 120);

      // Activities section
      if (activities && activities.length > 0) {
        doc.addPage();
        doc.fontSize(16).text('سجل الحركات', { align: 'center' });
        doc.moveDown();
        
        activities.forEach((activity, index) => {
          const activityY = 100 + (index * 80);
          if (activityY > 700) {
            doc.addPage();
          }
          
          doc.fontSize(10);
          doc.text(`النوع: ${activity.activityType}`, 50, activityY);
          doc.text(`الوصف: ${activity.description}`, 50, activityY + 15);
          doc.text(`بواسطة: ${activity.performedByName}`, 50, activityY + 30);
          doc.text(`التاريخ: ${new Date(activity.createdAt).toLocaleString('ar-SA')}`, 50, activityY + 45);
          
          // Add separator
          doc.moveTo(50, activityY + 60).lineTo(550, activityY + 60).stroke();
        });
      }

      // Footer
      doc.fontSize(8);
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.text(
          `صفحة ${i + 1} من ${totalPages}`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );
        doc.text(
          `تم الإنشاء في: ${new Date().toLocaleString('ar-SA')}`,
          50,
          doc.page.height - 30,
          { align: 'center' }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};