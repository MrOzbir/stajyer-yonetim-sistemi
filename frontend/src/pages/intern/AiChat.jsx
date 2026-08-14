/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useRef } from 'react';
import { Send, Bot, User, Sparkles, Lightbulb, Code, BookOpen, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'ai_chat_history';

export default function AiChat() {
    const [messages, setMessages] = useState(() => {
        // 🆕 Initializer pattern: localStorage'dan direkt yükle
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return [];
            }
        }
        return [];
    });
    
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Mesajlar değiştiğinde localStorage'a kaydet
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [messages]);

    // Otomatik scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    const handleSend = async () => {
        if (!input.trim() || isStreaming) return;

        const userMessage = input.trim();
        setInput('');
        
        const newUserMsg = { 
            role: 'user', 
            content: userMessage, 
            createdAt: new Date().toISOString() 
        };
        setMessages((prev) => [...prev, newUserMsg]);
        setIsStreaming(true);
        setStreamingContent('');

        // 🆕 Abort controller: Kullanıcı iptal edebilir
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch('http://localhost:5001/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    message: userMessage,
                    messages: messages.slice(-10).map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            let buffer = '';
            let receivedDone = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    
                    try {
                        const data = JSON.parse(line.substring(6));
                        
                        if (data.content) {
                            fullContent += data.content;
                            setStreamingContent(fullContent);
                        }
                        
                        if (data.done && data.full_response) {
                            receivedDone = true;
                            setMessages((prev) => [
                                ...prev,
                                {
                                    role: 'assistant',
                                    content: data.full_response,
                                    createdAt: new Date().toISOString()
                                }
                            ]);
                            setStreamingContent('');
                            setIsStreaming(false);
                        }
                        
                        if (data.error) {
                            console.error('Streaming hatası:', data.error);
                            throw new Error(data.error);
                        }
                    } catch {
                        // JSON parse hatası, satır tamamlanmamış olabilir
                    }
                }
            }

            // 🆕 Eğer done gelmedi ama streaming bittiyse, yarım kalan içeriği kaydet
            if (!receivedDone && fullContent.trim()) {
                console.warn('⚠️ Streaming tamamlandı ama done sinyali gelmedi. Yarım cevap kaydediliyor.');
                setMessages((prev) => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: fullContent + '\n\n(Yanıt yarıda kesilmiş olabilir)',
                        createdAt: new Date().toISOString()
                    }
                ]);
                setStreamingContent('');
                setIsStreaming(false);
            }

            // 🆕 Buffer'da kalan son satırı da işle
            if (buffer.trim()) {
                try {
                    const line = buffer.trim();
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.substring(6));
                        if (data.done && data.full_response && !receivedDone) {
                            setMessages((prev) => [
                                ...prev,
                                {
                                    role: 'assistant',
                                    content: data.full_response,
                                    createdAt: new Date().toISOString()
                                }
                            ]);
                            setStreamingContent('');
                            setIsStreaming(false);
                        }
                    }
                } catch {
                    // Parse hatası, yoksay
                }
            }

        } catch (error) {
            console.error('Chat hatası:', error);
            setIsStreaming(false);
            setStreamingContent('');
            
            if (error.name === 'AbortError') {
                // Kullanıcı iptal etti
                return;
            }
            
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: `⚠️ Bağlantı hatası: ${error.message}. Lütfen tekrar deneyin.`,
                    createdAt: new Date().toISOString()
                }
            ]);
        } finally {
            abortControllerRef.current = null;
        }
    };

    const clearHistory = () => {
        if (window.confirm('Tüm konuşma geçmişi silinsin mi?')) {
            setMessages([]);
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    const stopStreaming = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsStreaming(false);
            setStreamingContent('');
        }
    };

    const quickQuestions = [
        { icon: <Lightbulb size={14} />, text: "React'ta useEffect ne zaman kullanılır?", color: 'text-yellow-400' },
        { icon: <Code size={14} />, text: "Kod hatam var, nasıl debug ederim?", color: 'text-blue-400' },
        { icon: <BookOpen size={14} />, text: "Bu hafta ne öğrenmeliyim?", color: 'text-green-400' },
        { icon: <Sparkles size={14} />, text: "Motivasyonum düştü, tavsiye ver", color: 'text-purple-400' }
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Başlık */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold mb-1">AI Mentörüm 🤖</h1>
                    <p className="text-white/40 text-sm">Teknik sorularını sor, tavsiyeler al</p>
                </div>
                {messages.length > 0 && (
                    <button
                        onClick={clearHistory}
                        title="Geçmişi Temizle"
                        className="text-white/40 hover:text-brand-light transition-colors cursor-pointer"
                    >
                        <Trash2 size={18} />
                    </button>
                )}
            </div>

            {/* Hızlı Sorular */}
            {messages.length === 0 && !isStreaming && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {quickQuestions.map((q, i) => (
                        <button
                            key={i}
                            onClick={() => setInput(q.text)}
                            className="card text-left hover:border-white/20 transition-colors cursor-pointer"
                        >
                            <div className={`flex items-center gap-2 mb-2 ${q.color}`}>
                                {q.icon}
                                <span className="text-xs font-semibold">Hızlı Soru</span>
                            </div>
                            <p className="text-sm text-white/80">{q.text}</p>
                        </button>
                    ))}
                </div>
            )}

            {/* Mesajlar */}
            <div className="flex-1 overflow-y-auto bg-panel rounded-xl p-4 space-y-4 mb-4">
                {messages.length === 0 && !isStreaming && (
                    <div className="flex flex-col items-center justify-center h-full text-white/40">
                        <Bot size={48} className="mb-4 opacity-20" />
                        <p>Merhaba! Ben AI mentörünüm. Ne sormak istersin?</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-brand/20 text-brand-light flex items-center justify-center shrink-0">
                                <Bot size={16} />
                            </div>
                        )}
                        <div
                            className={`max-w-2xl px-4 py-3 rounded-2xl ${
                                msg.role === 'user'
                                    ? 'bg-brand text-white rounded-br-sm'
                                    : 'bg-night text-white rounded-bl-sm'
                            }`}
                        >
                            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                            <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-white/60' : 'text-white/40'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString('tr-TR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </div>
                        </div>
                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shrink-0">
                                <User size={16} />
                            </div>
                        )}
                    </div>
                ))}

                {/* Streaming içeriği */}
                {isStreaming && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-brand/20 text-brand-light flex items-center justify-center shrink-0">
                            <Bot size={16} className="animate-pulse" />
                        </div>
                        <div className="max-w-2xl px-4 py-3 rounded-2xl bg-night text-white rounded-bl-sm">
                            {streamingContent ? (
                                <div className="text-sm whitespace-pre-wrap">{streamingContent}</div>
                            ) : (
                                <div className="flex items-center gap-2 text-white/60">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-brand-light rounded-full animate-bounce"></span>
                                        <span className="w-2 h-2 bg-brand-light rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                                        <span className="w-2 h-2 bg-brand-light rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                                    </div>
                                    <span className="text-sm">AI düşünüyor...</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="AI mentörüne bir şey sor..."
                    disabled={isStreaming}
                    className="input-dark flex-1 disabled:opacity-50"
                />
                {isStreaming ? (
                    <button
                        onClick={stopStreaming}
                        className="bg-brand hover:bg-brand-light text-white font-semibold rounded-lg px-6 py-2.5 transition-colors cursor-pointer"
                    >
                        ⏹ Durdur
                    </button>
                ) : (
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="btn-brand px-6 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                        <Send size={16} />
                        Gönder
                    </button>
                )}
            </div>
        </div>
    );
}