const express = require('express');
const router = express.Router();
const stationController = require('../controllers/stationController');
const pumpSessionController = require('../controllers/pumpSessionController');
const dailyInventoryController = require('../controllers/dailyInventoryController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Station routes
router.get('/stations', stationController.getStations);
router.get('/stations/:id', stationController.getStation);
router.post('/stations', stationController.createStation);
router.put('/stations/:id', stationController.updateStation);

// Pump management
router.post('/stations/:stationId/pumps', stationController.addPump);
router.put('/stations/:stationId/pumps/:pumpId', stationController.updatePump);
router.delete('/stations/:stationId/pumps/:pumpId', stationController.deletePump);

// Fuel prices
router.put('/stations/:stationId/prices', stationController.updateFuelPrices);

// Statistics
router.get('/stations/:stationId/stats', stationController.getStationStats);

// Pump Session routes
router.get('/sessions', pumpSessionController.getSessions);
router.get('/sessions/:id', pumpSessionController.getSession);
router.post('/sessions/open', pumpSessionController.openSession);
router.put('/sessions/:sessionId/close', pumpSessionController.closeSession);
router.put('/sessions/:sessionId/approve-opening', pumpSessionController.approveOpening);
router.put('/sessions/:sessionId/approve-closing', pumpSessionController.approveClosing);
router.get('/sessions/summary', pumpSessionController.getSessionSummary);

// Daily Inventory routes
router.get('/inventory', dailyInventoryController.getInventoryReports);
router.get('/inventory/:id', dailyInventoryController.getInventoryDetail);
router.post('/inventory', dailyInventoryController.createInventory);
router.put('/inventory/:inventoryId', dailyInventoryController.updateInventory);
router.put('/inventory/:inventoryId/approve', dailyInventoryController.approveInventory);
router.post('/inventory/:inventoryId/expenses', dailyInventoryController.addExpense);
router.get('/inventory/fuel-balance', dailyInventoryController.getFuelBalanceReport);

module.exports = router;