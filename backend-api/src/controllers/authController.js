const authService = require('../services/authService');
const prisma = require('../config/database');
const axios = require('axios');

// ==========================================
// 🚀 ARKA PLAN İŞÇİSİ (BACKGROUND JOB)
// ==========================================
async function generateBackgroundTip(internId, logId, workedMinutes) {
    console.log(`🔄 [Background] Log ID: ${logId} için mentör tavsiyesi üretiliyor...`);
    try {
        const PYTHON_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000';
        
        // 🚨 PRO TIP: AI servisleri çökerse uygulamanın çökmemesi için timeout hayat kurtarır
        const response = await axios.post(`${PYTHON_SERVICE_URL}/generate-tip`, {
            internId: Number(internId),
            workedMinutes: Number(workedMinutes)
        }, { timeout: 45000 });

        if (response.data?.tip) {
            await prisma.dailyLog.update({
                where: { id: logId },
                data: { nextDayTip: response.data.tip, nextDayQuote: response.data.quote }
            });
            console.log(`✅ [Background] Mentör tavsiyesi başarıyla kaydedildi.`);
        }
    } catch (error) {
        // Fire-and-forget (Ateşle ve unut): Hata olursa ana sistemi asla durdurmaz, sadece loglar.
        console.error("🚨 [Background] Tavsiye üretilirken hata oluştu:", error.message);
    }
}


// ==========================================
// 🛡️ HTTP KONTROLCÜSÜ (CONTROLLER LAYER)
// ==========================================

exports.register = async (req, res) => {
    try {
        // 1. Pro-Level Validation (Gelen veriyi denetle)
        const { name, surname, email, password } = req.body;
        
        if (!name || !surname || !email || !password) {
            return res.status(400).json({ error: "Lütfen tüm zorunlu alanları (Ad, Soyad, E-Posta, Şifre) doldurun." });
        }

        // 2. Siparişi Mutfağa (Servis Katmanına) İlet
        const user = await authService.register(req.body);

        // 3. Güvenli Yanıt: Şifre gibi hassas veriler asla Frontend'e dönülmez
        return res.status(201).json({
            message: "Kullanıcı başarıyla oluşturuldu!",
            user: { 
                id: user.id, 
                name: user.name, 
                surname: user.surname, 
                email: user.email, 
                role: user.role 
            }
        });
    } catch (error) {
        console.error("🚨 KAYIT HATASI:", error.message);
        // Doğru HTTP Kodları: 409 (Conflict/Çakışma), 400 (Bad Request)
        const statusCode = error.message.includes("kullanımda") ? 409 : 400; 
        return res.status(statusCode).json({ error: error.message || "Kayıt işlemi başarısız oldu." });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // 1. Validation
        if (!email || !password) {
            return res.status(400).json({ error: "E-Posta ve şifre zorunludur." });
        }
        
        // 2. Mutfaktan (Service) Sonucu Al
        const result = await authService.login(email, password);

        // 3. Müşteriye Sun
        return res.status(200).json({
            message: "Başarıyla giriş yapıldı!",
            token: result.token,
            user: result.user
        });
    } catch (error) {
        console.error("🚨 GİRİŞ HATASI:", error.message);
        // 401: Yetkisiz (Yanlış Şifre), 403: Yasaklı (Arşivlenmiş/Silinmiş Kullanıcı)
        const statusCode = error.message.includes("Geçersiz") ? 401 : (error.message.includes("arşivlenmiş") ? 403 : 500);
        return res.status(statusCode).json({ error: error.message || "Giriş yapılamadı." });
    }
};

exports.logout = async (req, res) => {
    try {
        // Güvenlik: Req.user kontrolü (Token'ı olmayan buraya giremez)
        if (req.user?.role !== 'INTERN') {
            return res.status(403).json({ error: "Sadece stajyerler içindir." });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const openLog = await prisma.dailyLog.findFirst({
            where: { internId: req.user.userId, logoutTime: null, loginTime: { gte: today } },
            orderBy: { loginTime: 'desc' }
        });

        if (!openLog) {
            return res.status(404).json({ error: "Kapatılacak açık bir oturum bulunamadı." });
        }

        const logoutTime = new Date();
        const updatedLog = await prisma.dailyLog.update({
            where: { id: openLog.id },
            data: { logoutTime: logoutTime }
        });

        // Milisaniyeyi dakikaya çevir ve eksi (negatif) süre oluşmasını engelle
        const workedMinutes = Math.max(0, Math.round((logoutTime - openLog.loginTime) / 60000));

        // 🚀 PRO TIP: Background job'ın başına "await" KOYMUYORUZ. (Non-blocking) 
        // Bu sayede AI'ın düşünmesini beklemeden kullanıcıya saniyesinde çıkış yaptırılır.
        generateBackgroundTip(req.user.userId, updatedLog.id, workedMinutes).catch(err => console.error(err));

        return res.status(200).json({ message: "Başarıyla çıkış yapıldı!" });
    } catch (error) {
        console.error("🚨 ÇIKIŞ HATASI:", error);
        return res.status(500).json({ error: "Çıkış işlemi sırasında bir hata oluştu." });
    }
};

exports.getDailyTip = async (req, res) => {
    try {
        if (req.user?.role !== 'INTERN') {
            return res.status(403).json({ error: "Sadece stajyerler için." });
        }

        const lastLogWithTip = await prisma.dailyLog.findFirst({
            where: { 
                internId: req.user.userId,
                nextDayTip: { not: null } 
            },
            orderBy: { logoutTime: 'desc' }
        });

        if (lastLogWithTip) {
            return res.status(200).json({ tip: lastLogWithTip.nextDayTip, quote: lastLogWithTip.nextDayQuote });
        }

        // Eğer hiç log/tavsiye yoksa verilecek varsayılan mesaj (Fallback)
        return res.status(200).json({ 
            tip: "İlk mesaini tamamlayıp çıkış yaptığında, yarın için sana özel mentör tavsiyen burada belirecek!",
            quote: "Başlamak için en iyi zaman şimdidir."
        });
    } catch (error) {
        console.error("🚨 GÜNLÜK İPUCU HATASI:", error);
        return res.status(500).json({ error: "Mentör tavsiyesi getirilemedi." });
    }
};