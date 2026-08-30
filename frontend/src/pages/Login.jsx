import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { HelpCircle, X } from 'lucide-react';
import AsciiArt from '../components/AsciiArt';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isTakingOff, setIsTakingOff] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();

    const targetRouteRef = useRef('/admin');
    const fallbackTimerRef = useRef(null);
    const pendingAuthDataRef = useRef(null);

    // 🛫 Video Bittiğinde Gerçek Giriş ve Yönlendirme
    const completeLoginAndRedirect = () => {
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);

        const data = pendingAuthDataRef.current;
        if (data) {
            const user = data.user || data;
            const token = data.token;

            if (token) localStorage.setItem('token', token);
            if (user) localStorage.setItem('user', JSON.stringify(user));
            if (login) login(data);
        }

        navigate(targetRouteRef.current, { replace: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await api.post('/auth/login', {
                email: email.trim(),
                password: password
            });

            const data = res.data;
            const user = data.user || data;

            // Giriş verilerini video bitene kadar hafızada tut
            pendingAuthDataRef.current = data;
            const userRole = (user.role || '').toUpperCase();
            targetRouteRef.current = userRole === 'ADMIN' ? '/admin' : '/intern';

            // ✈️ Uçak geçiş videosunu başlat
            setIsTakingOff(true);

            // Emniyet Sayacı: Video takılırsa veya başlamazsa zorla yönlendir
            fallbackTimerRef.current = setTimeout(() => {
                completeLoginAndRedirect();
            }, 2300);

        } catch (err) {
            console.error('Giriş Hatası:', err.response?.data || err.message);
            alert(err.response?.data?.error || err.response?.data?.message || 'Geçersiz e-posta veya şifre.');
            setLoading(false);
            setIsTakingOff(false);
        }
    };

    useEffect(() => {
        return () => {
            if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        };
    }, []);

    return (
        <div className="relative min-h-screen bg-night flex items-center justify-center lg:items-end lg:justify-end lg:pr-[10%] lg:pb-[10%] p-4 overflow-hidden">
            
            {/* Arka Plan ASCII Efekti */}
            <div className="absolute inset-0 z-0">
                <AsciiArt />
            </div>
            
            {/* ✈️ Uçak Kalkış Katmanı (Transparan & Tam Ekran) */}
            {isTakingOff && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent pointer-events-none">
                    <video
                        src="/plane-transition.webm"
                        autoPlay
                        muted
                        playsInline
                        onEnded={completeLoginAndRedirect}
                        onError={completeLoginAndRedirect}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* Giriş Form Kartı */}
            <div className="w-full max-w-md bg-panel/80 backdrop-blur-md p-8 rounded-xl border border-edge shadow-2xl relative z-10 lg:translate-x-[20%] lg:translate-y-[15%]">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-snow">Stajyer Yönetim Sistemi</h1>
                    <p className="text-snow-faint text-sm mt-1">Lütfen hesabınıza giriş yapın</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-snow-muted text-sm mb-1">E-posta</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-night border border-edge rounded-lg px-4 py-2.5 text-snow outline-none focus:border-brand"
                            placeholder="ornek@sirket.com"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-snow-muted text-sm">Şifre</label>
                            <button
                                type="button"
                                onClick={() => setShowForgotModal(true)}
                                className="text-xs text-brand-light hover:underline cursor-pointer"
                            >
                                Şifremi Unuttum?
                            </button>
                        </div>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-night border border-edge rounded-lg px-4 py-2.5 text-snow outline-none focus:border-brand"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || isTakingOff}
                        className="w-full bg-brand hover:bg-brand-light text-white font-semibold py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 mt-2"
                    >
                        {loading || isTakingOff ? 'Uçuşa Hazırlanıyor...' : 'Giriş Yap'}
                    </button>
                </form>
            </div>

            {/* 🔑 Şifremi Unuttum Modalı */}
            {showForgotModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-panel border border-edge w-full max-w-sm rounded-2xl shadow-2xl p-6 relative">
                        <button
                            onClick={() => setShowForgotModal(false)}
                            className="absolute top-4 right-4 text-snow-faint hover:text-snow"
                        >
                            <X size={18} />
                        </button>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-brand/20 text-brand-light rounded-lg">
                                <HelpCircle size={20} />
                            </div>
                            <h3 className="font-bold text-snow text-base">Şifre Sıfırlama</h3>
                        </div>
                        <p className="text-xs text-snow-muted leading-relaxed">
                            Güvenlik protokolü gereği lütfen sistem yöneticiniz (Admin) ile iletişime geçin.
                        </p>
                        <button
                            onClick={() => setShowForgotModal(false)}
                            className="w-full mt-5 bg-overlay-hover hover:bg-overlay-hover text-snow font-semibold py-2 rounded-lg text-xs transition-colors"
                        >
                            Anladım
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}