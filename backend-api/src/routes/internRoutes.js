const express = require('express');
const router = express.Router();
const internController = require('../controllers/internController');
const { authenticateToken, roleMiddleware } = require('../../middleware/auth');

// 🚀 Tüm rotalarda standart ve eksiksiz güvenlik zinciri uygulandı: 
// Önce Kimlik Doğrula (authenticateToken) -> Sonra Rolü Kontrol Et (roleMiddleware)

router.get('/', authenticateToken, roleMiddleware('ADMIN'), internController.getAllInterns);
router.get('/users', authenticateToken, internController.getUsers); // Genel kullanıcı listesi
router.get('/:id', authenticateToken, roleMiddleware('ADMIN'), internController.getInternById);
router.patch('/:id/archive', authenticateToken, roleMiddleware('ADMIN'), internController.archiveIntern);
router.delete('/:id', authenticateToken, roleMiddleware('ADMIN'), internController.deleteIntern);
router.patch('/:id/restore', authenticateToken, roleMiddleware('ADMIN'), internController.restoreIntern);
router.put('/profile/email', authenticateToken, internController.updateNotificationEmail);

module.exports = router;