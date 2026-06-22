import { useState, useEffect, useCallback } from 'react';
import { productsAPI, userAPI } from '../api/index';
import DrugImage from '../components/DrugImages';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

export default function ProductDetail({ productId, onBack }) {
    const { t } = useT();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isFav, setIsFav] = useState(false);
    const [qty, setQty] = useState(1);
    const { addToCart } = useCart();
    const { user } = useAuth();

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const { data } = await productsAPI.getById(productId);
            setProduct(data);
            setIsFav(user?.favorites?.includes(productId) || false);
        } catch (err) {
            console.error(err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [productId, user]);

    useEffect(() => {
        load();
    }, [load]);

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

    // Eng arzon filial (isSynced, qty>0) — narx bo'yicha saralangan
    const bestStock = (product?.stocks || [])
        .filter(s => s.qty > 0 && s.branch?.isSynced === true)
        .sort((a, b) => (a.price || 0) - (b.price || 0))[0];

    // Arzonidan boshlab to'ldirish: qty ta uchun jami narxni hisoblaydi
    const calcTotalPrice = (stock, needed) => {
        const batches = Array.isArray(stock?.batches) && stock.batches.length > 0
            ? [...stock.batches].sort((a, b) => (a.price || 0) - (b.price || 0))
            : [{ price: stock?.price || 0, qty: stock?.qty || 0 }];
        let remaining = needed;
        let total = 0;
        for (const b of batches) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, b.qty || 0);
            total += take * (b.price || 0);
            remaining -= take;
        }
        return total;
    };

    const handleAddToCart = () => {
        if (!product || !bestStock || product.requiresRx) return;
        addToCart({ ...product, price: bestStock.price }, bestStock.branch?._id, qty);
    };

    if (loading) return <div className="loading"><div className="loading-spinner" /></div>;
    if (error) return (
        <div className="empty-state">
            <div className="icon">😔</div>
            <h3>{t('loadError')}</h3>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
                <button className="btn-primary" style={{ maxWidth: 160 }} onClick={load}>🔄 {t('retry')}</button>
                <button className="btn" style={{ maxWidth: 120 }} onClick={onBack}>{t('back')}</button>
            </div>
        </div>
    );
    if (!product) return <div className="empty-state"><div className="icon">😔</div><h3>{t('notFound')}</h3></div>;

    // Faqat isSynced=true bo'lgan filiallar ko'rsatiladi (agent o'rnatilgan, real vaqt sync).
    // Yangi filial ulanganda admin panel orqali Branch.isSynced=true qilinadi — kod o'zgarmaydi.
    const availableStocks = (product.stocks || []).filter(s =>
        s.qty > 0 && s.branch?.isSynced === true
    );

    return (
        <div className="page" style={{ paddingBottom: 200 }}>
            <div className="back-bar">
                <button className="back-btn" onClick={onBack}>←</button>
                <h2>{t('productTitle')}</h2>
            </div>

            <div className="product-detail-img fade-up">
                <DrugImage
                    imageType={product.imageType}
                    imageUrl={product.imageUrl}
                    category={product.category}
                    size={190}
                    fit="cover"
                    loading="eager"
                    fetchPriority="high"
                />
            </div>

            <div className="product-detail-info">
                <div className="product-detail-badges">
                    {product.requiresRx && <span className="badge badge-rx">Rx {t('requiresPrescription')}</span>}
                    {product.totalQty > 0 ? (
                        <span className="badge badge-instock">✓ {t('inStock')}</span>
                    ) : (
                        <span className="badge badge-outstock">{t('outOfStock')}</span>
                    )}
                </div>
                <h1 className="product-detail-name">{product.name}</h1>
                <div className="product-detail-price">
                    {product.minPrice ? `${product.minPrice.toLocaleString()} ${t('currency')}` : t('noPriceSet')}
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
                        <div key={i} className="branch-card" style={{ marginLeft: 0, marginRight: 0, flexDirection: 'column' }}>
                            <div className="branch-info">
                                <h4>№{String(s.branch?.number).padStart(3, '0')} {s.branch?.name}</h4>
                                <p>{s.price?.toLocaleString()} {t('currency')} • {s.qty} {t('leftInStock')}</p>
                            </div>
                            {/* Partiyalar — faqat NARX har xil bo'lganda, narx bo'yicha guruhlab ko'rsatamiz */}
                            {(() => {
                                // qty>0 va price>0 bo'lgan batchlar
                                const batches = (Array.isArray(s.batches) ? s.batches : [])
                                    .filter(b => (b.qty || 0) > 0 && (b.price || 0) > 0);
                                const prices = [...new Set(batches.map(b => b.price))];
                                if (prices.length <= 1) return null; // bitta narx — guruh kerak emas
                                const groups = prices.sort((a, b) => a - b).map(p => {
                                    const bs = batches.filter(b => b.price === p);
                                    return {
                                        price: p,
                                        qty: bs.reduce((sum, b) => sum + (b.qty || 0), 0),
                                        serias: [...new Set(bs.map(b => b.seria).filter(Boolean))],
                                    };
                                });
                                return (
                                    <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>{t('batchesTitle')}</div>
                                        {groups.map((g, gi) => (
                                            <div key={gi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                                <span style={{ color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {g.serias.length ? `${t('seriaLabel')}: ${g.serias.join(', ')}` : '—'}
                                                </span>
                                                <span style={{ flexShrink: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{g.qty} {t('leftInStock')}</span>
                                                    {g.price?.toLocaleString()} {t('currency')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
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
                <button className="btn-primary" onClick={handleAddToCart} disabled={product.totalQty === 0 || product.requiresRx}>
                    {product.requiresRx
                        ? t('requiresPrescription')
                        : product.totalQty > 0
                        ? `${t('addToCart')} • ${calcTotalPrice(bestStock, qty).toLocaleString()} ${t('currency')}`
                        : t('outOfStock')}
                </button>
            </div>
        </div>
    );
}
