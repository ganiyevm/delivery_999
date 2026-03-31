import React from 'react';
import { useCart } from '../context/CartContext';
import { useT } from '../i18n';

export default function BottomNav({ active, onNavigate }) {
    const { count } = useCart();
    const { t } = useT();

    const tabs = [
        { key: 'home', icon: '🏠', label: t('home') },
        { key: 'catalog', icon: '💊', label: t('catalog') },
        { key: 'branches', icon: '🏥', label: t('branches') },
        { key: 'cart', icon: '🛒', label: t('cart') },
        { key: 'profile', icon: '👤', label: t('profile') },
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
