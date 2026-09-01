const prisma = require('../config/database');
const axios = require('axios');

// Admin veya Stajyer için Rapor Oluşturma (Admin Paneli)
exports.generateReport = async (req, res) => {
    const internId = parseInt(req.params.id, 10);
    
    if (isNaN(internId)) {
        return res.status(400).json({ error: "Geçersiz stajyer ID formatı." });
    }
    try {
        const internData = await prisma.user.findUnique({
            where: { id: internId },
            select: {
                id: true, name: true, surname: true,
                tasksReceived: {
                    select: { title: true, status: true, repoLink: true, deadline: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 20
                },
                archiveEntries: {
                    select: {
                        mood: true,
                        topicsCovered: true,
                        challengesFaced: true,
                        socialInteractions: true,
                        sentimentScore: true,
                        date: true
                    },
                    orderBy: { date: 'desc' },
                    take: 15
                },
                logs: {
                    select: { loginTime: true, logoutTime: true },
                    orderBy: { loginTime: 'desc' },
                    take: 15
                }
            }
        });

        if (!internData) return res.status(404).json({ error: "Stajyer bulunamadı." });

        const PYTHON_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000/analyze';
        const payloadForAI = {
            id: internData.id,
            name: internData.name,
            surname: internData.surname,
            tasksReceived: internData.tasksReceived || [],
            archives: (internData.archiveEntries || []).map(a => ({
                date: a.date,
                content: `Ruh Hali: ${a.mood || 'Bilinmiyor'}. Konular: ${(a.topicsCovered || []).join(', ')}. Zorluklar: ${(a.challengesFaced || []).join(', ')}`
            })),
            logs: internData.logs || []
        };
        
        const aiResponse = await axios.post(PYTHON_SERVICE_URL, payloadForAI, { timeout: 180000 });
        const analysisResult = aiResponse.data;

        const newReport = await prisma.aiReport.create({
            data: {
                internId: internId,
                reportDate: new Date(),
                overallScore: analysisResult.overallScore || 70,
                strengths: analysisResult.strengths || [],
                weaknesses: analysisResult.weaknesses || [],
                suggestions: analysisResult.suggestions || [],
                adminSummary: analysisResult.adminSummary || 'Analiz tamamlandı.',
                internSummary: analysisResult.internSummary || analysisResult.adminSummary || 'İyi gidiyorsun!',
                internFeedback: analysisResult.internFeedback || 'Gelişmeye devam et.',
                learningResources: Array.isArray(analysisResult.learningResources)
                    ? analysisResult.learningResources.map(item => 
                        typeof item === 'object' ? `${item.title || 'Kaynak'} - ${item.url || ''}` : String(item)
                    )
                    : [],
                    nextSteps: Array.isArray(analysisResult.nextSteps)
                    ? analysisResult.nextSteps.map(step => 
                        typeof step === 'object' ? `${step.title || 'Adım'}: ${step.description || ''}`.trim() : String(step)
                    )
                    : [],
                encouragementQuote: analysisResult.encouragementQuote || 'Harika iş çıkarıyorsun!',
                rawJson: analysisResult
            }
        });

        res.status(201).json({ message: "AI Raporu başarıyla oluşturuldu!", report: newReport });
    } catch (error) {
        console.error("🚨 AI RAPOR HATASI:", error.response?.data || error.message);
        res.status(500).json({ error: "Yapay zeka analizi sırasında hata oluştu." });
    }
};

// Admin veya Ilgili Stajyer için Rapor Listeleme
exports.getReports = async (req, res) => {
    const internId = parseInt(req.params.internId, 10);
    const userId = parseInt(req.user?.userId || req.user?.id, 10);

    if (req.user.role !== 'ADMIN' && userId !== internId) {
        return res.status(403).json({ error: "Bu raporu görüntüleme yetkiniz yok." });
    }
    try {
        const reports = await prisma.aiReport.findMany({
            where: { internId: internId },
            orderBy: { id: 'desc' }
        });
        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ error: "Raporlar çekilirken hata oluştu." });
    }
};

// Rapor Silme
exports.deleteReport = async (req, res) => {
    try {
        const reportId = parseInt(req.params.reportId, 10);
        const report = await prisma.aiReport.findUnique({ where: { id: reportId } });
        if (!report) return res.status(404).json({ error: "Rapor bulunamadı." });

        await prisma.aiReport.delete({ where: { id: reportId } });
        res.json({ message: "Rapor başarıyla silindi." });
    } catch (error) {
        console.error("🚨 RAPOR SİLME HATASI:", error.message);
        res.status(500).json({ error: "Rapor silinemedi." });
    }
};

// Stajyer: Son Mentörlük Özetini Getirme
exports.getMyMentorship = async (req, res) => {
    try {
        if (req.user.role !== 'INTERN') return res.status(403).json({ error: "Bu rota sadece stajyerler içindir." });

        const internId = parseInt(req.user?.userId || req.user?.id, 10);

        const latestReport = await prisma.aiReport.findFirst({
            where: { internId: internId },
            orderBy: { id: 'desc' }
        });

        if (!latestReport) {
            return res.status(404).json({ message: "Henüz mentörlük raporunuz oluşturulmamış.", report: null });
        }

        res.status(200).json(latestReport);
    } catch (error) {
        console.error("🚨 MENTÖRLÜK RAPORU HATASI:", error);
        res.status(500).json({ error: "Mentörlük raporu alınamadı." });
    }
};

// Stajyer: Tüm Geçmiş Raporları Getirme (Veritabanındaki Tüm Alanlarla)
exports.getMyMentorshipHistory = async (req, res) => {
    try {
        if (req.user.role !== 'INTERN') return res.status(403).json({ error: "Yetkiniz yok." });

        const internId = parseInt(req.user?.userId || req.user?.id, 10);

        const reports = await prisma.aiReport.findMany({
            where: { internId: internId },
            orderBy: { id: 'desc' },
            take: 20
        });

        res.status(200).json(reports);
    } catch (error) {
        console.error("🚨 MENTÖRLÜK GEÇMİŞİ HATASI:", error);
        res.status(500).json({ error: "Geçmiş raporlar alınamadı." });
    }
};

// Stajyer: Günlük İpucu
exports.getDailyTip = async (req, res) => {
    try {
        if (req.user.role !== 'INTERN') return res.status(403).json({ error: "Sadece stajyerler için." });

        const internId = parseInt(req.user?.userId || req.user?.id, 10);

        const latestReport = await prisma.aiReport.findFirst({
            where: { internId: internId },
            orderBy: { id: 'desc' }
        });

        if (!latestReport) {
            return res.status(200).json({ tip: "İlk görevlerinizi tamamlayın!", source: "system" });
        }

        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const allTips = [ ...(latestReport.nextSteps || []), ...(latestReport.learningResources || []) ];
        const tip = allTips.length > 0 ? allTips[dayOfYear % allTips.length] : latestReport.encouragementQuote;

        res.status(200).json({ tip: tip, quote: latestReport.encouragementQuote, source: "ai-mentor", reportDate: latestReport.reportDate });
    } catch (error) {
        console.error("🚨 GÜNLÜK İPUCU HATASI:", error);
        res.status(500).json({ error: "Günlük ipucu alınamadı." });
    }
};

// AI Chat Akışı
exports.chat = async (req, res) => {
    try {
        const { message, messages } = req.body;
        if (!message || message.trim() === '') return res.status(400).json({ error: "Mesaj boş olamaz." });

        let context = {};
        if (req.user.role === 'INTERN') {
            const internId = parseInt(req.user?.userId || req.user?.id, 10);

            const internData = await prisma.user.findUnique({
                where: { id: internId },
                select: {
                    name: true, surname: true,
                    tasksReceived: {
                        where: { status: { not: 'COMPLETED' } },
                        select: { title: true, status: true, deadline: true, repoLink: true },
                        orderBy: { deadline: 'asc' }
                    },
                    archiveEntries: { select: { mood: true, topicsCovered: true, challengesFaced: true, date: true }, orderBy: { date: 'desc' }, take: 5 },
                    logs: {
                        select: { loginTime: true, logoutTime: true },
                        where: { loginTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
                        orderBy: { loginTime: 'desc' }
                    },
                    aiReports: {
                        select: { overallScore: true, strengths: true, internSummary: true, internFeedback: true, nextSteps: true, encouragementQuote: true, reportDate: true },
                        orderBy: { id: 'desc' }, take: 1
                    }
                }
            });

            const now = new Date();
            const tasksWithUrgency = (internData?.tasksReceived || []).map(task => {
                let daysLeft = null; let isOverdue = false;
                if (task.deadline) {
                    const diff = new Date(task.deadline) - now;
                    daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    isOverdue = daysLeft < 0;
                }
                return { title: task.title, status: task.status, daysLeft, isOverdue, hasRepo: !!task.repoLink };
            });

            const weeklyMinutes = (internData?.logs || []).reduce((acc, log) => {
                if (log.logoutTime) return acc + Math.round((new Date(log.logoutTime) - new Date(log.loginTime)) / 60000);
                return acc;
            }, 0);

            const latestReport = internData?.aiReports?.[0] || null;

            context = {
                name: `${internData?.name || ''} ${internData?.surname || ''}`.trim(),
                currentTasks: tasksWithUrgency,
                recentArchives: (internData?.archiveEntries || []).map(a => ({ 
                    date: a.date, 
                    summary: `Ruh Hali: ${a.mood || ''}. Konular: ${(a.topicsCovered || []).join(', ')}. Zorluklar: ${(a.challengesFaced || []).join(', ')}` 
                })),
                weeklyWorkedHours: Math.round(weeklyMinutes / 60),
                weeklyWorkedMinutes: weeklyMinutes,
                aiScore: latestReport?.overallScore || null,
                aiStrengths: latestReport?.strengths || [],
                aiSummary: latestReport?.internSummary || null,
                aiFeedback: latestReport?.internFeedback || null,
                aiNextSteps: latestReport?.nextSteps || [],
                aiQuote: latestReport?.encouragementQuote || null,
                aiReportDate: latestReport?.reportDate || null
            };
        }

        const PYTHON_CHAT_URL = (process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000/analyze').replace('/analyze', '/chat');
        
        const aiResponse = await axios.post(PYTHON_CHAT_URL, {
            message, messages: messages || [], context
        }, {
            responseType: 'stream', timeout: 30000, headers: { 'Content-Type': 'application/json' }
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        aiResponse.data.pipe(res);
    } catch (error) {
        console.error("🚨 AI CHAT HATASI:", error.response?.data || error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: "AI ile iletişim kurulamadı.", detail: error.response?.data?.detail || error.message });
        }
    }
};

// Stajyer: Kalan Limit Bilgisi
exports.getMyReportLimit = async (req, res) => {
    try {
        const internId = parseInt(req.user?.userId || req.user?.id, 10);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const reportCount = await prisma.aiReport.count({
            where: {
                internId: internId,
                reportDate: { gte: today }
            }
        });

        const limit = 3;
        const remaining = Math.max(0, limit - reportCount);

        res.status(200).json({ remaining, used: reportCount, limit });
    } catch (error) {
        console.error("🚨 Limit kontrol hatası:", error);
        res.status(500).json({ error: "Limit bilgisi alınamadı." });
    }
};

// Stajyer: Kendi AI Raporunu Üretme
exports.generateMyReport = async (req, res) => {
    const internId = parseInt(req.user?.userId || req.user?.id, 10);

    if (isNaN(internId)) {
        return res.status(400).json({ error: "Geçersiz kullanıcı kimliği." });
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reportCount = await prisma.aiReport.count({
            where: { internId: internId, reportDate: { gte: today } }
        });

        if (reportCount >= 3) {
            return res.status(429).json({ error: "Günlük AI raporu oluşturma limitinize (3) ulaştınız. Lütfen yarın tekrar deneyin." });
        }

        const internData = await prisma.user.findUnique({
            where: { id: internId },
            select: {
                id: true, name: true, surname: true,
                tasksReceived: { select: { title: true, status: true, repoLink: true, deadline: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 },
                archiveEntries: {
                    select: {
                        mood: true,
                        topicsCovered: true,
                        challengesFaced: true,
                        socialInteractions: true,
                        sentimentScore: true,
                        date: true
                    },
                    orderBy: { date: 'desc' },
                    take: 15
                },
                logs: { select: { loginTime: true, logoutTime: true }, orderBy: { loginTime: 'desc' }, take: 15 }
            }
        });

        if (!internData || !internData.tasksReceived || internData.tasksReceived.length === 0) {
            return res.status(400).json({ error: "Yapay zekanın analiz yapabilmesi için en az bir göreviniz olmalıdır." });
        }

        const PYTHON_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000/analyze';
        const payloadForAI = {
            id: internData.id,
            name: internData.name,
            surname: internData.surname,
            tasksReceived: internData.tasksReceived || [],
            archives: (internData.archiveEntries || []).map(a => ({
                date: a.date,
                content: `Ruh Hali: ${a.mood || 'Bilinmiyor'}. Konular: ${(a.topicsCovered || []).join(', ')}. Zorluklar: ${(a.challengesFaced || []).join(', ')}`
            })),
            logs: internData.logs || []
        };
        
        const aiResponse = await axios.post(PYTHON_SERVICE_URL, payloadForAI, { timeout: 180000 });
        const analysisResult = aiResponse.data;

        const newReport = await prisma.aiReport.create({
            data: {
                internId: internId,
                reportDate: new Date(),
                overallScore: analysisResult.overallScore || 70,
                strengths: analysisResult.strengths || [],
                weaknesses: analysisResult.weaknesses || [],
                suggestions: analysisResult.suggestions || [],
                adminSummary: analysisResult.adminSummary || 'Analiz tamamlandı.',
                internSummary: analysisResult.internSummary || analysisResult.adminSummary || 'İyi gidiyorsun!',
                internFeedback: analysisResult.internFeedback || 'Gelişmeye devam et.',
                learningResources: Array.isArray(analysisResult.learningResources)
                    ? analysisResult.learningResources.map(item => typeof item === 'object' ? `${item.title || 'Kaynak'} - ${item.url || ''}` : String(item))
                    : [],
                nextSteps: analysisResult.nextSteps || [],
                encouragementQuote: analysisResult.encouragementQuote || 'Harika iş çıkarıyorsun!',
                rawJson: analysisResult
            }
        });

        res.status(201).json({ 
            message: "AI Raporunuz başarıyla oluşturuldu!", 
            report: newReport, 
            remaining: 3 - (reportCount + 1) 
        });

    } catch (error) {
        console.error("🚨 STAJYER AI RAPOR HATASI:", error.response?.data || error.message);
        res.status(500).json({ error: "Yapay zeka analizi sırasında hata oluştu." });
    }
};