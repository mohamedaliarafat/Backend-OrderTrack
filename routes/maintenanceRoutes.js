const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { authMiddleware } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Create new maintenance record
router.post('/', maintenanceController.createMaintenance);

// Get all maintenance records with filtering
router.get('/', maintenanceController.getAllMaintenance);

// Get maintenance by ID
router.get('/:id', maintenanceController.getMaintenanceById);

// Update maintenance record
router.put('/:id', maintenanceController.updateMaintenance);

// Delete maintenance record
router.delete('/:id', maintenanceController.deleteMaintenance);

// Daily check operations
router.post('/:id/daily-check', maintenanceController.addDailyCheck);
router.put('/:id/daily-check/:checkId', maintenanceController.updateDailyCheck);
router.delete('/:id/daily-check/:checkId', maintenanceController.deleteDailyCheck);

// Supervisor actions
router.post('/:id/supervisor-action', maintenanceController.addSupervisorAction);
router.post('/:id/send-warning', maintenanceController.sendWarning);
router.post('/:id/send-note', maintenanceController.sendNote);

// Approval/Rejection
router.post('/:id/approve-check/:checkId', maintenanceController.approveCheck);
router.post('/:id/reject-check/:checkId', maintenanceController.rejectCheck);

// Reports and Exports
router.get('/:id/export/pdf', maintenanceController.exportToPDF);
router.get('/:id/export/excel', maintenanceController.exportToExcel);
router.get('/export/monthly/:month', maintenanceController.exportMonthlyReport);

// Statistics
router.get('/stats/monthly/:month', maintenanceController.getMonthlyStats);
router.get('/stats/vehicle/:plateNumber', maintenanceController.getVehicleStats);

// // Notifications
// router.get('/notifications/unread', maintenanceController.getUnreadNotifications);
// router.post('/notifications/:notificationId/read', maintenanceController.markNotificationAsRead);

module.exports = router;