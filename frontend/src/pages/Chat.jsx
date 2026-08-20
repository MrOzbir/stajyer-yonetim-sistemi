/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { io } from 'socket.io-client';
import { Send, Circle, Pencil, Trash2, X } from 'lucide-react';


export default function Chat() {
    const { user } = useAuth();
    const { onlineUsers, connected, sendMessage, sendTyping, unreadCounts, clearUnread } = useSocketContext();
        
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

    const [editingMessage, setEditingMessage] = useState(null);
    const [now, setNow] = useState(() => Date.now());
    
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

            const token = localStorage.getItem('token');

            const socket = io('http://localhost:5001', {
                auth: { token: token },
                transports: ['polling', 'websocket'], // Önce HTTP (polling) ile başlasın, sonra websocket'e geçsin (Hata riskini sıfırlar)
                autoConnect: true
            });

        socket.on('new_message', (msg) => {
            // Bu konuşmaya ait mesaj mı?
            const relevant =
                (msg.sender.id === user.id && msg.receiver.id === selectedUser?.id) ||
                (msg.sender.id === selectedUser?.id && msg.receiver.id === user.id);

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

        socket.on('message_updated', (updatedMsg) => {
            setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        });
    
        socket.on('message_deleted', (data) => {
            setMessages((prev) => prev.filter(m => m.id !== data.id));
        });

        return () => {
            socket.disconnect();
        };
    }, [user, selectedUser]);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Otomatik scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Seçili kullanıcı aktif olduğunda veya mesaj geldiğinde okundu yap / bildirimi sıfırla
    useEffect(() => {
        if (selectedUser?.id && unreadCounts[selectedUser.id] > 0) {
            clearUnread(selectedUser.id);
        }
    }, [selectedUser, messages, unreadCounts, clearUnread]);

    const handleSend = async () => {
        if (!newMessage.trim() || !selectedUser) return;
        
        // Düzenleme modundaysak API'ye PATCH at, normal gönderimse Socket.io kullan
        if (editingMessage) {
            try {
                await api.patch(`/messages/${editingMessage.id}`, { content: newMessage.trim() });
                setEditingMessage(null);
                setNewMessage('');
            } catch (e) {
                alert(e.response?.data?.error || "Mesaj düzenlenemedi.");
            }
        } else {
            sendMessage(selectedUser.id, newMessage.trim());
            setNewMessage('');
        }
        
        if (isTyping) {
            sendTyping(selectedUser.id, false);
            setIsTyping(false);
        }
    };
    
    const handleDeleteMsg = async (msgId) => {
        try {
            await api.delete(`/messages/${msgId}`);
        } catch (e) {
            alert(e.response?.data?.error || "Mesaj silinemedi.");
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

    const handleUserClick = (u) => {
        setSelectedUser(u);
        clearUnread(u.id); // Tıklandığı an bildirim sayacı sıfırlanır
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
                            onClick={() => handleUserClick(u)}
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

                            {unreadCounts[u.id] > 0 && selectedUser?.id !== u.id && (
                            <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse">
                                {unreadCounts[u.id]}
                            </div>
                        )}
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
                                // Bu senin user.id kullanılarak yapılmış güncel kontrolün
                                const isMine = msg.sender.id === user.id; 
                                
                                // 30 saniye (30.000 ms) kontrolü hesaplanıyor
                                const timeDiff = now - new Date(msg.timestamp).getTime();
                                const canEdit = isMine && timeDiff <= 30000;

                                return (
                                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-md px-4 py-2 rounded-2xl ${isMine ? 'bg-brand text-white rounded-br-sm' : 'bg-panel text-white rounded-bl-sm'}`}>
                                            <p className="text-sm">{msg.content}</p>
                                            <div className={`text-xs mt-1 ${isMine ? 'text-white/60' : 'text-white/40'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        {/* Düzenle / Sil Butonları - Sadece koşul uyuyorsa görünür */}
                                        {canEdit && (
                                            <div className="flex gap-3 mt-1 mr-1 text-[10px] text-white/40">
                                                <button 
                                                    onClick={() => { setEditingMessage(msg); setNewMessage(msg.content); }}
                                                    className="hover:text-brand-light flex items-center gap-1 transition-colors"
                                                >
                                                    <Pencil size={10} /> Düzenle
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteMsg(msg.id)}
                                                    className="hover:text-red-400 flex items-center gap-1 transition-colors"
                                                >
                                                    <Trash2 size={10} /> Sil
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Düzenleme Modu Göstergesi */}
                        {editingMessage && (
                            <div className="px-4 py-2 bg-brand/20 text-brand-light text-xs flex justify-between items-center border-t border-white/5">
                                <span>Mesaj düzenleniyor...</span>
                                <button onClick={() => { setEditingMessage(null); setNewMessage(''); }} className="hover:text-white transition-colors">
                                    <X size={14} />
                                </button>
                            </div>
                        )}

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