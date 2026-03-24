import React from 'react';
import { useCart } from '../context/CartContext';

export default function BottomNav({ active, onNavigate }) {
    const { count } = useCart();

    const tabs = [
        { key: 'home', icon: '🏠', label: 'Bosh' },
        { key: 'catalog', icon: '💊', label: 'Katalog' },
        { key: 'branches', icon: '🏥', label: 'Filial' },
        { key: 'cart', icon: '🛒', label: 'Savat' },
        { key: 'profile', icon: '👤', label: 'Profil' },
    ];

    return (
        <nav className="bottom-nav">
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    className={`nav-item ${active === tab.key ? 'active' : ''}`}
                    onClick={() => onNavigate(tab.key)}
                >
                    <span className="icon">{tab.icon}</span>
                    <span className="label">{tab.label}</span>
                    {tab.key === 'cart' && count > 0 && (
                        <span className="nav-badge">{count}</span>
                    )}
                </button>
            ))}
        </nav>
    );
}
