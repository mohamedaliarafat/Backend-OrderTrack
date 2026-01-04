const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', activityController.getActivities);
router.post('/', activityController.addActivity);
router.get('/order/:orderId', activityController.getActivitiesByOrder);

module.exports = router;
