const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/customers', reportController.customerReports);
router.get('/drivers', reportController.driverReports);
router.get('/suppliers', reportController.supplierReports);
router.get('/users', reportController.userReports);
router.get('/invoice/:orderId', reportController.invoiceReport);

// ✅ التصدير
router.get('/export/pdf', reportController.exportPDF);
router.get('/export/excel', reportController.exportExcel);

module.exports = router;
