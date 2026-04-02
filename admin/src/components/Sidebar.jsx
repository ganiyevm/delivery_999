import { NavLink } from 'react-router-dom';
import { useT } from '../i18n';

const ROLE_PAGES = {
    super_admin: ['/', '/orders', '/products', '/branches', '/users', '/import', '/accounts', '/delivery-settings'],
    admin:       ['/', '/orders', '/products', '/branches', '/users', '/import', '/delivery-settings'],
    operator:    ['/', '/orders'],
    pharmacist:  ['/', '/products', '/branches', '/import'],
    analyst:     ['/'],
};

const LANGS = [
    { code: 'uz', flag: '🇺🇿' },
    { code: 'ru', flag: '🇷🇺' },
    { code: 'en', flag: '🇬🇧' },
];

export default function Sidebar() {
    const { t, lang, changeLang } = useT();
    const role = localStorage.getItem('admin_role') || 'operator';
    const allowed = ROLE_PAGES[role] || ['/'];

    const navItems = [
        { path: '/',         icon: '📊', key: 'dashboard' },
        { path: '/orders',   icon: '📦', key: 'orders' },
        { path: '/products', icon: '💊', key: 'products' },
        { path: '/branches', icon: '🏥', key: 'branches' },
        { path: '/users',    icon: '👥', key: 'users' },
        { path: '/import',   icon: '📤', key: 'import' },
        { path: '/accounts',          icon: '🔑', key: 'accounts' },
        { path: '/delivery-settings', icon: '🚚', key: 'deliverySettings' },
    ].filter(item => allowed.includes(item.path));

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1>🏥 Аптек 999</h1>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {t(role)}
                </p>
            </div>

            <nav>
                {navItems.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        <span className="icon">{item.icon}</span>
                        <span>{t(item.key)}</span>
                    </NavLink>
                ))}
            </nav>

            <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, padding: '0 16px' }}>
                {/* Til tanlash */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    {LANGS.map(l => (
                        <button
                            key={l.code}
                            onClick={() => changeLang(l.code)}
                            style={{
                                flex: 1, padding: '6px 0', borderRadius: 8,
                                fontSize: 16, cursor: 'pointer', border: 'none',
                                background: lang === l.code ? 'var(--green)' : 'var(--card-hover)',
                                opacity: lang === l.code ? 1 : 0.55,
                                transition: 'all .15s',
                            }}
                        >
                            {l.flag}
                        </button>
                    ))}
                </div>

                <button className="nav-link" style={{ width: '100%' }} onClick={() => {
                    localStorage.removeItem('admin_token');
                    localStorage.removeItem('admin_role');
                    localStorage.removeItem('is_super_admin');
                    window.location.href = '/login';
                }}>
                    <span className="icon">🚪</span>
                    <span>{t('logout')}</span>
                </button>
            </div>
        </aside>
    );
}
