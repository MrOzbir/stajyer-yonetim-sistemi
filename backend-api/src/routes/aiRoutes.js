const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

// YÖNETİCİ (ADMIN) ROTALARI
router.post('/generate-report/:internId', authenticateToken, requireAdmin, aiController.generateReport);
router.get('/reports/:internId', authenticateToken, aiController.getReports);
router.delete('/reports/:reportId', authenticateToken, requireAdmin, aiController.deleteReport);

// STAJYER (INTERN) ROTALARI
router.get('/my-mentorship', authenticateToken, aiController.getMyMentorship);
router.get('/my-mentorship/history', authenticateToken, aiController.getMyMentorshipHistory);
router.get('/daily-tip', authenticateToken, aiController.getDailyTip);

// ORTAK CHAT (AI MENTÖR) ROTASI
router.post('/chat', authenticateToken, aiController.chat);

module.exports = router;