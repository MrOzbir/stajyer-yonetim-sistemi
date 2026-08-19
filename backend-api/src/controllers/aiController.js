const prisma = require('../config/database');
const axios = require('axios');

exports.generateReport = async (req, res) => {
    const internId = parseInt(req.params.internId);
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
                archives: {
                    select: { content: true, date: true },
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
        const aiResponse = await axios.post(PYTHON_SERVICE_URL, internData, { timeout: 180000 });
        const analysisResult = aiResponse.data;

        const newReport = await prisma.aiReport.create({
            data: {
                internId: internId,
                overallScore: analysisResult.overallScore || 70,
                strengths: analysisResult.strengths || [],
                weaknesses: analysisResult.weaknesses || [],
                suggestions: analysisResult.suggestions || [],
                adminSummary: analysisResult.adminSummary || 'Analiz tamamlandı.',
                internSummary: analysisResult.internSummary || analysisResult.adminSummary || 'İyi gidiyorsun!',
                internFeedback: analysisResult.internFeedback || 'Gelişmeye devam et.',
                
                // Yapay zeka obje dizisi döndürürse, onları Prisma için düz metne (string) çeviriyoruz
                learningResources: Array.isArray(analysisResult.learningResources)
                    ? analysisResult.learningResources.map(item => 
                        typeof item === 'object' ? `${item.title || 'Kaynak'} - ${item.url || ''}` : String(item)
                    )
                    : [],
                
                nextSteps: analysisResult.nextSteps || [],
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

exports.getReports = async (req, res) => {
    const internId = parseInt(req.params.internId);
    if (req.user.role !== 'ADMIN' && req.user.userId !== internId) {
        return res.status(403).json({ error: "Bu raporu görüntüleme yetkiniz yok." });
    }
    try {
        const reports = await prisma.aiReport.findMany({
            where: { internId: internId },
            orderBy: { reportDate: 'desc' }
        });
        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ error: "Raporlar çekilirken hata oluştu." });
    }
};

exports.deleteReport = async (req, res) => {
    try {
        const reportId = parseInt(req.params.reportId);
        const report = await prisma.aiReport.findUnique({ where: { id: reportId } });
        if (!report) return res.status(404).json({ error: "Rapor bulunamadı." });

        await prisma.aiReport.delete({ where: { id: reportId } });
        res.json({ message: "Rapor başarıyla silindi." });
    } catch (error) {
        console.error("🚨 RAPOR SİLME HATASI:", error.message);
        res.status(500).json({ error: "Rapor silinemedi." });
    }
};

exports.getMyMentorship = async (req, res) => {
    try {
        if (req.user.role !== 'INTERN') return res.status(403).json({ error: "Bu rota sadece stajyerler içindir." });

        const latestReport = await prisma.aiReport.findFirst({
            where: { internId: req.user.userId },
            orderBy: { reportDate: 'desc' }
        });

        if (!latestReport) {
            return res.status(404).json({ message: "Henüz mentörlük raporunuz oluşturulmamış.", report: null });
        }

        res.status(200).json({
            id: latestReport.id,
            reportDate: latestReport.reportDate,
            overallScore: latestReport.overallScore,
            strengths: latestReport.strengths,
            suggestions: latestReport.suggestions,
            internSummary: latestReport.internSummary,
            internFeedback: latestReport.internFeedback,
            learningResources: latestReport.learningResources,
            nextSteps: latestReport.nextSteps,
            encouragementQuote: latestReport.encouragementQuote
        });
    } catch (error) {
        console.error("🚨 MENTÖRLÜK RAPORU HATASI:", error);
        res.status(500).json({ error: "Mentörlük raporu alınamadı." });
    }
};

exports.getMyMentorshipHistory = async (req, res) => {
    try {
        if (req.user.role !== 'INTERN') return res.status(403).json({ error: "Yetkiniz yok." });

        const reports = await prisma.aiReport.findMany({
            where: { internId: req.user.userId },
            orderBy: { reportDate: 'desc' },
            take: 10,
            select: { id: true, reportDate: true, overallScore: true, strengths: true, internSummary: true, encouragementQuote: true }
        });
        res.status(200).json(reports);
    } catch (error) {
        console.error("🚨 MENTÖRLÜK GEÇMİŞİ HATASI:", error);
        res.status(500).json({ error: "Geçmiş raporlar alınamadı." });
    }
};

exports.getDailyTip = async (req, res) => {
    try {
        if (req.user.role !== 'INTERN') return res.status(403).json({ error: "Sadece stajyerler için." });

        const latestReport = await prisma.aiReport.findFirst({
            where: { internId: req.user.userId },
            orderBy: { reportDate: 'desc' }
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

exports.chat = async (req, res) => {
    try {
        const { message, messages } = req.body;
        if (!message || message.trim() === '') return res.status(400).json({ error: "Mesaj boş olamaz." });

        let context = {};
        if (req.user.role === 'INTERN') {
            const internData = await prisma.user.findUnique({
                where: { id: req.user.userId },
                select: {
                    name: true, surname: true,
                    tasksReceived: {
                        where: { status: { not: 'COMPLETED' } },
                        select: { title: true, status: true, deadline: true, repoLink: true },
                        orderBy: { deadline: 'asc' }
                    },
                    archives: { select: { content: true, date: true }, orderBy: { date: 'desc' }, take: 5 },
                    logs: {
                        select: { loginTime: true, logoutTime: true },
                        where: { loginTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
                        orderBy: { loginTime: 'desc' }
                    },
                    aiReports: {
                        select: { overallScore: true, strengths: true, internSummary: true, internFeedback: true, nextSteps: true, encouragementQuote: true, reportDate: true },
                        orderBy: { reportDate: 'desc' }, take: 1
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
                recentArchives: (internData?.archives || []).map(a => ({ date: a.date, summary: a.content.substring(0, 200) })),
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