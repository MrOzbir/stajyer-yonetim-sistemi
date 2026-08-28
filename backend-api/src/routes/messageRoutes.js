const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../../middleware/auth');

// 1. Yeni Mesaj Gönder (POST /api/messages)
router.post('/', authenticateToken, messageController.sendMessage);

// 2. İki Kullanıcı Arasındaki Mesaj Geçmişini Getir (GET /api/messages/:id)
router.get('/:id', authenticateToken, messageController.getMessages);

// 3. Mesaj Düzenle (PATCH /api/messages/:id)
router.patch('/:id', authenticateToken, messageController.editMessage);

// 4. Mesaj Sil (DELETE /api/messages/:id)
router.delete('/:id', authenticateToken, messageController.deleteMessage);

router.patch('/read/:senderId', authenticateToken, messageController.markAsRead);

module.exports = router;