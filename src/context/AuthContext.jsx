import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, setAuthToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('productify_token');
        if (!token) {
            setLoading(false);
            return;
        }
        getMe()
            .then(u => setUser(u))
            .catch(() => setAuthToken(null))
            .finally(() => setLoading(false));
    }, []);

    const logout = () => {
        setAuthToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
