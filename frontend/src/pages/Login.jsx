import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogIn } from 'lucide-react';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(email, password);
            navigate(user.role === 'ADMIN' ? '/admin' : '/intern');
        } catch (err) {
            setError(err.response?.data?.error || 'Giriş yapılamadı. Sunucuyu kontrol edin.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-night flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center shadow-[0_0_35px_rgba(160,30,39,0.45)]">
                        <ShieldAlert size={26} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Stajyer Yönetim Sistemi</h1>
                        <p className="text-sm text-white/40">Stajyer Yönetim Sistemi</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="card space-y-5">
                    <div>
                        <label className="label-dark">E-posta</label>
                        <input
                            className="input-dark"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@sirket.com"
                            required
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="label-dark">Şifre</label>
                            <Link 
                                to="/forgot-password" 
                                className="text-xs text-brand-light hover:underline transition-colors"
                            >
                                Şifremi Unuttum?
                            </Link>
                        </div>
                        <input
                            className="input-dark"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-brand/10 border border-brand/30 text-brand-light rounded-lg px-4 py-2.5 text-sm">
                            ⚠️ {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="btn-brand w-full flex items-center justify-center gap-2">
                        <LogIn size={16} />
                        {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                    </button>
                </form>

                <p className="text-center text-xs text-white/30 mt-6">
                    © 2026 Stajyer Yönetim Sistemi • AI Destekli Stajyer Yönetimi
                </p>
            </div>
        </div>
    );
}