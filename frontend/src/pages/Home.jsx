import React, { useState, useEffect } from 'react';
import { productsAPI, branchesAPI } from '../api/index';
import ProductCard from '../components/ProductCard';
import DrugImage from '../components/DrugImages';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const CATEGORIES = [
    { key: 'pain', icon: '💊', name: "Og'riq" },
    { key: 'antibiotics', icon: '🦠', name: 'Antibiotik' },
    { key: 'vitamins', icon: '🌟', name: 'Vitamin' },
    { key: 'heart', icon: '❤️', name: 'Yurak' },
    { key: 'children', icon: '👶', name: 'Bolalar' },
    { key: 'cosmetics', icon: '💄', name: 'Kosmetika' },
    { key: 'devices', icon: '🩺', name: 'Asboblar' },
    { key: 'stomach', icon: '🫀', name: "Me'da" },
];

export default function Home({ onNavigate, onProduct, onScanner }) {
    const { user } = useAuth();
    const { count } = useCart();
    const [popular, setPopular] = useState([]);
    const [branchCount, setBranchCount] = useState(20);

    useEffect(() => {
        productsAPI.getAll({ sort: 'popular', limit: 6 })
            .then(res => setPopular(res.data.products || []))
            .catch(() => { });
        branchesAPI.getAll()
            .then(res => { if (res.data?.length) setBranchCount(res.data.length); })
            .catch(() => { });
    }, []);

    const bonusProgress = user ? Math.min((user.bonusPoints || 0) / 50, 100) : 0;
    const tierLabel = { silver: '🥈 Kumush', gold: '🥇 Oltin', platinum: '💎 Platina' };

    return (
        <div className="page">
            {/* Header */}
            <header className="header">
                <div className="header-logo">
                    <img src="/logo999.jpg" alt="999" style={{ height: 40, width: 40, borderRadius: 10, objectFit: 'cover' }} />
                    <h1>Сеть Аптек 999<span>Тошкент бўйлаб 20 филиал</span></h1>
                </div>
                <div className="header-actions">
                    <button className="header-btn" onClick={onScanner}>📷</button>
                    <button className="header-btn" onClick={() => onNavigate('cart')}>
                        🛒
                        {count > 0 && <span className="cart-badge">{count}</span>}
                    </button>
                </div>
            </header>

            {/* Search */}
            <div className="search-bar" onClick={() => onNavigate('catalog')}>
                <span className="search-icon">🔍</span>
                <input className="search-input" placeholder="Dori, tarkib yoki analog..." readOnly />
            </div>

            {/* Promo */}
            <div className="promo-banner fade-up">
                <h2>🎉 Birinchi buyurtmada</h2>
                <p>Bepul yetkazib berish + 500 bonus ball!</p>
            </div>

            {/* Stats */}
            <div className="stats-grid fade-up">
                <div className="stat-card">
                    <div className="icon">🏥</div>
                    <div className="value">{branchCount}</div>
                    <div className="label">Filial</div>
                </div>
                <div className="stat-card">
                    <div className="icon">💊</div>
                    <div className="value">4000+</div>
                    <div className="label">Dori</div>
                </div>
                <div className="stat-card">
                    <div className="icon">🚚</div>
                    <div className="value">1-2</div>
                    <div className="label">soat</div>
                </div>
            </div>

            {/* Bonus */}
            {user && (
                <div className="bonus-card fade-up" onClick={() => onNavigate('bonus')}>
                    <div className="tier">{tierLabel[user.bonusTier] || '🥈 Kumush'}</div>
                    <div className="points">{(user.bonusPoints || 0).toLocaleString()}</div>
                    <div className="points-label">bonus ball</div>
                    <div className="bonus-progress">
                        <div className="bonus-progress-fill" style={{ width: `${bonusProgress}%` }} />
                    </div>
                </div>
            )}

            {/* Categories */}
            <h3 className="section-title">Kategoriyalar</h3>
            <div className="categories-grid fade-up">
                {CATEGORIES.map(cat => (
                    <div key={cat.key} className="category-item" onClick={() => onNavigate('catalog', { category: cat.key })}>
                        <div className="icon">{cat.icon}</div>
                        <div className="name">{cat.name}</div>
                    </div>
                ))}
            </div>

            {/* Popular */}
            <h3 className="section-title">Ommabop dorilar</h3>
            <div className="products-grid fade-up">
                {popular.map(p => (
                    <ProductCard key={p._id} product={p} onClick={onProduct} />
                ))}
            </div>

            {/* Delivery info */}
            <h3 className="section-title">Yetkazib berish</h3>
            <div className="delivery-info fade-up">
                <div className="delivery-info-grid">
                    <div className="delivery-info-item">
                        <div className="icon">💰</div>
                        <div className="text">Min 50,000 сўм</div>
                        <div className="sub">Minimal buyurtma</div>
                    </div>
                    <div className="delivery-info-item">
                        <div className="icon">🚚</div>
                        <div className="text">1-2 soat</div>
                        <div className="sub">Yetkazib berish</div>
                    </div>
                    <div className="delivery-info-item">
                        <div className="icon">💳</div>
                        <div className="text">Payme / Click</div>
                        <div className="sub">To'lov usuli</div>
                    </div>
                    <div className="delivery-info-item">
                        <div className="icon">🕐</div>
                        <div className="text">09:00 — 22:00</div>
                        <div className="sub">Ish vaqti</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
