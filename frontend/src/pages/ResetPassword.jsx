import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Lock } from 'lucide-react';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError("Şifre en az 6 karakter olmalıdır.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Şifreler uyuşmuyor.");
            return;
        }

        setLoading(true);

        try {
            await api.post('/auth/reset-password-with-token', { token, newPassword });
            alert("✅ Şifreniz başarıyla güncellendi! Giriş yapabilirsiniz.");
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.error || "Şifre sıfırlanamadı.");
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-night text-red-400 text-sm">
                Geçersiz şifre sıfırlama bağlantısı.
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-night p-4">
            <div className="w-full max-w-md bg-panel border border-edge rounded-2xl p-6 shadow-2xl">
                <h2 className="text-xl font-bold text-snow mb-1 flex items-center gap-2">
                    <Lock className="text-brand-light" size={22} /> Yeni Şifre Belirleyin
                </h2>
                <p className="text-xs text-snow-muted mb-6">Lütfen hesabınız için yeni bir şifre girin.</p>

                {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-snow-muted mb-1">Yeni Şifre</label>
                        <input
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-overlay border border-edge rounded-lg p-2.5 text-xs text-snow outline-none focus:border-brand"
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-snow-muted mb-1">Yeni Şifre (Tekrar)</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-overlay border border-edge rounded-lg p-2.5 text-xs text-snow outline-none focus:border-brand"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-lg text-xs transition-colors"
                    >
                        {loading ? "Güncelleniyor..." : "Şifreyi Kaydet"}
                    </button>
                </form>
            </div>
        </div>
    );
}