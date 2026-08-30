import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { 
    Calendar, Bot, Loader2, Smile, AlertCircle, 
    CheckCircle2, ThumbsDown, ThumbsUp, FileText 
} from 'lucide-react';

export default function DailySummaries() {
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSummaries = async () => {
            try {
                const res = await api.get('/summaries');
                setSummaries(res.data || []);
            } catch (error) {
                console.error("Özetler yüklenemedi:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSummaries();
    }, []);

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold mb-1">Stajyer Günlük Özetleri</h1>
                <p className="text-snow-faint text-sm">Yapay zeka tarafından derlenen anonim günlük raporlar</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 size={32} className="text-brand animate-spin" />
                </div>
            ) : summaries.length === 0 ? (
                <div className="card text-center py-20 border border-edge">
                    <Bot size={48} className="mx-auto mb-4 text-snow-faint" />
                    <p className="text-snow-muted">Henüz oluşturulmuş bir günlük özet bulunmuyor.</p>
                    <p className="text-snow-faint text-xs mt-2">Özetler her gün saat 12:00'de otomatik olarak derlenir.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {summaries.map((summary) => (
                        <div key={summary.id} className="card border border-edge bg-panel/60 p-6 space-y-5">
                            
                            {/* Tarih ve Genel Moral Başlığı */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge pb-4">
                                <div className="flex items-center gap-2 text-brand-light font-bold">
                                    <Calendar size={18} />
                                    <span>
                                        {new Date(summary.date).toLocaleDateString('tr-TR', {
                                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                                        })}
                                    </span>
                                </div>
                                {summary.generalMoral && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-xs font-semibold text-brand-light">
                                        <Smile size={14} />
                                        <span>Genel Moral: {summary.generalMoral}</span>
                                    </div>
                                )}
                            </div>

                            {/* Yönetici Özeti Paragrafı */}
                            {(summary.executiveSummary || summary.content) && (
                                <div className="bg-white/[0.02] border border-edge rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-snow font-semibold text-sm mb-2">
                                        <FileText size={16} className="text-brand-light" />
                                        <span>Yönetici Özeti</span>
                                    </div>
                                    <p className="text-snow-muted text-sm leading-relaxed whitespace-pre-wrap">
                                        {summary.executiveSummary || summary.content}
                                    </p>
                                </div>
                            )}

                            {/* Detay Kartları Izgarası */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                
                                {/* Başarılar */}
                                {summary.achievements?.length > 0 && (
                                    <div className="p-3.5 rounded-lg bg-green-500/5 border border-green-500/10 space-y-2">
                                        <div className="flex items-center gap-1.5 font-bold text-green-400">
                                            <CheckCircle2 size={14} /> Başarılar & Kazanımlar
                                        </div>
                                        <ul className="list-disc list-inside space-y-1 text-snow-muted">
                                            {summary.achievements.map((item, idx) => <li key={idx}>{item}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* Karşılaşılan Zorluklar */}
                                {summary.challenges?.length > 0 && (
                                    <div className="p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-2">
                                        <div className="flex items-center gap-1.5 font-bold text-amber-400">
                                            <AlertCircle size={14} /> Karşılaşılan Zorluklar
                                        </div>
                                        <ul className="list-disc list-inside space-y-1 text-snow-muted">
                                            {summary.challenges.map((item, idx) => <li key={idx}>{item}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* Memnuniyetler */}
                                {summary.satisfactions?.length > 0 && (
                                    <div className="p-3.5 rounded-lg bg-blue-500/5 border border-blue-500/10 space-y-2">
                                        <div className="flex items-center gap-1.5 font-bold text-blue-400">
                                            <ThumbsUp size={14} /> Memnuniyetler
                                        </div>
                                        <ul className="list-disc list-inside space-y-1 text-snow-muted">
                                            {summary.satisfactions.map((item, idx) => <li key={idx}>{item}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* Şikayetler */}
                                {summary.complaints?.length > 0 && (
                                    <div className="p-3.5 rounded-lg bg-red-500/5 border border-red-500/10 space-y-2">
                                        <div className="flex items-center gap-1.5 font-bold text-red-400">
                                            <ThumbsDown size={14} /> Şikayet & İyileştirme Alanları
                                        </div>
                                        <ul className="list-disc list-inside space-y-1 text-snow-muted">
                                            {summary.complaints.map((item, idx) => <li key={idx}>{item}</li>)}
                                        </ul>
                                    </div>
                                )}

                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}