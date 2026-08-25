const express = require('express');
const router = express.Router();
const { getDailySummaries } = require('../controllers/summaryController');
const { authenticateToken, roleMiddleware } = require('../../middleware/auth');
// Sadece ADMIN yetkisi olanlar özetleri görebilir
router.get('/', authenticateToken, roleMiddleware('ADMIN'), getDailySummaries);

module.exports = router;