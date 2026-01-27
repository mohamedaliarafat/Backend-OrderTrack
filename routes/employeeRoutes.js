const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.Controller');
const { authenticate, authorize } = require('../middleware/auth');

// جميع المسارات تتطلب مصادقة
router.use(authenticate);

// الموظفين
router.get('/', authorize(['admin', 'hr', 'manager']), employeeController.getAllEmployees);
router.get('/export', authorize(['admin', 'hr']), employeeController.exportEmployees);
router.get('/:id', authorize(['admin', 'hr', 'manager']), employeeController.getEmployeeById);
router.post('/', authorize(['admin', 'hr']), employeeController.createEmployee);
router.put('/:id', authorize(['admin', 'hr']), employeeController.updateEmployee);
router.delete('/:id', authorize(['admin']), employeeController.deleteEmployee);
router.put('/:id/status', authorize(['admin', 'hr']), employeeController.changeEmployeeStatus);

// البصمة
router.post('/:id/fingerprint', authorize(['admin', 'hr']), employeeController.registerFingerprint);

// مواقع العمل
router.put('/:id/locations', authorize(['admin', 'hr', 'manager']), employeeController.assignLocations);

module.exports = router;