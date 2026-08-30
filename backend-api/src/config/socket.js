const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('./database');

function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://192.168.1.41:5173'],
            methods: ['GET', 'POST', 'PATCH'],
            credentials: true
        },
        pingTimeout: 60000,
        transports: ['websocket', 'polling'],
        allowEIO3: true
    });

    const onlineUsers = new Map();

    // 🛡️ JWT Auth Middleware (Güvenli & Geriye Dönük Uyumlu)
    io.use((socket, next) => {
        try {
            const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
            if (!rawToken) {
                console.warn('⚠️ Soket Bağlantısı: Token bulunamadı');
                return next(new Error('Authentication token gerekli'));
            }

            const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
            const secret = process.env.JWT_SECRET || 'gizli-anahtar-fallback';
            const decoded = jwt.verify(token, secret);

            // Farklı token şemaları için güvenli ID çıkarımı
            const resolvedId = decoded.userId || decoded.id || decoded.sub;
            socket.userId = Number(resolvedId);
            socket.userRole = decoded.role || 'INTERN';

            if (!socket.userId || isNaN(socket.userId)) {
                return next(new Error('Geçersiz kullanıcı kimliği'));
            }

            next();
        } catch (error) {
            console.error('🚨 Soket Auth Hatası:', error.message);
            next(new Error('Geçersiz token'));
        }
    });

    io.on('connection', (socket) => {
        const strUserId = String(socket.userId);
        onlineUsers.set(strUserId, socket.id);
        
        // Kullanıcıyı kendi özel odasına al
        socket.join(`user:${strUserId}`);

        // Çevrimiçi kullanıcıları duyur
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
                    senderId: newMessage.senderId,
                    receiverId: newMessage.receiverId,
                    sender: newMessage.sender,
                    receiver: newMessage.receiver
                };

                io.to(`user:${String(socket.userId)}`).emit('new_message', payload);
                io.to(`user:${String(targetId)}`).emit('new_message', payload);

            } catch (error) {
                console.error('🚨 SOCKET MESAJ KAYIT HATASI:', error);
            }
        });

        // ⌨️ "Yazıyor..." Göstergesi
        socket.on('typing', (data) => {
            const { receiverId, isTyping } = data;
            if (receiverId) {
                socket.to(`user:${String(receiverId)}`).emit('user_typing', {
                    userId: socket.userId,
                    isTyping: isTyping
                });
            }
        });

        // 🔌 Bağlantı Koptuğunda
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