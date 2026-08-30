import { useState } from 'react';
import api from '../../api/axios';
import { BookOpen, Send, Sparkles } from 'lucide-react';

export default function InternArchives() {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Geçici mentör notunu tutacağımız State (Sayfa yenilenince veya çıkış yapılınca uçar)
    const [ephemeralNote, setEphemeralNote] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) return;

        setLoading(true);
        try {
            // Günlüğü backend'e gönderiyoruz
            const response = await api.post('/archives', { content });
            
            // Backend günlüğü kaydedip, AI'dan gelen anlık tavsiyeyi geri döndürecek
            setEphemeralNote(response.data.mentorNote);
            setContent(''); // Formu temizle
        } catch (error) {
            console.error("Günlük gönderilirken hata oluştu:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Sayfa Başlığı */}
            <div>
                <h1 className="text-2xl font-bold mb-1">Günlük Arşiv</h1>
                <p className="text-snow-faint text-sm">Günün nasıl geçti? Neler öğrendin, nelerde zorlandın?</p>
            </div>

            {/* AI Mentör Geçici Not Alanı (Sadece gönderimden sonra görünür) */}
            {ephemeralNote && (
                <div className="card border-l-4 border-l-brand bg-gradient-to-r from-brand/10 to-transparent p-5 animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={20} className="text-brand-light" />
                        <h3 className="font-bold text-brand-light text-lg">Mentörünün Değerlendirmesi</h3>
                    </div>
                    <p className="text-snow leading-relaxed text-sm">
                        {ephemeralNote}
                    </p>
                    <p className="text-snow-faint text-[10px] mt-4 italic">
                        * Bu not sana özeldir ve sistemde kaydedilmez. Sayfadan ayrıldığında silinecektir.
                    </p>
                </div>
            )}

            {/* Günlük Yazma Formu */}
            <form onSubmit={handleSubmit} className="card p-0 overflow-hidden border-edge">
                <div className="flex items-center gap-2 p-4 border-b border-edge bg-night/30">
                    <BookOpen size={18} className="text-brand-light" />
                    <h2 className="font-bold text-base">Bugünün Notları</h2>
                </div>
                
                <div className="p-4 bg-panel">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Sevgili günlük... (Şaka şaka, burası senin özgür alanın! Hislerini, teknik görevlerini, sosyalleşme durumunu veya şikayetlerini yazabilirsin. Unutma, bu yazılar yöneticilere sadece genel ve anonim bir özet olarak gidecek.)"
                        className="w-full h-48 bg-night border border-edge rounded-lg p-4 text-sm text-snow focus:outline-none focus:border-brand/50 resize-none transition-colors"
                        disabled={loading}
                    />
                </div>

                <div className="flex justify-end p-4 border-t border-edge bg-night/30">
                    <button
                        type="submit"
                        disabled={loading || !content.trim()}
                        className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <span>Gönder ve Mentörden Yorum Al</span>
                                <Send size={16} />
                            </>
                        )}
                    </button>
                </div>
            </form>

        </div>
    );
}