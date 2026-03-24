import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
    { path: '/', icon: '📊', label: 'Dashboard' },
    { path: '/orders', icon: '📦', label: 'Buyurtmalar' },
    { path: '/products', icon: '💊', label: 'Mahsulotlar' },
    { path: '/branches', icon: '🏥', label: 'Filiallar' },
    { path: '/users', icon: '👥', label: 'Foydalanuvchilar' },
    { path: '/import', icon: '📤', label: 'Import' },
];

export default function Sidebar() {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1>🏥 Аптек 999</h1>
                <p>Admin Panel</p>
            </div>
            <nav>
                {NAV_ITEMS.map(item => (
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
                <button className="nav-link" onClick={() => { localStorage.removeItem('admin_token'); window.location.href = '/login'; }}>
                    <span className="icon">🚪</span>
                    <span>Chiqish</span>
                </button>
            </div>
        </aside>
    );
}
