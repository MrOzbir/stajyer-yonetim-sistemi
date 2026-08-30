import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { 
    ArrowLeft, Bot, Calendar, CheckCircle2, Clock, 
    TrendingUp, BookOpen, Award, AlertTriangle, Sparkles, Trash2, Pencil, ListChecks
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function InternDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    
    // Temel Stajyer Verileri
    const [intern, setIntern] = useState(null);
    const [reports, setReports] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    
    // AI Rapor İşlemleri
    const [generating, setGenerating] = useState(false);    
    
    // Görev Modal ve Düzenleme İşlemleri
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [taskForm, setTaskForm] = useState({ title: '', description: '', repoLink: '', deadline: '' });
    const [editingTask, setEditingTask] = useState(null);
    
    // Çoklu Seçim İşlemleri (Görevler)
    const [isSelectTasksMode, setIsSelectTasksMode] = useState(false);
    const [selectedTasks, setSelectedTasks] = useState([]);

    // Çoklu Seçim İşlemleri (Raporlar)
    const [isSelectReportsMode, setIsSelectReportsMode] = useState(false);
    const [selectedReports, setSelectedReports] = useState([]);

    // 🗑️ SEÇİLİ GÖREVLERİ TOPLU SİL
    const handleDeleteSelectedTasks = async () => {
        if (selectedTasks.length === 0) return;
        if (!window.confirm(`Seçilen ${selectedTasks.length} görev kalıcı olarak silinsin mi?`)) return;

        try {
            await Promise.all(selectedTasks.map(id => api.delete(`/tasks/${id}`)));
            fetchIntern(); // Listeyi güncelle
            setSelectedTasks([]);
            alert("✅ Seçilen görevler başarıyla silindi.");
        } catch (err) {
            alert("❌ Toplu görev silinemedi: " + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteSelectedReports = async () => {
        if (selectedReports.length === 0) return;
        if (!window.confirm(`Seçilen ${selectedReports.length} rapor kalıcı olarak silinsin mi?`)) return;
    
        try {
            // Her biri için silme isteği atıyoruz (veya toplu silme endpoint'iniz varsa onu kullanabilirsiniz)
            await Promise.all(selectedReports.map(id => api.delete(`/ai/reports/${id}`)));
            
            setReports(prev => prev.filter(r => !selectedReports.includes(r.id)));
            setSelectedReports([]);
            alert("✅ Seçilen raporlar başarıyla silindi.");
        } catch (e) {
            alert("❌ Toplu silme başarısız: " + (e.response?.data?.error || e.message));
        }
    };

    const handleAssignTask = async (e) => {
        e.preventDefault();
        try {
            // Backend'in beklediği verileri gönderiyoruz (internId detay sayfasından gelir)
            await api.post('/tasks', { 
                ...taskForm, 
                internId: parseInt(id) // Veya stajyerin ID'si nereden geliyorsa (intern.id)
            });
            
            setIsTaskModalOpen(false);
            // handleAssignTask fonksiyonunun içindeki form sıfırlama satırını bulun ve güncelleyin:
            setTaskForm({ title: '', description: '', repoLink: '', deadline: '' });
            window.location.reload();
            alert("✅ Görev başarıyla atandı!");
        } catch (err) {
            alert("❌ Görev atanamadı: " + (err.response?.data?.error || err.message));
        }
    };

    // 🗑️ GÖREV SİL
    const handleDeleteTask = async (taskId) => {
        if (!window.confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
        try {
            await api.delete(`/tasks/${taskId}`);
            fetchIntern(); // Sadece veriyi tekrar çekerek listeyi güncelliyoruz
        } catch (err) {
            alert("❌ Görev silinemedi: " + (err.response?.data?.error || err.message));
        }
    };

    // ✏️ GÖREV DÜZENLE (GÖNDER)
    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/tasks/${editingTask.id}`, {
                title: editingTask.title,
                description: editingTask.description,
                deadline: editingTask.deadline
            });
            setEditingTask(null); // Modalı/Formu kapatır
            alert("✅ Görev başarıyla güncellendi!");
            
            fetchIntern(); // Listeyi güncelle
        } catch (err) {
            alert("❌ Görev güncellenemedi: " + (err.response?.data?.error || err.message));
        }
    };

    const fetchIntern = async () => {
        try {
            const res = await api.get(`/interns/${id}`);            
            const actualData = res.data.intern?.intern || res.data.intern || res.data;
            setIntern(actualData);

            const reportsRes = await api.get(`/ai/reports/${id}`);
            setReports(reportsRes.data || []);
            
        } catch (error) {
            console.error('Stajyer detayı alınamadı:', error);
        } finally {
            setLoading(false);
        }
    };

    // Bileşen yüklendiğinde ve id değiştiğinde çalışır
    useEffect(() => {
        fetchIntern();
    }, [id]);

    const generateReport = async () => {
        if (!window.confirm('Yeni AI raporu oluşturulsun mu? (1-2 dakika)')) return;
        setGenerating(true);
        try {
            await api.post(`/ai/generate-report/${id}`);
            // Yeniden yükle
            const reportsRes = await api.get(`/ai/reports/${id}`);
            setReports(reportsRes.data || []);
            const internRes = await api.get(`/interns/${id}`);
            setIntern(internRes.data.intern);
        } catch (e) {
            alert('❌ Hata: ' + (e.response?.data?.error || e.message));
        } finally {
            setGenerating(false);
        }
    };

        // 🗑️ RAPOR SİL
    const deleteReport = async (reportId) => {
        if (!window.confirm('Bu rapor kalıcı olarak silinsin mi?')) return;
        try {
            await api.delete(`/ai/reports/${reportId}`);
            setReports((prev) => prev.filter((r) => r.id !== reportId));
        } catch (e) {
            alert('❌ Rapor silinemedi: ' + (e.response?.data?.error || e.message));
        }
    };

    if (loading) {
        return (
            <div className="card flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!intern) return null;

    const latestReport = reports[0];
    const tabs = [
        { id: 'overview', label: 'Genel', icon: <TrendingUp size={16} /> },
        { id: 'tasks', label: 'Görevler', icon: <CheckCircle2 size={16} /> },
        { id: 'archives', label: 'Günlükler', icon: <BookOpen size={16} /> },
        { id: 'reports', label: `AI Raporları (${reports.length})`, icon: <Bot size={16} /> }
    ];


    if (!intern) {
        return (
            <div className="flex justify-center py-16">
                <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
            </div>
        );
    }

    // Arayüze gelmeden hemen önce verinin tam olarak ne olduğuna bakalım:
    console.log("💡 EKRANA BASILACAK STAJYER VERİSİ:", intern);

    // Daha önce eklediğimiz yükleme ekranı kontrolü:
    if (!intern) {
        return (
            <div className="flex justify-center py-16">
                <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div>
            {/* Başlık */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/interns')}
                        className="text-snow-muted hover:text-snow transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold">
                            {intern.name} {intern.surname}
                        </h1>
                        <p className="text-snow-faint text-sm">{intern.email}</p>
                    </div>
                </div>

                <button
                    onClick={generateReport}
                    disabled={generating}
                    className="btn-brand flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                    {generating ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Oluşturuluyor...
                        </>
                    ) : (
                        <>
                            <Bot size={16} />
                            Yeni AI Raporu
                        </>
                    )}
                </button>
            </div>

            {/* 1. EKRANDAKİ BUTON (Başlığın yanına eklenebilir) */}
            {user?.role === 'ADMIN' && (
                <button 
                    onClick={() => setIsTaskModalOpen(true)}
                    className="bg-brand hover:bg-brand-light text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                >
                    + Yeni Görev Ata
                </button>
            )}

            {/* 2. GÖREV ATAMA MODALI (Dosyanın en altına, sayfanın ana div'inin hemen içine koyun) */}
            {isTaskModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-panel w-full max-w-md rounded-xl border border-edge p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-snow mb-4">Yeni Görev Ata</h2>
                        
                        <form onSubmit={handleAssignTask} className="space-y-4">
                           {/* 1. GÖREV BAŞLIĞI */}
                            <div>
                                <label className="block text-snow-muted text-sm mb-1">Görev Başlığı</label>
                                <input 
                                    type="text" 
                                    required
                                    value={taskForm.title}
                                    onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                                    className="w-full bg-night border border-edge rounded-lg px-4 py-2 text-snow outline-none focus:border-brand"
                                    placeholder="Örn: React ile Login sayfası tasarımı"
                                />
                            </div>

                            {/* 2. GÖREV İÇERİĞİ / AÇIKLAMASI */}
                            <div>
                                <label className="block text-snow-muted text-sm mb-1">Görev Detayı (İçerik)</label>
                                <textarea 
                                    required
                                    value={taskForm.description}
                                    onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
                                    className="w-full bg-night border border-edge rounded-lg px-4 py-2 text-snow outline-none focus:border-brand min-h-[100px] resize-y"
                                    placeholder="Görevle ilgili detaylı açıklamaları ve gereksinimleri buraya yazın..."
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-snow-muted text-sm mb-1">Teslim Tarihi</label>
                                <input 
                                    type="date" 
                                    required
                                    min={new Date().toISOString().split('T')[0]}
                                    value={taskForm.deadline}
                                    onChange={(e) => setTaskForm({...taskForm, deadline: e.target.value})}
                                    className="w-full bg-night border border-edge rounded-lg px-4 py-2 text-snow outline-none focus:border-brand"
                                />
                            </div>

                            <div>
                                <label className="block text-snow-muted text-sm mb-1">Repo Linki (Opsiyonel)</label>
                                <input 
                                    type="url" 
                                    value={taskForm.repoLink}
                                    onChange={(e) => setTaskForm({...taskForm, repoLink: e.target.value})}
                                    className="w-full bg-night border border-edge rounded-lg px-4 py-2 text-snow outline-none focus:border-brand"
                                    placeholder="https://github.com/..."
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button 
                                    type="button" 
                                    onClick={() => setIsTaskModalOpen(false)}
                                    className="flex-1 bg-overlay hover:bg-overlay-hover text-snow py-2 rounded-lg font-semibold transition-colors"
                                >
                                    İptal
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 bg-brand hover:bg-brand-light text-white py-2 rounded-lg font-semibold transition-colors"
                                >
                                    Görev Ata
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Sekmeler */}
            <div className="flex gap-2 mb-6 border-b border-edge">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer border-b-2 ${
                            activeTab === tab.id
                                ? 'border-brand text-brand-light'
                                : 'border-transparent text-snow-muted hover:text-white'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Genel Bakış */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card">
                        <div className="text-snow-faint text-xs mb-1">AI Puanı</div>
                        <div className="text-3xl font-bold text-brand-light">
                            {intern.ai?.overallScore || '—'}
                            <span className="text-sm text-snow-faint">/100</span>
                        </div>
                    </div>
                    <div className="card">
                        <div className="text-snow-faint text-xs mb-1">Tamamlanan</div>
                        <div className="text-3xl font-bold">
                            {intern?.tasks?.completed || 0}
                            <span className="text-sm text-snow-faint">/{intern?.tasks?.total || 0}</span>
                        </div>
                    </div>
                    <div className="card">
                        <div className="text-snow-faint text-xs mb-1">Toplam Mesai</div>
                        <div className="text-2xl font-bold">{intern?.work?.totalWorked || '—'}</div>
                    </div>
                    <div className="card">
                        <div className="text-snow-faint text-xs mb-1">Son Giriş</div>
                        <div className="text-lg font-semibold">{intern?.lastLogin || '—'}</div>
                    </div>

                    {/* En Son Rapor Özeti */}
                    {latestReport && (
                        <div className="card md:col-span-2 lg:col-span-4 bg-gradient-to-br from-purple-900/20 to-brand/10 border-brand/30">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="text-brand-light" size={20} />
                                <h3 className="font-bold text-lg">Son AI Değerlendirmesi</h3>
                                <span className="text-xs text-snow-faint ml-auto">
                                    {new Date(latestReport.reportDate).toLocaleDateString('tr-TR')}
                                </span>
                            </div>
                            <p className="text-snow mb-4">{latestReport.internSummary}</p>
                            
                            {latestReport.strengths?.length > 0 && (
                                <div className="mb-3">
                                    <div className="text-xs text-green-400 font-semibold mb-1">💪 Güçlü Yönler</div>
                                    <div className="flex flex-wrap gap-2">
                                        {latestReport.strengths.map((s, i) => (
                                            <span key={i} className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {latestReport.nextSteps?.length > 0 && (
                                <div>
                                    <div className="text-xs text-blue-400 font-semibold mb-1">🎯 Sonraki Adımlar</div>
                                    <ul className="space-y-1">
                                        {latestReport.nextSteps.slice(0, 3).map((step, i) => (
                                            <li key={i} className="text-sm text-snow-muted flex gap-2">
                                                <span className="text-blue-400">•</span>
                                                {step}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Görevler */}
            {activeTab === 'tasks' && (
                <div className="card">
                    {/* Başlık ve Çoklu Seçim Butonu */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold">Tüm Görevler</h3>
                        {user?.role === 'ADMIN' && intern.tasksReceived?.length > 0 && (
                            <button
                                onClick={() => {
                                    setIsSelectTasksMode(!isSelectTasksMode);
                                    if (isSelectTasksMode) setSelectedTasks([]);
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                    isSelectTasksMode ? 'bg-brand/20 text-brand-light border border-brand/30' : 'bg-overlay text-snow-muted hover:bg-overlay-hover'
                                }`}
                            >
                                <ListChecks size={16} />
                                {isSelectTasksMode ? 'Seçimi İptal Et' : 'Çoklu Seçim'}
                            </button>
                        )}
                    </div>

                    {/* Toplu İşlem Barı (Silme) */}
                    {isSelectTasksMode && user?.role === 'ADMIN' && selectedTasks.length > 0 && (
                        <div className="flex items-center justify-between bg-panel p-3 rounded-lg border border-edge mb-4 animate-in fade-in slide-in-from-top-2">
                            <span className="text-sm text-snow-muted font-semibold">{selectedTasks.length} görev seçildi</span>
                            <button onClick={handleDeleteSelectedTasks} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer">
                                <Trash2 size={14} /> Seçilenleri Sil
                            </button>
                        </div>
                    )}

                    {/* Görev Listesi */}
                    {intern.tasksReceived?.length > 0 ? (
                        <div className="space-y-2">
                            {intern.tasksReceived.map((task) => (
                                <div key={task.id} className="p-3 bg-night/50 rounded-lg flex items-center justify-between group">
                                    
                                    {/* Sol Kısım: Checkbox (Varsa), Başlık, Açıklama ve Deadline */}
                                    <div className="flex items-start gap-3 flex-1 pr-4">
                                        {/* 🚀 GİZLİ CHECKBOX BURADA */}
                                        {isSelectTasksMode && user?.role === 'ADMIN' && (
                                            <div className="mt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTasks.includes(task.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedTasks([...selectedTasks, task.id]);
                                                        else setSelectedTasks(selectedTasks.filter(id => id !== task.id));
                                                    }}
                                                    className="w-4 h-4 accent-brand cursor-pointer"
                                                />
                                            </div>
                                        )}

                                        <div className="flex-1">
                                            <div className="font-semibold flex items-center gap-2">
                                                {task.repoLink ? (
                                                    <a 
                                                        href={task.repoLink} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="hover:text-brand-light hover:underline"
                                                    >
                                                        {task.title}
                                                        <span className="ml-1 text-xs text-snow-faint">↗</span>
                                                    </a>
                                                ) : (
                                                    task.title
                                                )}
                                            </div>
                                            {task.description && (
                                                <p className="text-sm text-snow-muted mt-1.5 line-clamp-2">
                                                    {task.description}
                                                </p>
                                            )}
                                            {task.deadline && (
                                                <div className="text-xs text-snow-faint mt-2">
                                                    <Clock size={12} className="inline mr-1" />
                                                    Deadline: {new Date(task.deadline).toLocaleDateString('tr-TR')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sağ Kısım: Durum Rozeti ve Butonlar */}
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold w-28 text-center inline-block ${
                                            task.status === 'COMPLETED' ? 'bg-green-500/20 text-green-300' :
                                            task.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-300' :
                                            'bg-yellow-500/20 text-yellow-300'
                                        }`}>
                                            {task.status}
                                        </span>

                                        {user?.role === 'ADMIN' && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                                                    title="Düzenle"
                                                    className="p-1.5 bg-overlay hover:bg-brand/20 text-snow-muted hover:text-brand-light rounded transition-colors cursor-pointer"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                                    title="Sil"
                                                    className="p-1.5 bg-overlay hover:bg-red-500/20 text-snow-muted hover:text-red-400 rounded transition-colors cursor-pointer"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-snow-faint text-center py-8">Henüz görev atanmamış.</p>
                    )}
                </div>
            )}

            {/* 3. GÖREV DÜZENLEME MODALI */}
            {editingTask && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-panel w-full max-w-md rounded-xl border border-edge p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-snow mb-4">Görevi Düzenle</h2>
                        
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-snow-muted text-sm mb-1">Görev Başlığı</label>
                                <input 
                                    type="text" 
                                    required
                                    value={editingTask.title}
                                    onChange={(e) => setEditingTask({...editingTask, title: e.target.value})}
                                    className="w-full bg-night border border-edge rounded-lg px-4 py-2 text-snow outline-none focus:border-brand"
                                />
                            </div>

                            <div>
                                <label className="block text-snow-muted text-sm mb-1">Görev Detayı (İçerik)</label>
                                <textarea 
                                    required
                                    value={editingTask.description || ''}
                                    onChange={(e) => setEditingTask({...editingTask, description: e.target.value})}
                                    className="w-full bg-night border border-edge rounded-lg px-4 py-2 text-snow outline-none focus:border-brand min-h-[100px] resize-y"
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-snow-muted text-sm mb-1">Teslim Tarihi</label>
                                <input 
                                    type="date" 
                                    value={editingTask.deadline ? new Date(editingTask.deadline).toISOString().split('T')[0] : ''}
                                    onChange={(e) => setEditingTask({...editingTask, deadline: e.target.value})}
                                    className="w-full bg-night border border-edge rounded-lg px-4 py-2 text-snow outline-none focus:border-brand"
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button 
                                    type="button" 
                                    onClick={() => setEditingTask(null)}
                                    className="flex-1 bg-overlay hover:bg-overlay-hover text-snow py-2 rounded-lg font-semibold transition-colors"
                                >
                                    İptal
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 bg-brand hover:bg-brand-light text-white py-2 rounded-lg font-semibold transition-colors"
                                >
                                    Güncelle
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Günlük Arşivler */}
            {activeTab === 'archives' && (
                <div className="space-y-3">
                    {intern.archives?.length > 0 ? intern.archives.map((archive) => (
                        <div key={archive.id} className="card">
                            <div className="flex items-center gap-2 mb-2 text-snow-faint text-xs">
                                <Calendar size={12} />
                                {new Date(archive.date).toLocaleDateString('tr-TR', {
                                    day: 'numeric', month: 'long', year: 'numeric'
                                })}
                            </div>
                            <p className="text-snow whitespace-pre-wrap">{archive.content}</p>
                        </div>
                    )) : (
                        <div className="card text-center py-8 text-snow-faint">
                            Henüz günlük arşiv yok.
                        </div>
                    )}
                </div>
            )}

            {/* AI Raporları */}
            {activeTab === 'reports' && (
                <div className="space-y-4">
                    {/* Başlık ve Çoklu Seçim Butonu */}
                    {reports.length > 0 && user?.role === 'ADMIN' && (
                        <div className="flex items-center justify-between bg-panel p-3 rounded-lg border border-edge">
                            <span className="text-sm text-snow-muted">
                                {selectedReports.length > 0 ? `${selectedReports.length} rapor seçildi` : "Toplu işlem için rapor seçin"}
                            </span>
                            
                            <div className="flex items-center gap-3">
                                {selectedReports.length > 0 && (
                                    <button
                                        onClick={handleDeleteSelectedReports}
                                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Trash2 size={14} /> Seçilenleri Sil ({selectedReports.length})
                                    </button>
                                )}
                                
                                <button
                                    onClick={() => {
                                        setIsSelectReportsMode(!isSelectReportsMode);
                                        if (isSelectReportsMode) setSelectedReports([]);
                                    }}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                        isSelectReportsMode ? 'bg-brand/20 text-brand-light border border-brand/30' : 'bg-overlay text-snow-muted hover:bg-overlay-hover'
                                    }`}
                                >
                                    <ListChecks size={16} />
                                    {isSelectReportsMode ? 'Seçimi İptal Et' : 'Çoklu Seçim'}
                                </button>
                            </div>
                        </div>
                    )}

                    {reports.length === 0 ? (
                        <div className="card text-center py-12">
                            <Bot size={48} className="mx-auto mb-4 text-snow-faint" />
                            <p className="text-snow-faint mb-4">Henüz AI raporu oluşturulmamış.</p>
                            <button onClick={generateReport} className="btn-brand">
                                İlk Raporu Oluştur
                            </button>
                        </div>
                    ) : (
                        reports.map((report) => (
                            <div key={report.id} className="flex items-center gap-3">
                                {/* 🚀 DÜZELTME: isSelectReportsMode şartı eklendi */}
                                {isSelectReportsMode && user?.role === 'ADMIN' && (
                                    <input
                                        type="checkbox"
                                        checked={selectedReports.includes(report.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedReports([...selectedReports, report.id]);
                                            else setSelectedReports(selectedReports.filter(id => id !== report.id));
                                        }}
                                        className="w-4 h-4 accent-brand cursor-pointer"
                                    />
                                )}
                                <div className="flex-1">
                                    <ReportCard report={report} onDelete={deleteReport} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// Rapor kartı component'i
function ReportCard({ report, onDelete }) {
    const [expanded, setExpanded] = useState(false);
    
    const scoreColor = report.overallScore >= 80 ? 'text-green-400' :
                       report.overallScore >= 60 ? 'text-yellow-400' : 'text-red-400';
    
    return (
        <div className="card">
            <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-4">
                    <div className={`text-3xl font-bold ${scoreColor}`}>
                        {report.overallScore}
                    </div>
                    <div>
                        <div className="font-semibold">
                            AI Performans Raporu
                        </div>
                        <div className="text-xs text-snow-faint">
                            {new Date(report.reportDate).toLocaleDateString('tr-TR', {
                                day: 'numeric', month: 'long', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            })}
                        </div>
                    </div>
                </div>
                
                {/* 🗑️ SİLME BUTONU + AÇ/KAPA */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(report.id); }}
                        title="Raporu Sil"
                        className="text-snow-faint hover:text-red-400 transition-colors cursor-pointer p-1.5 hover:bg-red-500/10 rounded-lg"
                    >
                        <Trash2 size={16} />
                    </button>
                    <div className="text-snow-faint">{expanded ? '▲' : '▼'}</div>
                </div>
            </div>

            {expanded && (
                <div className="mt-4 pt-4 border-t border-edge space-y-4">
                    {/* Özetler */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-purple-900/20 rounded-lg">
                            <div className="text-xs text-purple-300 font-semibold mb-2">
                                👤 Stajyer Özeti
                            </div>
                            <p className="text-sm text-snow">{report.internSummary}</p>
                        </div>
                        <div className="p-3 bg-blue-900/20 rounded-lg">
                            <div className="text-xs text-blue-300 font-semibold mb-2">
                                👔 Yönetici Özeti
                            </div>
                            <p className="text-sm text-snow">{report.adminSummary}</p>
                        </div>
                    </div>

                    {/* Güçlü/Zayıf Yönler */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-green-400 font-semibold mb-2 flex items-center gap-1">
                                <Award size={14} /> Güçlü Yönler
                            </div>
                            <ul className="space-y-1">
                                {report.strengths?.map((s, i) => (
                                    <li key={i} className="text-sm text-snow-muted flex gap-2">
                                        <span className="text-green-400">✓</span> {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <div className="text-xs text-red-400 font-semibold mb-2 flex items-center gap-1">
                                <AlertTriangle size={14} /> Gelişim Alanları
                            </div>
                            <ul className="space-y-1">
                                {report.weaknesses?.map((w, i) => (
                                    <li key={i} className="text-sm text-snow-muted flex gap-2">
                                        <span className="text-red-400">•</span> {w}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Öneriler */}
                    {report.suggestions?.length > 0 && (
                        <div>
                            <div className="text-xs text-yellow-400 font-semibold mb-2">💡 Öneriler</div>
                            <ul className="space-y-1">
                                {report.suggestions.map((s, i) => (
                                    <li key={i} className="text-sm text-snow-muted">• {s}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Öğrenme Kaynakları */}
                    {report.learningResources?.length > 0 && (
                        <div>
                            <div className="text-xs text-blue-400 font-semibold mb-2">📚 Öğrenme Kaynakları</div>
                            <ul className="space-y-1">
                                {report.learningResources.map((r, i) => (
                                    <li key={i} className="text-sm text-snow-muted">• {r}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Sonraki Adımlar */}
                    {report.nextSteps?.length > 0 && (
                        <div>
                            <div className="text-xs text-purple-400 font-semibold mb-2">🎯 Sonraki Adımlar</div>
                            <ol className="space-y-1 list-decimal list-inside">
                                {report.nextSteps.map((s, i) => (
                                    <li key={i} className="text-sm text-snow-muted">{s}</li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {/* Motivasyon Sözü */}
                    {report.encouragementQuote && (
                        <div className="p-3 bg-brand/10 rounded-lg border border-brand/30">
                            <div className="text-xs text-brand-light font-semibold mb-1">💬 Motivasyon</div>
                            <p className="text-sm text-snow italic">"{report.encouragementQuote}"</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

