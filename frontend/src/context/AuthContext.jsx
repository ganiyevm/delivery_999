import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/index';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            try {
                // Telegram WebApp initData yordamida autentifikatsiya
                const tg = window.Telegram?.WebApp;
                if (tg?.initData) {
                    const { data } = await authAPI.telegramAuth(tg.initData);
                    setToken(data.token);
                    setUser(data.user);
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    tg.ready();
                    tg.expand();
                } else {
                    // Development mode — har doim yangi dev token olish
                    const { data } = await authAPI.devLogin();
                    setToken(data.token);
                    setUser(data.user);
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                }
            } catch (err) {
                console.error('Auth error:', err);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, []);

    const updateUser = (updates) => {
        const updated = { ...user, ...updates };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
