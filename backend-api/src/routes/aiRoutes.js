const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken, roleMiddleware } = require('../../middleware/auth');

// Yapay zeka rapor oluşturma rotası
router.post('/generate-report/:id', authenticateToken, roleMiddleware('ADMIN'), aiController.generateReport);

// 🚀 EKSİK OLAN VE 404 VEREN ROTA: Raporları Getirme
router.get('/reports/:internId', authenticateToken, aiController.getReports);

// Hazır el atmışken, ileride lazım olacak Rapor Silme rotasını da ekleyelim
router.delete('/reports/:reportId', authenticateToken, roleMiddleware('ADMIN'), aiController.deleteReport);

// Stajyerlerin kendi mentörlük verilerini çekebileceği rotalar (İsteğe bağlı/aiController'da vardı)
router.get('/mentorship/my-report', authenticateToken, aiController.getMyMentorship);
router.get('/mentorship/history', authenticateToken, aiController.getMyMentorshipHistory);
router.get('/mentorship/daily-tip', authenticateToken, aiController.getDailyTip);
router.post('/chat', authenticateToken, aiController.chat);

module.exports = router;