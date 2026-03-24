import React, { useState, useEffect, useRef, useCallback } from 'react';
import { productsAPI } from '../api/index';
import ProductCard from '../components/ProductCard';

const CATEGORIES = [
    { key: '', label: 'Barchasi' },
    { key: 'pain', label: "Og'riq" },
    { key: 'antibiotics', label: 'Antibiotik' },
    { key: 'vitamins', label: 'Vitamin' },
    { key: 'heart', label: 'Yurak' },
    { key: 'children', label: 'Bolalar' },
    { key: 'cosmetics', label: 'Kosmetika' },
    { key: 'devices', label: 'Asboblar' },
    { key: 'stomach', label: "Me'da" },
];

export default function Catalog({ onProduct, initialCategory }) {
    const [products, setProducts] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState(initialCategory || '');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const observerRef = useRef();
    const searchTimeout = useRef();

    const isSearching = search.trim().length > 0;

    const fetchProducts = useCallback(async (p = 1, reset = false) => {
        if (loading) return;
        setLoading(true);
        try {
            const params = { page: p, limit: 20 };
            if (search) params.search = search;
            if (category) params.category = category;
            const { data } = await productsAPI.getAll(params);
            const newProducts = data.products || [];
            setProducts(prev => reset ? newProducts : [...prev, ...newProducts]);
            setHasMore(p < (data.pagination?.pages || 1));
            setPage(p);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [search, category]);

    useEffect(() => {
        fetchProducts(1, true);
    }, [search, category]);

    // Infinite scroll
    const lastRef = useCallback(node => {
        if (loading) return;
        if (observerRef.current) observerRef.current.disconnect();
        observerRef.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                fetchProducts(page + 1);
            }
        });
        if (node) observerRef.current.observe(node);
    }, [loading, hasMore, page]);

    const handleSearch = (e) => {
        const val = e.target.value;
        setInputValue(val);
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => setSearch(val), 300);
    };

    const clearSearch = () => {
        setInputValue('');
        setSearch('');
    };

    return (
        <div className="page">
            <div className="back-bar">
                <h2>💊 Katalog</h2>
            </div>

            <div className="search-bar" style={{ top: 0 }}>
                <span className="search-icon">🔍</span>
                <input
                    className="search-input"
                    placeholder="Dori nomini yozing..."
                    value={inputValue}
                    onChange={handleSearch}
                    autoFocus
                />
                {inputValue && (
                    <button className="search-clear-btn" onClick={clearSearch}>✕</button>
                )}
            </div>

            {!isSearching && (
                <div className="chips-scroll">
                    {CATEGORIES.map(c => (
                        <button key={c.key} className={`chip ${category === c.key ? 'active' : ''}`}
                            onClick={() => setCategory(c.key)}>
                            {c.label}
                        </button>
                    ))}
                </div>
            )}

            {isSearching && products.length > 0 && !loading && (
                <div className="search-count">{products.length} ta dori topildi</div>
            )}

            {products.length === 0 && !loading ? (
                <div className="empty-state">
                    <div className="icon">🔍</div>
                    <h3>Topilmadi</h3>
                    <p>Boshqa so'z bilan qidiring</p>
                </div>
            ) : isSearching ? (
                <div className="search-results-list">
                    {products.map((p, i) => (
                        <div key={p._id} ref={i === products.length - 1 ? lastRef : null}>
                            <ProductCard product={p} onClick={onProduct} searchMode />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="products-grid">
                    {products.map((p, i) => (
                        <div key={p._id} ref={i === products.length - 1 ? lastRef : null}>
                            <ProductCard product={p} onClick={onProduct} />
                        </div>
                    ))}
                </div>
            )}

            {loading && <div className="loading"><div className="loading-spinner" /></div>}
        </div>
    );
}
