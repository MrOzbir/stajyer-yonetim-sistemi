const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

router.post('/', authenticateToken, requireAdmin, departmentController.createDepartment);
router.get('/', authenticateToken, departmentController.getAllDepartments);
router.patch('/:id', authenticateToken, requireAdmin, departmentController.updateDepartment);
router.delete('/:id', authenticateToken, requireAdmin, departmentController.deleteDepartment);

// Kullanıcıya departman atama (Admin yetkisi gerektirir)
router.patch('/users/:id/department', authenticateToken, requireAdmin, departmentController.assignUserDepartment);

module.exports = router;