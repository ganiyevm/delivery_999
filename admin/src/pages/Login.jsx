import React, { useState } from 'react';
import api from '../api/axios';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { data } = await api.post('/auth/admin/login', { username, password });
            localStorage.setItem('admin_token', data.token);
            localStorage.setItem('is_super_admin', data.admin?.isSuperAdmin ? '1' : '0');
            window.location.href = '/admin/';
        } catch (err) {
            setError(err.response?.data?.error || 'Xatolik');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <form className="login-card" onSubmit={handleSubmit}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏥</div>
                <h1>Аптек 999</h1>
                <p>Admin paneliga kirish</p>
                {error && <div style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
                <div className="form-group">
                    <label className="form-label">Login</label>
                    <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" />
                </div>
                <div className="form-group">
                    <label className="form-label">Parol</label>
                    <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" />
                </div>
                <button className="btn btn-primary" style={{ width: '100%', padding: 14, fontSize: 15 }} disabled={loading}>
                    {loading ? '⏳' : 'Kirish'}
                </button>
            </form>
        </div>
    );
}
