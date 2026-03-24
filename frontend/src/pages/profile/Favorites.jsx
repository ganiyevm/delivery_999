import React, { useState, useEffect } from 'react';
import { userAPI } from '../../api/index';
import DrugImage from '../../components/DrugImages';
import { useCart } from '../../context/CartContext';

export default function Favorites({ onBack, onProduct }) {
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);
    const { addToCart } = useCart();

    useEffect(() => {
        userAPI.getFavorites()
            .then(res => setFavorites(res.data || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const removeFav = async (id) => {
        await userAPI.removeFavorite(id);
        setFavorites(prev => prev.filter(f => f._id !== id));
    };

    if (loading) return <div className="loading"><div className="loading-spinner" /></div>;

    return (
        <div className="page">
            <div className="back-bar"><button className="back-btn" onClick={onBack}>←</button><h2>❤️ Sevimlilar</h2></div>
            {favorites.length === 0 ? (
                <div className="empty-state"><div className="icon">🤍</div><h3>Sevimlilar bo'sh</h3></div>
            ) : (
                favorites.map(p => (
                    <div key={p._id} className="product-list-item fade-up" onClick={() => onProduct?.(p)}>
                        <div className="product-list-img"><DrugImage category={p.category} size={50} /></div>
                        <div className="product-list-info">
                            <h4>{p.name}</h4>
                            <p className="meta">{p.manufacturer || p.category}</p>
                        </div>
                        <div className="product-list-right">
                            <button className="remove-btn" onClick={e => { e.stopPropagation(); removeFav(p._id); }}>✕</button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
