import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api/index';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const doAuth = useCallback(async () => {
        setLoading(true);
        setError(null);

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
            setError(err.response?.data?.error || err.message || 'Autentifikatsiya xatosi');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        doAuth();
    }, [doAuth]);

    const updateUser = (updates) => {
        const updated = { ...user, ...updates };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, error, retryAuth: doAuth, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
