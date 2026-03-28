import React from 'react';
import { NavLink } from 'react-router-dom';

// Har bir rol nimani ko'ra oladi
const ROLE_PAGES = {
    super_admin: ['/', '/orders', '/products', '/branches', '/users', '/import', '/accounts'],
    admin:       ['/', '/orders', '/products', '/branches', '/users', '/import'],
    operator:    ['/', '/orders'],
    pharmacist:  ['/', '/products', '/branches', '/import'],
    analyst:     ['/'],
};

const ROLE_LABELS = {
    super_admin: 'Super Admin',
    admin:       'Admin',
    operator:    'Operator',
    pharmacist:  'Farmatsevt',
    analyst:     'Analyst',
};

const ALL_NAV = [
    { path: '/',          icon: '📊', label: 'Dashboard' },
    { path: '/orders',    icon: '📦', label: 'Buyurtmalar' },
    { path: '/products',  icon: '💊', label: 'Mahsulotlar' },
    { path: '/branches',  icon: '🏥', label: 'Filiallar' },
    { path: '/users',     icon: '👥', label: 'Foydalanuvchilar' },
    { path: '/import',    icon: '📤', label: 'Import' },
    { path: '/accounts',  icon: '🔑', label: 'Adminlar' },
];

export default function Sidebar() {
    const role = localStorage.getItem('admin_role') || 'operator';
    const allowed = ROLE_PAGES[role] || ['/'];
    const navItems = ALL_NAV.filter(item => allowed.includes(item.path));

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1>🏥 Аптек 999</h1>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {ROLE_LABELS[role] || role}
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
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
            <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, padding: '0 20px' }}>
                <button className="nav-link" onClick={() => {
                    localStorage.removeItem('admin_token');
                    localStorage.removeItem('admin_role');
                    localStorage.removeItem('is_super_admin');
                    window.location.href = '/login';
                }}>
                    <span className="icon">🚪</span>
                    <span>Chiqish</span>
                </button>
            </div>
        </aside>
    );
}
