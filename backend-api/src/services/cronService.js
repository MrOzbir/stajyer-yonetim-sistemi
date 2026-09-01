const cron = require('node-cron');
const prisma = require('../config/database');
const axios = require('axios');
const nodemailer = require('nodemailer'); // Mail paketi eklendi

// Mail gönderici ayarları (Nodemailer)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || 587,
    secure: false, 
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// 🚀 1. ÖZETLEME İŞLEMİNİ BAĞIMSIZ FONKSİYON YAPTIK
async function generateDailySummary() {
    console.log("⏳ [CRON/SİSTEM] Stajyer günlükleri AI ile özetleniyor...");
    try {
        const exactly24HoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
        
        const recentEntries = await prisma.dailyArchiveEntry.findMany({
            where: { date: { gte: exactly24HoursAgo } },
            select: { mood: true, topicsCovered: true, challengesFaced: true, socialInteractions: true, sentimentScore: true }
        });

        if (recentEntries.length === 0) {
            console.log("ℹ️ [SİSTEM] Özetlenecek yeni günlük girdisi bulunamadı.");
            return;
        }

        const combinedData = recentEntries.map((e, idx) => 
            `Kayıt ${idx + 1}: Ruh Hali: ${e.mood}, Konular: ${e.topicsCovered.join(', ')}, Zorluklar: ${e.challengesFaced.join(', ')}, Sosyal Durum: ${e.socialInteractions.join(', ')}, Skor: ${e.sentimentScore}`
        ).join('\n');

        // Docker ortamı için URL düzeltildi (127.0.0.1 yerine ai-service)
        const AI_URL = 'http://ai-service:8000/summarize-daily';
        
        const aiResponse = await axios.post(AI_URL, {
            dailyContents: combinedData
        }, { timeout: 180000 });

        const summaryData = aiResponse.data;

        // 1. Veritabanına Kaydet
        const newSummary = await prisma.dailySummary.create({
            data: {
                generalMoral: summaryData.genelMoral || summaryData.generalMoral || "Dengeli",
                challenges: summaryData.karsilasilanZorluklar || summaryData.challenges || [],
                achievements: summaryData.basarilar || summaryData.achievements || [],
                complaints: summaryData.sikayetler || summaryData.complaints || [],
                satisfactions: summaryData.memnuniyetler || summaryData.satisfactions || [],
                executiveSummary: summaryData.yoneticiOzeti || summaryData.executiveSummary || "Son 24 saatteki veriler işlendi.",
            }
        });
        
        console.log(`✅ [SİSTEM] ${recentEntries.length} adet günlük başarıyla özetlendi!`);

        // 2. Yöneticilere Mail Gönder
        const mailOptions = {
            from: `"Stajyer Yönetim Sistemi" <${process.env.SMTP_USER}>`,
            to: "admin@example.com", // BURAYI KENDİ (VEYA YÖNETİCİNİN) E-POSTA ADRESİYLE DEĞİŞTİRİN
            subject: "📊 Günlük Stajyer Performans ve Durum Özeti",
            html: `
                <h2>Günlük Stajyer Durum Özeti</h2>
                <p><strong>Genel Moral:</strong> ${newSummary.generalMoral}</p>
                <p><strong>Yönetici Özeti:</strong></p>
                <p>${newSummary.executiveSummary}</p>
                
                <h3>🌟 Başarılar</h3>
                <ul>${newSummary.achievements.map(a => `<li>${a}</li>`).join('')}</ul>
                
                <h3>🚧 Karşılaşılan Zorluklar</h3>
                <ul>${newSummary.challenges.map(c => `<li>${c}</li>`).join('')}</ul>
                
                <p><small>Tüm detaylar için sisteme giriş yapabilirsiniz.</small></p>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("✅ [SİSTEM] Rapor e-postası başarıyla gönderildi: " + info.messageId);

    } catch (error) {
        console.error("🚨 [SİSTEM] Özetleme/Mail hatası:", error.response?.data || error.message);
    }
}

// 🚀 2. ZAMANLAYICI
cron.schedule('0 12 * * *', () => {
    console.log("⏰ [CRON] Saat 12:00 rutini tetiklendi.");
    generateDailySummary();
}, { scheduled: true, timezone: "Europe/Istanbul" });

// 🚀 3. TELAFİ MEKANİZMASI
async function checkMissedSummary() {
    const now = new Date();
    const today12PM = new Date();
    today12PM.setHours(12, 0, 0, 0);

    if (now > today12PM) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const existingSummary = await prisma.dailySummary.findFirst({
            where: { date: { gte: todayStart } }
        });

        if (!existingSummary) {
            console.log("⚠️ [SİSTEM] Saat 12:00 raporu kaçırılmış! Telafi süreci başlatılıyor...");
            await generateDailySummary();
        } else {
            console.log("ℹ️ [SİSTEM] Bugünün öğle raporu zaten mevcut. Telafiye gerek yok.");
        }
    }
}

checkMissedSummary();