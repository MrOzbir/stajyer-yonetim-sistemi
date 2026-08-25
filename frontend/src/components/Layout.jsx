import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    ShieldAlert, LayoutDashboard, Users, Building2,
    MessageSquare, Briefcase, GraduationCap, LogOut,
    BookOpenText
} from 'lucide-react';
import { useSocketContext } from '../context/SocketContext';

const adminLinks = [
    { to: '/admin', end: true, label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/admin/interns', label: 'Stajyerler', icon: <Users size={18} /> },
    { to: '/admin/departments', label: 'Departmanlar', icon: <Building2 size={18} /> },
    { to: '/admin/summaries', label: 'Günlük Özetler', icon: <BookOpenText size={18} /> },
    { to: '/admin/chat', label: 'Mesajlar', icon: <MessageSquare size={18} /> },
];

const internLinks = [
    { to: '/intern', end: true, label: 'Panelim', icon: <LayoutDashboard size={18} /> },
    { to: '/intern/tasks', label: 'Görevlerim', icon: <Briefcase size={18} /> },
    { to: '/intern/mentorship', label: 'AI Mentörüm', icon: <GraduationCap size={18} /> },
    { to: '/intern/chat', label: 'Mesajlar', icon: <MessageSquare size={18} /> },
];

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const links = user?.role === 'ADMIN' ? adminLinks : internLinks;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const { unreadCounts } = useSocketContext();
    const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

    return (
        <div className="min-h-screen bg-night">
            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-full w-64 bg-panel border-r border-white/5 flex flex-col">
                {/* Logo */}
                <div className="flex items-center gap-3 p-5 border-b border-white/5">
                    <div className="w-10 h-10 bg-brand rounded-lg flex items-center justify-center">
                        <ShieldAlert size={22} className="text-white" />
                    </div>
                    <div>
                        <div className="font-bold leading-tight">StajyerOS</div>
                        <div className="text-xs text-white/40">
                            {user?.role === 'ADMIN' ? 'Yönetici Paneli' : 'Stajyer Paneli'}
                        </div>
                    </div>
                </div>

                {/* Menü */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {links.map((link) => {
                        // Mesajlar sekmesi mi kontrol edelim
                        const isChatLink = link.to.includes('/chat');

                        return (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                end={link.end}
                                className={({ isActive }) =>
                                    `flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-colors ${
                                        isActive
                                            ? 'bg-brand/15 text-brand-light border-l-2 border-brand font-semibold'
                                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    }`
                                }
                            >
                                <div className="flex items-center gap-3">
                                    {link.icon}
                                    <span>{link.label}</span>
                                </div>

                                {/* 🔴 Eğer bu link Mesajlar ise ve okunmamış varsa rozet göster */}
                                {isChatLink && totalUnread > 0 && (
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                                        {totalUnread}
                                    </span>
                                )}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Kullanıcı + Çıkış */}
                <div className="p-3 border-t border-white/5">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-9 h-9 rounded-full bg-brand/20 text-brand-light flex items-center justify-center font-bold">
                            {user?.name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{user?.name}</div>
                            <div className="text-xs text-white/40">{user?.role}</div>
                        </div>
                        <button
                            onClick={handleLogout}
                            title="Çıkış Yap"
                            className="text-white/40 hover:text-brand-light transition-colors"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* İçerik */}
            <main className="ml-64 p-8">
                <Outlet />
            </main>
        </div>
    );
}