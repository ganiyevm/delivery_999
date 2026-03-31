import React, { useState, useEffect } from 'react';
import { ordersAPI } from '../../api/index';
import { useT } from '../../i18n';

const STATUS_ICONS = {
    awaiting_payment: '⏳', pending_operator: '🔄', confirmed: '✅',
    rejected: '❌', on_the_way: '🚗', delivered: '✅', cancelled: '❌',
};

export default function Orders({ onBack }) {
    const { t } = useT();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        ordersAPI.getMy()
            .then(res => setOrders(res.data || []))
            .catch(err => console.error('Orders error:', err?.response?.data || err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading"><div className="loading-spinner" /></div>;

    return (
        <div className="page">
            <div className="back-bar"><button className="back-btn" onClick={onBack}>←</button><h2>📦 {t('myOrders')}</h2></div>
            {orders.length === 0 ? (
                <div className="empty-state"><div className="icon">📦</div><h3>{t('noOrders')}</h3></div>
            ) : (
                orders.map(o => (
                    <div key={o._id} className="card fade-up" style={{ margin: '0 20px 10px' }}>
                        <div className="flex-between mb-8">
                            <span style={{ fontWeight: 800, fontSize: 14 }}>#{o.orderNumber}</span>
                            <span className={`badge badge-status-${o.status}`}>{STATUS_ICONS[o.status]} {t(o.status)}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            {o.items?.length || 0} ta dori • {o.branch?.name || ''}
                        </div>
                        <div className="flex-between">
                            <span style={{ fontWeight: 800, color: 'var(--green)' }}>{o.total?.toLocaleString()} сўм</span>
                            <span className="text-sm text-gray">{new Date(o.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
