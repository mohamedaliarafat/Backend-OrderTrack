const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salaryController');
const { authenticate, authorize } = require('../middleware/auth');

// جمع المسارات تتطلب مصادقة
router.use(authenticate);

// كشوف الرواتب
router.get('/', authorize(['admin', 'hr', 'accountant']), salaryController.getSalarySheets);
router.get('/export', authorize(['admin', 'hr', 'accountant']), salaryController.exportSalaries);
router.get('/employee/:id', authorize(['admin', 'hr', 'accountant', 'employee']), salaryController.getEmployeeSalary);
router.post('/create', authorize(['admin', 'hr', 'accountant']), salaryController.createSalarySheet);
router.post('/approve', authorize(['admin', 'hr', 'accountant']), salaryController.approveSalarySheet);
router.post('/pay', authorize(['admin', 'accountant']), salaryController.paySalaries);
router.put('/:id', authorize(['admin', 'hr', 'accountant']), salaryController.updateSalary);

module.exports = router;
