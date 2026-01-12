const express = require('express');
const maintenanceController = require('../controllers/maintenanceRecordController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', maintenanceController.getMaintenanceRecords);
router.post('/', maintenanceController.createMaintenanceRecord);

module.exports = router;
