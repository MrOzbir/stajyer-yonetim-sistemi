const express = require('express');
const router = express.Router();
const archiveController = require('../controllers/archiveController');
const { authenticateToken, roleMiddleware } = require('../../middleware/auth');

// Arşiv rotaları (Fonksiyon isimleri controller ile tamamen eşitlendi)
router.get('/', authenticateToken, roleMiddleware('ADMIN'), archiveController.getAllArchives);
router.post('/', authenticateToken, roleMiddleware('INTERN'), archiveController.createArchive);
router.delete('/:id', authenticateToken, roleMiddleware('ADMIN'), archiveController.deleteArchive);

module.exports = router;