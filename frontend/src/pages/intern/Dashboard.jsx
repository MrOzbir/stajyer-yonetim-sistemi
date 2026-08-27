import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { 
    BookOpen, Sparkles, Bell, 
    MessageSquare, Clock, AlertTriangle, CheckCircle2, ChevronRight, Bot,
    FileText, X, Calendar, Award, Info, Mail // 🚀 Mail ikonu eklendi
} from 'lucide-react';

export default function InternDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    const { unreadCounts } = useSocketContext();
    const totalUnread = Object.values(unreadCounts || {}).reduce((a, b) => a + b, 0);

    const [tip, setTip] = useState(null);
    const [mentorship, setMentorship] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [limitInfo, setLimitInfo] = useState({ remaining: 0, limit: 3 });
    const [generating, setGenerating] = useState(false);
    const [loading, setLoading] = useState(true);

    // GEÇMİŞ RAPOR MODAL DURUMLARI
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);

    // 🚀 MAIL KAYIT MODAL DURUMLARI
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [isSavingEmail, setIsSavingEmail] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [tipRes, menRes, tasksRes, limitRes] = await Promise.allSettled([
                    api.get('/ai/daily-tip'),
                    api.get('/ai/my-mentorship'),
                    api.get('/tasks'),
                    api.get('/ai/my-report-limit') 
                ]);
                
                if (tipRes.status === 'fulfilled') setTip(tipRes.value.data);
                if (menRes.status === 'fulfilled') setMentorship(menRes.value.data);
                if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value.data || []);
                if (limitRes.status === 'fulfilled') setLimitInfo(limitRes.value.data);
            } catch (e) {
                console.error("Dashboard verileri çekilirken hata:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    const handleGenerateMyReport = async () => {
        if (limitInfo.remaining <= 0) {
            alert("Günlük limitiniz dolmuştur.");
            return;
        }
        if (!window.confirm("Kendi AI raporunuzu oluşturmak istiyor musunuz?")) return;
        setGenerating(true);
        try {
            const res = await api.post('/ai/generate-my-report');
            alert('✅ ' + res.data.message);
            window.location.reload(); 
        } catch (error) {
            alert("❌ Hata: " + (error.response?.data?.error || error.message));
        } finally {
            setGenerating(false);
        }
    };

    const handleOpenHistoryModal = async () => {
        setIsHistoryOpen(true);
        setLoadingHistory(true);
        try {
            const res = await api.get('/ai/my-mentorship-history');
            const reports = res.data || [];
            setHistoryList(reports);
            if (reports.length > 0) {
                setSelectedReport(reports[0]);
            }
        } catch (error) {
            console.error("Geçmiş raporlar alınamadı:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    // 🚀 MAIL KAYDETME FONKSİYONU
    const handleSaveEmail = async () => {
        if (!email) {
            alert("Lütfen geçerli bir e-posta adresi girin.");
            return;
        }
        setIsSavingEmail(true);
        try {
            await api.put('/interns/profile/email', { notificationEmail: email });
            alert("✅ Görev bildirim e-postası başarıyla kaydedildi!");
            setIsEmailModalOpen(false);
        } catch (error) {
            console.error("Mail kaydetme hatası:", error); 
            alert("❌ Mail kaydedilemedi.");
        } finally {
            setIsSavingEmail(false);
        }
    };

    const activeTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.deadline);
    activeTasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] min-h-[600px]">
            
            {/* 🚀 BAŞLIK VE MAIL BUTONU */}
            <div className="shrink-0 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold">Merhaba, {user?.name}! 👋</h1>
                    <p className="text-white/40 text-xs hidden sm:block">• Bugünün bildirimleri ve AI mentöründen notlar</p>
                </div>
                
                {/* 🚀 SAĞ ÜST KÖŞEDEKİ UFAK MAVİ BUTON */}
                <button
                    onClick={() => setIsEmailModalOpen(true)}
                    className="flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                    <Mail size={14} />
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex justify-center items-center">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0 space-y-4">
                    
                    {/* ÜST BAR: Performans Analizi */}
                    <div className="shrink-0 flex items-center justify-between bg-gradient-to-r from-night to-panel p-3.5 rounded-xl border border-white/10 shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand/10 rounded-lg">
                                <Bot size={18} className="text-brand-light" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-sm">Anlık Performans Analizi</h3>
                                <p className="text-[11px] text-white/50">Güncel durumunuzun detaylı analizini isteyin.</p>
                            </div>
                        </div>
                        
                        <div className="relative group flex items-center gap-3 sm:gap-4">

                            {/* Limit Sayacı */}
                            <div className="text-right hidden sm:block">
                                <div className="text-[10px] text-white/40 uppercase tracking-wider">LİMİT</div>
                                <div className="font-bold text-sm flex items-baseline gap-1">
                                    <span className={limitInfo.remaining > 0 ? "text-green-400" : "text-red-400"}>{limitInfo.remaining}</span>
                                    <span className="text-xs text-white/30">/ {limitInfo.limit}</span>
                                </div>
                            </div>

                            {/* GEÇMİŞ RAPORLAR BUTONU */}
                            <button
                                onClick={handleOpenHistoryModal}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/90 hover:text-white rounded-lg text-xs font-semibold border border-white/10 transition-all shadow-sm"
                                title="Geçmiş AI Raporlarını Gör"
                            >
                                <FileText size={14} className="text-brand-light" />
                                <span className="hidden md:inline">Geçmiş Raporlar</span>
                            </button>

                            {/* RAPOR OLUŞTUR BUTONU */}
                            <button
                                onClick={handleGenerateMyReport}
                                disabled={generating || limitInfo.remaining === 0}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    generating || limitInfo.remaining === 0
                                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                        : 'bg-brand hover:bg-brand-light text-white shadow-lg'
                                }`}
                            >
                                {generating ? 'Analiz...' : 'Rapor Oluştur'}
                            </button>

                            {/* HOVER TOOLTIP KUTUSU */}
                            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-night/95 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 backdrop-blur-md">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-light mb-1">
                                    <Info size={14} />
                                    <span>Sistem Yük Limiti</span>
                                </div>
                                <p className="text-[11px] text-white/70 leading-relaxed">
                                    Sunucu performansını korumak ve yapay zeka servislerinin aşırı yüklenmesini önlemek amacıyla günlük rapor oluşturma hakkınız <strong className="text-white font-bold">{limitInfo.limit} adet</strong> ile sınırlandırılmıştır.
                                </p>
                                <div className="mt-2 text-[10px] text-white/40 border-t border-white/10 pt-1.5 flex justify-between items-center">
                                    <span>Bugün kalan hakkınız:</span>
                                    <span className={`font-bold ${limitInfo.remaining > 0 ? "text-green-400" : "text-red-400"}`}>
                                        {limitInfo.remaining} / {limitInfo.limit}
                                    </span>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* ORTA BÖLÜM */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
                        
                        {/* SOL KOLON */}
                        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
                            
                            {/* BİLDİRİM PANELİ */}
                            <div className="card p-0 flex flex-col flex-1 min-h-0 border-white/10">
                                <div className="shrink-0 flex items-center gap-2 p-3 border-b border-white/10 bg-night/30">
                                    <Bell size={16} className="text-brand-light" />
                                    <h2 className="font-bold text-sm">Bildirimler & Hatırlatmalar</h2>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-panel scrollbar-thin scrollbar-thumb-brand/20 scrollbar-track-transparent">
                                    {totalUnread > 0 ? (
                                        <div 
                                            onClick={() => navigate('/intern/chat')}
                                            className="flex items-center justify-between p-2 rounded-md bg-brand/10 border border-brand/20 cursor-pointer hover:bg-brand/20 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-brand/20 rounded-full text-brand-light">
                                                    <MessageSquare size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-white">Yeni Mesajınız Var!</p>
                                                    <p className="text-[11px] text-brand-light/80">Yöneticilerinizden okunmamış {totalUnread} mesaj bulunuyor.</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={14} className="text-brand-light/50" />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 p-2 rounded-md bg-white/5 border border-white/5">
                                            <div className="p-1.5 bg-white/5 rounded-full text-white/40">
                                                <MessageSquare size={14} />
                                            </div>
                                            <p className="text-xs text-white/40">Şu an okunmamış mesajınız yok.</p>
                                        </div>
                                    )}

                                    {activeTasks.length > 0 ? (
                                        activeTasks.map(task => {
                                            const daysLeft = Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                            const isOverdue = daysLeft < 0;
                                            const isUrgent = daysLeft >= 0 && daysLeft <= 2;

                                            return (
                                                <div 
                                                    key={task.id}
                                                    onClick={() => navigate('/intern/tasks')}
                                                    className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors ${
                                                        isOverdue ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' : 
                                                        isUrgent ? 'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20' :
                                                        'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className={`shrink-0 p-1.5 rounded-full ${
                                                            isOverdue ? 'bg-red-500/20 text-red-400' : 
                                                            isUrgent ? 'bg-orange-500/20 text-orange-400' :
                                                            'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                            {isOverdue ? <AlertTriangle size={14} /> : <Clock size={14} />}
                                                        </div>
                                                        <div className="truncate">
                                                            <p className="text-xs font-semibold text-white/90 truncate">{task.title}</p>
                                                            <p className={`text-[10px] font-medium mt-0.5 ${
                                                                isOverdue ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-blue-400'
                                                            }`}>
                                                                {isOverdue ? `${Math.abs(daysLeft)} gün gecikti!` : daysLeft === 0 ? 'Bugün teslim edilecek' : `${daysLeft} gün kaldı`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={14} className="shrink-0 text-white/20 ml-2" />
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/5 border border-green-500/10">
                                            <div className="p-1.5 bg-green-500/10 rounded-full text-green-400">
                                                <CheckCircle2 size={14} />
                                            </div>
                                            <p className="text-xs text-green-400/80">Aktif bir göreviniz yok. Harika!</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ARŞİV / ÖZET ALANI */}
                            {mentorship ? (
                                <div className="shrink-0 flex items-center justify-between card p-3 gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-brand/10 rounded-full flex flex-col items-center justify-center shrink-0">
                                            <span className="font-bold text-brand-light text-sm">{mentorship.overallScore}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <BookOpen size={14} className="text-brand-light" />
                                                <span className="font-bold text-xs">Mentör Özeti</span>
                                            </div>
                                            <p className="text-white/70 text-[11px] line-clamp-2">{mentorship.internSummary}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => navigate('/intern/archives')} className="shrink-0 bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded text-[11px] font-semibold transition-colors">
                                        Arşiv
                                    </button>
                                </div>
                            ) : (
                                <div className="shrink-0 card border border-brand/20 bg-gradient-to-br from-brand/5 to-transparent p-3 flex flex-row items-center justify-between gap-4">
                                    <div className="flex flex-row items-center gap-3">
                                        <div className="shrink-0 w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center">
                                            <BookOpen size={14} className="text-brand-light" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-bold text-white mb-0.5">Staj Serüvenine Hoş Geldin!</h3>
                                            <p className="text-white/60 text-[10px] leading-tight">
                                                Mentörünün seni analiz edebilmesi için görevlerini tamamla ve arşivlerini yaz.
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => navigate('/intern/archives')} 
                                        className="shrink-0 bg-brand hover:bg-brand-light text-white px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors"
                                    >
                                        Arşiv Yaz
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* SAĞ KOLON: Günün Önerisi */}
                        <div className="lg:col-span-1 flex flex-col min-h-0">
                            <div className="card flex-1 flex flex-col border-l-4 border-l-brand bg-gradient-to-b from-purple-900/10 to-transparent min-h-0 p-4">
                                <div className="shrink-0 flex items-center gap-2 mb-3">
                                    <Sparkles size={16} className="text-brand-light" />
                                    <span className="font-bold text-brand-light text-sm">Günün Mentör Notu</span>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-brand/20 scrollbar-track-transparent">
                                    <p className="text-white/80 leading-relaxed text-xs">
                                        {tip?.tip || "Bugün için yeni bir tavsiye bulunamadı. Görevlerini tamamlamaya odaklan!"}
                                    </p>
                                    {tip?.quote && (
                                        <div className="mt-3 p-2.5 rounded bg-black/20 border border-white/5">
                                            <p className="text-[11px] text-white/60 italic font-medium">"{tip.quote}"</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* GEÇMİŞ AI RAPORLARI MODALI */}
            {isHistoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-panel border border-white/10 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-fadeIn">
                        
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-night/50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-brand/10 rounded-lg text-brand-light">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base">Geçmiş AI Analiz Raporları</h3>
                                    <p className="text-xs text-white/50">Veritabanına kaydedilen önceki performans analizleriniz</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsHistoryOpen(false)}
                                className="p-1.5 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-hidden p-4">
                            {loadingHistory ? (
                                <div className="h-64 flex justify-center items-center">
                                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : historyList.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center text-center p-6">
                                    <FileText size={40} className="text-white/20 mb-3" />
                                    <p className="text-sm font-semibold text-white/70">Henüz kayıtlı bir rapor bulunamadı.</p>
                                    <p className="text-xs text-white/40 mt-1">"Rapor Oluştur" butonunu kullanarak ilk analizinizi başlatabilirsiniz.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-h-[350px]">
                                    
                                    {/* Sol Taraf: Rapor Listesi */}
                                    <div className="md:col-span-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                                        {historyList.map((item) => {
                                            const isSelected = selectedReport?.id === item.id;
                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => setSelectedReport(item)}
                                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                                        isSelected 
                                                            ? 'bg-brand/20 border-brand/50 text-white shadow-md' 
                                                            : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/70'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/30 text-white/80 flex items-center gap-1">
                                                            <Calendar size={10} />
                                                            {new Date(item.reportDate || item.createdAt).toLocaleDateString('tr-TR')}
                                                        </span>
                                                        <span className="text-xs font-extrabold text-brand-light flex items-center gap-0.5">
                                                            <Award size={12} />
                                                            {item.overallScore} Puan
                                                        </span>
                                                    </div>
                                                    <p className="text-xs font-medium line-clamp-2 text-white/90">
                                                        {item.internSummary || "Detaylar için tıklayın."}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Sağ Taraf: Seçilen Rapor Detayı */}
                                    <div className="md:col-span-2 bg-night/40 border border-white/5 rounded-xl p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 flex flex-col justify-between">
                                        {selectedReport ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                                                    <div>
                                                        <span className="text-xs text-white/40 font-mono">RAPOR ID: #{selectedReport.id}</span>
                                                        <h4 className="text-sm font-bold text-white mt-0.5">
                                                            {new Date(selectedReport.reportDate || selectedReport.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} Tarihli Analiz
                                                        </h4>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] text-white/40 uppercase">Skor</div>
                                                        <div className="text-xl font-black text-brand-light">{selectedReport.overallScore}/100</div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h5 className="text-xs font-bold text-brand-light mb-1 uppercase tracking-wider">Mentör Özeti</h5>
                                                    <p className="text-xs text-white/80 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
                                                        {selectedReport.internSummary}
                                                    </p>
                                                </div>

                                                {selectedReport.strengths && selectedReport.strengths.length > 0 && (
                                                    <div>
                                                        <h5 className="text-xs font-bold text-green-400 mb-1 uppercase tracking-wider">Öne Çıkan Güçlü Yönler</h5>
                                                        <ul className="list-disc list-inside space-y-1">
                                                            {selectedReport.strengths.map((str, idx) => (
                                                                <li key={idx} className="text-xs text-white/70">{str}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {selectedReport.encouragementQuote && (
                                                    <div className="p-3 bg-brand/10 border border-brand/20 rounded-lg italic text-xs text-brand-light font-medium">
                                                        "{selectedReport.encouragementQuote}"
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-xs text-white/40">
                                                Detayları görüntülemek için soldan bir rapor seçin.
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}

            {/* 🚀 GMAIL KAYIT MODALI */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-panel border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-fadeIn">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                <Mail className="text-blue-400" size={20} />
                                E-Posta Bildirimleri
                            </h3>
                            <button 
                                onClick={() => setIsEmailModalOpen(false)}
                                className="text-white/50 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-white/60 mb-5 leading-relaxed">
                            Görevlerinizin teslim süresine son 1 gün kala veya gecikme yaşandığında sistemin size otomatik hatırlatma e-postası atabilmesi için bildirim adresinizi kaydedin.
                        </p>
                        <div className="space-y-3">
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Örn: mailadresiniz@gmail.com"
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                            />
                            <button 
                                onClick={handleSaveEmail}
                                disabled={isSavingEmail}
                                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                                {isSavingEmail ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}