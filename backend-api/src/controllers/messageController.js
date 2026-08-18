const prisma = require('../config/database');

exports.sendMessage = async (req, res) => {
    try {
        const { receiverId, content } = req.body;
        const senderId = req.user.userId;

        if (!receiverId || !content || content.trim() === "") return res.status(400).json({ error: "Alıcı ve mesaj boş olamaz." });
        if (senderId === parseInt(receiverId)) return res.status(400).json({ error: "Kendinize mesaj gönderemezsiniz." });

        const newMessage = await prisma.message.create({ data: { content, senderId, receiverId: parseInt(receiverId) } });

        // Express app üzerinden io nesnesine erişip canlı yayın yapıyoruz!
        const io = req.app.get('io');
        if (io) {
            const payload = { ...newMessage, sender: { id: senderId, name: req.user.name || 'User' }, receiver: { id: parseInt(receiverId) } };
            io.to(`user:${senderId}`).emit('new_message', payload);
            io.to(`user:${receiverId}`).emit('new_message', payload);
        }
        res.status(201).json({ message: "Mesaj başarıyla gönderildi!", data: newMessage });
    } catch (error) { res.status(500).json({ error: "Mesaj gönderilirken hata oluştu." }); }
};

exports.getMessages = async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: { OR: [{ senderId: req.user.userId }, { receiverId: req.user.userId }] },
            orderBy: { timestamp: 'asc' },
            include: { sender: { select: { id: true, name: true } }, receiver: { select: { id: true, name: true } } }
        });
        res.status(200).json(messages);
    } catch (error) { res.status(500).json({ error: "Mesajlar listelenemedi." }); }
};

exports.getChatHistory = async (req, res) => {
    try {
        const myId = req.user.userId;
        const otherId = parseInt(req.params.otherUserId);
        if (myId === otherId) return res.status(400).json({ error: "Geçersiz işlem." });

        const messages = await prisma.message.findMany({
            where: { OR: [{ senderId: myId, receiverId: otherId }, { senderId: otherId, receiverId: myId }] },
            orderBy: { timestamp: 'asc' }, take: 100,
            include: { sender: { select: { id: true, name: true } }, receiver: { select: { id: true, name: true } } }
        });
        res.status(200).json({ otherUserId: otherId, messages });
    } catch (error) { res.status(500).json({ error: "Geçmiş alınamadı." }); }
};