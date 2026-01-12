const express = require('express');
const technicianLocationController = require('../controllers/technicianLocationController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', technicianLocationController.getTechnicianLocations);
router.post('/', technicianLocationController.createTechnicianLocation);

module.exports = router;
