const cron = require('node-cron');
const prisma = require('../config/database');
const axios = require('axios');

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

        const aiResponse = await axios.post('http://127.0.0.1:8000/summarize-daily', {
            dailyContents: combinedData
        }, { timeout: 180000 });

        const summaryData = aiResponse.data;

        await prisma.dailySummary.create({
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
    } catch (error) {
        console.error("🚨 [SİSTEM] Özetleme hatası:", error.message);
    }
}

// 🚀 2. ZAMANLAYICI (Her gün saat 12:00'de tetikler)
cron.schedule('0 12 * * *', () => {
    console.log("⏰ [CRON] Saat 12:00 rutini tetiklendi.");
    generateDailySummary();
}, { scheduled: true, timezone: "Europe/Istanbul" });

// 🚀 3. TELAFİ MEKANİZMASI (Sunucu açıldığında kontrol eder)
async function checkMissedSummary() {
    const now = new Date();
    const today12PM = new Date();
    today12PM.setHours(12, 0, 0, 0);

    // Eğer şu an saat 12:00'yi geçtiyse...
    if (now > today12PM) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Bugün için halihazırda bir özet oluşturulmuş mu kontrol et
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

// Sunucu başlatılır başlatılmaz telafi kontrolünü çalıştır
checkMissedSummary();