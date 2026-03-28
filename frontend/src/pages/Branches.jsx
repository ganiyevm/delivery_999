import React, { useState, useEffect } from 'react';
import { branchesAPI } from '../api/index';

// URL larni to'g'ri ochish — Telegram ichida tashqi brauzer
function openUrl(url) {
    const tg = window.Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, '_blank');
}

function NavSheet({ branch, onClose }) {
    const lat = branch.location?.lat;
    const lng = branch.location?.lng;
    const hasCoords = lat && lng && lat !== 0 && lng !== 0;
    const name = encodeURIComponent(branch.name || 'Apteka 999');
    const addr = encodeURIComponent((branch.address || '') + ', Toshkent');

    const options = [
        {
            label: 'Yandex Navigator',
            sub: 'Quruqlik yo\'li, piyoda',
            icon: '🧭',
            color: '#FF0000',
            url: hasCoords
                ? `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`
                : `https://yandex.uz/maps/?text=${addr}&rtt=auto`,
        },
        {
            label: 'Yandex Go — Taksi',
            sub: 'Narx va vaqtni ko\'rsatadi',
            icon: '🚕',
            color: '#FC3F1D',
            // AppMetrica redirect — to'g'ridan Yandex Go ilovasini borish nuqtasi bilan ochadi
            url: hasCoords
                ? `https://3.redirect.appmetrica.yandex.com/route?end-lat=${lat}&end-lon=${lng}&appmetrica_tracking_id=1180215`
                : 'https://go.yandex',
        },
        {
            label: 'Google Maps',
            sub: 'Yo\'nalish va navigatsiya',
            icon: '🗺',
            color: '#4285F4',
            url: hasCoords
                ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
                : `https://www.google.com/maps/search/?api=1&query=${addr}`,
        },
        {
            label: '2GIS',
            sub: 'Toshkent xaritasi',
            icon: '🏙',
            color: '#00B357',
            url: hasCoords
                ? `https://2gis.uz/tashkent?m=${lng},${lat}/17&q=${name}`
                : `https://2gis.uz/tashkent/search/${addr}`,
        },
        {
            label: 'Apple Maps',
            sub: 'iPhone uchun',
            icon: '📍',
            color: '#555',
            url: hasCoords
                ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
                : `https://maps.apple.com/?q=${addr}`,
        },
    ];

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'flex-end',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%', background: 'var(--bg-card)',
                    borderRadius: '20px 20px 0 0', padding: '12px 0 32px',
                    animation: 'slideUp .25s ease',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
                <div style={{ padding: '0 20px 12px', fontWeight: 700, fontSize: 15 }}>
                    📍 {branch.name}
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginTop: 2 }}>
                        {branch.address || 'Manzil kiritilmagan'}
                    </div>
                </div>

                {options.map(opt => (
                    <button
                        key={opt.label}
                        onClick={() => { openUrl(opt.url); onClose(); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            width: '100%', padding: '13px 20px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            textAlign: 'left',
                        }}
                    >
                        <span style={{
                            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                            background: opt.color + '18',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 22,
                        }}>{opt.icon}</span>
                        <span>
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{opt.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{opt.sub}</div>
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function Branches() {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [navBranch, setNavBranch] = useState(null);

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
            <div className="back-bar"><h2>🏥 Filiallar</h2></div>

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            <span className={`badge ${b.isOpen ? 'badge-instock' : 'badge-outstock'}`}>
                                {b.isOpen ? '🟢 Ochiq' : '🔴 Yopiq'}
                            </span>
                            {(b.location?.lat && b.location?.lat !== 0) && (
                                <button
                                    onClick={() => setNavBranch(b)}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                        padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                                        background: 'var(--primary)', color: 'white',
                                        border: 'none', cursor: 'pointer',
                                    }}
                                >
                                    🧭 Yo'nalish
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {navBranch && <NavSheet branch={navBranch} onClose={() => setNavBranch(null)} />}
        </div>
    );
}
