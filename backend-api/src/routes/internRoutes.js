const express = require('express');
const router = express.Router();
const internController = require('../controllers/internController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

router.get('/', authenticateToken, requireAdmin, internController.getAllInterns);
router.get('/users', authenticateToken, internController.getUsers); // Genel kullanıcı listesi
router.get('/:id', authenticateToken, requireAdmin, internController.getInternById);
router.patch('/:id/archive', authenticateToken, requireAdmin, internController.archiveIntern);
router.patch('/:id/restore', authenticateToken, requireAdmin, internController.restoreIntern);
module.exports = router;