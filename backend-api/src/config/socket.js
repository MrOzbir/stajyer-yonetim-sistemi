const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('./database');

function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: ['http://localhost:5173', 'http://127.0.0.1:5173', '*'],
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        transports: ['websocket', 'polling'],
        allowEIO3: true
    });

    const onlineUsers = new Map();

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
        onlineUsers.set(String(socket.userId), socket.id);
        socket.join(`user:${socket.userId}`);

        io.emit('online_users', {
            userIds: Array.from(onlineUsers.keys()).map((id) => parseInt(id, 10)),
            count: onlineUsers.size
        });

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
                        sender: { select: { id: true, name: true, surname: true } },
                        receiver: { select: { id: true, name: true, surname: true } }
                    }
                });

                const payload = {
                    id: newMessage.id,
                    content: newMessage.content,
                    timestamp: newMessage.timestamp || newMessage.createdAt || new Date(),
                    senderId: newMessage.senderId,
                    receiverId: newMessage.receiverId,
                    sender: newMessage.sender,
                    receiver: newMessage.receiver
                };

                io.to(`user:${socket.userId}`).emit('new_message', payload);
                io.to(`user:${targetId}`).emit('new_message', payload);
            } catch (error) {
                console.error('🚨 SOCKET MESAJ HATASI:', error);
            }
        });

        socket.on('typing', (data) => {
            const { receiverId, isTyping } = data;
            if (receiverId) {
                socket.to(`user:${Number(receiverId)}`).emit('user_typing', {
                    userId: socket.userId,
                    isTyping: isTyping
                });
            }
        });

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