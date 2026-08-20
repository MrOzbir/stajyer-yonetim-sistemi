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

// Mesajı Düzenleme (Sadece ilk 30 saniye)
exports.editMessage = async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const { content } = req.body;
        const userId = req.user.userId;

        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) return res.status(404).json({ error: "Mesaj bulunamadı." });

        // 1. Güvenlik: Kendi mesajı mı?
        if (message.senderId !== userId) return res.status(403).json({ error: "Sadece kendi mesajlarınızı düzenleyebilirsiniz." });

        // 2. Zaman Kontrolü: 30 saniye geçti mi?
        const timeDiff = new Date().getTime() - new Date(message.timestamp).getTime();
        if (timeDiff > 30000) {
            return res.status(400).json({ error: "Mesajlar sadece gönderildikten sonraki ilk 30 saniye içinde düzenlenebilir." });
        }

        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: { content: content },
            include: {
                sender: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } }
            }
        });

        const messagePayload = {
            id: updatedMessage.id,
            content: updatedMessage.content,
            timestamp: updatedMessage.timestamp,
            sender: updatedMessage.sender,
            receiver: updatedMessage.receiver
        };

        // Socket.io ile her iki tarafa güncellemeyi canlı yayınla
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${updatedMessage.senderId}`).emit('message_updated', messagePayload);
            io.to(`user:${updatedMessage.receiverId}`).emit('message_updated', messagePayload);
        }

        res.status(200).json({ message: "Mesaj düzenlendi!", data: messagePayload });
    } catch (error) {
        console.error("🚨 MESAJ DÜZENLEME HATASI:", error);
        res.status(500).json({ error: "Mesaj düzenlenemedi." });
    }
};

// Mesajı Silme (Sadece ilk 30 saniye)
exports.deleteMessage = async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const userId = req.user.userId;

        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) return res.status(404).json({ error: "Mesaj bulunamadı." });

        if (message.senderId !== userId) return res.status(403).json({ error: "Sadece kendi mesajlarınızı silebilirsiniz." });

        const timeDiff = new Date().getTime() - new Date(message.timestamp).getTime();
        if (timeDiff > 30000) {
            return res.status(400).json({ error: "Mesajlar sadece gönderildikten sonraki ilk 30 saniye içinde silinebilir." });
        }

        await prisma.message.delete({ where: { id: messageId } });

        // Socket.io ile her iki tarafa silinme emrini canlı yayınla
        const io = req.app.get('io');
        if (io) {
            const payload = { id: messageId, senderId: message.senderId, receiverId: message.receiverId };
            io.to(`user:${message.senderId}`).emit('message_deleted', payload);
            io.to(`user:${message.receiverId}`).emit('message_deleted', payload);
        }

        res.status(200).json({ message: "Mesaj silindi!" });
    } catch (error) {
        console.error("🚨 MESAJ SİLME HATASI:", error);
        res.status(500).json({ error: "Mesaj silinemedi." });
    }
};