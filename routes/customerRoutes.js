const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', customerController.createCustomer);
router.post('/:id/documents', customerController.uploadCustomerDocuments);
router.get('/', customerController.getCustomers);
router.get('/search', customerController.searchCustomers);
router.get('/:id', customerController.getCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);
router.delete('/:id/documents/:documentId', customerController.deleteCustomerDocument);

module.exports = router;
