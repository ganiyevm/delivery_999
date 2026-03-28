import React, { useState, useEffect } from 'react';
import { branchesAPI } from '../api/index';

// ─── URL ochish — faqat HTTPS, Telegram tashqi brauzerda ochadi ───
function openMapApp(url) {
    const tg = window.Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, '_blank');
}

// ─── SVG Logolar ───
const YandexNavIcon = () => (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <rect width="44" height="44" rx="11" fill="#FC3F1D" />
        <path d="M22 9C15.373 9 10 14.373 10 21c0 4.27 2.165 8.03 5.45 10.25L22 35l6.55-3.75C31.835 29.03 34 25.27 34 21c0-6.627-5.373-12-12-12z" fill="white" opacity="0.15" />
        <path d="M26.5 14h-2.8l-4.2 8.4h2.4l.9-1.8h5l.9 1.8h2.5L26.5 14zm-2.8 4.8 1.4-2.8 1.4 2.8h-2.8z" fill="white" />
        <path d="M17.5 22.5l-1.8 7.5h2.3l.45-1.9h2.55l.45 1.9h2.3l-1.8-7.5h-4.5zm.95 4 .75-3.1.75 3.1h-1.5z" fill="white" />
    </svg>
);

const YandexGoIcon = () => (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <rect width="44" height="44" rx="11" fill="#FFD600" />
        <rect x="9" y="20" width="26" height="13" rx="4" fill="#1A1A1A" />
        <rect x="13" y="17" width="18" height="7" rx="3" fill="#1A1A1A" />
        <circle cx="15" cy="33" r="3" fill="#FFD600" stroke="#1A1A1A" strokeWidth="1.5" />
        <circle cx="29" cy="33" r="3" fill="#FFD600" stroke="#1A1A1A" strokeWidth="1.5" />
        <rect x="20" y="21" width="1.5" height="5" rx="0.75" fill="#FFD600" />
        <rect x="23" y="21" width="1.5" height="5" rx="0.75" fill="#FFD600" />
        <path d="M26 14l2.5 3H24l2-3z" fill="#1A1A1A" />
    </svg>
);

const GoogleMapsIcon = () => (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <rect width="44" height="44" rx="11" fill="white" stroke="#E5E5E5" strokeWidth="1" />
        <path d="M22 8c-5.523 0-10 4.477-10 10 0 7.5 10 18 10 18s10-10.5 10-18c0-5.523-4.477-10-10-10z" fill="#EA4335" />
        <path d="M22 8c-5.523 0-10 4.477-10 10 0 2.09.64 4.03 1.74 5.64L22 8z" fill="#1A73E8" />
        <path d="M32 18c0-2.09-.64-4.03-1.74-5.64L22 18h10z" fill="#FBBC04" />
        <path d="M22 8l-8.26 10c.97 1.44 2.31 2.62 3.87 3.38L22 8z" fill="#34A853" />
        <circle cx="22" cy="18" r="4" fill="white" />
    </svg>
);

const TwoGisIcon = () => (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <rect width="44" height="44" rx="11" fill="#00AF57" />
        <text x="22" y="28" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontSize="13" fontWeight="900" fill="white">2GIS</text>
    </svg>
);

const AppleMapsIcon = () => (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <rect width="44" height="44" rx="11" fill="url(#appleGrad)" />
        <defs>
            <linearGradient id="appleGrad" x1="0" y1="0" x2="44" y2="44">
                <stop offset="0%" stopColor="#3EC6F5" />
                <stop offset="100%" stopColor="#1A6CF5" />
            </linearGradient>
        </defs>
        <path d="M22 10c-5.523 0-10 4.477-10 10 0 5.523 4.477 10 10 10s10-4.477 10-10c0-5.523-4.477-10-10-10z" fill="white" opacity="0.2" />
        <path d="M22 14c-3.314 0-6 2.686-6 6 0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6z" fill="white" />
        <circle cx="22" cy="20" r="2.5" fill="#3EC6F5" />
        <path d="M15 28l13-8" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
);

// ─── Xarita variantlari — faqat ishlaydigan HTTPS URL lar ───
const NAV_OPTIONS = (lat, lng, name, addr) => [
    {
        label: 'Yandex Navigator',
        sub: 'Haydovchi navigatsiyasi',
        Icon: YandexNavIcon,
        url: lat
            ? `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`
            : `https://yandex.uz/maps/?text=${addr}&rtt=auto`,
    },
    {
        label: 'Yandex Go',
        sub: 'Taksi — narx va vaqt',
        Icon: YandexGoIcon,
        url: lat
            ? `https://go.yandex/route?end-lat=${lat}&end-lon=${lng}&end-name=${name}`
            : 'https://go.yandex',
    },
    {
        label: 'Google Maps',
        sub: "Yo'nalish va navigatsiya",
        Icon: GoogleMapsIcon,
        url: lat
            ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
            : `https://www.google.com/maps/search/?api=1&query=${addr}`,
    },
    {
        label: '2GIS',
        sub: "O'zbekiston xaritasi",
        Icon: TwoGisIcon,
        url: lat
            ? `https://2gis.uz/tashkent?m=${lng},${lat}/17`
            : `https://2gis.uz/tashkent/search/${addr}`,
    },
    {
        label: 'Apple Maps',
        sub: 'iPhone va iPad uchun',
        Icon: AppleMapsIcon,
        url: lat
            ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
            : `https://maps.apple.com/?q=${addr}`,
    },
];

function NavSheet({ branch, onClose }) {
    const lat = branch.location?.lat && branch.location.lat !== 0 ? branch.location.lat : null;
    const lng = branch.location?.lng && branch.location.lng !== 0 ? branch.location.lng : null;
    const name = encodeURIComponent(branch.name || 'Apteka 999');
    const addr = encodeURIComponent((branch.address || '') + ', Toshkent');
    const options = NAV_OPTIONS(lat, lng, name, addr);

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
            onClick={onClose}
        >
            <div
                style={{ width: '100%', background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', paddingBottom: 32, animation: 'slideUp .22s ease' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 0' }} />

                {/* Header */}
                <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{branch.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{branch.address || 'Manzil kiritilmagan'}</div>
                </div>

                {/* Options */}
                {options.map(({ label, sub, Icon, url }) => (
                    <button
                        key={label}
                        onClick={() => { openMapApp(url); onClose(); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            width: '100%', padding: '11px 20px',
                            background: 'none', border: 'none', cursor: 'pointer',
                        }}
                    >
                        <Icon />
                        <span style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{label}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>
                        </span>
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                            <path d="M1 1l6 6-6 6" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                ))}

                {/* Cancel */}
                <button
                    onClick={onClose}
                    style={{
                        display: 'block', width: 'calc(100% - 40px)', margin: '8px 20px 0',
                        padding: '13px', borderRadius: 14, fontSize: 15, fontWeight: 600,
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        border: 'none', cursor: 'pointer',
                    }}
                >
                    Bekor qilish
                </button>
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

            {branches.map(b => {
                const hasCoords = b.location?.lat && b.location.lat !== 0;
                return (
                    <div key={b._id} className={`branch-card ${b.isOpen ? '' : 'closed'}`}>
                        <div className="branch-info">
                            <h4>№{String(b.number).padStart(3, '0')} {b.name}</h4>
                            <p>📍 {b.address || 'Manzil kiritilmagan'}</p>
                            {b.phone && <p>📞 {b.phone}</p>}
                            <p>🕐 {b.hours || '09:00 — 22:00'}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                <span className={`badge ${b.isOpen ? 'badge-instock' : 'badge-outstock'}`}>
                                    {b.isOpen ? '🟢 Ochiq' : '🔴 Yopiq'}
                                </span>
                                {hasCoords && (
                                    <button
                                        onClick={() => setNavBranch(b)}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                                            background: 'var(--primary)', color: 'white',
                                            border: 'none', cursor: 'pointer',
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white" />
                                        </svg>
                                        Yo'nalish
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}

            {navBranch && <NavSheet branch={navBranch} onClose={() => setNavBranch(null)} />}
        </div>
    );
}
