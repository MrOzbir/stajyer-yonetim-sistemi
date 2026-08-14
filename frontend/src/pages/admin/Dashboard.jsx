import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Users, Briefcase, AlertTriangle, Building2 } from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const [interns, tasks, urgent, depts] = await Promise.all([
                    api.get('/interns'),
                    api.get('/tasks'),
                    api.get('/tasks/urgent'),
                    api.get('/departments'),
                ]);
                setStats({
                    interns: interns.data.totalInterns,
                    tasks: tasks.data.length,
                    urgent: urgent.data.stats.total,
                    depts: depts.data.length,
                });
            } catch (e) {
                console.error('Dashboard verisi alınamadı:', e);
            }
        })();
    }, []);

    const cards = [
        { label: 'Aktif Stajyer', value: stats?.interns, icon: <Users size={20} />, accent: 'text-brand-light bg-brand/15' },
        { label: 'Toplam Görev', value: stats?.tasks, icon: <Briefcase size={20} />, accent: 'text-white bg-white/10' },
        { label: 'Acil Görev', value: stats?.urgent, icon: <AlertTriangle size={20} />, accent: 'text-brand-light bg-brand/15' },
        { label: 'Departman', value: stats?.depts, icon: <Building2 size={20} />, accent: 'text-white bg-white/10' },
    ];

    return (
        <div>
            <h1 className="text-2xl font-bold mb-1">Yönetici Dashboard</h1>
            <p className="text-white/40 text-sm mb-6">Genel sistemin anlık özeti</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((c) => (
                    <div key={c.label} className="card flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${c.accent}`}>
                            {c.icon}
                        </div>
                        <div>
                            <div className="stat-value">{c.value ?? '—'}</div>
                            <div className="text-sm text-white/50">{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}