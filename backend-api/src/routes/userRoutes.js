const express = require('express');
const router = express.Router();

const prisma = require('../config/database');

const { authenticateToken } = require('../../middleware/auth');

// Tüm kullanıcıları veya role göre (Örn: ?role=ADMIN) kullanıcıları getir
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { role } = req.query;
        const filter = role ? { role: role } : {};
        
        const users = await prisma.user.findMany({
            where: filter,
            select: {
                id: true,
                name: true,
                surname: true,
                role: true,
                email: true
            }
        });
        
        res.json(users);
    } catch (error) {
        console.error("Kullanıcılar getirilirken hata:", error);
        res.status(500).json({ error: "Sunucu hatası" });
    }
});

module.exports = router;