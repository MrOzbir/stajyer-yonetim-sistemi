const authService = require('../services/authService');

exports.register = async (req, res) => {
    try {
        // Müşterinin formunu mutfağa gönder
        const user = await authService.register(req.body);

        // Mutfaktan gelen sonucu müşteriye sun
        res.status(201).json({
            message: "Kullanıcı başarıyla oluşturuldu!",
            user: user
        });
    } catch (error) {
        console.error("🚨 KAYIT HATASI:", error.message);
        const statusCode = error.message.includes("kullanımda") || error.message.includes("bulunamadı") ? 400 : 500;
        res.status(statusCode).json({ error: error.message || "Kayıt sırasında hata oluştu." });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Siparişi mutfağa ver
        const result = await authService.login(email, password);

        // Başarılı sonucu sun
        res.status(200).json({
            message: "Başarıyla giriş yapıldı!",
            token: result.token,
            user: result.user
        });
    } catch (error) {
        console.error("🚨 GİRİŞ (LOGIN) HATASI:", error.message);
        
        // Servisten gelen spesifik hata mesajlarına göre HTTP kodlarını ayarla
        let statusCode = 500;
        if (error.message.includes("Geçersiz")) statusCode = 401;
        if (error.message.includes("arşivlenmiş")) statusCode = 403;

        res.status(statusCode).json({ error: error.message || "Sunucu tarafında bir hata oluştu." });
    }
};

exports.logout = async (req, res) => {
    try {
        // req.user (JWT'den gelen token bilgisi) üzerinden işlemi başlat
        const result = await authService.logout(req.user.userId, req.user.role);
        
        res.status(200).json({ 
            message: "Başarıyla çıkış yapıldı!",
            ...result
        });
    } catch (error) {
        console.error("🚨 ÇIKIŞ (LOGOUT) HATASI:", error.message);
        
        let statusCode = 500;
        if (error.message.includes("Sadece stajyerler")) statusCode = 403;
        if (error.message.includes("bulunamadı")) statusCode = 404;

        res.status(statusCode).json({ error: error.message || "Çıkış işlemi sırasında hata oluştu." });
    }
};