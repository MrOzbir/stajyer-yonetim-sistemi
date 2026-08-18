const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

router.post('/', authenticateToken, requireAdmin, taskController.createTask);
router.get('/', authenticateToken, taskController.getTasks);
router.get('/urgent', authenticateToken, taskController.getUrgentTasks);
router.patch('/:id', authenticateToken, taskController.updateTaskStatus);
router.delete('/:id', authenticateToken, requireAdmin, taskController.deleteTask);

module.exports = router;