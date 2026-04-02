import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { branchesAPI } from '../api/index';
import { useT } from '../i18n';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const grayIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const blueIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
}

function MapFlyTo({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, zoom, { duration: 0.8 });
    }, [center, zoom]);
    return null;
}

const NAV_ICONS = {
    yandexNav:  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/YandexNavigatorLogo.svg/200px-YandexNavigatorLogo.svg.png',
    yandexMaps: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Yandex_Maps_icon.svg/200px-Yandex_Maps_icon.svg.png',
    googleMaps: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Google_Maps_icon_%282020%29.svg/200px-Google_Maps_icon_%282020%29.svg.png',
    appleMaps:  'https://upload.wikimedia.org/wikipedia/commons/2/21/Apple_Maps_iOS_26_icon.png',
};
function openMapApp(url) {
    const tg = window.Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, '_blank');
}

function NavSheet({ branch, onClose, t }) {
    const lat = branch.location?.lat || null;
    const lng = branch.location?.lng || null;
    const addr = encodeURIComponent((branch.address || '') + ', Toshkent');
    const opts = [
        { label: 'Yandex Navigator', sub: t('navYandexSub'), src: NAV_ICONS.yandexNav,
          url: lat ? `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto` : `https://yandex.uz/maps/?text=${addr}&rtt=auto` },
        { label: 'Yandex Maps', sub: t('navYandexMapsSub'), src: NAV_ICONS.yandexMaps,
          url: lat ? `https://yandex.uz/maps/?pt=${lng},${lat}&z=17` : `https://yandex.uz/maps/?text=${addr}` },
        { label: 'Google Maps', sub: t('navGoogleSub'), src: NAV_ICONS.googleMaps,
          url: lat ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${addr}` },
        { label: 'Apple Maps', sub: t('navAppleSub'), src: NAV_ICONS.appleMaps,
          url: lat ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d` : `https://maps.apple.com/?q=${addr}` },
    ];
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}
            onClick={onClose}>
            <div style={{ width: '100%', background: 'var(--card)', borderRadius: '20px 20px 0 0', paddingBottom: 32, animation: 'slideUp .22s ease' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 6px' }} />
                <div style={{ padding: '10px 20px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{branch.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{branch.address || '—'}</div>
                </div>
                {opts.map(o => (
                    <button key={o.label} onClick={() => { openMapApp(o.url); onClose(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '11px 20px', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <img src={o.src} alt={o.label} width={44} height={44} style={{ borderRadius: 11, objectFit: 'cover', flexShrink: 0 }} />
                        <span style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{o.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.sub}</div>
                        </span>
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1l6 6-6 6" stroke="var(--border)" strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                ))}
                <button onClick={onClose} style={{ display: 'block', width: 'calc(100% - 40px)', margin: '8px 20px 0', padding: 13, borderRadius: 14, fontSize: 15, fontWeight: 600, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    {t('cancel')}
                </button>
            </div>
        </div>
    );
}

function BranchCard({ branch, userLoc, isNearest, onNavigate, onSelect, isSelected, t }) {
    const dist = userLoc && branch.location?.lat
        ? haversine(userLoc.lat, userLoc.lng, branch.location.lat, branch.location.lng)
        : null;
    const hasCoords = !!(branch.location?.lat && branch.location.lat !== 0);

    return (
        <div
            onClick={() => onSelect(branch)}
            style={{
                background: 'var(--card)', borderRadius: 16, padding: '14px 16px',
                border: `2px solid ${isSelected ? 'var(--green)' : isNearest ? 'rgba(39,174,96,0.3)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'border-color 0.2s',
                opacity: branch.isOpen ? 1 : 0.65,
            }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {isNearest && (
                            <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--green)', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>
                                📍 {t('nearest')}
                            </span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: branch.isOpen ? 'rgba(39,174,96,0.12)' : 'rgba(139,143,163,0.12)',
                            color: branch.isOpen ? 'var(--green)' : 'var(--text-secondary)' }}>
                            ● {branch.isOpen ? t('openText') : t('closedText')}
                        </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginTop: 5, lineHeight: 1.3 }}>
                        №{String(branch.number).padStart(3, '0')} {branch.name}
                    </div>
                </div>
                {dist !== null && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: dist < 1 ? 'var(--green)' : dist < 3 ? 'var(--orange)' : 'var(--text-secondary)' }}>
                            {fmtDist(dist)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{t('away')}</div>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📍</span> <span>{branch.address || t('noAddress')}</span>
                </div>
                {branch.phone && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>📞</span>
                        <a href={`tel:${branch.phone}`} onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--blue-light)', textDecoration: 'none', fontWeight: 600 }}>
                            {branch.phone}
                        </a>
                    </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🕐</span> <span>{branch.hours || '09:00 — 22:00'}</span>
                </div>
            </div>

            {hasCoords && (
                <button
                    onClick={e => { e.stopPropagation(); onNavigate(branch); }}
                    style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 12, background: 'var(--green)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
                    </svg>
                    {t('getDirections')}
                </button>
            )}
        </div>
    );
}

export default function Branches() {
    const { t } = useT();
    const [branches,   setBranches]   = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [userLoc,    setUserLoc]    = useState(null);
    const [locLoading, setLocLoading] = useState(false);
    const [navBranch,  setNavBranch]  = useState(null);
    const [selected,   setSelected]   = useState(null);
    const [view,       setView]       = useState('list');
    const [flyTo,      setFlyTo]      = useState(null);
    const listRef = useRef(null);
    const cardRefs = useRef({});

    useEffect(() => {
        branchesAPI.getAll()
            .then(res => setBranches(res.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));

        if (navigator.geolocation) {
            setLocLoading(true);
            navigator.geolocation.getCurrentPosition(
                pos => {
                    setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setLocLoading(false);
                },
                () => setLocLoading(false),
                { enableHighAccuracy: true, timeout: 8000 }
            );
        }
    }, []);

    const sorted = useMemo(() => {
        if (!userLoc) return branches;
        return [...branches].sort((a, b) => {
            const da = a.location?.lat ? haversine(userLoc.lat, userLoc.lng, a.location.lat, a.location.lng) : 999;
            const db = b.location?.lat ? haversine(userLoc.lat, userLoc.lng, b.location.lat, b.location.lng) : 999;
            return da - db;
        });
    }, [branches, userLoc]);

    const withCoords = sorted.filter(b => b.location?.lat && b.location.lat !== 0);
    const nearest = sorted.find(b => b.location?.lat && b.location.lat !== 0);

    const handleMapSelect = (branch) => {
        setSelected(branch);
        setView('list');
        setTimeout(() => {
            cardRefs.current[branch._id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    const handleCardSelect = (branch) => {
        if (!branch.location?.lat) return;
        setSelected(branch);
        setFlyTo({ center: [branch.location.lat, branch.location.lng], zoom: 17 });
        if (view === 'list') setView('map');
    };

    const mapCenter = nearest?.location
        ? [nearest.location.lat, nearest.location.lng]
        : [41.2995, 69.2401];

    const openCount = branches.filter(b => b.isOpen).length;

    if (loading) return <div className="loading"><div className="loading-spinner" /></div>;

    return (
        <>
        <div className="page" style={{ paddingBottom: 80 }}>
            <div className="back-bar">
                <h2>🏥 {t('branches')}</h2>
                {locLoading && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>📡 {t('locating')}</span>}
                {userLoc && !locLoading && <span style={{ fontSize: 11, color: 'var(--green)' }}>📍 {t('locationFound')}</span>}
            </div>

            <div style={{ padding: '0 20px 12px', display: 'flex', gap: 16, fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('totalLabel')}: <strong style={{ color: 'var(--text)' }}>{branches.length}</strong></span>
                <span style={{ color: 'var(--green)' }}>● {t('openLabel')}: <strong>{openCount}</strong></span>
                <span style={{ color: 'var(--text-secondary)' }}>● {t('closedLabel')}: <strong>{branches.length - openCount}</strong></span>
            </div>

            <div style={{ padding: '0 20px 14px', display: 'flex', gap: 8 }}>
                <button onClick={() => setView('list')} style={{
                    flex: 1, padding: '9px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    background: view === 'list' ? 'var(--green)' : 'var(--card)',
                    color: view === 'list' ? '#fff' : 'var(--text-secondary)',
                    border: view === 'list' ? 'none' : '1px solid var(--border)',
                }}>📋 {t('listView')}</button>
                <button onClick={() => setView('map')} style={{
                    flex: 1, padding: '9px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    background: view === 'map' ? 'var(--green)' : 'var(--card)',
                    color: view === 'map' ? '#fff' : 'var(--text-secondary)',
                    border: view === 'map' ? 'none' : '1px solid var(--border)',
                }}>🗺 {t('mapView')}</button>
            </div>

            {view === 'map' && (
                <div style={{ padding: '0 20px 16px' }}>
                    <div style={{ borderRadius: 18, overflow: 'hidden', height: 380, border: '1px solid var(--border)' }}>
                        <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
                            {flyTo && <MapFlyTo center={flyTo.center} zoom={flyTo.zoom} />}
                            {userLoc && (
                                <>
                                    <Circle center={[userLoc.lat, userLoc.lng]} radius={300}
                                        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2 }} />
                                    <Marker position={[userLoc.lat, userLoc.lng]} icon={blueIcon}>
                                        <Popup>📍 {t('youAreHere')}</Popup>
                                    </Marker>
                                </>
                            )}
                            {withCoords.map(b => (
                                <Marker key={b._id} position={[b.location.lat, b.location.lng]}
                                    icon={b.isOpen ? greenIcon : grayIcon}
                                    eventHandlers={{ click: () => handleMapSelect(b) }}>
                                    <Popup>
                                        <div style={{ minWidth: 160 }}>
                                            <strong>№{String(b.number).padStart(3, '0')} {b.name}</strong><br />
                                            <span style={{ color: b.isOpen ? 'green' : 'gray' }}>
                                                ● {b.isOpen ? t('openText') : t('closedText')}
                                            </span><br />
                                            {b.address && <span style={{ fontSize: 12 }}>{b.address}</span>}
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, textAlign: 'center' }}>
                        {t('mapLegendText')}
                    </div>
                </div>
            )}

            {view === 'list' && (
                <div ref={listRef} style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {userLoc && nearest && (
                        <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 12, background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.2)', color: 'var(--green)', fontWeight: 600 }}>
                            📍 {t('nearestBranchInfo').replace('{dist}', fmtDist(haversine(userLoc.lat, userLoc.lng, nearest.location.lat, nearest.location.lng)))}
                        </div>
                    )}
                    {sorted.map((b) => (
                        <div key={b._id} ref={el => cardRefs.current[b._id] = el}>
                            <BranchCard
                                branch={b} userLoc={userLoc}
                                isNearest={b._id === nearest?._id && !!userLoc}
                                isSelected={selected?._id === b._id}
                                onNavigate={setNavBranch}
                                onSelect={handleCardSelect}
                                t={t}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>

        {navBranch && <NavSheet branch={navBranch} onClose={() => setNavBranch(null)} t={t} />}
        </>
    );
}
