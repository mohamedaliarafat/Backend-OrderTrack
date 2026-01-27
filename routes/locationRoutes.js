const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticate, authorize } = require('../middleware/auth');

// التحقق من الموقع (بدون مصادقة)
router.post('/verify', locationController.verifyLocation);

// جميع المسارات الأخرى تتطلب مصادقة
router.use(authenticate);

// المواقع
router.get('/', authorize(['admin', 'hr', 'manager']), locationController.getAllLocations);
router.get('/:id/employees', authorize(['admin', 'hr', 'manager']), locationController.getLocationEmployees);
router.post('/', authorize(['admin', 'hr', 'manager']), locationController.createLocation);
router.put('/:id', authorize(['admin', 'hr', 'manager']), locationController.updateLocation);
router.put('/:id/status', authorize(['admin', 'hr', 'manager']), locationController.toggleLocationStatus);
router.delete('/:id', authorize(['admin']), locationController.deleteLocation);

module.exports = router;