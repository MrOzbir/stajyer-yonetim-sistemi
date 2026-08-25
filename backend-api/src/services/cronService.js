const cron = require('node-cron');
const prisma = require('../config/database');
const axios = require('axios');

// Her gün saat 12:00'de çalışır ('0 12 * * *')
cron.schedule('0 12 * * *', async () => {
    console.log("⏰ [CRON] Son 24 saatlik stajyer günlükleri AI ile özetleniyor...");
    try {
        // 🎯 Tam olarak son 24 saat öncesinin zaman damgası
        const exactly24HoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
        
        // 1. Sadece son 24 saat içinde oluşturulmuş anonim kayıtları çek
        const recentEntries = await prisma.dailyArchiveEntry.findMany({
            where: { 
                date: { 
                    gte: exactly24HoursAgo 
                } 
            },
            select: {
                mood: true,
                topicsCovered: true,
                challengesFaced: true,
                socialInteractions: true,
                sentimentScore: true
            }
        });

        if (recentEntries.length === 0) {
            console.log("ℹ️ [CRON] Son 24 saat içinde kaydedilmiş herhangi bir günlük girdisi bulunamadı.");
            return;
        }

        // 2. Anonim girdileri AI için birleştir
        const combinedData = recentEntries.map((e, idx) => 
            `Kayıt ${idx + 1}: Ruh Hali: ${e.mood}, Konular: ${e.topicsCovered.join(', ')}, Zorluklar: ${e.challengesFaced.join(', ')}, Sosyal Durum: ${e.socialInteractions.join(', ')}, Skor: ${e.sentimentScore}`
        ).join('\n');

        // 3. Python AI servisine gönder
        const aiResponse = await axios.post('http://127.0.0.1:8000/summarize-daily', {
            dailyContents: combinedData
        }, { timeout: 180000 });

        const summaryData = aiResponse.data;

        // 4. DailySummary tablosuna son 24 saatin özetini kaydet
        await prisma.dailySummary.create({
            data: {
                generalMoral: summaryData.genelMoral || summaryData.generalMoral || "Dengeli",
                challenges: summaryData.karsilasilanZorluklar || summaryData.challenges || [],
                achievements: summaryData.basarilar || summaryData.achievements || [],
                complaints: summaryData.sikayetler || summaryData.complaints || [],
                satisfactions: summaryData.memnuniyetler || summaryData.satisfactions || [],
                executiveSummary: summaryData.yoneticiOzeti || summaryData.executiveSummary || "Son 24 saatteki stajyer verileri işlendi.",
                entryCount: recentEntries.length
            }
        });

        console.log(`✅ [CRON] Son 24 saate ait ${recentEntries.length} adet günlük başarıyla özetlendi ve DB'ye kaydedildi.`);
    } catch (error) {
        console.error("🚨 [CRON] 24 saatlik özetleme hatası:", error.message);
    }
}, {
    scheduled: true,
    timezone: "Europe/Istanbul"
});