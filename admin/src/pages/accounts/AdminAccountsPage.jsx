import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useT } from '../../i18n';

const ROLES = [
    { value: 'admin',      label: 'Admin — hamma narsa (user boshqarish yo\'q)' },
    { value: 'operator',   label: 'Operator — faqat buyurtmalar' },
    { value: 'pharmacist', label: 'Farmatsevt — mahsulotlar, import, filiallar' },
    { value: 'analyst',    label: 'Analyst — faqat dashboard (o\'qish)' },
];

const ROLE_BADGE = {
    super_admin: { label: 'Super Admin', color: '#9B59B6' },
    admin:       { label: 'Admin',       color: '#3498DB' },
    operator:    { label: 'Operator',    color: '#E67E22' },
    pharmacist:  { label: 'Farmatsevt',  color: '#27AE60' },
    analyst:     { label: 'Analyst',     color: '#7F8C8D' },
};

const empty = { username: '', password: '', role: 'operator', fullName: '' };

export default function AdminAccountsPage() {
    const { t } = useT();
    const [accounts, setAccounts] = useState([]);
    const [form, setForm] = useState(empty);
    const [editing, setEditing] = useState(null); // account _id
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = () => api.get('/admin/accounts').then(r => setAccounts(r.data || [])).catch(() => {});

    useEffect(() => { load(); }, []);

    const openNew = () => { setForm(empty); setEditing(null); setError(''); setShowForm(true); };
    const openEdit = (acc) => {
        setForm({ username: acc.username, password: '', role: acc.role, fullName: acc.fullName || '' });
        setEditing(acc._id);
        setError('');
        setShowForm(true);
    };

    const handleSave = async () => {
        setError('');
        if (!form.username || (!editing && !form.password)) {
            setError('Login va parol majburiy');
            return;
        }
        setLoading(true);
        try {
            const body = { role: form.role, fullName: form.fullName };
            if (!editing) { body.username = form.username; body.password = form.password; }
            if (form.password) body.password = form.password;

            if (editing) await api.put(`/admin/accounts/${editing}`, body);
            else await api.post('/admin/accounts', { ...body, username: form.username });

            setShowForm(false);
            load();
        } catch (err) {
            setError(err.response?.data?.error || 'Xato');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (acc) => {
        await api.put(`/admin/accounts/${acc._id}`, { isActive: !acc.isActive });
        load();
    };

    const handleDelete = async (acc) => {
        if (!confirm(`"${acc.username}" ni o'chirasizmi?`)) return;
        try {
            await api.delete(`/admin/accounts/${acc._id}`);
            load();
        } catch (err) { alert(err.response?.data?.error || 'Xato'); }
    };

    return (
        <div>
            <div className="topbar">
                <h2>🔑 {t('accounts')}</h2>
                <button className="btn btn-primary" onClick={openNew}>+ {t('addAccount')}</button>
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr><th>Login</th><th>{t('fullName')}</th><th>{t('role')}</th><th>{t('status')}</th><th>{t('lastLogin')}</th><th>{t('actions')}</th></tr>
                    </thead>
                    <tbody>
                        {accounts.map(acc => {
                            const rb = ROLE_BADGE[acc.role] || {};
                            return (
                                <tr key={acc._id} style={{ opacity: acc.isActive ? 1 : 0.5 }}>
                                    <td style={{ fontWeight: 700 }}>{acc.username}</td>
                                    <td>{acc.fullName || '—'}</td>
                                    <td>
                                        <span style={{ background: rb.color + '22', color: rb.color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                            {t(acc.role)}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ color: acc.isActive ? '#27AE60' : '#e74c3c', fontWeight: 600, fontSize: 12 }}>
                                            {acc.isActive ? `● ${t('active')}` : `● ${t('inactive')}`}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        {acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleString() : '—'}
                                    </td>
                                    <td style={{ display: 'flex', gap: 4 }}>
                                        {acc.role !== 'super_admin' && (<>
                                            <button className="btn" onClick={() => openEdit(acc)}>✏️</button>
                                            <button className="btn" onClick={() => handleToggle(acc)}
                                                title={acc.isActive ? 'Bloklash' : 'Faollashtirish'}>
                                                {acc.isActive ? '🔒' : '🔓'}
                                            </button>
                                            <button className="btn" style={{ color: '#e74c3c' }} onClick={() => handleDelete(acc)}>🗑</button>
                                        </>)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editing ? `✏️ ${t('editAccount')}` : `+ ${t('addAccount')}`}</h3>
                            <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        {error && <div style={{ color: '#e74c3c', marginBottom: 12, fontSize: 13 }}>❌ {error}</div>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {!editing && (
                                <div className="form-group">
                                    <label className="form-label">Login *</label>
                                    <input className="form-input" value={form.username}
                                        onChange={e => setForm({ ...form, username: e.target.value })}
                                        placeholder="operator1" autoComplete="off" />
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">{t('fullName')}</label>
                                <input className="form-input" value={form.fullName}
                                    onChange={e => setForm({ ...form, fullName: e.target.value })}
                                    placeholder="Abdullayev Sardor" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{editing ? t('newPassword') : `${t('password')} *`}</label>
                                <input className="form-input" type="password" value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    placeholder="••••••" autoComplete="new-password" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('role')} *</label>
                                <select className="form-input" value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}>
                                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>
                            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                                {loading ? '⏳' : (editing ? t('save') : t('add'))}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
