const jwt = require('jsonwebtoken');

// 1. GENEL BİLET KONTROLÜ (authenticateToken)
// Bu görevli, gelen kişinin elinde geçerli bir bilet (token) olup olmadığına bakar.
const authenticateToken = (req, res, next) => {
    // İsteğin başlığından (header) bileti alıyoruz
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN_METNI" formatından sadece metni ayırıyoruz

    // Eğer bilet yoksa, 401 Yetkisiz hatası verip kapıyı kapatıyoruz
    if (!token) {
        return res.status(401).json({ error: "Erişim reddedildi. Biletiniz (Token) yok." });
    }

    // Bilet varsa, sahte olup olmadığını veya süresinin dolup dolmadığını .env'deki gizli şifremizle kontrol ediyoruz
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        // Eğer bilet geçersizse 403 Yasaklı hatası veriyoruz
        if (err) {
            return res.status(403).json({ error: "Geçersiz veya süresi dolmuş bilet." });
        }
        
        // Bilet geçerliyse, içindeki bilgileri (userId ve role) req.user içine koyup kişiyi içeri alıyoruz (next)
        req.user = user;
        next(); 
    });
};

// 2. YETKİ KONTROLÜ (requireAdmin)
// Bu görevli, sadece içeri girmeyi başarmış kişilerin ceketine bakar. Eğer ADMIN yazmıyorsa geri çevirir.
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Bu işlemi yapmak için yönetici (Admin) yetkisine sahip olmalısınız." });
    }
    next();
};

// Bu iki güvenlik görevlisini diğer dosyalarda kullanabilmek için dışa aktarıyoruz
module.exports = { authenticateToken, requireAdmin };