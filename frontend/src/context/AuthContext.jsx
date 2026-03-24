import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/index';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            const tg = window.Telegram?.WebApp;

            // Telegram ga darhol "tayyor" signalini yuborish (spinner o'chishi uchun)
            if (tg) {
                tg.ready();
                tg.expand();
            }

            try {
                if (tg?.initData) {
                    // Telegram WebApp rejimi
                    const { data } = await authAPI.telegramAuth(tg.initData);
                    setToken(data.token);
                    setUser(data.user);
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                } else {
                    // Development mode
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
