const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authMiddleware } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Supplier routes
router.post('/', supplierController.createSupplier);
router.get('/', supplierController.getSuppliers);
router.get('/search', supplierController.searchSuppliers);
router.get('/statistics', supplierController.getSuppliersStatistics);
router.get('/:id', supplierController.getSupplier);
router.put('/:id', supplierController.updateSupplier);
router.delete('/:id', supplierController.deleteSupplier);
router.delete('/:supplierId/documents/:documentId', supplierController.deleteDocument);

module.exports = router;