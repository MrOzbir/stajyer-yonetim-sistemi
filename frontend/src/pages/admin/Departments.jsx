import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import { Building2, Plus, Pencil, Trash2, Users, X } from 'lucide-react';

// Renk paleti önerileri (departman rozetleri için)
const PRESET_COLORS = [
    '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6',
    '#ec4899', '#14b8a6', '#a01e27', '#64748b'
];

export default function Departments() {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null); // null = yeni, obje = düzenleme
    const [form, setForm] = useState({ name: '', description: '', color: PRESET_COLORS[0] });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async (showSpinner = false) => {
        if (showSpinner) setLoading(true);
        try {
            const res = await api.get('/departments');
            setDepartments(res.data);
        } catch (e) {
            console.error('Departmanlar yüklenemedi:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            await load(); // ✅ İlk yükleme: loading zaten true, senkron setState YOK
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]);

    const openCreate = () => {
        setEditing(null);
        setForm({ name: '', description: '', color: PRESET_COLORS[0] });
        setError('');
        setModalOpen(true);
    };

    const openEdit = (dept) => {
        setEditing(dept);
        setForm({ name: dept.name, description: dept.description || '', color: dept.color });
        setError('');
        setModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            if (editing) {
                await api.patch(`/departments/${editing.id}`, form);
            } else {
                await api.post('/departments', form);
            }
            setModalOpen(false);
            load(true);   // 🔄
        } catch (err) {
            setError(err.response?.data?.error || 'Kaydedilemedi.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (dept) => {
        if (!window.confirm(`"${dept.name}" silinsin mi?`)) return;
        try {
            await api.delete(`/departments/${dept.id}`);
            load(true);   // 🔄
        } catch (e) {
            alert(e.response?.data?.error || 'Silinemedi.');
        }
    };

    return (
        <div>
            {/* Başlık + Yeni Butonu */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold mb-1">Departmanlar</h1>
                    <p className="text-white/40 text-sm">Ekipleri organize edin ve renklendirin</p>
                </div>
                <button onClick={openCreate} className="btn-brand flex items-center gap-2">
                    <Plus size={16} /> Yeni Departman
                </button>
            </div>

            {/* Yükleniyor */}
            {loading && (
                <div className="card flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* Boş Durum */}
            {!loading && departments.length === 0 && (
                <div className="card text-center py-16">
                    <Building2 size={32} className="text-white/20 mx-auto mb-3" />
                    <p className="text-white/40">Henüz departman yok. İlk departmanınızı oluşturun!</p>
                </div>
            )}

            {/* Departman Kartları */}
            {!loading && departments.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {departments.map((dept) => (
                        <div key={dept.id} className="card hover:border-white/15 transition-colors">
                            {/* Üst: Renk + Ad + Aksiyonlar */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: dept.color }}
                                    >
                                        <Building2 size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="font-bold">{dept.name}</div>
                                        <div className="text-xs text-white/40">
                                            {dept.createdAt}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openEdit(dept)}
                                        title="Düzenle"
                                        className="text-white/40 hover:text-white transition-colors cursor-pointer"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(dept)}
                                        title="Sil"
                                        className="text-white/40 hover:text-brand-light transition-colors cursor-pointer"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Açıklama */}
                            <p className="text-sm text-white/60 mb-4 min-h-[40px]">
                                {dept.description || 'Açıklama eklenmemiş.'}
                            </p>

                            {/* Üye Sayısı */}
                            <div className="flex items-center gap-2 text-sm">
                                <span
                                    className="px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                                    style={{ backgroundColor: dept.color }}
                                >
                                    <Users size={12} className="inline mr-1 -mt-0.5" />
                                    {dept.internCount} aktif stajyer
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ================= MODAL ================= */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="card w-full max-w-md">
                        {/* Modal Başlık */}
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold">
                                {editing ? 'Departmanı Düzenle' : 'Yeni Departman'}
                            </h2>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="text-white/40 hover:text-white cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="label-dark">Departman Adı *</label>
                                <input
                                    className="input-dark"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Örn: Backend, Frontend, DevOps"
                                    required
                                />
                            </div>

                            <div>
                                <label className="label-dark">Açıklama</label>
                                <textarea
                                    className="input-dark resize-none"
                                    rows={3}
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Bu departman neyle ilgilenir?"
                                />
                            </div>

                            <div>
                                <label className="label-dark">Rozet Rengi</label>
                                <div className="flex gap-2 flex-wrap">
                                    {PRESET_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setForm({ ...form, color })}
                                            className={`w-8 h-8 rounded-lg transition-transform cursor-pointer ${
                                                form.color === color ? 'scale-110 ring-2 ring-white' : 'hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <div className="bg-brand/10 border border-brand/30 text-brand-light rounded-lg px-4 py-2.5 text-sm">
                                    ⚠️ {error}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 text-white/60 hover:text-white transition-colors cursor-pointer">
                                    İptal
                                </button>
                                <button type="submit" disabled={saving} className="btn-brand flex-1">
                                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}