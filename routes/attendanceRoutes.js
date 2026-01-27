const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');

// تسجيل الحضور/الانصراف بالبصمة (بدون مصادقة)
router.post('/fingerprint', attendanceController.recordAttendance);

// جميع المسارات الأخرى تتطلب مصادقة
router.use(authenticate);

// سجلات الحضور
router.get('/', authorize(['admin', 'hr', 'manager', 'supervisor']), attendanceController.getAttendanceRecords);
router.get('/employee/:id', authorize(['admin', 'hr', 'manager', 'supervisor']), attendanceController.getEmployeeAttendanceReport);
router.post('/manual', authorize(['admin', 'hr', 'manager']), attendanceController.manualAttendance);
router.put('/:id', authorize(['admin', 'hr', 'manager']), attendanceController.updateAttendance);
router.post('/leave', authorize(['admin', 'hr', 'manager']), attendanceController.recordLeave);

module.exports = router;