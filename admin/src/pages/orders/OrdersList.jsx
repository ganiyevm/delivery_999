import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { useT } from '../../i18n';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay,
    isWithinInterval, parseISO,
} from 'date-fns';

/* ─── Date Range Picker ─────────────────────────────────────────── */
const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const MONTHS_UZ = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];

function DateRangePicker({ dateFrom, dateTo, onChange }) {
    const [open, setOpen]         = useState(false);
    const [viewMonth, setView]    = useState(new Date());
    const [hovered, setHovered]   = useState(null);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const from = dateFrom ? parseISO(dateFrom) : null;
    const to   = dateTo   ? parseISO(dateTo)   : null;

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 }),
        end:   endOfWeek(endOfMonth(viewMonth),     { weekStartsOn: 1 }),
    });

    const handleDay = (day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        if (!from || (from && to)) {
            onChange({ dateFrom: dayStr, dateTo: '' });
        } else {
            if (day < from) {
                onChange({ dateFrom: dayStr, dateTo: format(from, 'yyyy-MM-dd') });
            } else {
                onChange({ dateFrom: format(from, 'yyyy-MM-dd'), dateTo: dayStr });
            }
            setOpen(false);
        }
    };

    const isInRange = (day) => {
        const end = hovered || to;
        if (!from || !end) return false;
        const [a, b] = from <= end ? [from, end] : [end, from];
        return isWithinInterval(day, { start: a, end: b });
    };

    const label = () => {
        if (dateFrom && dateTo) return `${dateFrom} — ${dateTo}`;
        if (dateFrom) return `${dateFrom} dan ...`;
        return 'Sana tanlang';
    };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
                    background: open ? 'var(--card-hover)' : 'var(--card)',
                    color: (dateFrom || dateTo) ? 'var(--text)' : 'var(--text-secondary)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    fontWeight: (dateFrom || dateTo) ? 600 : 400,
                }}>
                📅 {label()}
                {(dateFrom || dateTo) && (
                    <span
                        onClick={(e) => { e.stopPropagation(); onChange({ dateFrom: '', dateTo: '' }); }}
                        style={{ marginLeft: 4, opacity: 0.6, fontWeight: 400, fontSize: 14 }}>✕</span>
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 999,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 14, padding: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                    minWidth: 290,
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <button onClick={() => setView(subMonths(viewMonth, 1))}
                            style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 18, padding: '0 6px' }}>‹</button>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                            {MONTHS_UZ[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                        </span>
                        <button onClick={() => setView(addMonths(viewMonth, 1))}
                            style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 18, padding: '0 6px' }}>›</button>
                    </div>

                    {/* Weekday labels */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                        {WEEKDAYS.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', padding: '2px 0' }}>{d}</div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                        {days.map((day, i) => {
                            const ds       = format(day, 'yyyy-MM-dd');
                            const isFrom   = from && isSameDay(day, from);
                            const isTo     = to   && isSameDay(day, to);
                            const inRange  = isInRange(day);
                            const isToday  = isSameDay(day, new Date());
                            const dimmed   = !isSameMonth(day, viewMonth);
                            const selected = isFrom || isTo;

                            return (
                                <div key={i}
                                    onClick={() => handleDay(day)}
                                    onMouseEnter={() => from && !to && setHovered(day)}
                                    onMouseLeave={() => setHovered(null)}
                                    style={{
                                        textAlign: 'center', padding: '6px 2px', borderRadius: 6,
                                        fontSize: 12, cursor: 'pointer', userSelect: 'none',
                                        fontWeight: selected ? 800 : isToday ? 700 : 400,
                                        color: selected ? '#fff' : dimmed ? 'var(--border)' : isToday ? '#10b981' : 'var(--text)',
                                        background: selected
                                            ? '#10b981'
                                            : inRange ? 'rgba(16,185,129,0.15)' : 'transparent',
                                        transition: 'background 0.15s',
                                    }}>
                                    {day.getDate()}
                                </div>
                            );
                        })}
                    </div>

                    {/* Hint */}
                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
                        {!from ? 'Boshlang\'ich sanani tanlang' : !to ? 'Tugash sanasini tanlang' : `${dateFrom} — ${dateTo}`}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function OrdersList() {
    const { t } = useT();

    const STATUS_MAP = {
        awaiting_payment: { label: t('awaiting_payment'), badge: 'badge-yellow' },
        pending_operator: { label: t('pending_operator'), badge: 'badge-orange' },
        confirmed:  { label: t('confirmed'),  badge: 'badge-blue' },
        on_the_way: { label: t('on_the_way'), badge: 'badge-blue' },
        delivered:  { label: t('delivered'),  badge: 'badge-green' },
        rejected:   { label: t('rejected'),   badge: 'badge-red' },
        cancelled:  { label: t('cancelled'),  badge: 'badge-gray' },
    };

    const PAYMENT_MAP = {
        pending:  { label: t('pending_operator'), badge: 'badge-yellow' },
        paid:     { label: `${t('paid')} ✓`,      badge: 'badge-green' },
        failed:   { label: 'Xato',                 badge: 'badge-red' },
        refunded: { label: t('refunded'),          badge: 'badge-gray' },
    };

    const [orders, setOrders] = useState([]);
    const [pagination, setPagination] = useState({});
    const [filters, setFilters] = useState({ status: '', branch: '', search: '', dateFrom: '', dateTo: '', page: 1 });
    const [branches, setBranches] = useState([]);
    const [selected, setSelected] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [statusNote, setStatusNote] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        api.get('/admin/branches').then(r => setBranches(r.data || [])).catch(() => {});
    }, []);

    const fetchOrders = (f = filters) => {
        const params = { page: f.page, limit: 20 };
        if (f.status)   params.status   = f.status;
        if (f.branch)   params.branch   = f.branch;
        if (f.search)   params.search   = f.search;
        if (f.dateFrom) params.dateFrom = f.dateFrom;
        if (f.dateTo)   params.dateTo   = f.dateTo;
        api.get('/admin/orders', { params }).then(r => {
            setOrders(r.data.orders || []);
            setPagination(r.data.pagination || {});
            setLastUpdated(new Date());
        }).catch(() => {});
    };

    useEffect(() => { fetchOrders(filters); }, [filters]);
    useEffect(() => {
        const interval = setInterval(() => fetchOrders(filters), 15000);
        return () => clearInterval(interval);
    }, [filters]);

    const changeStatus = async () => {
        if (!selected || !newStatus) return;
        try {
            await api.patch(`/admin/orders/${selected._id}/status`, { status: newStatus, note: statusNote });
            setSelected(null);
            setFilters({ ...filters });
        } catch (err) { alert(err.response?.data?.error || 'Xato'); }
    };

    return (
        <div>
            <div className="topbar">
                <h2>📦 {t('orders')}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {lastUpdated && <span style={{ fontSize: 12, color: '#888' }}>🔄 {lastUpdated.toLocaleTimeString()}</span>}
                    <button className="btn" onClick={() => fetchOrders(filters)}>↻ {t('refresh')}</button>
                    <button className="btn" onClick={async () => {
                        try {
                            const params = {};
                            if (filters.status)   params.status   = filters.status;
                            if (filters.branch)   params.branch   = filters.branch;
                            if (filters.search)   params.search   = filters.search;
                            if (filters.dateFrom) params.dateFrom = filters.dateFrom;
                            if (filters.dateTo)   params.dateTo   = filters.dateTo;
                            const res = await api.get('/admin/orders/export', { params, responseType: 'blob' });
                            const url = URL.createObjectURL(new Blob([res.data]));
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `orders_${new Date().toISOString().split('T')[0]}.xlsx`;
                            a.click();
                            URL.revokeObjectURL(url);
                        } catch { alert('Export xatosi'); }
                    }}>📥 {t('exportExcel')}</button>
                </div>
            </div>

            <div className="filters-row">
                <input className="form-input" placeholder={t('search')}
                    onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} />
                <select className="form-select" onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}>
                    <option value="">{t('allStatuses')}</option>
                    {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select className="form-select" onChange={e => setFilters({ ...filters, branch: e.target.value, page: 1 })}>
                    <option value="">{t('allBranches')}</option>
                    {branches.map(b => <option key={b._id} value={b._id}>№{String(b.number).padStart(3, '0')} {b.name}</option>)}
                </select>
                <DateRangePicker
                    dateFrom={filters.dateFrom}
                    dateTo={filters.dateTo}
                    onChange={({ dateFrom, dateTo }) =>
                        setFilters({ ...filters, dateFrom, dateTo, page: 1 })
                    }
                />
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('orderNum')}</th><th>{t('customer')}</th><th>{t('phone')}</th>
                            <th>{t('branch')}</th><th>{t('amount')}</th><th>{t('payment')}</th>
                            <th>{t('status')}</th><th>{t('date')}</th><th>{t('actions')}</th>
                        </tr>
                    </thead>
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
                                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                        <div style={{ fontWeight: 600 }}>
                                            {new Date(o.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)' }}>
                                            {new Date(o.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </div>
                                    </td>
                                    <td style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn" onClick={() => setSelected(o)}>👁</button>
                                        {o.paymentStatus === 'pending' && o.paymentMethod === 'click' && (
                                            <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 12 }}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`#${o.orderNumber}`)) return;
                                                    try {
                                                        await api.patch(`/admin/orders/${o._id}/confirm-payment`);
                                                        fetchOrders(filters);
                                                    } catch (err) { alert(err.response?.data?.error || 'Xato'); }
                                                }}>
                                                ✅ {t('paid')}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="pagination">
                    <span>{pagination.page || 1} / {pagination.pages || 1} ({pagination.total || 0})</span>
                    <div className="pagination-btns">
                        <button className="btn" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>←</button>
                        <button className="btn" disabled={filters.page >= (pagination.pages || 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>→</button>
                    </div>
                </div>
            </div>

            {selected && (
                <div className="modal-overlay" onClick={() => setSelected(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📦 #{selected.orderNumber}</h3>
                            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 2 }}>
                            <p><strong>{t('customer')}:</strong> {selected.customerName}</p>
                            <p><strong>{t('phone')}:</strong> <a href={`tel:${selected.phone}`} style={{ color: 'var(--blue-light)' }}>{selected.phone}</a></p>
                            <div style={{ marginBottom: 8 }}>
                                <strong>{t('address')}:</strong> {selected.address || '—'}
                                {selected.address && (() => {
                                    const m = selected.address.match(/([-\d.]+),\s*([-\d.]+)/);
                                    const q = m ? `${m[1]},${m[2]}` : encodeURIComponent(selected.address + ', Toshkent');
                                    return (
                                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                            <a href={m ? `https://www.google.com/maps?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noreferrer"
                                                style={{ padding: '3px 10px', borderRadius: 6, background: '#4285F4', color: 'white', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                                                🗺 Google
                                            </a>
                                            <a href={m ? `https://yandex.uz/maps/?pt=${m[2]},${m[1]}&z=17` : `https://yandex.uz/maps/?text=${q}`} target="_blank" rel="noreferrer"
                                                style={{ padding: '3px 10px', borderRadius: 6, background: '#FC3F1D', color: 'white', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                                                🧭 Yandex
                                            </a>
                                        </div>
                                    );
                                })()}
                            </div>
                            {selected.notes && (
                                <p style={{ background: 'var(--bg)', padding: '6px 10px', borderRadius: 8, borderLeft: '3px solid var(--green)' }}>
                                    <strong>{t('note')}:</strong> {selected.notes}
                                </p>
                            )}
                            <p><strong>{t('payment')}:</strong> {selected.paymentMethod} ({selected.paymentStatus})
                                {selected.paymentStatus === 'pending' && (
                                    <button className="btn btn-primary" style={{ marginLeft: 8, padding: '2px 10px', fontSize: 12 }}
                                        onClick={async () => {
                                            try {
                                                await api.patch(`/admin/orders/${selected._id}/confirm-payment`);
                                                setSelected(null); setFilters({ ...filters });
                                            } catch (err) { alert(err.response?.data?.error || 'Xato'); }
                                        }}>✅ {t('confirm')}</button>
                                )}
                            </p>
                            <p><strong>{t('total')}:</strong> {selected.total?.toLocaleString()} so'm</p>
                        </div>
                        <h4 style={{ margin: '16px 0 8px' }}>{t('products')}:</h4>
                        {selected.items?.map((item, i) => (
                            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                {item.productName} × {item.qty} — {(item.price * item.qty).toLocaleString()} so'm
                            </div>
                        ))}
                        <h4 style={{ margin: '16px 0 8px' }}>{t('status')}:</h4>
                        <div className="timeline">
                            {selected.statusHistory?.map((s, i) => (
                                <div key={i} className="timeline-item">
                                    <div className="timeline-dot" />
                                    <div className="timeline-content">
                                        <h4>{STATUS_MAP[s.status]?.label || s.status}</h4>
                                        <p>
                                            {new Date(s.changedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            {' '}
                                            {new Date(s.changedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            {' — '}{s.changedBy}{s.note ? ` (${s.note})` : ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <h4 style={{ margin: '16px 0 8px' }}>{t('changeStatus')}:</h4>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select className="form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                                <option value="">—</option>
                                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <input className="form-input" placeholder={t('statusNote')} value={statusNote} onChange={e => setStatusNote(e.target.value)} style={{ flex: 1 }} />
                            <button className="btn btn-primary" onClick={changeStatus}>✓</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
