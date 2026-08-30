import { NavLink } from 'react-router-dom';
import { BookOpen, LayoutDashboard } from 'lucide-react'; 

export default function AdminSidebar() {
    return (
        <aside className="w-64 bg-night border-r border-edge h-screen p-4">
            {/* Logo veya Başlık Alanı */}
            
            <nav className="space-y-2 mt-6">
                {/* Mevcut Menü Elemanlarınız */}
                <NavLink to="/admin/dashboard" className="flex items-center gap-3 p-3 rounded-lg hover:bg-overlay transition-colors">
                    <LayoutDashboard size={20} />
                    <span>Panel</span>
                </NavLink>

                {/* 🚀 YENİ EKLENEN: Günlük Özetler Butonu */}
                <NavLink 
                    to="/admin/summaries" 
                    className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-brand/10 text-brand-light font-bold' : 'text-snow-muted hover:bg-overlay'}`}
                >
                    <BookOpen size={20} />
                    <span>Günlük Özetler</span>
                </NavLink>
            </nav>
        </aside>
    );
}