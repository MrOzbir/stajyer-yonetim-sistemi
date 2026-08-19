const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken, roleMiddleware } = require('../../middleware/auth');

// Yapay zeka rapor oluşturma rotası (Controller fonksiyonu ile uyumlu hale getirildi)
router.post('/generate-report/:id', authenticateToken, roleMiddleware('ADMIN'), aiController.generateReport);

// Eğer başka yapay zeka rotalarınız varsa buraya ekleyebilirsiniz...

module.exports = router;