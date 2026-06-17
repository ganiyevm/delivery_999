import React from 'react';
import { useCart } from '../context/CartContext';
import { useT } from '../i18n';

function Icon({ name }) {
    const common = {
        width: 22,
        height: 22,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
    };
    const paths = {
        home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
        catalog: <><path d="M10 21h4" /><path d="m8 17 8-8" /><path d="M7 7a3 3 0 0 1 4.24 0l5.66 5.66a3 3 0 0 1-4.24 4.24L7 11.24A3 3 0 0 1 7 7Z" /></>,
        branches: <><path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
        cart: <><path d="M5 6h16l-2 9H8L5 3H2" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
        profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    };
    return <svg {...common}>{paths[name]}</svg>;
}

export default function BottomNav({ active, onNavigate }) {
    const { count } = useCart();
    const { t } = useT();

    const tabs = [
        { key: 'home', icon: 'home', label: t('home') },
        { key: 'catalog', icon: 'catalog', label: t('catalog') },
        { key: 'branches', icon: 'branches', label: t('branches') },
        { key: 'cart', icon: 'cart', label: t('cart') },
        { key: 'profile', icon: 'profile', label: t('profile') },
    ];

    return (
        <nav className="bottom-nav">
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    className={`nav-item ${active === tab.key ? 'active' : ''}`}
                    onClick={() => onNavigate(tab.key)}
                >
                    <span className="icon"><Icon name={tab.icon} /></span>
                    <span className="label">{tab.label}</span>
                    {tab.key === 'cart' && count > 0 && (
                        <span className="nav-badge">{count}</span>
                    )}
                </button>
            ))}
        </nav>
    );
}
