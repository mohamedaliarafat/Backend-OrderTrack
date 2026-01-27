const express = require('express');
const router = express.Router();
const penaltyController = require('../controllers/penaltyController');
const { authenticate, authorize } = require('../middleware/auth');

// جميع المسارات تتطلب مصادقة
router.use(authenticate);

// الجزاءات
router.get('/', authorize(['admin', 'hr', 'manager']), penaltyController.getAllPenalties);
router.get('/employee/:id', authorize(['admin', 'hr', 'manager', 'employee']), penaltyController.getEmployeePenalties);
router.post('/', authorize(['admin', 'hr', 'manager']), penaltyController.issuePenalty);
router.put('/:id/approve', authorize(['admin', 'hr', 'manager']), penaltyController.approvePenalty);
router.put('/:id/cancel', authorize(['admin', 'hr', 'manager']), penaltyController.cancelPenalty);
router.put('/:id/appeal', authorize(['employee']), penaltyController.appealPenalty);
router.put('/:id/appeal/decide', authorize(['admin', 'hr', 'manager']), penaltyController.decideAppeal);

module.exports = router;
