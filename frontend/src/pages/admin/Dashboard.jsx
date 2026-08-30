import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { 
    Users, Briefcase, AlertTriangle, Building2, 
    ChevronRight, X, Clock, CheckCircle2, User
} from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [internsList, setInternsList] = useState([]);
    const [tasksList, setTasksList] = useState([]);
    const [urgentList, setUrgentList] = useState([]);
    const [deptsList, setDeptsList] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeSection, setActiveSection] = useState('tasks');

    useEffect(() => {
        (async () => {
            try {
                const [internsRes, tasksRes, urgentRes, deptsRes] = await Promise.all([
                    api.get('/interns'),
                    api.get('/tasks'),
                    api.get('/tasks/urgent'),
                    api.get('/departments'),
                ]);

                const interns = Array.isArray(internsRes.data?.interns) 
                    ? internsRes.data.interns 
                    : Array.isArray(internsRes.data) ? internsRes.data : [];

                const tasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];

                // 🔴 DÜZELTME: Backend /api/tasks/urgent endpoint'i { stats, tasks } formatında döner
                const urgent = Array.isArray(urgentRes.data?.tasks)
                    ? urgentRes.data.tasks
                    : Array.isArray(urgentRes.data?.urgentTasks)
                    ? urgentRes.data.urgentTasks
                    : Array.isArray(urgentRes.data)
                    ? urgentRes.data
                    : [];

                const depts = Array.isArray(deptsRes.data) ? deptsRes.data : [];

                setInternsList(interns);
                setTasksList(tasks);
                setUrgentList(urgent);
                setDeptsList(depts);

                setStats({
                    interns: internsRes.data?.totalInterns ?? interns.length,
                    tasks: tasks.length,
                    urgent: urgentRes.data?.stats?.total ?? urgent.length,
                    depts: depts.length,
                });
            } catch (e) {
                console.error('Dashboard verisi alınamadı:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const internTaskMap = internsList.map((intern) => {
        const assignedTasks = tasksList.filter((t) => t.internId === intern.id || t.intern?.id === intern.id);
        return {
            ...intern,
            assignedTasks,
            taskCount: assignedTasks.length,
        };
    });

    const cards = [
        { id: 'interns', label: 'Aktif Stajyer', value: stats?.interns, icon: <Users size={20} />, accent: 'text-brand-light bg-brand/15' },
        { id: 'tasks', label: 'Toplam Görev', value: stats?.tasks, icon: <Briefcase size={20} />, accent: 'text-white bg-white/10' },
        { id: 'urgent', label: 'Acil Görev', value: stats?.urgent, icon: <AlertTriangle size={20} />, accent: 'text-red-400 bg-red-500/15' },
        { id: 'depts', label: 'Departman', value: stats?.depts, icon: <Building2 size={20} />, accent: 'text-white bg-white/10' },
    ];

    if (loading) {
        return (
            <div className="flex justify-center items-center py-32">
                <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold mb-1">Yönetici Dashboard</h1>
                <p className="text-white/40 text-sm">Genel sistemin anlık özeti (Detaylar için kutulara tıklayın)</p>
            </div>

            {/* İSTATİSTİK KARTLARI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((c) => {
                    const isSelected = activeSection === c.id;
                    return (
                        <div
                            key={c.id}
                            onClick={() => setActiveSection(activeSection === c.id ? null : c.id)}
                            className={`card flex items-center justify-between p-4 cursor-pointer transition-all duration-200 select-none ${
                                isSelected 
                                    ? 'ring-2 ring-brand-light bg-panel shadow-lg -translate-y-1' 
                                    : 'hover:bg-white/[0.07] hover:-translate-y-0.5'
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${c.accent}`}>
                                    {c.icon}
                                </div>
                                <div>
                                    <div className="stat-value font-bold text-2xl">{c.value ?? '—'}</div>
                                    <div className="text-sm text-white/50">{c.label}</div>
                                </div>
                            </div>
                            <ChevronRight 
                                size={18} 
                                className={`text-white/30 transition-transform duration-300 ${isSelected ? 'rotate-90 text-brand-light' : ''}`} 
                            />
                        </div>
                    );
                })}
            </div>

            {/* İNTERAKTİF ÖZET ALANI */}
            {activeSection && (
                <div className="card p-5 border border-white/10 bg-panel/80 backdrop-blur-md rounded-xl shadow-2xl transition-all duration-300">
                    
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            {cards.find(c => c.id === activeSection)?.icon}
                            <h2 className="font-bold text-lg text-white">
                                {activeSection === 'interns' && 'Aktif Stajyerler Listesi'}
                                {activeSection === 'tasks' && 'Görev Dağılımı ve Stajyer Özeti'}
                                {activeSection === 'urgent' && 'Acil & Bekleyen Görevler'}
                                {activeSection === 'depts' && 'Departman Dağılımları'}
                            </h2>
                        </div>
                        <button 
                            onClick={() => setActiveSection(null)}
                            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* 1. AKTİF STAJYERLER LİSTESİ */}
                    {activeSection === 'interns' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {internsList.length === 0 ? (
                                <p className="text-white/40 text-sm py-4">Kayıtlı aktif stajyer bulunmuyor.</p>
                            ) : (
                                internsList.map((intern) => (
                                    <div key={intern.id} className="p-3 bg-night/50 border border-white/5 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-brand/20 text-brand-light flex items-center justify-center font-bold text-xs">
                                                {intern.name?.[0]}{intern.surname?.[0]}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">{intern.name} {intern.surname}</p>
                                                <p className="text-xs text-white/40">{intern.email}</p>
                                            </div>
                                        </div>
                                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-500/20" title="Aktif"></span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* 2. GÖREVLER */}
                    {activeSection === 'tasks' && (
                        <div className="space-y-3">
                            {internTaskMap.length === 0 ? (
                                <p className="text-white/40 text-sm py-4">Henüz görevlendirilmiş stajyer bulunmuyor.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {internTaskMap.map((intern) => (
                                        <div key={intern.id} className="p-4 bg-night/50 border border-white/5 rounded-xl space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <User size={16} className="text-brand-light" />
                                                    <span className="font-bold text-sm text-white">{intern.name} {intern.surname}</span>
                                                </div>
                                                <span className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shadow-md">
                                                    {intern.taskCount}
                                                </span>
                                            </div>

                                            {intern.assignedTasks.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {intern.assignedTasks.map((t) => (
                                                        <div key={t.id} className="text-xs text-white/70 bg-white/5 px-2.5 py-1.5 rounded flex items-center justify-between">
                                                            <span className="truncate pr-2">• {t.title}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                                t.status === 'COMPLETED' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
                                                            }`}>
                                                                {t.status}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-white/30 italic">Atanmış aktif görev yok.</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. ACİL GÖREVLER (HATA DÜZELTİLDİ) */}
                    {activeSection === 'urgent' && (
                        <div className="space-y-2">
                            {urgentList.length === 0 ? (
                                <div className="flex items-center gap-2 text-green-400 text-sm py-4">
                                    <CheckCircle2 size={16} />
                                    <span>Tebrikler! Şu anda gecikmiş veya acil görev bulunmuyor.</span>
                                </div>
                            ) : (
                                urgentList.map((task) => {
                                    const internFullName = task.intern 
                                        ? `${task.intern.name} ${task.intern.surname || ''}`.trim() 
                                        : 'Atanmadı';

                                    return (
                                        <div key={task.id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-full bg-red-500/20 text-red-400">
                                                    <Clock size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-white">{task.title}</p>
                                                    <p className="text-xs text-red-400/80">
                                                        Atanan Stajyer: <strong className="text-white">{internFullName}</strong>
                                                    </p>
                                                </div>
                                            </div>
                                            {task.deadline && (
                                                <span className="text-xs bg-black/40 text-red-300 px-2 py-1 rounded">
                                                    {new Date(task.deadline).toLocaleDateString('tr-TR')}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* 4. DEPARTMANLAR */}
                    {activeSection === 'depts' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {deptsList.length === 0 ? (
                                <p className="text-white/40 text-sm py-4">Departman kaydı bulunamadı.</p>
                            ) : (
                                deptsList.map((d) => (
                                    <div key={d.id} className="p-3.5 bg-night/50 border border-white/5 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <Building2 size={16} className="text-brand-light" />
                                            <span className="font-semibold text-sm text-white">{d.name}</span>
                                        </div>
                                        <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded">
                                            {d.interns?.length ?? 0} Stajyer
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}