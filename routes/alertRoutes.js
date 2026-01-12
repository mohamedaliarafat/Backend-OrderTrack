const express = require('express');
const alertController = require('../controllers/alertController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', alertController.getAlerts);
router.post('/', alertController.createAlert);

module.exports = router;
