/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
    const { user } = useAuth() || {};
    const socketRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [connected, setConnected] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState({});

    // 🔌 Soket Bağlantı Yönetimi
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setConnected(false);
            return;
        }

        const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5001';

        const newSocket = io(socketUrl, {
            auth: { token },
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('✅ Socket.io Bağlantısı Başarılı!');
            setConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.warn('⚠️ Socket.io Bağlantısı Kesildi');
            setConnected(false);
        });

        newSocket.on('connect_error', (err) => {
            console.error('🚨 Socket Bağlantı Hatası:', err.message);
            setConnected(false);
        });

        newSocket.on('online_users', (data) => {
            setOnlineUsers(data.userIds || []);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [user]);

    // 💬 Gelen Mesaj Dinleyicisi
    useEffect(() => {
        if (!socket || !user) return;

        const myId = Number(user.id || user.userId);

        const handleNewMessage = (msg) => {
            const receiverId = Number(msg.receiver?.id || msg.receiverId);
            const senderId = Number(msg.sender?.id || msg.senderId);

            if (receiverId === myId && senderId) {
                setUnreadCounts((prev) => ({
                    ...prev,
                    [senderId]: (prev[senderId] || 0) + 1
                }));
            }
        };

        socket.on('new_message', handleNewMessage);
        return () => socket.off('new_message', handleNewMessage);
    }, [socket, user]);

    const clearUnread = useCallback((userId) => {
        if (!userId) return;
        setUnreadCounts((prev) => ({ ...prev, [userId]: 0 }));
    }, []);

    const sendMessage = useCallback((receiverId, content) => {
        if (socketRef.current) {
            socketRef.current.emit('send_message', { receiverId, content });
        }
    }, []);

    const sendTyping = useCallback((receiverId, isTyping) => {
        if (socketRef.current) {
            socketRef.current.emit('typing', { receiverId, isTyping });
        }
    }, []);

    return (
        <SocketContext.Provider value={{ socket, onlineUsers, connected, sendMessage, sendTyping, unreadCounts, clearUnread }}>
            {children}
        </SocketContext.Provider>
    );
}

export const useSocketContext = () => useContext(SocketContext);