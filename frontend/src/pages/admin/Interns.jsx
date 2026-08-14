import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import { Archive, RotateCcw, Users, ArchiveRestore } from 'lucide-react';

export default function Interns() {
    const [interns, setInterns] = useState([]);
    const [archived, setArchived] = useState([]);
    const [view, setView] = useState('active');
    const [loading, setLoading] = useState(true);

    // 🎯 showSpinner=true → sadece butonlardan çağrılınca spinner aç
    const load = useCallback(async (showSpinner = false) => {
        if (showSpinner) setLoading(true);
        try {
            const [activeRes, archivedRes] = await Promise.all([
                api.get('/interns'),
                api.get('/interns?archived=true'),
            ]);
            setInterns(activeRes.data.interns || []);
            setArchived(archivedRes.data.interns || []);
        } catch (e) {
            console.error('Stajyerler yüklenemedi:', e);
        } finally {
            setLoading(false);   // ✅ await'den sonra → asenkron, kurala uygun
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            await load(); // ✅ İlk yükleme: loading zaten true, senkron setState YOK
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]);

    const handleArchive = async (intern) => {
        if (!window.confirm(`${intern.name} ${intern.surname} arşivlensin mi?`)) return;
        try {
            await api.patch(`/interns/${intern.id}/archive`);
            load(true);   // 🔄
        } catch (e) {
            alert(e.response?.data?.error || 'Arşivleme başarısız');
        }
    };

    const handleRestore = async (intern) => {
        try {
            await api.patch(`/interns/${intern.id}/restore`);
            load(true);   // 🔄
        } catch (e) {
            alert(e.response?.data?.error || 'Geri yükleme başarısız');
        }
    };

    const list = view === 'active' ? interns : archived;

    return (
        <div>
            {/* Başlık */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold mb-1">Stajyerler</h1>
                    <p className="text-white/40 text-sm">Tüm stajyerlerin performans özeti</p>
                </div>

                {/* Sekmeler */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setView('active')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                            view === 'active'
                                ? 'bg-brand text-white'
                                : 'bg-panel text-white/60 hover:text-white border border-white/10'
                        }`}
                    >
                        <Users size={16} /> Aktif ({interns.length})
                    </button>
                    <button
                        onClick={() => setView('archived')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                            view === 'archived'
                                ? 'bg-brand text-white'
                                : 'bg-panel text-white/60 hover:text-white border border-white/10'
                        }`}
                    >
                        <ArchiveRestore size={16} /> Arşiv ({archived.length})
                    </button>
                </div>
            </div>

            {/* Yükleniyor */}
            {loading && (
                <div className="card flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* Boş Durum */}
            {!loading && list.length === 0 && (
                <div className="card text-center py-16 text-white/40">
                    {view === 'active' ? 'Aktif stajyer yok.' : 'Arşivde stajyer yok.'}
                </div>
            )}

            {/* Tablo */}
            {!loading && list.length > 0 && (
                <div className="card p-0 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-night/60 text-white/50 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="text-left px-5 py-3">Stajyer</th>
                                <th className="text-left px-5 py-3">Departman</th>
                                <th className="text-left px-5 py-3">Görevler</th>
                                <th className="text-left px-5 py-3">AI Puanı</th>
                                <th className="text-left px-5 py-3">Toplam Mesai</th>
                                <th className="text-left px-5 py-3">Son Giriş</th>
                                <th className="text-right px-5 py-3">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {list.map((intern) => (
                                <tr key={intern.id} className="hover:bg-white/[0.03] transition-colors">
                                    {/* Stajyer */}
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative shrink-0">
                                                <div className="w-10 h-10 rounded-full bg-brand/20 text-brand-light flex items-center justify-center font-bold">
                                                    {intern.name?.charAt(0)}
                                                </div>
                                                {intern.isActiveNow && (
                                                    <span
                                                        className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-panel"
                                                        title="Çevrimiçi"
                                                    ></span>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-semibold truncate">
                                                    {intern.name} {intern.surname}
                                                </div>
                                                <div className="text-xs text-white/40 truncate">{intern.email}</div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Departman */}
                                    <td className="px-5 py-4">
                                        {intern.department ? (
                                            <span
                                                className="px-2.5 py-1 rounded-full text-xs font-medium text-white whitespace-nowrap"
                                                style={{ backgroundColor: intern.department.color }}
                                            >
                                                {intern.department.name}
                                            </span>
                                        ) : (
                                            <span className="text-white/30 text-xs">—</span>
                                        )}
                                    </td>

                                    {/* Görevler */}
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold">
                                                {intern.tasks.completed}/{intern.tasks.total}
                                            </span>
                                            {intern.tasks.urgent > 0 && (
                                                <span className="bg-brand/15 text-brand-light px-2 py-0.5 rounded text-xs font-semibold">
                                                    {intern.tasks.urgent} acil
                                                </span>
                                            )}
                                            {intern.tasks.overdue > 0 && (
                                                <span className="bg-brand text-white px-2 py-0.5 rounded text-xs font-semibold">
                                                    {intern.tasks.overdue} gecikmiş
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* AI Puanı */}
                                    <td className="px-5 py-4">
                                        {intern.ai ? (
                                            <div className="w-24">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="font-bold text-brand-light">{intern.ai.overallScore}</span>
                                                    <span className="text-white/30">/100</span>
                                                </div>
                                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-brand rounded-full"
                                                        style={{ width: `${intern.ai.overallScore}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-white/30 text-xs">Rapor yok</span>
                                        )}
                                    </td>

                                    {/* Mesai */}
                                    <td className="px-5 py-4 text-white/70 whitespace-nowrap">
                                        {intern.work.totalWorked}
                                    </td>

                                    {/* Son Giriş */}
                                    <td className="px-5 py-4 text-white/50 text-xs whitespace-nowrap">
                                        {intern.lastLogin || '—'}
                                    </td>

                                    {/* İşlemler */}
                                    <td className="px-5 py-4 text-right">
                                        {view === 'active' ? (
                                            <button
                                                onClick={() => handleArchive(intern)}
                                                title="Arşivle"
                                                className="text-white/40 hover:text-brand-light transition-colors cursor-pointer"
                                            >
                                                <Archive size={18} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleRestore(intern)}
                                                title="Geri Yükle"
                                                className="text-white/40 hover:text-green-400 transition-colors cursor-pointer"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}