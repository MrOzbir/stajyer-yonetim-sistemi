import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import { Clock, CheckCircle2, Circle, Play, AlertTriangle, Code, ExternalLink } from 'lucide-react';
// Aciliyet seviyesine göre renkler ve etiketler
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
            {/* Başlık */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-1">Görevlerim</h1>
                <p className="text-white/40 text-sm">Size atanan tüm görevler ve durumları</p>
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
                        const status = STATUS_CONFIG[task.status];
                        const isUpdating = updatingId === task.id;

                        return (
                            <div key={task.id} className="card hover:border-white/15 transition-colors">
                                {/* Üst: Durum + Aciliyet */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className={`flex items-center gap-2 ${status.color}`}>
                                        {status.icon}
                                        <span className="text-sm font-semibold">{status.label}</span>
                                    </div>
                                    {urgency.icon && (
                                        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${urgency.color}`}>
                                            {urgency.icon}
                                            {urgency.label}
                                        </span>
                                    )}
                                </div>

                                {/* Başlık */}
                                <h3 className="font-bold text-lg mb-2">{task.title}</h3>

                                {/* Açıklama */}
                                <p className="text-sm text-white/60 mb-4 line-clamp-2">
                                    {task.description || 'Açıklama yok.'}
                                </p>


                                {/* Deadline Bilgisi */}
                                {task.deadline && (() => {
                                    // 1. Kalan günü backend'e güvenmeden React içinde kesin olarak hesaplıyoruz
                                    const today = new Date();
                                    const deadlineDate = new Date(task.deadline);
                                    
                                    // Sadece günleri karşılaştırmak için saatleri sıfırlayalım (gece yarısı yapalım)
                                    today.setHours(0, 0, 0, 0);
                                    deadlineDate.setHours(0, 0, 0, 0);
                                    
                                    const diffTime = deadlineDate.getTime() - today.getTime();
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    const isOverdue = diffDays < 0;

                                    return (
                                        <div className="flex flex-col gap-2 mb-4">
                                            
                                            {/* Üst Satır: Sadece Takvim Tarihi */}
                                            <div className="flex items-center gap-2 text-sm">
                                                <Clock size={14} className="text-white/40" />
                                                <span className="text-white/60">Deadline:</span>
                                                <span className="font-semibold">
                                                    {deadlineDate.toLocaleDateString('tr-TR')}
                                                </span>
                                            </div>

                                            {/* Alt Satır: Kalan/Gecikme Rozeti (Eğer görev tamamlanmadıysa göster) */}
                                            {task.status !== 'COMPLETED' && (
                                                <div className="flex items-center">
                                                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                                                        isOverdue 
                                                            ? 'bg-red-600/35 text-red-400'       // Gecikmişse kesinlikle KIRMIZI
                                                            : diffDays <= 2 
                                                                ? 'bg-orange-500/20 text-orange-400' // 2 veya daha az gün kaldıysa TURUNCU
                                                                : 'bg-blue-500/20 text-blue-300'     // Normal süresi varsa MAVİ
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
                                            className="flex items-center gap-2 text-sm text-brand-light hover:underline"
                                        >
                                            <Code size={14} />
                                            <span className="truncate">{task.repoLink}</span>
                                            <ExternalLink size={12} />
                                        </a>
                                    ) : (
                                        <button
                                            onClick={() => handleRepoLink(task)}
                                            disabled={isUpdating}
                                            className="text-sm text-white/40 hover:text-brand-light transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            + Repo linki ekle
                                        </button>
                                    )}
                                </div>

                                {/* Durum Güncelleme Butonları */}
                                <div className="flex gap-2">
                                    {task.status === 'PENDING' && (
                                        <button
                                            onClick={() => handleStatusUpdate(task, 'IN_PROGRESS')}
                                            disabled={isUpdating}
                                            className="flex-1 btn-brand text-sm"
                                        >
                                            {isUpdating ? 'Güncelleniyor...' : '▶ Başlat'}
                                        </button>
                                    )}
                                    {task.status === 'IN_PROGRESS' && (
                                        <button
                                            onClick={() => handleStatusUpdate(task, 'COMPLETED')}
                                            disabled={isUpdating}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            {isUpdating ? 'Güncelleniyor...' : '✓ Tamamla'}
                                        </button>
                                    )}
                                    {task.status === 'COMPLETED' && (
                                        <div className="flex-1 text-center text-sm text-green-400 font-semibold py-2.5">
                                            ✅ Tamamlandı
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}