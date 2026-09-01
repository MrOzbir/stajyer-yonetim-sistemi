const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken, roleMiddleware } = require('../../middleware/auth');

// Stajyer AI Rotaları
router.get('/my-report-limit', authenticateToken, roleMiddleware('INTERN'), aiController.getMyReportLimit);
router.post('/generate-my-report', authenticateToken, roleMiddleware('INTERN'), aiController.generateMyReport);
router.get('/my-mentorship', authenticateToken, roleMiddleware('INTERN'), aiController.getMyMentorship);
router.get('/my-mentorship-history', authenticateToken, roleMiddleware('INTERN'), aiController.getMyMentorshipHistory);
router.get('/daily-tip', authenticateToken, roleMiddleware('INTERN'), aiController.getDailyTip);
router.post('/chat', authenticateToken, aiController.chat);

// Admin ve Genel Rotalar
router.post('/generate-report/:id', authenticateToken, roleMiddleware('ADMIN'), aiController.generateReport);
router.get('/reports/:internId', authenticateToken, aiController.getReports);
router.delete('/reports/:reportId', authenticateToken, roleMiddleware('ADMIN'), aiController.deleteReport);

module.exports = router;