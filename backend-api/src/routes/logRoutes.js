const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { authenticateToken } = require('../../middleware/auth');

router.get('/', authenticateToken, logController.getLogs);
module.exports = router;