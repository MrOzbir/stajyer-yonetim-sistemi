import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import { Archive, RotateCcw, Users, ArchiveRestore, Bot, Trash2, UserPlus } from 'lucide-react';

export default function Interns() {
    const [interns, setInterns] = useState([]);
    const [archived, setArchived] = useState([]);
    const [view, setView] = useState('active');
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(null); // 🆕 AI rapor oluşturulurken hangi stajyer ID'si
    const navigate = useNavigate();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [addForm, setAddForm] = useState({
        name: '',
        surname: '',
        email: '',
        password: '',
        departmentId: ''
    });
    

    // 🎯 showSpinner=true → sadece butonlardan çağrılınca spinner aç
    const load = useCallback(async (showSpinner = false) => {
        if (showSpinner) setLoading(true);
        try {
            const [activeRes, archivedRes] = await Promise.all([
                api.get('/interns'),
                api.get('/interns?archived=true'),
            ]);
            
            console.log("💡 BACKEND'DEN GELEN AKTİF LİSTE:", activeRes.data);

            // Matruşka ihtimaline karşı güvenli veri okuma
            const activeList = activeRes.data.interns || activeRes.data.data || activeRes.data;
            const archivedList = archivedRes.data.interns || archivedRes.data.data || archivedRes.data;

            setInterns(Array.isArray(activeList) ? activeList : []);
            setArchived(Array.isArray(archivedList) ? archivedList : []);
        } catch (e) {
            console.error('Stajyerler yüklenemedi:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const res = await api.get('/departments');
                setDepartments(res.data);
            } catch (error) {
                console.error("Departmanlar getirilemedi:", error);
            }
        };
        fetchDepartments();
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

    const handleDelete = async (intern) => {
        // Kalıcı silme olduğu için ekstra dikkat çekici bir uyarı koyuyoruz
        if (!window.confirm(`⚠️ DİKKAT: ${intern.name} ${intern.surname} sistemden KALICI olarak silinecek. Tüm görevleri, raporları ve logları da yok olacak.\n\nBu işlem GERİ ALINAMAZ! Onaylıyor musunuz?`)) return;
        
        try {
            await api.delete(`/interns/${intern.id}`);
            load(true); // Listeyi yenile
        } catch (e) {
            alert(e.response?.data?.error || 'Silme işlemi başarısız');
        }
    };

    const handleAddIntern = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            // Backend'deki register rotamıza istek atıyoruz[cite: 1]
            await api.post('/auth/register', {
                name: addForm.name.trim(),
                surname: addForm.surname.trim(),
                email: addForm.email.trim(),
                password: addForm.password,
                role: 'INTERN' ,
                departmentId: addForm.departmentId ? parseInt(addForm.departmentId) : null
            });
            
            setIsAddModalOpen(false);
            setAddForm({ name: '', surname: '', email: '', password: '', departmentId: '' });
            load(true); // Listeyi anında yenile
            alert("✅ Stajyer başarıyla sisteme eklendi!");
        } catch (error) {
            alert("❌ Hata: " + (error.response?.data?.error || "Stajyer eklenemedi."));
        } finally {
            setIsSubmitting(false);
        }
    };

    // 🤖 AI RAPOR OLUŞTUR
    const generateAiReport = async (intern) => {

        console.log("🚨 TIKLANAN STAJYER BÜTÜN OBJESİ:", intern);
        // Görev kontrolü
        if (!intern.tasks || intern.tasks.total === 0) {
            alert(`❌ ${intern.name} ${intern.surname} adlı stajyere henüz hiç görev atanmamış, görev atanmamış stajyerin AI raporu.`);
            return;
        }

        if (!window.confirm(`${intern.name} ${intern.surname} için AI raporu oluşturulsun mu? (1-2 dakika sürebilir)`)) return;
        
        setIsGenerating(intern.id);
        try {
            // Backend'e istek atıyoruz (Python servisi uzun sürebilir)
            await api.post(`/ai/generate-report/${intern.id}`);
            await load(false);
            alert('✅ AI Raporu başarıyla oluşturuldu!');
        } catch (e) {
            console.error("AI Rapor Hatası:", e);
            alert('❌ Rapor oluşturulamadı: ' + (e.response?.data?.error || e.message));
        } finally {
            // 🛡️ KRİTİK: Hata olsa bile loader'ı mutlaka kapatır!
            setIsGenerating(null);
        }
    };

    const list = view === 'active' ? interns : archived;

    return (
        <div>
            {/* Başlık */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold mb-1">Stajyerler</h1>
                    <p className="text-snow-faint text-sm">Tüm stajyerlerin performans özeti</p>
                </div>

                {/* Sekmeler */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-lg"
                    >
                        <UserPlus size={18} />
                        Yeni Stajyer Ekle
                    </button>
                    <button
                        onClick={() => setView('active')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                            view === 'active'
                                ? 'bg-brand text-white'
                                : 'bg-panel text-snow-muted hover:text-white border border-edge'
                        }`}
                    >
                        <Users size={16} /> Aktif ({interns.length})
                    </button>
                    <button
                        onClick={() => setView('archived')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                            view === 'archived'
                                ? 'bg-brand text-white'
                                : 'bg-panel text-snow-muted hover:text-white border border-edge'
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
                <div className="card text-center py-16 text-snow-faint">
                    {view === 'active' ? 'Aktif stajyer yok.' : 'Arşivde stajyer yok.'}
                </div>
            )}

            {/* Tablo */}
            {!loading && list.length > 0 && (
                <div className="card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs lg:text-sm">
                            <thead className="bg-night/60 text-snow-muted text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="text-left px-2 py-2.5 sm:px-3">Stajyer</th>
                                    <th className="text-left px-2 py-2.5 sm:px-3">Departman</th>
                                    <th className="text-left px-2 py-2.5 sm:px-3">Görevler</th>
                                    <th className="text-left px-2 py-2.5 sm:px-3">AI Puanı</th>
                                    <th className="text-left px-2 py-2.5 sm:px-3">Toplam Mesai</th>
                                    <th className="text-left px-2 py-2.5 sm:px-3">Son Giriş</th>
                                    <th className="text-right px-2 py-2.5 sm:px-3">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge">
                                {list.map((intern) => (
                                    <tr 
                                    key={intern.id} 
                                    className="hover:bg-overlay transition-colors cursor-pointer"
                                    onClick={(e) => {
                                        // 🚨 KESİN KORUMA: Eğer tıklanan yer bir buton veya butonun içindeki bir ikon ise yönlendirmeyi iptal et!
                                        if (e.target.closest('button')) return;
                                        
                                        // Sadece boşluğa tıklandıysa detay sayfasına git
                                        navigate(`/admin/interns/${intern.id}`);
                                    }}
                                    >
                                        
                                        {/* Stajyer */}
                                        <td className="px-2 py-3 sm:px-3">
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
                                                    <div className="font-semibold break-words whitespace-normal max-w-[120px] md:max-w-full">
                                                        {intern.name} {intern.surname}
                                                    </div>
                                                    <div className="text-[10px] sm:text-xs text-snow-faint break-words whitespace-normal max-w-[120px] md:max-w-full">{intern.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                    
    
                                        {/* Departman */}
                                        <td className="px-2 py-3 sm:px-3">
                                            {intern.department ? (
                                                <span
                                                    className="px-2.5 py-1 rounded-full text-xs font-medium text-snow whitespace-nowrap"
                                                    style={{ backgroundColor: intern.department.color }}
                                                >
                                                    {intern.department.name}
                                                </span>
                                            ) : (
                                                <span className="text-snow-faint text-xs">—</span>
                                            )}
                                        </td>
    
                                        {/* Görevler */}
                                        <td className="px-2 py-3 sm:px-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold whitespace-nowrap">
                                                    {intern.tasks.completed}/{intern.tasks.total}
                                                </span>
                                                {intern.tasks.urgent > 0 && (
                                                    <span className="bg-brand/15 text-brand-light px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap">
                                                        {intern.tasks.urgent} acil
                                                    </span>
                                                )}
                                                {intern.tasks.overdue > 0 && (
                                                    <span className="bg-brand text-white px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap">
                                                        {intern.tasks.overdue} gecikmiş
                                                    </span>
                                                )}
                                            </div>
                                        </td>
    
                                        {/* AI Puanı */}
                                        <td className="px-2 py-3 sm:px-3">
                                            {intern.ai ? (
                                                <div className="w-24">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="font-bold text-brand-light">{intern.ai.overallScore}</span>
                                                        <span className="text-snow-faint">/100</span>
                                                    </div>
                                                    <div className="h-1.5 bg-overlay-hover rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-brand rounded-full"
                                                            style={{ width: `${intern.ai.overallScore}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-snow-faint text-xs whitespace-nowrap">Rapor yok</span>
                                            )}
                                        </td>
    
                                        {/* Mesai */}
                                        <td className="px-2 py-3 sm:px-3 text-snow-muted">
                                            {intern.work.totalWorked}
                                        </td>
    
                                        {/* Son Giriş */}
                                        <td className="px-2 py-3 sm:px-3 text-snow-muted text-[10px] sm:text-xs">
                                            {intern.lastLogin || '—'}
                                        </td>
    
                                        {/* İşlemler */}
                                        <td className="px-2 py-3 sm:px-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* 🤖 AI RAPOR BUTONU (sadece aktif stajyerler için) */}
                                                {view === 'active' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Satıra tıklama olayını engeller
                                                            generateAiReport(intern);
                                                        }}
                                                        disabled={isGenerating === intern.id}
                                                        title="AI Performans Raporu Oluştur"
                                                        className={`flex items-center shrink-0 whitespace-nowrap gap-1 px-2 py-1.5 sm:px-3 rounded-lg text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
                                                            isGenerating === intern.id
                                                                ? 'bg-purple-600/30 text-purple-300 cursor-wait'
                                                                : 'bg-purple-600 hover:bg-purple-700 text-white'
                                                        }`}
                                                    >
                                                        {isGenerating === intern.id ? (
                                                            <>
                                                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                <span className="hidden sm:inline">Analiz...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Bot size={14} />
                                                                <span className="hidden sm:inline">AI Rapor</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
    
                                                {/* Arşivle / Geri Yükle */}
                                                {view === 'active' ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Satıra tıklama olayını engeller
                                                            handleArchive(intern);
                                                        }}
                                                        title="Arşivle"
                                                        className="text-snow-faint hover:text-brand-light transition-colors cursor-pointer shrink-0"
                                                    >
                                                        <Archive size={18} />
                                                    </button>
                                                ) : (
                                                    <>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Satıra tıklama olayını engeller
                                                            handleRestore(intern);
                                                        }}
                                                        title="Geri Yükle"
                                                        className="text-snow-faint hover:text-green-400 transition-colors cursor-pointer shrink-0"
                                                    >
                                                        <RotateCcw size={18} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(intern); // 🚨 Silme işlemi
                                                        }}
                                                        title="Kalıcı Olarak Sil"
                                                        className="text-snow-faint hover:text-red-500 transition-colors cursor-pointer shrink-0"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        
        {/* YENİ STAJYER EKLEME MODALI */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-panel w-full max-w-md rounded-xl border border-edge p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-brand/10 rounded-lg text-brand-light">
                                <UserPlus size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-snow">Yeni Stajyer Ekle</h2>
                        </div>
                        
                        <form onSubmit={handleAddIntern} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-snow-muted text-xs font-medium mb-1.5 uppercase tracking-wider">Ad</label>
                                    <input 
                                        type="text" required
                                        value={addForm.name}
                                        onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                                        className="w-full bg-night border border-edge rounded-lg px-4 py-2.5 text-sm text-snow outline-none focus:border-brand transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-snow-muted text-xs font-medium mb-1.5 uppercase tracking-wider">Soyad</label>
                                    <input 
                                        type="text" required
                                        value={addForm.surname}
                                        onChange={(e) => setAddForm({...addForm, surname: e.target.value})}
                                        className="w-full bg-night border border-edge rounded-lg px-4 py-2.5 text-sm text-snow outline-none focus:border-brand transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-snow-muted text-xs font-medium mb-1.5 uppercase tracking-wider">E-Posta</label>
                                <input 
                                    type="email" required
                                    value={addForm.email}
                                    onChange={(e) => setAddForm({...addForm, email: e.target.value})}
                                    className="w-full bg-night border border-edge rounded-lg px-4 py-2.5 text-sm text-snow outline-none focus:border-brand transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-snow-muted text-xs font-medium mb-1.5 uppercase tracking-wider">Geçici Şifre</label>
                                <input 
                                    type="password" required minLength="6"
                                    value={addForm.password}
                                    onChange={(e) => setAddForm({...addForm, password: e.target.value})}
                                    className="w-full bg-night border border-edge rounded-lg px-4 py-2.5 text-sm text-snow outline-none focus:border-brand transition-colors"
                                />
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button 
                                    type="button" 
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 bg-overlay hover:bg-overlay-hover text-snow py-2.5 rounded-lg text-sm font-semibold transition-colors"
                                >
                                    İptal
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="flex-1 bg-brand hover:bg-brand-light text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : 'Kaydet'}
                                </button>
                            </div>
                            <div>
                                <label className="block text-snow-muted text-xs font-medium mb-1.5 uppercase tracking-wider">Departman (Opsiyonel)</label>
                                <select 
                                    value={addForm.departmentId}
                                    onChange={(e) => setAddForm({...addForm, departmentId: e.target.value})}
                                    className="w-full bg-night border border-edge rounded-lg px-4 py-2.5 text-sm text-snow outline-none focus:border-brand transition-colors appearance-none cursor-pointer"
                                >
                                    <option value="">Departman Seçin...</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </option>
                                    ))} 
                                </select>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}