const express = require('express');
const router = express.Router();
const archiveController = require('../controllers/archiveController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

router.post('/', authenticateToken, archiveController.createArchive);
router.get('/', authenticateToken, requireAdmin, archiveController.getAllArchives);
module.exports = router;