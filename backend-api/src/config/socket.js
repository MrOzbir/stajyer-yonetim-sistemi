const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('./database');

function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: '*', // İleride canlıya alırken Vite/React domain'i ile değiştirebilirsin
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        transports: ['websocket', 'polling'],
        allowEIO3: true
    });

    // Online kullanıcıları takip etmek için Map
    const onlineUsers = new Map();

    // Socket.io JWT Authentication Middleware
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error('Authentication token gerekli'));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            socket.userRole = decoded.role;
            next();
        } catch (error) {
            next(new Error('Geçersiz veya süresi dolmuş token'));
        }
    });

    // Yeni bağlantı geldiğinde
    io.on('connection', (socket) => {
        console.log(`🔌 Yeni bağlantı: User ${socket.userId} (${socket.id})`);
        onlineUsers.set(String(socket.userId), socket.id);
        socket.join(`user:${socket.userId}`);

        // Tüm client'lara güncel online listesini yayınla
        io.emit('online_users', {
            userIds: Array.from(onlineUsers.keys()).map(id => parseInt(id)),
            count: onlineUsers.size
        });

        // Yeni mesaj geldiğinde
        socket.on('send_message', async (data) => {
            try {
                const { receiverId, content } = data;

                if (!receiverId || !content || content.trim() === '') {
                    return socket.emit('error', { message: 'Alıcı ve içerik gerekli' });
                }

                const newMessage = await prisma.message.create({
                    data: {
                        content: content,
                        senderId: socket.userId,
                        receiverId: parseInt(receiverId)
                    },
                    include: {
                        sender: { select: { id: true, name: true } },
                        receiver: { select: { id: true, name: true } }
                    }
                });

                const messagePayload = {
                    id: newMessage.id,
                    content: newMessage.content,
                    timestamp: newMessage.timestamp,
                    sender: newMessage.sender,
                    receiver: newMessage.receiver
                };

                io.to(`user:${socket.userId}`).emit('new_message', messagePayload);
                io.to(`user:${receiverId}`).emit('new_message', messagePayload);
                console.log(`💬 Mesaj: ${socket.userId} → ${receiverId}`);
            } catch (error) {
                console.error('🚨 SOCKET MESAJ HATASI:', error);
                socket.emit('error', { message: 'Mesaj gönderilemedi' });
            }
        });

        // Yazıyor... göstergesi
        socket.on('typing', (data) => {
            const { receiverId, isTyping } = data;
            socket.to(`user:${receiverId}`).emit('user_typing', {
                userId: socket.userId,
                isTyping: isTyping
            });
        });

        // Bağlantı koptuğunda
        socket.on('disconnect', () => {
            console.log(`❌ Bağlantı koptu: User ${socket.userId}`);
            onlineUsers.delete(String(socket.userId));
            io.emit('online_users', {
                userIds: Array.from(onlineUsers.keys()).map(id => parseInt(id)),
                count: onlineUsers.size
            });
        });
    });

    return io;
}

module.exports = setupSocket;