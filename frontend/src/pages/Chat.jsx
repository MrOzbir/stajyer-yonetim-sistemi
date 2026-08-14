/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { Send, Circle } from 'lucide-react';
import { io } from 'socket.io-client';

export default function Chat() {
    const { user } = useAuth();
    const { onlineUsers, connected, sendMessage, sendTyping } = useSocket();
    
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [otherTyping, setOtherTyping] = useState(false);
    const [loading, setLoading] = useState(true);

    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const otherTypingTimeoutRef = useRef(null);

    // Kullanıcıları yükle (Admin → tüm stajyerler, Stajyer → sadece admin)
    useEffect(() => {
        (async () => {
            try {
                if (user.role === 'ADMIN') {
                    const res = await api.get('/interns');
                    setUsers(res.data.interns || []);
                } else {
                    // Stajyer için admin'leri bul (role='ADMIN' olanlar)
                    const res = await api.get('/users?role=ADMIN');
                    setUsers(res.data || []);
                }
            } catch (e) {
                console.error('Kullanıcılar yüklenemedi:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [user]);

    // Seçili kullanıcı değişince mesaj geçmişini yükle
    useEffect(() => {
        if (!selectedUser) return;
        (async () => {
            try {
                const res = await api.get(`/messages/${selectedUser.id}`);
                setMessages(res.data.messages || []);
            } catch (e) {
                console.error('Mesajlar yüklenemedi:', e);
            }
        })();
    }, [selectedUser]);

    // Yeni mesaj geldiğinde (Socket.io)
    useEffect(() => {
        if (!user) return;

        const socket = io('http://localhost:5001', {
            auth: { token: localStorage.getItem('token') },
            transports: ['websocket']
        });

        socket.on('new_message', (msg) => {
            // Bu konuşmaya ait mesaj mı?
            const relevant =
                (msg.sender.id === user.userId && msg.receiver.id === selectedUser?.id) ||
                (msg.sender.id === selectedUser?.id && msg.receiver.id === user.userId);

            if (relevant) {
                setMessages((prev) => [...prev, msg]);
            }
        });

        socket.on('user_typing', (data) => {
            if (data.userId === selectedUser?.id) {
                setOtherTyping(data.isTyping);
                clearTimeout(otherTypingTimeoutRef.current);
                if (data.isTyping) {
                    otherTypingTimeoutRef.current = setTimeout(() => {
                        setOtherTyping(false);
                    }, 3000);
                }
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [user, selectedUser]);

    // Otomatik scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!newMessage.trim() || !selectedUser) return;
        sendMessage(selectedUser.id, newMessage.trim());
        setNewMessage('');
        if (isTyping) {
            sendTyping(selectedUser.id, false);
            setIsTyping(false);
        }
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (!selectedUser) return;

        if (!isTyping) {
            sendTyping(selectedUser.id, true);
            setIsTyping(true);
        }

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            sendTyping(selectedUser.id, false);
            setIsTyping(false);
        }, 2000);
    };

    return (
        <div className="flex h-[calc(100vh-8rem)]">
            {/* Sol: Kullanıcı Listesi */}
            <div className="w-80 bg-panel border-r border-white/5 flex flex-col">
                <div className="p-4 border-b border-white/5">
                    <h2 className="font-bold">Mesajlar</h2>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                        <Circle size={8} className={connected ? 'text-green-500 fill-green-500' : 'text-white/30'} />
                        <span className="text-white/50">{connected ? 'Bağlı' : 'Bağlı değil'}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading && (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}

                    {!loading && users.length === 0 && (
                        <div className="text-center py-8 text-white/40 text-sm">
                            Konuşma yok
                        </div>
                    )}

                    {users.map((u) => (
                        <button
                            key={u.id}
                            onClick={() => setSelectedUser(u)}
                            className={`w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors cursor-pointer ${
                                selectedUser?.id === u.id ? 'bg-white/10' : ''
                            }`}
                        >
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-brand/20 text-brand-light flex items-center justify-center font-bold">
                                    {u.name?.charAt(0)}
                                </div>
                                {onlineUsers.includes(u.id) && (
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-panel"></span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <div className="font-semibold truncate">
                                    {u.name} {u.surname}
                                </div>
                                <div className="text-xs text-white/40 truncate">
                                    {onlineUsers.includes(u.id) ? 'Çevrimiçi' : 'Çevrimdışı'}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Sağ: Mesajlaşma Alanı */}
            <div className="flex-1 flex flex-col bg-night">
                {!selectedUser ? (
                    <div className="flex-1 flex items-center justify-center text-white/40">
                        <div className="text-center">
                            <Send size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Bir konuşma seçin</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-white/5 bg-panel">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-brand/20 text-brand-light flex items-center justify-center font-bold">
                                        {selectedUser.name?.charAt(0)}
                                    </div>
                                    {onlineUsers.includes(selectedUser.id) && (
                                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-panel"></span>
                                    )}
                                </div>
                                <div>
                                    <div className="font-bold">
                                        {selectedUser.name} {selectedUser.surname}
                                    </div>
                                    <div className="text-xs text-white/40">
                                        {otherTyping ? 'Yazıyor...' : onlineUsers.includes(selectedUser.id) ? 'Çevrimiçi' : 'Çevrimdışı'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mesajlar */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.map((msg) => {
                                const isMine = msg.sender.id === user.userId;
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-md px-4 py-2 rounded-2xl ${
                                                isMine
                                                    ? 'bg-brand text-white rounded-br-sm'
                                                    : 'bg-panel text-white rounded-bl-sm'
                                            }`}
                                        >
                                            <p className="text-sm">{msg.content}</p>
                                            <div className={`text-xs mt-1 ${isMine ? 'text-white/60' : 'text-white/40'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString('tr-TR', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-white/5 bg-panel">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={handleTyping}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    placeholder="Mesaj yazın..."
                                    className="input-dark flex-1"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!newMessage.trim()}
                                    className="btn-brand px-6 flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Send size={16} />
                                    Gönder
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}