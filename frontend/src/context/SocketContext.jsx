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

    // Bağlantı Kurulumu
    useEffect(() => {
        if (!user) return;

        const token = localStorage.getItem('token');
        const newSocket = io('http://localhost:5001', {
            auth: { token },
            transports: ['websocket']
        });
        
        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on('connect', () => setConnected(true));
        newSocket.on('disconnect', () => setConnected(false));
        newSocket.on('online_users', (data) => setOnlineUsers(data.userIds || []));
        
        return () => newSocket.disconnect();
    }, [user]);

    // Mesaj Dinleyicisi
    useEffect(() => {
        if (!socket || !user) return;

        const handleNewMessage = (msg) => { 
            if (msg.receiver.id === user.id) {
                setUnreadCounts((prev) => ({
                    ...prev,
                    [msg.sender.id]: (prev[msg.sender.id] || 0) + 1
                }));
            }
        };

        socket.on('new_message', handleNewMessage);
        return () => socket.off('new_message', handleNewMessage);
    }, [socket, user]);

    // Bildirim Sıfırlama
    const clearUnread = useCallback((userId) => {
        setUnreadCounts((prev) => ({ ...prev, [userId]: 0 }));
    }, []);

    const sendMessage = useCallback((receiverId, content) => {
        if (socketRef.current) socketRef.current.emit('send_message', { receiverId, content });
    }, []);

    const sendTyping = useCallback((receiverId, isTyping) => {
        if (socketRef.current) socketRef.current.emit('typing', { receiverId, isTyping });
    }, []);

    return (
        <SocketContext.Provider value={{ socket, onlineUsers, connected, sendMessage, sendTyping, unreadCounts, clearUnread }}>
            {children}
        </SocketContext.Provider>
    );
}

// Kolay kullanım için hook'u buradan dışarı aktarıyoruz
export const useSocketContext = () => useContext(SocketContext);