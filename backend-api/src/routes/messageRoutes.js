const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../../middleware/auth');

router.post('/', authenticateToken, messageController.sendMessage);
router.get('/', authenticateToken, messageController.getMessages);
router.get('/:otherUserId', authenticateToken, messageController.getChatHistory);
module.exports = router;