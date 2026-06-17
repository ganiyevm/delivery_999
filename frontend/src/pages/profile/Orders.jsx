import { useState, useEffect, useRef, useCallback } from 'react';
import { ordersAPI } from '../../api/index';
import { useT } from '../../i18n';

// To'lov tugmasi — Kaspi/Wildberries uslubida:
// 1) To'lov sahifasi tashqi brauzerda ochiladi
// 2) Ilova "Kutilmoqda..." ko'rsatadi va fon rejimida status tekshiradi
// 3) To'lov kelganda avtomatik "✅" chiqadi (onSuccess chaqiriladi)
function PayButton({ order, t, onSuccess }) {
    const [phase, setPhase] = useState('idle'); // idle | opening | waiting | error
    const pollRef = useRef(null);
    const tg = window.Telegram?.WebApp;

    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, []);

    // To'lov kelgan-kelmaganini tekshirish
    const checkStatus = useCallback(async () => {
        try {
            const { data } = await ordersAPI.getById(order._id);
            if (data.status === 'confirmed' || data.paymentStatus === 'paid') {
                stopPolling();
                onSuccess?.();
            }
        } catch (_) {}
    }, [order._id, stopPolling, onSuccess]);

    // Mini-app qayta faollashganda (foydalanuvchi to'lashdan qaytdi) — darhol tekshirish
    useEffect(() => {
        if (phase !== 'waiting') return;

        // Polling har 5 soniyada
        pollRef.current = setInterval(checkStatus, 5000);

        // Telegram mini-app: foydalanuvchi qaytganda voqea
        const onActivated = () => checkStatus();
        tg?.onEvent?.('activated', onActivated);

        // Brauzer: tab/oyna qayta fokusga kelganda
        const onVisible = () => { if (document.visibilityState === 'visible') checkStatus(); };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            stopPolling();
            tg?.offEvent?.('activated', onActivated);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [phase, checkStatus, stopPolling, tg]);

    useEffect(() => () => stopPolling(), [stopPolling]);

    const handlePay = async () => {
        setPhase('opening');
        try {
            const { data } = await ordersAPI.getPaymentUrl(order._id);
            if (!data.paymentUrl) {
                alert('To\'lov havolasi yaratilmadi. Buyurtma holati: ' + order.status);
                setPhase('idle');
                return;
            }

            // Click/Payme bare WEBAPP_URL ga qaytaradi — qaytib kelganda
            // App.jsx Payment sahifasini tiklashi uchun belgilab qo'yamiz.
            localStorage.setItem('pendingPaymentOrderId', order._id);

            // Tashqi brauzerda ochish
            if (tg?.openLink) {
                tg.openLink(data.paymentUrl, { try_instant_view: false });
            } else {
                window.open(data.paymentUrl, '_blank');
            }

            setPhase('waiting');
        } catch (err) {
            const msg = err?.response?.data?.error || err?.message || 'Noma\'lum xato';
            alert('To\'lov xatosi: ' + msg);
            setPhase('idle');
        }
    };

    if (phase === 'waiting') {
        return (
            <div style={{ marginTop: 12, padding: '16px', borderRadius: 14, background: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>
                    <span style={{ display: 'inline-block', animation: 'spin 1.2s linear infinite' }}>⏳</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>To'lov kutilmoqda...</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    To'lashni tugatib, ilovaga qayting — avtomatik tasdiqlanadi
                </div>
                <button onClick={handlePay} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', color: 'var(--text)' }}>
                    🔄 To'lov havolasini qayta ochish
                </button>
            </div>
        );
    }

    return (
        <button onClick={handlePay} disabled={phase === 'opening'} style={{
            width: '100%', marginTop: 12, padding: '14px', borderRadius: 14,
            background: phase === 'error' ? 'var(--red, #e74c3c)' : 'var(--green)',
            color: 'white', border: 'none', fontWeight: 700, fontSize: 15,
            cursor: phase === 'opening' ? 'default' : 'pointer',
            boxShadow: '0 4px 15px rgba(39,174,96,0.3)',
            opacity: phase === 'opening' ? 0.75 : 1,
            transition: 'opacity .2s',
        }}>
            {phase === 'opening' ? '⏳ Ochilmoqda...'
            : phase === 'error'   ? '⚠️ Qayta urinish'
            : `💳 To'lash — ${order.total?.toLocaleString()} ${t('currency')}`}
        </button>
    );
}

const STATUS_KEYS = ['awaiting_payment', 'pending_operator', 'confirmed', 'on_the_way', 'delivered', 'rejected', 'cancelled'];
const STATUS_ICONS = {
    awaiting_payment: '⏳', pending_operator: '🔄', confirmed: '✅',
    on_the_way: '🚗', delivered: '✅', rejected: '❌', cancelled: '❌',
};
const STATUS_COLORS = {
    awaiting_payment: { color: '#f39c12', bg: 'rgba(243,156,18,0.12)' },
    pending_operator: { color: '#3498db', bg: 'rgba(52,152,219,0.12)' },
    confirmed:        { color: '#27ae60', bg: 'rgba(39,174,96,0.12)' },
    on_the_way:       { color: '#9b59b6', bg: 'rgba(155,89,182,0.12)' },
    delivered:        { color: '#27ae60', bg: 'rgba(39,174,96,0.12)' },
    rejected:         { color: '#e74c3c', bg: 'rgba(231,76,60,0.12)' },
    cancelled:        { color: '#e74c3c', bg: 'rgba(231,76,60,0.12)' },
};
const PAY_ICONS = { cash: '💵', card: '💳', payme: '💳', click: '💳', uzum: '💳' };

function StatusBadge({ status, t }) {
    const c = STATUS_COLORS[status] || { color: '#999', bg: 'rgba(153,153,153,0.12)' };
    const icon = STATUS_ICONS[status] || '❓';
    const label = t(`status_${status}`) !== `status_${status}` ? t(`status_${status}`) : status;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            color: c.color, background: c.bg,
        }}>
            {icon} {label}
        </span>
    );
}

function InfoRow({ label, value }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
        </div>
    );
}

function OrderDetail({ order, onClose, onRefresh, t }) {
    const dateStr = new Date(order.createdAt).toLocaleString([], {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

    const payLabel = (() => {
        const m = order.paymentMethod;
        if (m === 'cash') return t('pay_cash');
        if (m === 'card') return t('pay_card');
        return m ? (PAY_ICONS[m] || '') + ' ' + (m.charAt(0).toUpperCase() + m.slice(1)) : '—';
    })();

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}
            onClick={onClose}
        >
            <div
                style={{ width: '100%', maxHeight: '85vh', overflowY: 'auto', background: 'var(--card)', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', animation: 'slideUp .25s ease' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 17 }}>#{order.orderNumber}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{dateStr}</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'var(--bg)', border: 'none', borderRadius: 50, width: 32, height: 32, fontSize: 18, cursor: 'pointer', color: 'var(--text)' }}>×</button>
                </div>

                <StatusBadge status={order.status} t={t} />

                {order.status === 'awaiting_payment' && order.paymentMethod !== 'cash' && (
                    <PayButton order={order} t={t} onSuccess={() => { onRefresh?.(); onClose(); }} />
                )}

                <hr style={{ margin: '14px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

                {/* Items */}
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>🛒 {t('orderItems')}</div>
                {order.items?.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{item.productName || item.product?.name || t('orderProduct')}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                {(item.price || 0).toLocaleString()} {t('currency')} × {item.qty}
                            </div>
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--green)', whiteSpace: 'nowrap' }}>
                            {((item.price || 0) * item.qty).toLocaleString()} {t('currency')}
                        </div>
                    </div>
                ))}

                <hr style={{ margin: '14px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

                <InfoRow label={`📍 ${t('branch')}`}     value={order.branch?.name || '—'} />
                {order.branch?.phone && <InfoRow label={`📞 ${t('orderBranchPhone')}`} value={order.branch.phone} />}
                <InfoRow label={`🏠 ${t('orderAddr')}`}  value={order.address || order.deliveryAddress || (order.deliveryType === 'pickup' ? t('pickup') : '—')} />
                <InfoRow label={`💳 ${t('paymentTitle')}`} value={payLabel} />
                {order.note && <InfoRow label={`📝 ${t('orderNote')}`} value={order.note} />}

                <hr style={{ margin: '14px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

                {order.deliveryCost > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: 'var(--text-secondary)' }}>
                        <span>{t('deliveryCost')}</span>
                        <span>{(order.deliveryCost || 0).toLocaleString()} {t('currency')}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}>
                    <span>{t('orderTotal')}</span>
                    <span style={{ color: 'var(--green)' }}>{(order.total || 0).toLocaleString()} {t('currency')}</span>
                </div>

                {order.statusHistory?.length > 0 && (
                    <>
                        <hr style={{ margin: '14px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📋 {t('statusHistory')}</div>
                        {order.statusHistory.map((h, i) => {
                            const c = STATUS_COLORS[h.status] || { color: '#999' };
                            const icon = STATUS_ICONS[h.status] || '❓';
                            const label = t(`status_${h.status}`) !== `status_${h.status}` ? t(`status_${h.status}`) : h.status;
                            return (
                                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 12 }}>
                                    <span style={{ fontSize: 16 }}>{icon}</span>
                                    <div>
                                        <span style={{ fontWeight: 700, color: c.color }}>{label}</span>
                                        {h.note && <div style={{ color: 'var(--text-secondary)' }}>{h.note}</div>}
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                                            {new Date(h.changedAt).toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
}

export default function Orders({ onBack }) {
    const { t } = useT();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    const loadOrders = useCallback(() => {
        ordersAPI.getMy()
            .then(res => setOrders(res.data || []))
            .catch(err => console.error('Orders error:', err?.response?.data || err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadOrders(); }, [loadOrders]);

    if (loading) return <div className="loading"><div className="loading-spinner" /></div>;

    return (
        <div className="page">
            <div className="back-bar">
                <button className="back-btn" onClick={onBack}>←</button>
                <h2>📦 {t('myOrders')}</h2>
            </div>

            {orders.length === 0 ? (
                <div className="empty-state"><div className="icon">📦</div><h3>{t('noOrders')}</h3></div>
            ) : (
                orders.map(o => (
                    <div key={o._id} className="card fade-up" style={{ margin: '0 20px 10px', cursor: 'pointer' }} onClick={() => setSelected(o)}>
                        <div className="flex-between mb-8">
                            <span style={{ fontWeight: 800, fontSize: 14 }}>#{o.orderNumber}</span>
                            <StatusBadge status={o.status} t={t} />
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            {o.items?.length || 0} {t('orderItems').toLowerCase()} • {o.branch?.name || ''}
                        </div>
                        <div className="flex-between">
                            <span style={{ fontWeight: 800, color: 'var(--green)' }}>{o.total?.toLocaleString()} {t('currency')}</span>
                            <span className="text-sm text-gray">{new Date(o.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))
            )}

            {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} onRefresh={loadOrders} t={t} />}
        </div>
    );
}
