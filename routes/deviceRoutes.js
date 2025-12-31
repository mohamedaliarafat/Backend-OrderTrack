const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const deviceController = require('../controllers/deviceController');

router.use(authMiddleware);

// تسجيل/تحديث توكن
router.post('/register', deviceController.registerDevice);

// حذف توكن (logout أو disable)
router.post('/unregister', deviceController.unregisterDevice);

// ping لتحديث lastUsedAt
router.post('/ping', deviceController.pingDevice);

module.exports = router;
