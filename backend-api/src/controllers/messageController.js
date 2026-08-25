const prisma = require('../config/database');

// 1. İki Kullanıcı Arasındaki Mesaj Geçmişini Getir (GET /api/messages/:id)
exports.getMessages = async (req, res) => {
    try {
        const rawTargetId = req.params.id || req.params.otherUserId || req.params.userId;
        const rawMyId = req.user?.userId || req.user?.id;

        const targetUserId = parseInt(rawTargetId, 10);
        const currentUserId = parseInt(rawMyId, 10);

        if (isNaN(targetUserId) || isNaN(currentUserId)) {
            return res.status(400).json({ error: "Geçersiz kullanıcı ID parametresi." });
        }

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: currentUserId, receiverId: targetUserId },
                    { senderId: targetUserId, receiverId: currentUserId }
                ]
            },
            include: {
                sender: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } }
            },
            orderBy: { id: 'asc' }
        });

        return res.status(200).json({ messages });
    } catch (error) {
        console.error("🚨 GET MESSAGES DETAYLI SUNUCU HATASI:", error);
        return res.status(500).json({ error: "Mesajlar yüklenirken sunucu hatası oluştu." });
    }
};

// 2. HTTP Üzerinden Mesaj Gönderme (POST /api/messages)
exports.sendMessage = async (req, res) => {
    try {
        const { receiverId, content } = req.body;
        const senderId = parseInt(req.user?.userId || req.user?.id, 10);
        const targetId = parseInt(receiverId, 10);

        if (!targetId || !content || content.trim() === "") {
            return res.status(400).json({ error: "Alıcı ve mesaj boş olamaz." });
        }
        if (senderId === targetId) {
            return res.status(400).json({ error: "Kendinize mesaj gönderemezsiniz." });
        }

        const newMessage = await prisma.message.create({
            data: {
                content: content.trim(),
                senderId: senderId,
                receiverId: targetId
            },
            include: {
                sender: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } }
            }
        });

        const io = req.app.get('io');
        if (io) {
            const payload = {
                id: newMessage.id,
                content: newMessage.content,
                timestamp: newMessage.timestamp || newMessage.createdAt || new Date(),
                senderId: newMessage.senderId,
                receiverId: newMessage.receiverId,
                sender: newMessage.sender,
                receiver: newMessage.receiver
            };
            io.to(`user:${senderId}`).emit('new_message', payload);
            io.to(`user:${targetId}`).emit('new_message', payload);
        }

        return res.status(201).json({ message: "Mesaj başarıyla gönderildi!", data: newMessage });
    } catch (error) {
        console.error("🚨 MESAJ GÖNDERME HATASI:", error);
        return res.status(500).json({ error: "Mesaj gönderilirken hata oluştu." });
    }
};

// 3. Mesaj Düzenleme (PATCH /api/messages/:id) - İlk 30 Saniye
exports.editMessage = async (req, res) => {
    try {
        const messageId = parseInt(req.params.id, 10);
        const { content } = req.body;
        const currentUserId = parseInt(req.user?.userId || req.user?.id, 10);

        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Mesaj içeriği boş olamaz." });
        }

        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) return res.status(404).json({ error: "Mesaj bulunamadı." });

        if (message.senderId !== currentUserId) {
            return res.status(403).json({ error: "Sadece kendi mesajınızı düzenleyebilirsiniz." });
        }

        const msgDate = message.timestamp || message.createdAt || new Date();
        const timeDiff = Date.now() - new Date(msgDate).getTime();
        if (timeDiff > 30000) {
            return res.status(400).json({ error: "Mesajlar sadece ilk 30 saniye içinde düzenlenebilir." });
        }

        const updated = await prisma.message.update({
            where: { id: messageId },
            data: { content: content.trim() },
            include: {
                sender: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } }
            }
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`user:${updated.senderId}`).emit('message_updated', updated);
            io.to(`user:${updated.receiverId}`).emit('message_updated', updated);
        }

        return res.status(200).json({ message: "Mesaj düzenlendi.", data: updated });
    } catch (error) {
        console.error("🚨 MESAJ DÜZENLEME HATASI:", error);
        return res.status(500).json({ error: "Mesaj düzenlenemedi." });
    }
};

// 4. Mesaj Silme (DELETE /api/messages/:id) - İlk 30 Saniye
exports.deleteMessage = async (req, res) => {
    try {
        const messageId = parseInt(req.params.id, 10);
        const currentUserId = parseInt(req.user?.userId || req.user?.id, 10);

        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) return res.status(404).json({ error: "Mesaj bulunamadı." });

        if (message.senderId !== currentUserId) {
            return res.status(403).json({ error: "Sadece kendi mesajınızı silebilirsiniz." });
        }

        const msgDate = message.timestamp || message.createdAt || new Date();
        const timeDiff = Date.now() - new Date(msgDate).getTime();
        if (timeDiff > 30000) {
            return res.status(400).json({ error: "Mesajlar sadece ilk 30 saniye içinde silinebilir." });
        }

        await prisma.message.delete({ where: { id: messageId } });

        const io = req.app.get('io');
        if (io) {
            const payload = { id: messageId, senderId: message.senderId, receiverId: message.receiverId };
            io.to(`user:${message.senderId}`).emit('message_deleted', payload);
            io.to(`user:${message.receiverId}`).emit('message_deleted', payload);
        }

        return res.status(200).json({ message: "Mesaj silindi." });
    } catch (error) {
        console.error("🚨 MESAJ SİLME HATASI:", error);
        return res.status(500).json({ error: "Mesaj silinemedi." });
    }
};