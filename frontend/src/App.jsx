import AiChat from './pages/intern/AiChat';
import Chat from './pages/Chat';
import Tasks from './pages/intern/Tasks';
import Departments from './pages/admin/Departments';
import Interns from './pages/admin/Interns';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import InternDashboard from './pages/intern/Dashboard';

// 🆕 Giriş yapmış kullanıcı /login'e gelirse panele yönlendir
function LoginRoute() {
    const { user } = useAuth();
    if (user) {
        return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/intern'} replace />;
    }
    return <Login />;
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginRoute />} />

                    {/* Admin Bölgesi */}
                    <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                        <Route path="/admin" element={<Layout />}>
                            <Route index element={<AdminDashboard />} />
                            <Route path="interns" element={<Interns />} />
                            <Route path="departments" element={<Departments />} />
                            <Route path="chat" element={<Chat />} />  {/* ✅ ComingSoon yerine */}
                        </Route>
                    </Route>

                    {/* Stajyer Bölgesi */}
                    <Route element={<ProtectedRoute roles={['INTERN']} />}>
                        <Route path="/intern" element={<Layout />}>
                            <Route index element={<InternDashboard />} />
                            <Route path="tasks" element={<Tasks />} />
                            <Route path="mentorship" element={<AiChat />} /> 
                            <Route path="chat" element={<Chat />} />
                        </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}