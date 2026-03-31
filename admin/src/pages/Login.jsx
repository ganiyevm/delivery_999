import React, { useState } from 'react';
import api from '../api/axios';
import { useT } from '../i18n';

const LANGS = [
    { code: 'uz', flag: '🇺🇿', label: "O'zbek" },
    { code: 'ru', flag: '🇷🇺', label: 'Русский' },
    { code: 'en', flag: '🇬🇧', label: 'English' },
];

export default function Login() {
    const { t, lang, changeLang } = useT();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { data } = await api.post('/auth/admin/login', { username, password });
            localStorage.setItem('admin_token', data.token);
            localStorage.setItem('admin_role', data.admin?.role || 'operator');
            localStorage.setItem('is_super_admin', data.admin?.isSuperAdmin ? '1' : '0');
            window.location.href = '/admin/';
        } catch (err) {
            setError(err.response?.data?.error || t('error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <form className="login-card" onSubmit={handleSubmit}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏥</div>
                <h1>Аптек 999</h1>
                <p style={{ marginBottom: 16 }}>{t('loginTitle')}</p>

                {/* Til tanlash */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, justifyContent: 'center' }}>
                    {LANGS.map(l => (
                        <button
                            key={l.code}
                            type="button"
                            onClick={() => changeLang(l.code)}
                            style={{
                                padding: '6px 14px', borderRadius: 20, fontSize: 13,
                                cursor: 'pointer', border: 'none',
                                background: lang === l.code ? 'var(--green)' : 'var(--card-hover)',
                                color: lang === l.code ? '#fff' : 'var(--text-secondary)',
                                fontWeight: lang === l.code ? 700 : 400,
                                transition: 'all .15s',
                            }}
                        >
                            {l.flag} {l.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                        {error}
                    </div>
                )}
                <div className="form-group">
                    <label className="form-label">{t('username')}</label>
                    <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('password')}</label>
                    <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" />
                </div>
                <button className="btn btn-primary" style={{ width: '100%', padding: 14, fontSize: 15 }} disabled={loading}>
                    {loading ? '⏳' : t('loginBtn')}
                </button>
            </form>
        </div>
    );
}
