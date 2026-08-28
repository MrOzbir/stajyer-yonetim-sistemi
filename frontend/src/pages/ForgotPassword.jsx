import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { KeyRound, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            const res = await api.post('/auth/forgot-password', { email });
            setMessage(res.data.message);
        } catch (err) {
            setError(err.response?.data?.error || "E-posta gönderilemedi.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-night p-4">
            <div className="w-full max-w-md bg-panel border border-white/10 rounded-2xl p-6 shadow-2xl">
                <Link to="/login" className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white mb-4 transition-colors">
                    <ArrowLeft size={14} /> Giriş Sayfasına Dön
                </Link>

                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <KeyRound className="text-brand-light" size={22} /> Şifremi Unuttum
                </h2>
                <p className="text-xs text-white/50 mb-6">
                    Sistemde kayıtlı e-posta adresinizi girin. Size bir sıfırlama bağlantısı göndereceğiz.
                </p>

                {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">{error}</div>}
                {message && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg flex items-center gap-2">
                        <CheckCircle2 size={16} /> {message}
                    </div>
                )}

                {!message && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-white/70 mb-1">E-posta Adresi</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-white/30" size={16} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-brand"
                                    placeholder="ornek@sirket.com"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-brand hover:bg-brand-light text-white font-bold py-2.5 rounded-lg text-xs transition-colors"
                        >
                            {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}