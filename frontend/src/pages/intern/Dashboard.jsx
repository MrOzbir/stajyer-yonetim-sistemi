import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { 
    BookOpen, TrendingUp, Sparkles, Bell, 
    MessageSquare, Clock, AlertTriangle, CheckCircle2, ChevronRight 
} from 'lucide-react';

export default function InternDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    // Global Socket.io üzerinden okunmamış mesajları çekiyoruz
    const { unreadCounts } = useSocketContext();
    const totalUnread = Object.values(unreadCounts || {}).reduce((a, b) => a + b, 0);

    // State'ler
    const [tip, setTip] = useState(null);
    const [mentorship, setMentorship] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [tipRes, menRes, tasksRes] = await Promise.allSettled([
                    api.get('/ai/daily-tip'),
                    api.get('/ai/my-mentorship'),
                    api.get('/tasks') 
                ]);
                
                if (tipRes.status === 'fulfilled') setTip(tipRes.value.data);
                if (menRes.status === 'fulfilled') setMentorship(menRes.value.data);
                if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value.data || []);
            } catch (e) {
                console.error("Dashboard verileri çekilirken hata:", e);
            } finally {
                setLoading(false);
            }
        };
        
        fetchDashboardData();
    }, []);

    // 🚀 BİLDİRİMLER İÇİN GÖREV HESAPLAMALARI
    const activeTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.deadline);
    activeTasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    
    // Sadece kırmızı (gecikmiş) ve turuncu (2 gün veya az kalmış) görevleri al
    const urgentTasks = activeTasks.filter(task => {
        const daysLeft = Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
        return daysLeft <= 2; 
    });

    return (
        // 🚀 1. DÜZELTME: Sayfayı ekranın boyuna (100vh) kilitliyoruz.
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            
            {/* Karşılama (Sabit Yükseklik, Küçülmez) */}
            <div className="shrink-0 mb-4">
                <h1 className="text-2xl font-bold mb-1">Merhaba, {user?.name}! 👋</h1>
                <p className="text-white/40 text-sm">Bugünün bildirimleri ve AI mentöründen notlar</p>
            </div>

            {loading ? (
                <div className="flex-1 flex justify-center items-center">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                // 🚀 2. DÜZELTME: Ana ızgarayı esnek (flex-1) yapıp min-h-0 verdik ki içeriği taşmasın
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
                    
                    {/* SOL KOLON: Bildirimler ve Görevler */}
                    <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
                        
                        {/* 🔔 BİLDİRİM PANELİ (Ekran büyüdükçe bu panel esneyip uzayacak) */}
                        <div className="card p-0 flex flex-col flex-1 min-h-0 border-white/10">
                            <div className="shrink-0 flex items-center gap-2 p-3 border-b border-white/10 bg-night/30">
                                <Bell size={18} className="text-brand-light" />
                                <h2 className="font-bold text-base">Bildirimler & Hatırlatmalar</h2>
                            </div>
                            
                            {/* 🚀 3. DÜZELTME: Kutu içi kaydırma çubuğu (overflow-y-auto) sadece listeye eklendi */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-panel scrollbar-thin scrollbar-thumb-brand/20 scrollbar-track-transparent">
                                
                                {/* 1. Mesaj Bildirimi */}
                                {totalUnread > 0 ? (
                                    <div 
                                        onClick={() => navigate('/intern/chat')}
                                        className="flex items-center justify-between p-2.5 rounded-lg bg-brand/10 border border-brand/20 cursor-pointer hover:bg-brand/20 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-brand/20 rounded-full text-brand-light">
                                                <MessageSquare size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">Yeni Mesajınız Var!</p>
                                                <p className="text-xs text-brand-light/80">Yöneticilerinizden okunmamış {totalUnread} mesaj bulunuyor.</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-brand-light/50" />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5">
                                        <div className="p-2 bg-white/5 rounded-full text-white/40">
                                            <MessageSquare size={16} />
                                        </div>
                                        <p className="text-sm text-white/40">Şu an okunmamış mesajınız yok.</p>
                                    </div>
                                )}

                                {/* 2. Yaklaşan Görev Bildirimleri */}
                                {urgentTasks.length > 0 ? (
                                    urgentTasks.map(task => {
                                        const daysLeft = Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                        const isOverdue = daysLeft < 0;

                                        return (
                                            <div 
                                                key={task.id}
                                                onClick={() => navigate('/intern/tasks')}
                                                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                                    isOverdue ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' : 
                                                    'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-full ${
                                                        isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                                                    }`}>
                                                        {isOverdue ? <AlertTriangle size={14} /> : <Clock size={14} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-white/90">{task.title}</p>
                                                        <p className={`text-xs font-medium mt-0.5 ${
                                                            isOverdue ? 'text-red-400' : 'text-orange-400'
                                                        }`}>
                                                            {isOverdue ? `${Math.abs(daysLeft)} gün gecikti!` : daysLeft === 0 ? 'Bugün teslim edilecek' : `${daysLeft} gün kaldı`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className="text-white/20" />
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                                        <div className="p-2 bg-green-500/10 rounded-full text-green-400">
                                            <CheckCircle2 size={16} />
                                        </div>
                                        <p className="text-sm text-green-400/80">Yaklaşan veya gecikmiş acil bir göreviniz yok. Harika!</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AI Mentör Özeti (Sabit Yükseklik) */}
                        {mentorship ? (
                            <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="card flex flex-col items-center justify-center text-center p-4">
                                    <TrendingUp size={24} className="text-brand-light mb-2" />
                                    <div className="text-3xl font-bold text-brand-light mb-1">{mentorship.overallScore}</div>
                                    <div className="text-xs text-white/50">AI Puanı</div>
                                </div>
                                <div className="card md:col-span-2 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BookOpen size={16} className="text-brand-light" />
                                        <span className="font-bold text-base">Mentörünün Özeti</span>
                                    </div>
                                    <p className="text-white/80 text-sm leading-relaxed line-clamp-3">{mentorship.internSummary}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="shrink-0 card border border-brand/20 bg-gradient-to-br from-brand/5 to-transparent py-5 px-4">
                            <div className="max-w-md mx-auto text-center">
                                <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <BookOpen size={20} className="text-brand-light" />
                                </div>
                                <h3 className="text-sm font-bold text-white mb-2">Staj Serüvenine Hoş Geldin!</h3>
                                
                                {/* Ana Karşılama Metni */}
                                <p className="text-white/70 text-xs leading-relaxed mb-3">
                                    Mentörünün seni analiz edebilmesi için görevlerini tamamla ve günlüğünü yazmaya başla. Burası resmi bir staj defteri değil; hislerini, zorluklarını ve başarılarını paylaşabileceğin kişisel gelişim alanın!
                                </p>
                                
                                {/* Alt Satır: Gizlilik ve Anonimlik Notu */}
                                <p className="text-white/40 text-[11px] leading-relaxed mb-4 italic px-2">
                                    🔒 Günlüğünü sadece yapay zeka okur. Yöneticilere yalnızca genel bir özet sunulur, böylece dilek ve şikayetlerini özgürce yazabilirsin.
                                </p>
                                
                                <button 
                                    onClick={() => navigate('/intern/archives')} 
                                    className="bg-brand hover:bg-brand-light text-white px-5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                >
                                    Yazmaya Başla
                                </button>
                            </div>
                        </div>
                        )}
                    </div>

                    {/* SAĞ KOLON: Günün Önerisi */}
                    <div className="lg:col-span-1 flex flex-col min-h-0">
                        <div className="card flex-1 flex flex-col border-l-4 border-l-brand bg-gradient-to-b from-purple-900/10 to-transparent min-h-0 p-4">
                            <div className="shrink-0 flex items-center gap-2 mb-4">
                                <Sparkles size={18} className="text-brand-light" />
                                <span className="font-bold text-brand-light">Günün Mentör Notu</span>
                            </div>
                            
                            {/* Tavsiye metni çok uzun olursa kendi içinde scroll çıkacak */}
                            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-brand/20 scrollbar-track-transparent">
                                <p className="text-white/80 leading-relaxed text-sm">
                                    {tip?.tip || "Bugün için yeni bir tavsiye bulunamadı. Görevlerini tamamlamaya odaklan!"}
                                </p>
                                {tip?.quote && (
                                    <div className="mt-4 p-3 rounded-lg bg-black/20 border border-white/5">
                                        <p className="text-xs text-white/60 italic font-medium">"{tip.quote}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}