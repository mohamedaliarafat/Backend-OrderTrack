const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authMiddleware } = require('../middleware/authMiddleware');

// جميع المسارات تتطلب مصادقة
router.use(authMiddleware);

router.post('/', driverController.createDriver);
router.get('/', driverController.getDrivers);
router.get('/search', driverController.searchDrivers);
router.get('/active', driverController.getActiveDrivers);
router.get('/:id', driverController.getDriver);
router.put('/:id', driverController.updateDriver);
router.delete('/:id', driverController.deleteDriver);

module.exports = router;