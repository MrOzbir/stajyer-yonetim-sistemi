import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Lightbulb, Target, TrendingUp } from 'lucide-react';

export default function InternDashboard() {
    const [tip, setTip] = useState(null);
    const [mentorship, setMentorship] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const [tipRes, menRes] = await Promise.allSettled([
                    api.get('/ai/daily-tip'),
                    api.get('/ai/my-mentorship'),
                ]);
                if (tipRes.status === 'fulfilled') setTip(tipRes.value.data);
                if (menRes.status === 'fulfilled') setMentorship(menRes.value.data);
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold mb-1">Merhaba! 👋</h1>
                <p className="text-snow-faint text-sm mb-6">Bugünün özeti ve AI mentöründen notlar</p>
            </div>

            {/* Günün İpucu */}
            {tip && (
                <div className="card border-l-4 border-l-brand">
                    <div className="flex items-center gap-2 mb-2">
                        <Lightbulb size={18} className="text-brand-light" />
                        <span className="text-sm font-semibold text-brand-light">Günün Önerisi</span>
                    </div>
                    <p className="text-snow">{tip.tip}</p>
                    {tip.quote && (
                        <p className="text-xs text-snow-faint italic mt-3">"{tip.quote}"</p>
                    )}
                </div>
            )}

            {/* AI Mentör Özeti */}
            {mentorship && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="card flex flex-col items-center justify-center text-center">
                        <TrendingUp size={22} className="text-brand-light mb-2" />
                        <div className="stat-value text-brand-light">{mentorship.overallScore}</div>
                        <div className="text-sm text-snow-muted">AI Performans Puanı</div>
                    </div>
                    <div className="card lg:col-span-2">
                        <div className="flex items-center gap-2 mb-2">
                            <Target size={18} className="text-brand-light" />
                            <span className="text-sm font-semibold">Mentörünün Özeti</span>
                        </div>
                        <p className="text-snow text-sm leading-relaxed">{mentorship.internSummary}</p>
                    </div>
                </div>
            )}
        </div>
    );
}