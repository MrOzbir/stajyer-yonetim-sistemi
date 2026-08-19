const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticateToken, roleMiddleware } = require('../../middleware/auth');

// Görev rotaları (Controller fonksiyon adlarıyla %100 uyumlu hale getirildi)
router.post('/', authenticateToken, roleMiddleware('ADMIN'), taskController.createTask);
router.get('/', authenticateToken, taskController.getTasks); // DİKKAT: getAllTasks yerine getTasks yapıldı!
router.get('/urgent', authenticateToken, taskController.getUrgentTasks);
router.patch('/:id/status', authenticateToken, taskController.updateTaskStatus);
router.delete('/:id', roleMiddleware('ADMIN'), taskController.deleteTask);

module.exports = router;