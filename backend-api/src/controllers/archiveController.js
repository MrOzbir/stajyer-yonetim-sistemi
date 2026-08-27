const prisma = require('../config/database');
const axios = require('axios');

exports.createArchive = async (req, res) => {
    try {
        const { content } = req.body;
        const internId = req.user.userId || req.user.id;

        if (req.user.role !== 'INTERN') {
            return res.status(403).json({ error: "Sadece stajyerler günlük arşiv ekleyebilir." });
        }
        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Arşiv içeriği boş olamaz." });
        }

        let aiResult = { mood: "Normal", topicsCovered: [], challengesFaced: [], socialInteractions: [], sentimentScore: 75 };
        
        // 1. Ham metni Python AI servisine gönder (Tek sefer)
        try {
            const aiResponse = await axios.post('http://127.0.0.1:8000/process-daily-entry', {
                internId: internId,
                dailyContent: content
            }, { timeout: 60000 });

            if (aiResponse.data) {
                aiResult = { ...aiResult, ...aiResponse.data };
            }
        } catch (aiError) {
            console.error("🚨 AI ANONİMLEŞTİRME HATASI:", aiError.message);
        }

        // 2. SAAT İZİNİ SİL: Günü al ama saati 00:00:00'a sabitle
        const anonymousDate = new Date();
        anonymousDate.setHours(0, 0, 0, 0);

        // 3. Ham metni çöpe atıp, SADECE AI'ın ürettiği JSON verisini DB'ye kaydet
        const savedEntry = await prisma.dailyArchiveEntry.create({
            data: {
                internId: internId,
                date: anonymousDate, // 🚀 Saat izi tamamen silindi!
                mood: aiResult.mood || "Normal",
                topicsCovered: aiResult.topicsCovered || [],
                challengesFaced: aiResult.challengesFaced || [],
                socialInteractions: aiResult.socialInteractions || [],
                sentimentScore: parseInt(aiResult.sentimentScore, 10) || 75
            }
        });

        // 4. Frontend'e yanıt dön (Ham metin uçtu, DB'de sadece JSON var, mentör notu geçici)
        res.status(201).json({
            message: "Günlüğünüz anonimleştirilerek başarıyla işlendi!",
            entry: savedEntry,
            mentorNote: aiResult.mentorNote
        });

    } catch (error) {
        console.error("🚨 GÜNLÜK İŞLEME HATASI:", error);
        res.status(500).json({ error: "Günlük işlenirken bir hata oluştu." });
    }
};

exports.getAllArchives = async (req, res) => {
    try {
        const entries = await prisma.dailyArchiveEntry.findMany({
            orderBy: { date: 'desc' }
        });
        res.status(200).json(entries);
    } catch (error) {
        res.status(500).json({ error: "Arşivler listelenirken hata oluştu." });
    }
};

exports.deleteArchive = async (req, res) => {
    try {
        const archiveId = parseInt(req.params.id, 10);
        // 🚀 DÜZELTME: Tablo adı 'dailyArchiveEntry' olarak güncellendi
        await prisma.dailyArchiveEntry.delete({
            where: { id: archiveId }
        });
        res.status(200).json({ message: "Arşiv başarıyla silindi." });
    } catch (error) {
        res.status(500).json({ error: "Arşiv silinirken bir hata oluştu." });
    }
};