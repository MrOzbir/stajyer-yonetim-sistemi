const prisma = require('../config/database');

exports.getDailySummaries = async (req, res) => {
    try {
        // En yeniden en eskiye doğru son 30 günün özetini getirir
        const summaries = await prisma.dailySummary.findMany({
            orderBy: { date: 'desc' },
            take: 30 
        });
        
        res.status(200).json(summaries);
    } catch (error) {
        console.error("Özetler çekilirken hata:", error);
        res.status(500).json({ error: "Günlük özetler sunucudan alınamadı." });
    }
};