const jwt = require('jsonwebtoken');

// 1. Kimlik Doğrulama (Token Kontrolü)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Yetkilendirme tokeni bulunamadı.' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'gizli_anahtar', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
        }
        req.user = user; // Kullanıcı bilgilerini isteğe ekle
        next();
    });
};

// 2. Rol Kontrolü (🚀 Eksik olan ve hataya sebep olan fonksiyon budur!)
const roleMiddleware = (requiredRole) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== requiredRole) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
        }
        next();
    };
};

// İki fonksiyonu da dışa aktarıyoruz
module.exports = {
    authenticateToken,
    roleMiddleware
};