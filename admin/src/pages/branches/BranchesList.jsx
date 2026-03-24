import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function BranchesList() {
    const [branches, setBranches] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({});

    const load = () => api.get('/admin/branches').then(r => setBranches(r.data || [])).catch(() => { });

    useEffect(() => { load(); }, []);

    const handleToggle = async (id) => {
        await api.patch(`/admin/branches/${id}/toggle`);
        load();
    };

    const handleSave = async () => {
        if (!editing) return;
        await api.put(`/admin/branches/${editing._id}`, form);
        setEditing(null);
        load();
    };

    const openEdit = (b) => {
        setForm({ name: b.name, address: b.address, phone: b.phone, hours: b.hours, operatorChatId: b.operatorChatId || '', operatorIds: (b.operatorIds || []).join(', '), courierIds: (b.courierIds || []).join(', ') });
        setEditing(b);
    };

    return (
        <div>
            <div className="topbar"><h2>🏥 Filiallar</h2></div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead><tr><th>№</th><th>Nomi</th><th>Manzil</th><th>Tel</th><th>Vaqt</th><th>Holat</th><th>Amallar</th></tr></thead>
                    <tbody>
                        {branches.map(b => (
                            <tr key={b._id}>
                                <td>№{String(b.number).padStart(3, '0')}</td>
                                <td style={{ fontWeight: 600 }}>{b.name}</td>
                                <td style={{ fontSize: 12 }}>{b.address || '—'}</td>
                                <td>{b.phone || '—'}</td>
                                <td>{b.hours || '—'}</td>
                                <td><span className={`badge ${b.isOpen ? 'badge-green' : 'badge-red'}`}>{b.isOpen ? 'Ochiq' : 'Yopiq'}</span></td>
                                <td style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn" onClick={() => openEdit(b)}>✏️</button>
                                    <button className="btn" onClick={() => handleToggle(b._id)}>{b.isOpen ? '🔴' : '🟢'}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editing && (
                <div className="modal-overlay" onClick={() => setEditing(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>✏️ №{String(editing.number).padStart(3, '0')} {editing.name}</h3><button className="modal-close" onClick={() => setEditing(null)}>✕</button></div>
                        <div className="form-group"><label className="form-label">Nomi</label><input className="form-input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Manzil</label><input className="form-input" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Ish vaqti</label><input className="form-input" value={form.hours || ''} onChange={e => setForm({ ...form, hours: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Operator Chat ID (Telegram)</label><input className="form-input" value={form.operatorChatId || ''} onChange={e => setForm({ ...form, operatorChatId: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Operator IDs (vergul bilan)</label><input className="form-input" value={form.operatorIds || ''} onChange={e => setForm({ ...form, operatorIds: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Kuryer IDs (vergul bilan)</label><input className="form-input" value={form.courierIds || ''} onChange={e => setForm({ ...form, courierIds: e.target.value })} /></div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave}>Saqlash</button>
                    </div>
                </div>
            )}
        </div>
    );
}
