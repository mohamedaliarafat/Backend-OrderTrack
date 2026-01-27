const express = require('express');
const router = express.Router();
const advanceController = require('../controllers/advanceController');
const { authenticate, authorize } = require('../middleware/auth');

// جميع المسارات تتطلب مصادقة
router.use(authenticate);

// السلف
router.get('/', authorize(['admin', 'hr', 'accountant', 'manager']), advanceController.getAllAdvances);
router.get('/employee/:id', authorize(['admin', 'hr', 'accountant', 'manager', 'employee']), advanceController.getEmployeeAdvances);
router.post('/', authorize(['admin', 'hr', 'accountant', 'employee']), advanceController.requestAdvance);
router.put('/:id/approve', authorize(['admin', 'hr', 'accountant', 'manager']), advanceController.approveAdvance);
router.put('/:id/reject', authorize(['admin', 'hr', 'accountant', 'manager']), advanceController.rejectAdvance);
router.put('/:id/pay', authorize(['admin', 'accountant']), advanceController.payAdvance);
router.put('/:id/repayment', authorize(['admin', 'hr', 'accountant', 'manager']), advanceController.updateRepayment);

module.exports = router;