import React, { useState, useEffect } from 'react';
import { branchesAPI } from '../api/index';

function MapButtons({ branch }) {
    const addr = encodeURIComponent((branch.address || '') + ', Toshkent');
    const lat = branch.location?.lat;
    const lng = branch.location?.lng;
    const hasCoords = lat && lng && lat !== 0 && lng !== 0;

    const maps = [
        {
            label: 'Google',
            icon: '🗺',
            url: hasCoords
                ? `https://www.google.com/maps?q=${lat},${lng}`
                : `https://www.google.com/maps/search/?api=1&query=${addr}`,
        },
        {
            label: 'Yandex',
            icon: '🧭',
            url: hasCoords
                ? `https://yandex.uz/maps/?pt=${lng},${lat}&z=17`
                : `https://yandex.uz/maps/?text=${addr}`,
        },
        {
            label: 'Yandex Go',
            icon: '🚕',
            url: hasCoords
                ? `https://3.redirect.appmetrica.yandex.com/route?end-lat=${lat}&end-lon=${lng}&end-name=${encodeURIComponent(branch.address || '')}&ref=apteka999&appmetrica_tracking_id=1178268795219968000`
                : `https://go.yandex`,
        },
        {
            label: 'Apple',
            icon: '📍',
            url: hasCoords
                ? `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(branch.name || '')}`
                : `https://maps.apple.com/?q=${addr}`,
        },
    ];

    const openLink = (url) => {
        const tg = window.Telegram?.WebApp;
        if (tg?.openLink) tg.openLink(url);
        else window.open(url, '_blank');
    };

    return (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {maps.map(m => (
                <button
                    key={m.label}
                    onClick={() => openLink(m.url)}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        border: '1px solid var(--border)', cursor: 'pointer',
                    }}
                >
                    {m.icon} {m.label}
                </button>
            ))}
        </div>
    );
}

export default function Branches() {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        branchesAPI.getAll()
            .then(res => setBranches(res.data || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const openCount = branches.filter(b => b.isOpen).length;
    const closedCount = branches.length - openCount;

    if (loading) return <div className="loading"><div className="loading-spinner" /></div>;

    return (
        <div className="page">
            <div className="back-bar">
                <h2>🏥 Filiallar</h2>
            </div>

            <div style={{ padding: '0 20px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                {branches.length} filial • <span className="text-green">{openCount} ochiq</span> • <span className="text-gray">{closedCount} yopiq</span>
            </div>

            {branches.map(b => (
                <div key={b._id} className={`branch-card ${b.isOpen ? '' : 'closed'}`}>
                    <div className="branch-info">
                        <h4>№{String(b.number).padStart(3, '0')} {b.name}</h4>
                        <p>📍 {b.address || 'Manzil kiritilmagan'}</p>
                        {b.phone && <p>📞 {b.phone}</p>}
                        <p>🕐 {b.hours || '09:00 — 22:00'}</p>
                        <span className={`badge ${b.isOpen ? 'badge-instock' : 'badge-outstock'}`}>
                            {b.isOpen ? '🟢 Ochiq' : '🔴 Yopiq'}
                        </span>
                        <MapButtons branch={b} />
                    </div>
                </div>
            ))}
        </div>
    );
}
