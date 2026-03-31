import React, { useState, useEffect } from 'react';
import { branchesAPI } from '../api/index';
import { useT } from '../i18n';

// ─── URL ochish — faqat HTTPS, Telegram tashqi brauzerda ochadi ───
function openMapApp(url) {
    const tg = window.Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, '_blank');
}

// ─── Real logolar (Wikimedia CDN — CORS yo'q) ───
const AppIcon = ({ src, alt }) => (
    <img
        src={src} alt={alt}
        width={44} height={44}
        style={{ borderRadius: 11, objectFit: 'cover', flexShrink: 0 }}
        onError={e => { e.target.style.background = 'var(--border)'; }}
    />
);

const ICONS = {
    yandexNav:   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/YandexNavigatorLogo.svg/200px-YandexNavigatorLogo.svg.png',
    yandexMaps:  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Yandex_Maps_icon.svg/200px-Yandex_Maps_icon.svg.png',
    googleMaps:  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Google_Maps_icon_%282020%29.svg/200px-Google_Maps_icon_%282020%29.svg.png',
    appleMaps:   'https://upload.wikimedia.org/wikipedia/commons/2/21/Apple_Maps_iOS_26_icon.png',
};

// ─── Xarita variantlari ───
const NAV_OPTIONS = (lat, lng, addr) => [
    {
        label: 'Yandex Navigator',
        sub: 'Haydovchi navigatsiyasi',
        icon: <AppIcon src={ICONS.yandexNav} alt="Yandex Navigator" />,
        url: lat
            ? `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`
            : `https://yandex.uz/maps/?text=${addr}&rtt=auto`,
    },
    {
        label: 'Yandex Maps',
        sub: 'Yandex xaritasi',
        icon: <AppIcon src={ICONS.yandexMaps} alt="Yandex Maps" />,
        url: lat
            ? `https://yandex.uz/maps/?pt=${lng},${lat}&z=17`
            : `https://yandex.uz/maps/?text=${addr}`,
    },
    {
        label: 'Google Maps',
        sub: "Yo'nalish va navigatsiya",
        icon: <AppIcon src={ICONS.googleMaps} alt="Google Maps" />,
        url: lat
            ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
            : `https://www.google.com/maps/search/?api=1&query=${addr}`,
    },
    {
        label: 'Apple Maps',
        sub: 'iPhone va iPad uchun',
        icon: <AppIcon src={ICONS.appleMaps} alt="Apple Maps" />,
        url: lat
            ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
            : `https://maps.apple.com/?q=${addr}`,
    },
];

function NavSheet({ branch, onClose }) {
    const lat = branch.location?.lat && branch.location.lat !== 0 ? branch.location.lat : null;
    const lng = branch.location?.lng && branch.location.lng !== 0 ? branch.location.lng : null;
    const addr = encodeURIComponent((branch.address || '') + ', Toshkent');
    const options = NAV_OPTIONS(lat, lng, addr);

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end' }}
            onClick={onClose}
        >
            <div
                style={{ width: '100%', background: 'var(--card)', borderRadius: '20px 20px 0 0', paddingBottom: 32, animation: 'slideUp .22s ease' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 0' }} />

                {/* Header */}
                <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{branch.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{branch.address || '—'}</div>
                </div>

                {/* Options */}
                {options.map(({ label, sub, icon, url }) => (
                    <button
                        key={label}
                        onClick={() => { openMapApp(url); onClose(); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            width: '100%', padding: '11px 20px',
                            background: 'none', border: 'none', cursor: 'pointer',
                        }}
                    >
                        {icon}
                        <span style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{label}</div>
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
                        background: 'var(--bg)', color: 'var(--text)',
                        border: '1px solid var(--border)', cursor: 'pointer',
                    }}
                >
                    Bekor qilish
                </button>
            </div>
        </div>
    );
}

export default function Branches() {
    const { t } = useT();
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
        <>
            <div className="page">
                <div className="back-bar"><h2>🏥 Filiallar</h2></div>

                <div style={{ padding: '0 20px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {branches.length} • <span className="text-green">{openCount} {t('openBranches')}</span> • <span className="text-gray">{closedCount} {t('closedBranches')}</span>
                </div>

                {branches.map(b => {
                    const hasCoords = b.location?.lat && b.location.lat !== 0;
                    return (
                        <div key={b._id} className={`branch-card ${b.isOpen ? '' : 'closed'}`}>
                            <div className="branch-info">
                                <h4>№{String(b.number).padStart(3, '0')} {b.name}</h4>
                                <p>📍 {b.address || t('noAddress')}</p>
                                {b.phone && <p>📞 {b.phone}</p>}
                                <p>🕐 {b.hours || '09:00 — 22:00'}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                    <span className={`badge ${b.isOpen ? 'badge-instock' : 'badge-outstock'}`}>
                                        {b.isOpen ? t('openStatus') : t('closedStatus')}
                                    </span>
                                    {hasCoords && (
                                        <button
                                            onClick={() => setNavBranch(b)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                                                background: 'var(--green)', color: 'white',
                                                border: 'none', cursor: 'pointer',
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white" />
                                            </svg>
                                            {t('navigate')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {navBranch && <NavSheet branch={navBranch} onClose={() => setNavBranch(null)} />}
        </>
    );
}
