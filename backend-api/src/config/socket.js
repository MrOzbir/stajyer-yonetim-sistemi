const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('./database');

function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: ['http://localhost:5173', 'http://192.168.1.41:5173', 'http://127.0.0.1:5173', '*'],
            methods: ['GET', 'POST', 'PATCH'],
            credentials: true
        },
        pingTimeout: 60000,
        transports: ['websocket', 'polling'],
        allowEIO3: true
    });

    const onlineUsers = new Map();

    // JWT Auth Middleware
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error('Authentication token gerekli'));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = Number(decoded.userId || decoded.id);
            socket.userRole = decoded.role;
            next();
        } catch (error) {
            next(new Error('Geçersiz token'));
        }
    });

    io.on('connection', (socket) => {
        const strUserId = String(socket.userId);
        onlineUsers.set(strUserId, socket.id);
        
        // Kullanıcıyı kendi odasına String olarak kaydet
        socket.join(`user:${strUserId}`);

        io.emit('online_users', {
            userIds: Array.from(onlineUsers.keys()).map((id) => parseInt(id, 10)),
            count: onlineUsers.size
        });

        // 💬 MESAJ GÖNDERME
        socket.on('send_message', async (data) => {
            try {
                const { receiverId, content } = data;
                const targetId = Number(receiverId);

                if (!targetId || !content || !content.trim()) return;

                // Veritabanına kaydet
                const newMessage = await prisma.message.create({
                    data: {
                        content: content.trim(),
                        senderId: socket.userId,
                        receiverId: targetId
                    },
                    include: {
                        sender: { select: { id: true, name: true } },
                        receiver: { select: { id: true, name: true } }
                    }
                });

                const payload = {
                    id: newMessage.id,
                    content: newMessage.content,
                    timestamp: newMessage.createdAt || newMessage.timestamp || new Date(),
                    createdAt: newMessage.createdAt || newMessage.timestamp || new Date(),
                    isRead: newMessage.isRead || false,
                    senderId: newMessage.senderId,
                    receiverId: newMessage.receiverId,
                    sender: newMessage.sender,
                    receiver: newMessage.receiver
                };

                // Hem gönderenin hem alıcının odasına ilet
                io.to(`user:${String(socket.userId)}`).emit('new_message', payload);
                io.to(`user:${String(targetId)}`).emit('new_message', payload);

                console.log(`💬 Mesaj iletildi: ${socket.userId} -> ${targetId}`);
            } catch (error) {
                console.error('🚨 SOCKET MESAJ KAYIT HATASI:', error);
            }
        });

        // "Yazıyor..." Göstergesi
        socket.on('typing', (data) => {
            const { receiverId, isTyping } = data;
            if (receiverId) {
                socket.to(`user:${String(receiverId)}`).emit('user_typing', {
                    userId: socket.userId,
                    isTyping: isTyping
                });
            }
        });

        // Bağlantı Koptuğunda
        socket.on('disconnect', () => {
            onlineUsers.delete(String(socket.userId));
            io.emit('online_users', {
                userIds: Array.from(onlineUsers.keys()).map((id) => parseInt(id, 10)),
                count: onlineUsers.size
            });
        });
    });

    return io;
}

module.exports = setupSocket;