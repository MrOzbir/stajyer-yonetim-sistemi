import { createContext, useContext, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

function getInitialAuth() {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
        try {
            return JSON.parse(storedUser);
        } catch {
            return null;
        }
    }
    return null;
}

export function AuthProvider({ children }) {
    // ✅ setLoading kaldırıldı — artık state değişmiyor
    const [user, setUser] = useState(getInitialAuth);

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        return res.data.user;
    };

    const logout = async () => {
        try {
            if (user?.role === 'INTERN') await api.post('/auth/logout');
        } catch (err) {
            // ✅ Boş catch yerine hata loglayarak ESLint'i susturduk
            console.error('Logout API hatası (önemli değil):', err.message);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);