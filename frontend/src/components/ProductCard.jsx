import React from 'react';
import DrugImage from './DrugImages';
import { useCart } from '../context/CartContext';

export default function ProductCard({ product, onClick, searchMode }) {
    const { addToCart } = useCart();

    const handleAdd = (e) => {
        e.stopPropagation();
        addToCart(product, product.branchId);
    };

    const canBuy = product.inStock !== false && product.price > 0;
    const desc = product.description?.uz || product.ingredient || '';

    if (searchMode) {
        return (
            <div className="search-result-card fade-up" onClick={() => onClick?.(product)}>
                <div className="search-result-img">
                    <DrugImage
                        imageType={product.imageType}
                        imageUrl={product.imageUrl}
                        category={product.category}
                        size={88}
                    />
                </div>
                <div className="search-result-info">
                    <div className="search-result-name">{product.name}</div>
                    {product.manufacturer && (
                        <div className="search-result-mfr">
                            {product.manufacturer}{product.country ? ` (${product.country})` : ''}
                        </div>
                    )}
                    {desc ? (
                        <div className="search-result-desc">{desc}</div>
                    ) : null}
                    <div className="search-result-bottom">
                        <span className="product-card-price">
                            {product.price ? `${product.price.toLocaleString()} сўм` : '—'}
                        </span>
                        {canBuy && (
                            <button className="add-to-cart-btn" onClick={handleAdd}>+</button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="product-card fade-up" onClick={() => onClick?.(product)}>
            <div className="product-card-img">
                <DrugImage
                    imageType={product.imageType}
                    imageUrl={product.imageUrl}
                    category={product.category}
                    size={80}
                />
            </div>
            <div className="product-card-info">
                <div className="product-card-name">{product.name}</div>
                <div className="product-card-manufacturer">
                    {product.manufacturer || ''} {product.country ? `(${product.country})` : ''}
                </div>
                <div className="product-card-bottom">
                    <span className="product-card-price">
                        {product.price ? `${product.price.toLocaleString()} сўм` : '—'}
                    </span>
                    {canBuy && (
                        <button className="add-to-cart-btn" onClick={handleAdd}>+</button>
                    )}
                </div>
            </div>
        </div>
    );
}
