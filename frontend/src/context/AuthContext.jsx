import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../api/index';

const AuthContext = createContext(null);

function isPaymentReturn() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param
        || params.get('tgWebAppStartParam')
        || '';
    return Boolean(params.get('pay') || /^pay_[a-f\d]{24}(?:_.+)?$/i.test(startParam) || localStorage.getItem('pendingPaymentOrderId'));
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const retryTimer = useRef(null);

    const doAuth = useCallback(async () => {
        setLoading(true);
        setError(null);

        const tg = window.Telegram?.WebApp;

        if (tg) {
            tg.ready();
            tg.expand();
        }

        try {
            if (tg?.initData) {
                const { data } = await authAPI.telegramAuth(tg.initData);
                setToken(data.token);
                setUser(data.user);
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            } else if (isPaymentReturn()) {
                // Click/Payme tashqi brauzerdan qaytganda Telegram initData bo'lmaydi.
                // Payment sahifasi public status endpointlari bilan o'zi tekshiradi.
                const savedUser = localStorage.getItem('user');
                if (savedUser) {
                    try { setUser(JSON.parse(savedUser)); } catch (_) {}
                }
            } else {
                const { data } = await authAPI.devLogin();
                setToken(data.token);
                setUser(data.user);
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            // Muvaffaqiyatli — retry timerni bekor qilish
            if (retryTimer.current) clearTimeout(retryTimer.current);
        } catch (err) {
            console.error('Auth error:', err);
            const errMsg = err.response?.data?.error || err.message || 'Autentifikatsiya xatosi';
            setError(errMsg);

            // Eski token hali localStorage da bo'lishi mumkin — foydalanishga harakat
            const savedToken = localStorage.getItem('token');
            if (savedToken) {
                setToken(savedToken);
                const savedUser = localStorage.getItem('user');
                if (savedUser) {
                    try { setUser(JSON.parse(savedUser)); } catch (_) {}
                }
            }

            // 5 soniyadan keyin avtomatik qayta urinish (tarmoq muammosi bo'lishi mumkin)
            retryTimer.current = setTimeout(() => {
                doAuth();
            }, 5000);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        doAuth();
        return () => { if (retryTimer.current) clearTimeout(retryTimer.current); };
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
