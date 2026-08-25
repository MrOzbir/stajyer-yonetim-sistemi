import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import { Clock, CheckCircle2, Circle, Play, AlertTriangle, Code, ExternalLink, Trash2, Pencil, ListChecks } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const URGENCY_CONFIG = {
    overdue: { label: 'Süresi Geçmiş', color: 'bg-brand text-white', icon: <AlertTriangle size={14} /> },
    critical: { label: 'Kritik', color: 'bg-brand/20 text-brand-light border border-brand/40', icon: <AlertTriangle size={14} /> },
    high: { label: 'Acil', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/40', icon: <Clock size={14} /> },
    medium: { label: 'Orta', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40', icon: <Clock size={14} /> },
    low: { label: 'Normal', color: 'bg-white/10 text-white/60', icon: <Clock size={14} /> },
    none: { label: 'Deadline Yok', color: 'bg-white/5 text-white/30', icon: null }
};

// Durum etiketleri
const STATUS_CONFIG = {
    PENDING: { label: 'Bekliyor', color: 'text-white/50', icon: <Circle size={16} className="text-white/50" /> },
    IN_PROGRESS: { label: 'Devam Ediyor', color: 'text-blue-400', icon: <Play size={16} className="text-blue-400" /> },
    COMPLETED: { label: 'Tamamlandı', color: 'text-green-400', icon: <CheckCircle2 size={16} className="text-green-400" /> }
};

export default function Tasks() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    const [editingTask, setEditingTask] = useState(null);
    const { user } = useAuth();
    
    // Çoklu seçim stateleri
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedTasks, setSelectedTasks] = useState([]);

    const handleDeleteSelectedTasks = async () => {
        if (selectedTasks.length === 0) return;
        if (!window.confirm(`Seçilen ${selectedTasks.length} görev kalıcı olarak silinsin mi?`)) return;
    
        try {
            await Promise.all(selectedTasks.map(id => api.delete(`/tasks/${id}`)));
            load(false);
            setSelectedTasks([]);
            alert("✅ Seçilen görevler başarıyla silindi.");
        } catch (err) {
            alert("❌ Toplu görev silinemedi: " + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
        try {
            await api.delete(`/tasks/${taskId}`);
            load(false);
        } catch (err) {
            alert("Silme işlemi başarısız: " + err.response?.data?.error);
        }
    };
    
    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/tasks/${editingTask.id}`, editingTask);
            setEditingTask(null);
            load(false);
        } catch (err) {
            alert("Güncelleme başarısız: " + err.response?.data?.error);
        }
    };

    const load = useCallback(async (showSpinner = false) => {
        if (showSpinner) setLoading(true);
        try {
            const res = await api.get('/tasks');
            setTasks(res.data || []);
        } catch (err) {
            console.error('Görevler yüklenemedi:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        (async () => {
            await load();
        })();
    }, [load]);

    const handleStatusUpdate = async (task, newStatus) => {
        setUpdatingId(task.id);
        try {
            await api.patch(`/tasks/${task.id}`, { status: newStatus });
            load(false);
        } catch (err) {
            alert(err.response?.data?.error || 'Durum güncellenemedi');
        } finally {
            setUpdatingId(false);
        }
    };

    const handleRepoLink = async (task) => {
        const link = prompt('GitHub/GitLab repo linkini girin:', task.repoLink || '');
        if (link === null) return;
        setUpdatingId(task.id);
        try {
            await api.patch(`/tasks/${task.id}`, { repoLink: link });
            load(true);
        } catch {
            alert('Repo linki kaydedilemedi');
        } finally {
            setUpdatingId(false);
        }
    };

    // İstatistikler
    const stats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'COMPLETED').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        overdue: tasks.filter(t => t.isOverdue).length
    };

    return (
        <div>
            {/* 🚀 BAŞLIK VE ÇOKLU SEÇİM BUTONU BİR ARADA */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold mb-1">Görevlerim</h1>
                    <p className="text-white/40 text-sm">Size atanan tüm görevler ve durumları</p>
                </div>
                
                {user?.role === 'ADMIN' && tasks.length > 0 && (
                    <button
                        onClick={() => {
                            setIsSelectMode(!isSelectMode);
                            if (isSelectMode) setSelectedTasks([]); // Kapatıldığında seçimleri sıfırla
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                            isSelectMode 
                                ? 'bg-brand/20 text-brand-light border border-brand/30' 
                                : 'bg-white/5 text-white/50 hover:bg-white/10'
                        }`}
                    >
                        <ListChecks size={16} />
                        {isSelectMode ? 'Seçimi İptal Et' : 'Çoklu Seçim'}
                    </button>
                )}
            </div>

            {/* İstatistik Kartları */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="card">
                    <div className="text-sm text-white/50 mb-1">Toplam</div>
                    <div className="stat-value">{stats.total}</div>
                </div>
                <div className="card">
                    <div className="text-sm text-white/50 mb-1">Tamamlanan</div>
                    <div className="stat-value text-green-400">{stats.completed}</div>
                </div>
                <div className="card">
                    <div className="text-sm text-white/50 mb-1">Devam Eden</div>
                    <div className="stat-value text-blue-400">{stats.inProgress}</div>
                </div>
                <div className="card">
                    <div className="text-sm text-white/50 mb-1">Gecikmiş</div>
                    <div className="stat-value text-brand-light">{stats.overdue}</div>
                </div>
            </div>

            {/* 🚀 TOPLU İŞLEM BARI (Sadece Seçim Modu Açıkken Görünür) */}
            {isSelectMode && user?.role === 'ADMIN' && tasks.length > 0 && (
                <div className="flex items-center justify-between bg-panel p-3 rounded-lg border border-white/10 mb-4">
                    <span className="text-sm text-white/60 font-semibold">
                        {selectedTasks.length} görev seçildi
                    </span>
                    <button
                        onClick={handleDeleteSelectedTasks}
                        disabled={selectedTasks.length === 0}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <Trash2 size={14} /> Seçilenleri Sil
                    </button>
                </div>
            )}

            {/* Yükleniyor */}
            {loading && (
                <div className="card flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* Boş Durum */}
            {!loading && tasks.length === 0 && (
                <div className="card text-center py-16 text-white/40">
                    Henüz size atanmış görev yok.
                </div>
            )}

            {/* Görev Kartları */}
            {!loading && tasks.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {tasks.map((task) => {
                        const urgency = URGENCY_CONFIG[task.urgencyLevel || 'none'];
                        const status = STATUS_CONFIG[task.status] || STATUS_CONFIG['PENDING'];
                        const isUpdating = updatingId === task.id;

                        return (
                            <div key={task.id} className="card hover:border-white/15 transition-colors relative flex flex-col">
                                
                                {/* Üst: Checkbox, Durum, Aciliyet ve Kontroller */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        
                                        {/* CHECKBOX BURADA! */}
                                        {isSelectMode && user?.role === 'ADMIN' && (
                                            <input
                                                type="checkbox"
                                                checked={selectedTasks.includes(task.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedTasks([...selectedTasks, task.id]);
                                                    } else {
                                                        setSelectedTasks(selectedTasks.filter(id => id !== task.id));
                                                    }
                                                }}
                                                className="w-4 h-4 accent-brand cursor-pointer"
                                            />
                                        )}

                                        <div className={`flex items-center gap-2 ${status.color}`}>
                                            {status.icon}
                                            <span className="text-sm font-semibold">{status.label}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {/* Aciliyet Rozeti */}
                                        {urgency.icon && (
                                            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${urgency.color}`}>
                                                {urgency.icon}
                                                {urgency.label}
                                            </span>
                                        )}

                                        {/* YÖNETİCİ KONTROLLERİ (Düzenle ve Sil) */}
                                        {user?.role === 'ADMIN' && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                                                    title="Görevi Düzenle"
                                                    className="flex items-center justify-center w-7 h-7 rounded bg-white/5 hover:bg-brand/20 text-white/50 hover:text-brand-light transition-colors cursor-pointer"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                                    title="Görevi Sil"
                                                    className="flex items-center justify-center w-7 h-7 rounded bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </>
                                        )}

                                        {/* Geri Al Butonu (Sağ Üst Köşe) */}
                                        {(task.status === 'IN_PROGRESS' || task.status === 'COMPLETED') && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStatusUpdate(task, task.status === 'IN_PROGRESS' ? 'PENDING' : 'IN_PROGRESS');
                                                }}
                                                disabled={isUpdating}
                                                title="İşlemi Geri Al"
                                                className="flex items-center justify-center w-5 h-5 rounded bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                                            >
                                                {isUpdating ? (
                                                    <div className="w-2.5 h-2.5 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin"></div>
                                                ) : (
                                                    <span className="text-[10px] leading-none">↩</span>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Başlık */}
                                <h3 className="font-bold text-lg mb-2">{task.title}</h3>

                                {/* Açıklama */}
                                <p className="text-sm text-white/60 mb-4 line-clamp-2">
                                    {task.description || 'Açıklama yok.'}
                                </p>

                                {/* Deadline Bilgisi */}
                                {task.deadline && (() => {
                                    const today = new Date();
                                    const deadlineDate = new Date(task.deadline);
                                    
                                    today.setHours(0, 0, 0, 0);
                                    deadlineDate.setHours(0, 0, 0, 0);
                                    
                                    const diffTime = deadlineDate.getTime() - today.getTime();
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    const isOverdue = diffDays < 0;

                                    return (
                                        <div className="flex flex-col gap-2 mb-4">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Clock size={14} className="text-white/40" />
                                                <span className="text-white/60">Deadline:</span>
                                                <span className="font-semibold">
                                                    {deadlineDate.toLocaleDateString('tr-TR')}
                                                </span>
                                            </div>
                                            {task.status !== 'COMPLETED' && (
                                                <div className="flex items-center">
                                                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                                                        isOverdue 
                                                            ? 'bg-red-600/35 text-red-400'
                                                            : diffDays <= 2 
                                                                ? 'bg-orange-500/20 text-orange-400'
                                                                : 'bg-blue-500/20 text-blue-300'
                                                    }`}>
                                                        {isOverdue 
                                                            ? `${Math.abs(diffDays)} gün gecikmiş`
                                                            : diffDays === 0
                                                                ? 'Bugün teslim edilecek'
                                                                : `${diffDays} gün kaldı`
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Repo Linki */}
                                <div className="mb-4">
                                    {task.repoLink ? (
                                        <a
                                            href={task.repoLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-2 text-sm text-brand-light hover:underline w-fit"
                                        >
                                            <Code size={14} />
                                            <span className="truncate">{task.repoLink}</span>
                                            <ExternalLink size={12} />
                                        </a>
                                    ) : (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRepoLink(task);
                                            }}
                                            disabled={isUpdating}
                                            className="text-sm text-white/40 hover:text-brand-light transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            + Repo linki ekle
                                        </button>
                                    )}
                                </div>

                                {/* ANA İŞLEM BUTONLARI (Alt Kısım) */}
                                <div className="flex gap-2 mt-auto pt-2">
                                    {task.status === 'PENDING' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleStatusUpdate(task, 'IN_PROGRESS');
                                            }}
                                            disabled={isUpdating}
                                            className="flex-1 btn-brand text-sm py-2.5"
                                        >
                                            {isUpdating ? 'Güncelleniyor...' : '▶ Başlat'}
                                        </button>
                                    )}

                                    {task.status === 'IN_PROGRESS' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleStatusUpdate(task, 'COMPLETED');
                                            }}
                                            disabled={isUpdating}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-2 py-2.5 transition-colors cursor-pointer disabled:opacity-50 text-sm"
                                        >
                                            {isUpdating ? 'Güncelleniyor...' : '✓ Tamamla'}
                                        </button>
                                    )}

                                    {task.status === 'COMPLETED' && (
                                        <div className="flex-1 text-center text-sm text-green-400 font-semibold py-2.5 flex items-center justify-center bg-green-500/10 rounded-lg">
                                            ✅ Tamamlandı
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* GÖREV DÜZENLEME MODALI */}
            {editingTask && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-panel w-full max-w-md rounded-xl border border-white/10 p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Görevi Düzenle</h2>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-white/60 text-sm mb-1">Görev Başlığı</label>
                                <input 
                                    type="text" required value={editingTask.title}
                                    onChange={(e) => setEditingTask({...editingTask, title: e.target.value})}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-brand"
                                />
                            </div>
                            <div>
                                <label className="block text-white/60 text-sm mb-1">Görev Detayı</label>
                                <textarea 
                                    required value={editingTask.description || ''}
                                    onChange={(e) => setEditingTask({...editingTask, description: e.target.value})}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white min-h-[100px] outline-none focus:border-brand"
                                />
                            </div>
                            <div>
                                <label className="block text-white/60 text-sm mb-1">Teslim Tarihi</label>
                                <input 
                                    type="date" 
                                    value={editingTask.deadline ? new Date(editingTask.deadline).toISOString().split('T')[0] : ''}
                                    onChange={(e) => setEditingTask({...editingTask, deadline: e.target.value})}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-brand"
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setEditingTask(null)} className="flex-1 bg-white/5 hover:bg-white/10 py-2 rounded-lg font-semibold transition-colors">İptal</button>
                                <button type="submit" className="flex-1 bg-brand hover:bg-brand-light text-white py-2 rounded-lg font-semibold transition-colors">Güncelle</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}