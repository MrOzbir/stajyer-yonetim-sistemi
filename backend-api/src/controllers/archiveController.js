const prisma = require('../config/database');

exports.createArchive = async (req, res) => {
    try {
        const { content } = req.body;
        if (req.user.role !== 'INTERN') return res.status(403).json({ error: "Sadece stajyerler günlük arşiv ekleyebilir." });
        if (!content || content.trim() === "") return res.status(400).json({ error: "Arşiv içeriği boş olamaz." });

        const newArchive = await prisma.dailyArchive.create({ data: { content: content, internId: req.user.userId } });
        res.status(201).json({ message: "Günlük arşiviniz başarıyla kaydedildi!", archive: newArchive });
    } catch (error) { res.status(500).json({ error: "Günlük arşiv eklenirken bir hata oluştu." }); }
};

exports.getAllArchives = async (req, res) => {
    try {
        const archives = await prisma.dailyArchive.findMany({
            orderBy: { date: 'desc' },
            include: { intern: { select: { id: true, name: true, surname: true } } }
        });
        res.status(200).json(archives);
    } catch (error) { res.status(500).json({ error: "Arşivler listelenirken hata oluştu." }); }
};