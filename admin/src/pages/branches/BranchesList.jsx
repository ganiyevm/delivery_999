import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

const YANDEX_KEY = 'b282d82a-e502-4d33-acb3-d5bd433af913';

const emptyForm = { name: '', address: '', phone: '', hours: '09:00 — 22:00', operatorChatId: '', operatorIds: '', courierIds: '', lat: '', lng: '' };

export default function BranchesList() {
    const [branches, setBranches] = useState([]);
    const [editing, setEditing] = useState(null);   // branch obj yoki 'new'
    const [form, setForm] = useState({});
    const [newNumber, setNewNumber] = useState('');
    const [geoLoading, setGeoLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const role = localStorage.getItem('admin_role') || 'operator';
    const canManage = role === 'super_admin' || role === 'admin';

    const load = () => api.get('/admin/branches').then(r => setBranches(r.data || [])).catch(() => {});
    useEffect(() => { load(); }, []);

    const handleToggle = async (id) => {
        await api.patch(`/admin/branches/${id}/toggle`);
        load();
    };

    const openEdit = (b) => {
        setForm({
            name: b.name || '', address: b.address || '', phone: b.phone || '',
            hours: b.hours || '09:00 — 22:00',
            operatorChatId: b.operatorChatId || '',
            operatorIds: (b.operatorIds || []).join(', '),
            courierIds: (b.courierIds || []).join(', '),
            lat: b.location?.lat || '', lng: b.location?.lng || '',
        });
        setEditing(b);
    };

    const openNew = () => {
        setForm(emptyForm);
        setNewNumber('');
        setEditing('new');
    };

    // Manzildan koordinata olish (Yandex Geocoder)
    const geocodeAddress = async () => {
        const addr = form.address;
        if (!addr) return alert('Avval manzil kiriting');
        setGeoLoading(true);
        try {
            const res = await fetch(
                `https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_KEY}&geocode=${encodeURIComponent(addr + ', Toshkent')}&format=json&results=1`
            );
            const data = await res.json();
            const pos = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
            if (pos) {
                const [lng, lat] = pos.split(' ');
                setForm(f => ({ ...f, lat: parseFloat(lat).toFixed(6), lng: parseFloat(lng).toFixed(6) }));
            } else {
                alert('Manzil topilmadi, koordinatalarni qo\'lda kiriting');
            }
        } catch { alert('Geocoder xatosi'); }
        finally { setGeoLoading(false); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const body = {
                name: form.name, address: form.address, phone: form.phone,
                hours: form.hours, operatorChatId: form.operatorChatId || null,
                operatorIds: form.operatorIds ? form.operatorIds.split(',').map(x => parseInt(x.trim())).filter(Boolean) : [],
                courierIds: form.courierIds ? form.courierIds.split(',').map(x => parseInt(x.trim())).filter(Boolean) : [],
                location: { lat: parseFloat(form.lat) || 0, lng: parseFloat(form.lng) || 0 },
            };
            if (editing === 'new') {
                await api.post('/admin/branches', { ...body, number: parseInt(newNumber) });
            } else {
                await api.put(`/admin/branches/${editing._id}`, body);
            }
            setEditing(null);
            load();
        } catch (err) { alert(err.response?.data?.error || 'Xato'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (b) => {
        if (!confirm(`№${b.number} "${b.name}" filialni o'chirasizmi?\nBu filialdagi barcha stock ma'lumotlari ham o'chishi mumkin.`)) return;
        try {
            await api.delete(`/admin/branches/${b._id}`);
            load();
        } catch (err) { alert(err.response?.data?.error || 'Xato'); }
    };

    const mapUrl = (lat, lng) => lat && lng
        ? `https://www.google.com/maps?q=${lat},${lng}`
        : null;

    return (
        <div>
            <div className="topbar">
                <h2>🏥 Filiallar ({branches.length})</h2>
                {canManage && <button className="btn btn-primary" onClick={openNew}>+ Filial qo'shish</button>}
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr><th>№</th><th>Nomi</th><th>Manzil</th><th>Tel</th><th>Koordinata</th><th>Holat</th><th>Amallar</th></tr>
                    </thead>
                    <tbody>
                        {branches.map(b => (
                            <tr key={b._id}>
                                <td>№{String(b.number).padStart(3, '0')}</td>
                                <td style={{ fontWeight: 600 }}>{b.name}</td>
                                <td style={{ fontSize: 12 }}>{b.address || '—'}</td>
                                <td>{b.phone || '—'}</td>
                                <td style={{ fontSize: 11 }}>
                                    {b.location?.lat && b.location?.lng && b.location.lat !== 0 ? (
                                        <a href={mapUrl(b.location.lat, b.location.lng)} target="_blank" rel="noreferrer"
                                            style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                            📍 {b.location.lat.toFixed(4)}, {b.location.lng.toFixed(4)}
                                        </a>
                                    ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                                </td>
                                <td><span className={`badge ${b.isOpen ? 'badge-green' : 'badge-red'}`}>{b.isOpen ? 'Ochiq' : 'Yopiq'}</span></td>
                                <td style={{ display: 'flex', gap: 4 }}>
                                    <button className="btn" onClick={() => openEdit(b)}>✏️</button>
                                    <button className="btn" onClick={() => handleToggle(b._id)}>{b.isOpen ? '🔴' : '🟢'}</button>
                                    {canManage && (
                                        <button className="btn" style={{ color: '#e74c3c' }} onClick={() => handleDelete(b)}>🗑</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editing && (
                <div className="modal-overlay" onClick={() => setEditing(null)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editing === 'new' ? '+ Yangi filial' : `✏️ №${String(editing.number).padStart(3, '0')} ${editing.name}`}</h3>
                            <button className="modal-close" onClick={() => setEditing(null)}>✕</button>
                        </div>

                        {editing === 'new' && (
                            <div className="form-group">
                                <label className="form-label">Filial raqami *</label>
                                <input className="form-input" type="number" value={newNumber} onChange={e => setNewNumber(e.target.value)} placeholder="21" />
                            </div>
                        )}
                        <div className="form-group"><label className="form-label">Nomi *</label><input className="form-input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Manzil</label><input className="form-input" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Ko'cha, uy raqami, tuman" /></div>
                        <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Ish vaqti</label><input className="form-input" value={form.hours || ''} onChange={e => setForm({ ...form, hours: e.target.value })} /></div>

                        {/* Geolokatsiya */}
                        <div className="form-group">
                            <label className="form-label">📍 Geolokatsiya (koordinatalar)</label>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                <input className="form-input" value={form.lat || ''} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="Kenglik: 41.3135" style={{ flex: 1 }} />
                                <input className="form-input" value={form.lng || ''} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="Uzunlik: 69.3537" style={{ flex: 1 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn" onClick={geocodeAddress} disabled={geoLoading} style={{ fontSize: 12 }}>
                                    {geoLoading ? '⏳' : '🔍 Manzildan topish'}
                                </button>
                                {form.lat && form.lng && (
                                    <>
                                        <a href={`https://www.google.com/maps?q=${form.lat},${form.lng}`} target="_blank" rel="noreferrer"
                                            className="btn" style={{ fontSize: 12, textDecoration: 'none' }}>🗺 Google</a>
                                        <a href={`https://yandex.uz/maps/?pt=${form.lng},${form.lat}&z=17`} target="_blank" rel="noreferrer"
                                            className="btn" style={{ fontSize: 12, textDecoration: 'none' }}>🧭 Yandex</a>
                                    </>
                                )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                                Manzil kiriting va "Manzildan topish" ni bosing — koordinatalar avtomatik to'ldiriladi
                            </div>
                        </div>

                        <div className="form-group"><label className="form-label">Operator Chat ID (Telegram)</label><input className="form-input" value={form.operatorChatId || ''} onChange={e => setForm({ ...form, operatorChatId: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Operator IDs (vergul bilan)</label><input className="form-input" value={form.operatorIds || ''} onChange={e => setForm({ ...form, operatorIds: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Kuryer IDs (vergul bilan)</label><input className="form-input" value={form.courierIds || ''} onChange={e => setForm({ ...form, courierIds: e.target.value })} /></div>

                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave} disabled={saving}>
                            {saving ? '⏳ Saqlanmoqda...' : 'Saqlash'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
