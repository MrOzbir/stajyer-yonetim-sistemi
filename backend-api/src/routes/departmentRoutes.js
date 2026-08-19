const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticateToken, roleMiddleware } = require('../../middleware/auth');

// 🚨 DÜZELTME: requireAdmin yerine roleMiddleware('ADMIN') kullanıldı
router.post('/', authenticateToken, roleMiddleware('ADMIN'), departmentController.createDepartment);
router.get('/', authenticateToken, departmentController.getAllDepartments);
router.patch('/:id', authenticateToken, roleMiddleware('ADMIN'), departmentController.updateDepartment);
router.delete('/:id', authenticateToken, roleMiddleware('ADMIN'), departmentController.deleteDepartment);

// Kullanıcıya departman atama (Admin yetkisi gerektirir)
router.patch('/users/:id/department', authenticateToken, roleMiddleware('ADMIN'), departmentController.assignUserDepartment);

module.exports = router;