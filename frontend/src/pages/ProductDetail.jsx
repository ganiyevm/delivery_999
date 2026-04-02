import { useState, useEffect } from 'react';
import { productsAPI, userAPI } from '../api/index';
import DrugImage from '../components/DrugImages';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

export default function ProductDetail({ productId, onBack }) {
    const { t } = useT();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isFav, setIsFav] = useState(false);
    const [qty, setQty] = useState(1);
    const { addToCart } = useCart();
    const { user } = useAuth();

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await productsAPI.getById(productId);
                setProduct(data);
                setIsFav(user?.favorites?.includes(productId) || false);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [productId]);

    const toggleFav = async () => {
        try {
            if (isFav) {
                await userAPI.removeFavorite(productId);
            } else {
                await userAPI.addFavorite(productId);
            }
            setIsFav(!isFav);
        } catch (err) { console.error(err); }
    };

    const handleAddToCart = () => {
        if (!product) return;
        const bestStock = product.stocks?.find(s => s.qty > 0);
        for (let i = 0; i < qty; i++) {
            addToCart({ ...product, price: bestStock?.price || product.minPrice }, bestStock?.branch?._id);
        }
    };

    if (loading) return <div className="loading"><div className="loading-spinner" /></div>;
    if (!product) return <div className="empty-state"><div className="icon">😔</div><h3>{t('notFound')}</h3></div>;

    const availableStocks = product.stocks?.filter(s => s.qty > 0) || [];

    return (
        <div className="page" style={{ paddingBottom: 140 }}>
            <div className="back-bar">
                <button className="back-btn" onClick={onBack}>←</button>
                <h2>{t('productTitle')}</h2>
            </div>

            <div className="product-detail-img fade-up">
                <DrugImage imageType={product.imageType} imageUrl={product.imageUrl} category={product.category} size={190} />
            </div>

            <div className="product-detail-info">
                <div className="product-detail-badges">
                    {product.requiresRx && <span className="badge badge-rx">Rx</span>}
                    {product.totalQty > 0 ? (
                        <span className="badge badge-instock">✓ {t('inStock')}</span>
                    ) : (
                        <span className="badge badge-outstock">{t('outOfStock')}</span>
                    )}
                </div>
                <h1 className="product-detail-name">{product.name}</h1>
                <div className="product-detail-price">
                    {product.minPrice ? `${product.minPrice.toLocaleString()} сўм` : t('noPriceSet')}
                </div>
            </div>

            {product.manufacturer && (
                <div className="product-detail-section">
                    <h3>{t('manufacturer')}</h3>
                    <p>{product.manufacturer} {product.country ? `(${product.country})` : ''}</p>
                </div>
            )}

            {product.ingredient && (
                <div className="product-detail-section">
                    <h3>{t('ingredient')}</h3>
                    <p>{product.ingredient}</p>
                </div>
            )}

            {product.description?.uz && (
                <div className="product-detail-section">
                    <h3>{t('descriptionLabel')}</h3>
                    <p>{product.description.uz}</p>
                </div>
            )}

            {product.analogs?.length > 0 && (
                <div className="product-detail-section">
                    <h3>{t('analogs')}</h3>
                    <div className="chips-scroll" style={{ paddingLeft: 0 }}>
                        {product.analogs.map((a, i) => <span key={i} className="chip">{a}</span>)}
                    </div>
                </div>
            )}

            {availableStocks.length > 0 && (
                <div className="product-detail-section">
                    <h3>{t('availableBranches')} ({availableStocks.length})</h3>
                    {availableStocks.map((s, i) => (
                        <div key={i} className="branch-card" style={{ marginLeft: 0, marginRight: 0 }}>
                            <div className="branch-info">
                                <h4>№{String(s.branch?.number).padStart(3, '0')} {s.branch?.name}</h4>
                                <p>{s.price?.toLocaleString()} сўм • {s.qty} {t('leftInStock')}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="fixed-bottom">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                    <button onClick={toggleFav} style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer' }}>
                        {isFav ? '❤️' : '🤍'}
                    </button>
                    <div className="qty-controls">
                        <button className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                        <span className="qty-value">{qty}</span>
                        <button className="qty-btn" onClick={() => setQty(qty + 1)}>+</button>
                    </div>
                </div>
                <button className="btn-primary" onClick={handleAddToCart} disabled={product.totalQty === 0}>
                    {product.totalQty > 0
                        ? `${t('addToCart')} • ${((product.minPrice || 0) * qty).toLocaleString()} сўм`
                        : t('outOfStock')}
                </button>
            </div>
        </div>
    );
}
