/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export function useSocket() {
    const { user } = useAuth();
    const socketRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!user) return;

        const token = localStorage.getItem('token');
        const socket = io('http://localhost:5001', {
            auth: { token },
            transports: ['websocket']
        });
        socketRef.current = socket;
        setSocket(socket);
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
        });

        socket.on('disconnect', () => {
            setConnected(false);
        });

        socket.on('online_users', (data) => {
            setOnlineUsers(data.userIds || []);
        });

        socket.on('connect_error', (err) => {
            console.error('Socket bağlantı hatası:', err.message);
        });

        return () => {
            socket.disconnect();
        };
    }, [user]);

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
    return {
        socket,
        onlineUsers,
        connected,
        sendMessage,
        sendTyping
    };
}