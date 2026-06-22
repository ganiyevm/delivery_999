import { useState, useEffect } from 'react';
import { productsAPI, branchesAPI } from '../api/index';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useT } from '../i18n';

const CATEGORY_ICONS = [
    { key: 'pain', icon: '💊' },
    { key: 'antibiotics', icon: '🦠' },
    { key: 'vitamins', icon: '🌟' },
    { key: 'heart', icon: '❤️' },
    { key: 'children', icon: '👶' },
    { key: 'cosmetics', icon: '💄' },
    { key: 'devices', icon: '🩺' },
    { key: 'stomach', icon: '🫀' },
];

function HeaderIcon({ name }) {
    const props = {
        width: 20,
        height: 20,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
    };
    const icons = {
        scan: <><path d="M4 7V5a1 1 0 0 1 1-1h2" /><path d="M17 4h2a1 1 0 0 1 1 1v2" /><path d="M20 17v2a1 1 0 0 1-1 1h-2" /><path d="M7 20H5a1 1 0 0 1-1-1v-2" /><path d="M7 12h10" /></>,
        cart: <><path d="M5 6h16l-2 9H8L5 3H2" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    };
    return <svg {...props}>{icons[name]}</svg>;
}

export default function Home({ onNavigate, onProduct, onScanner }) {
    const { user } = useAuth();
    const { count } = useCart();
    const { t } = useT();
    const [popular, setPopular] = useState([]);
    const [branchCount, setBranchCount] = useState(20);

    const loadHomeData = () => {
        productsAPI.getAll({ sort: 'popular', limit: 6 })
            .then(res => setPopular(res.data.products || []))
            .catch(() => {});
        branchesAPI.getAll()
            .then(res => { if (res.data?.length) setBranchCount(res.data.length); })
            .catch(() => {});
    };

    useEffect(() => {
        loadHomeData();
    }, []);

    // App qaytib ochilganda yangilash + har 120 sekundda fonda jim yangilash
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') loadHomeData();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);

        const intervalId = setInterval(() => {
            if (document.visibilityState === 'visible') loadHomeData();
        }, 120_000); // 2 daqiqa (bosh sahifada kam yangilanish kerak)

        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
            clearInterval(intervalId);
        };
    }, []);

    const bonusProgress = user ? Math.min((user.bonusPoints || 0) / 50, 100) : 0;

    return (
        <div className="page">
            <header className="header">
                <div className="header-logo">
                    <img className="header-logo-img" src="/logo999.jpg" alt="999" decoding="async" fetchPriority="high" />
                    <div>
                        <div className="header-eyebrow">{t('branchSubtitle').replace('{n}', branchCount)}</div>
                        <h1>{t('appName')}</h1>
                    </div>
                </div>
                <div className="header-actions">
                    <button className="header-btn" onClick={onScanner} aria-label="Scanner">
                        <HeaderIcon name="scan" />
                    </button>
                    <button className="header-btn" onClick={() => onNavigate('cart')}>
                        <HeaderIcon name="cart" />
                        {count > 0 && <span className="cart-badge">{count}</span>}
                    </button>
                </div>
            </header>

            <div className="search-bar" onClick={() => onNavigate('catalog')}>
                <span className="search-icon">🔍</span>
                <input className="search-input" placeholder={t('searchPlaceholder')} readOnly />
            </div>

            <button
                onClick={() => onNavigate('prescription')}
                style={{
                    width: '100%', border: '1px solid rgba(39,174,96,0.24)', background: 'var(--card)',
                    borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12,
                    color: 'var(--text)', textAlign: 'left', marginBottom: 16, cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                }}>
                <span style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(39,174,96,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🧾</span>
                <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>{t('prescriptionCtaTitle')}</span>
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginTop: 3 }}>{t('prescriptionCtaText')}</span>
                </span>
                <span style={{ color: 'var(--green)', fontWeight: 900 }}>→</span>
            </button>

            <div className="promo-banner fade-up">
                <div className="promo-copy">
                    <span className="promo-kicker">999 dorixonalar</span>
                    <h2>{t('promoTitle')}</h2>
                    <p>{t('promoText')}</p>
                </div>
                <div className="promo-mark">
                    <img src="/logo999.jpg" alt="" loading="lazy" decoding="async" />
                </div>
            </div>

            <div className="stats-grid fade-up">
                <div className="stat-card">
                    <div className="icon">№</div>
                    <div className="value">{branchCount}</div>
                    <div className="label">{t('branchStat')}</div>
                </div>
                <div className="stat-card">
                    <div className="icon">Rx</div>
                    <div className="value">4000+</div>
                    <div className="label">{t('medicineStat')}</div>
                </div>
                <div className="stat-card">
                    <div className="icon">24</div>
                    <div className="value">1-2</div>
                    <div className="label">{t('hourStat')}</div>
                </div>
            </div>

            {user && (
                <div className="bonus-card fade-up" onClick={() => onNavigate('bonus')}>
                    <div className="tier">{t(user.bonusTier)}</div>
                    <div className="points">{(user.bonusPoints || 0).toLocaleString()}</div>
                    <div className="points-label">{t('bonusPoints')}</div>
                    <div className="bonus-progress">
                        <div className="bonus-progress-fill" style={{ width: `${bonusProgress}%` }} />
                    </div>
                </div>
            )}

            <h3 className="section-title">{t('categoriesTitle')}</h3>
            <div className="categories-grid fade-up">
                {CATEGORY_ICONS.map(cat => (
                    <div key={cat.key} className="category-item" onClick={() => onNavigate('catalog', { category: cat.key })}>
                        <div className="icon">{cat.icon}</div>
                        <div className="name">{t(`cat_${cat.key}`)}</div>
                    </div>
                ))}
            </div>

            <h3 className="section-title">{t('popularTitle')}</h3>
            <div className="products-grid fade-up">
                {popular.map(p => (
                    <ProductCard key={p._id} product={p} onClick={onProduct} />
                ))}
            </div>

            <h3 className="section-title">{t('deliveryTitle')}</h3>
            <div className="delivery-info fade-up">
                <div className="delivery-info-grid">
                    <div className="delivery-info-item">
                        <div className="icon">💰</div>
                        <div className="text">50 000 {t('currency')}</div>
                        <div className="sub">{t('minOrder')}</div>
                    </div>
                    <div className="delivery-info-item">
                        <div className="icon">🚚</div>
                        <div className="text">1-2 {t('hourStat')}</div>
                        <div className="sub">{t('deliveryTime')}</div>
                    </div>
                    <div className="delivery-info-item">
                        <div className="icon">💳</div>
                        <div className="text">Payme / Click</div>
                        <div className="sub">{t('paymentMethod')}</div>
                    </div>
                    <div className="delivery-info-item">
                        <div className="icon">🕐</div>
                        <div className="text">09:00 — 22:00</div>
                        <div className="sub">{t('workHours')}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
