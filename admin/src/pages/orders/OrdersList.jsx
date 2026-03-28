import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

const STATUS_MAP = {
    awaiting_payment: { label: 'To\'lov kutilmoqda', badge: 'badge-yellow' },
    pending_operator: { label: 'Tekshirilmoqda', badge: 'badge-orange' },
    confirmed: { label: 'Tasdiqlandi', badge: 'badge-blue' },
    on_the_way: { label: 'Yo\'lda', badge: 'badge-blue' },
    delivered: { label: 'Yetkazildi', badge: 'badge-green' },
    rejected: { label: 'Rad etildi', badge: 'badge-red' },
    cancelled: { label: 'Bekor qilindi', badge: 'badge-gray' },
};

const PAYMENT_MAP = {
    pending:  { label: 'Kutilmoqda', badge: 'badge-yellow' },
    paid:     { label: 'To\'landi ✓', badge: 'badge-green' },
    failed:   { label: 'Xato', badge: 'badge-red' },
    refunded: { label: 'Qaytarildi', badge: 'badge-gray' },
};

export default function OrdersList() {
    const [orders, setOrders] = useState([]);
    const [pagination, setPagination] = useState({});
    const [filters, setFilters] = useState({ status: '', branch: '', search: '', page: 1 });
    const [branches, setBranches] = useState([]);
    const [selected, setSelected] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [statusNote, setStatusNote] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        api.get('/admin/branches').then(r => setBranches(r.data || [])).catch(() => { });
    }, []);

    const fetchOrders = (f = filters) => {
        const params = { page: f.page, limit: 20 };
        if (f.status) params.status = f.status;
        if (f.branch) params.branch = f.branch;
        if (f.search) params.search = f.search;
        api.get('/admin/orders', { params }).then(r => {
            setOrders(r.data.orders || []);
            setPagination(r.data.pagination || {});
            setLastUpdated(new Date());
        }).catch(() => { });
    };

    useEffect(() => {
        fetchOrders(filters);
    }, [filters]);

    // Har 15 sekundda avtomatik yangilash — Click to'lovlarini real-time ko'rish uchun
    useEffect(() => {
        const interval = setInterval(() => fetchOrders(filters), 15000);
        return () => clearInterval(interval);
    }, [filters]);

    const changeStatus = async () => {
        if (!selected || !newStatus) return;
        try {
            await api.patch(`/admin/orders/${selected._id}/status`, { status: newStatus, note: statusNote });
            setSelected(null);
            setFilters({ ...filters }); // refresh
        } catch (err) { alert(err.response?.data?.error || 'Xato'); }
    };

    return (
        <div>
            <div className="topbar">
                <h2>📦 Buyurtmalar</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {lastUpdated && (
                        <span style={{ fontSize: 12, color: '#888' }}>
                            🔄 {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <button className="btn" onClick={() => fetchOrders(filters)}>↻ Yangilash</button>
                    <button className="btn" onClick={() => window.open('/api/admin/orders/export', '_blank')}>📥 Excel</button>
                </div>
            </div>

            <div className="filters-row">
                <input className="form-input" placeholder="Qidirish..." onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} />
                <select className="form-select" onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}>
                    <option value="">Barcha statuslar</option>
                    {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select className="form-select" onChange={e => setFilters({ ...filters, branch: e.target.value, page: 1 })}>
                    <option value="">Barcha filiallar</option>
                    {branches.map(b => <option key={b._id} value={b._id}>№{String(b.number).padStart(3, '0')} {b.name}</option>)}
                </select>
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead><tr><th>Order#</th><th>Mijoz</th><th>Tel</th><th>Filial</th><th>Summa</th><th>To'lov</th><th>Status</th><th>Sana</th><th>Amal</th></tr></thead>
                    <tbody>
                        {orders.map(o => {
                            const sm = STATUS_MAP[o.status] || {};
                            const pm = PAYMENT_MAP[o.paymentStatus] || {};
                            return (
                                <tr key={o._id}>
                                    <td style={{ fontWeight: 700 }}>#{o.orderNumber}</td>
                                    <td>{o.customerName}</td>
                                    <td>{o.phone}</td>
                                    <td>{o.branch?.name || '—'}</td>
                                    <td>{o.total?.toLocaleString()}</td>
                                    <td><span className={`badge ${pm.badge}`}>{pm.label}</span></td>
                                    <td><span className={`badge ${sm.badge}`}>{sm.label}</span></td>
                                    <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                                    <td style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn" onClick={() => setSelected(o)}>👁</button>
                                        {o.paymentStatus === 'pending' && o.paymentMethod === 'click' && (
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '4px 8px', fontSize: 12 }}
                                                title="Click to'lovini tasdiqlash"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`#${o.orderNumber} — to'lovni tasdiqlaysizmi?`)) return;
                                                    try {
                                                        await api.patch(`/admin/orders/${o._id}/confirm-payment`);
                                                        fetchOrders(filters);
                                                    } catch (err) { alert(err.response?.data?.error || 'Xato'); }
                                                }}>
                                                ✅ To'landi
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="pagination">
                    <span>Sahifa {pagination.page || 1} / {pagination.pages || 1} ({pagination.total || 0})</span>
                    <div className="pagination-btns">
                        <button className="btn" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>←</button>
                        <button className="btn" disabled={filters.page >= (pagination.pages || 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>→</button>
                    </div>
                </div>
            </div>

            {/* Order Detail Modal */}
            {selected && (
                <div className="modal-overlay" onClick={() => setSelected(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📦 #{selected.orderNumber}</h3>
                            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 2 }}>
                            <p><strong>Mijoz:</strong> {selected.customerName}</p>
                            <p><strong>Tel:</strong> <a href={`tel:${selected.phone}`} style={{ color: 'var(--primary)' }}>{selected.phone}</a></p>

                            {/* Manzil + xarita tugmalari */}
                            <div style={{ marginBottom: 8 }}>
                                <strong>Manzil:</strong> {selected.address || '—'}
                                {selected.address && (() => {
                                    const coordMatch = selected.address.match(/([-\d.]+),\s*([-\d.]+)/);
                                    const q = coordMatch
                                        ? `${coordMatch[1]},${coordMatch[2]}`
                                        : encodeURIComponent(selected.address + ', Toshkent');
                                    const googleUrl = coordMatch
                                        ? `https://www.google.com/maps?q=${q}`
                                        : `https://www.google.com/maps/search/?api=1&query=${q}`;
                                    const yandexUrl = coordMatch
                                        ? `https://yandex.uz/maps/?pt=${coordMatch[2]},${coordMatch[1]}&z=17`
                                        : `https://yandex.uz/maps/?text=${q}`;
                                    return (
                                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                            <a href={googleUrl} target="_blank" rel="noreferrer"
                                                style={{ padding: '3px 10px', borderRadius: 6, background: '#4285F4', color: 'white', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                                                🗺 Google
                                            </a>
                                            <a href={yandexUrl} target="_blank" rel="noreferrer"
                                                style={{ padding: '3px 10px', borderRadius: 6, background: '#FC3F1D', color: 'white', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                                                🧭 Yandex
                                            </a>
                                        </div>
                                    );
                                })()}
                            </div>

                            {selected.notes && (
                                <p style={{ background: 'var(--bg)', padding: '6px 10px', borderRadius: 8, borderLeft: '3px solid var(--primary)' }}>
                                    <strong>Izoh:</strong> {selected.notes}
                                </p>
                            )}

                            <p><strong>To'lov:</strong> {selected.paymentMethod} ({selected.paymentStatus})
                            {selected.paymentStatus === 'pending' && (
                                <button className="btn btn-primary" style={{ marginLeft: 8, padding: '2px 10px', fontSize: 12 }}
                                    onClick={async () => {
                                        try {
                                            await api.patch(`/admin/orders/${selected._id}/confirm-payment`);
                                            alert("To'lov tasdiqlandi!");
                                            setSelected(null);
                                            setFilters({ ...filters });
                                        } catch (err) { alert(err.response?.data?.error || 'Xato'); }
                                    }}>
                                    ✅ Tasdiqlash
                                </button>
                            )}
                        </p>
                            <p><strong>Summa:</strong> {selected.total?.toLocaleString()} сўм</p>
                        </div>
                        <h4 style={{ margin: '16px 0 8px' }}>Dorilar:</h4>
                        {selected.items?.map((item, i) => (
                            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                {item.productName} × {item.qty} — {(item.price * item.qty).toLocaleString()} сўм
                            </div>
                        ))}
                        <h4 style={{ margin: '16px 0 8px' }}>Status tarixi:</h4>
                        <div className="timeline">
                            {selected.statusHistory?.map((s, i) => (
                                <div key={i} className="timeline-item">
                                    <div className="timeline-dot" />
                                    <div className="timeline-content">
                                        <h4>{STATUS_MAP[s.status]?.label || s.status}</h4>
                                        <p>{new Date(s.changedAt).toLocaleString()} — {s.changedBy} {s.note ? `(${s.note})` : ''}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <h4 style={{ margin: '16px 0 8px' }}>Status o'zgartirish:</h4>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select className="form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                                <option value="">Tanlang</option>
                                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <input className="form-input" placeholder="Izoh" value={statusNote} onChange={e => setStatusNote(e.target.value)} style={{ flex: 1 }} />
                            <button className="btn btn-primary" onClick={changeStatus}>✓</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
