const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticateToken, roleMiddleware } = require('../../middleware/auth');

router.post('/', authenticateToken, roleMiddleware('ADMIN'), taskController.createTask);
router.get('/', authenticateToken, taskController.getTasks);
router.get('/urgent', authenticateToken, taskController.getUrgentTasks);
router.get('/:id', authenticateToken, taskController.getTaskById);

router.patch('/:id', authenticateToken, taskController.updateTaskStatus); 
router.put('/:id', authenticateToken, roleMiddleware('ADMIN'), taskController.updateAdminTask);
router.delete('/:id', authenticateToken, roleMiddleware('ADMIN'), taskController.deleteTask);

module.exports = router;