const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, adminOrOwnerMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.use(adminOrOwnerMiddleware);

router.get('/', userController.listUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.patch('/:id/block', userController.blockUser);

module.exports = router;
