import { useState, useEffect, useRef, useCallback } from 'react';
import { productsAPI } from '../api/index';
import ProductCard from '../components/ProductCard';
import { useT } from '../i18n';

const CATEGORY_KEYS = ['', 'pain', 'antibiotics', 'vitamins', 'heart', 'children', 'cosmetics', 'devices', 'stomach'];

export default function Catalog({ onProduct, initialCategory }) {
    const { t } = useT();
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
                <h2>💊 {t('catalog')}</h2>
            </div>

            <div className="search-bar" style={{ top: 0 }}>
                <span className="search-icon">🔍</span>
                <input
                    className="search-input"
                    placeholder={t('searchPlaceholder')}
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
                    {CATEGORY_KEYS.map(key => (
                        <button key={key} className={`chip ${category === key ? 'active' : ''}`}
                            onClick={() => setCategory(key)}>
                            {key === '' ? t('allCategories') : t(`cat_${key}`)}
                        </button>
                    ))}
                </div>
            )}

            {isSearching && products.length > 0 && !loading && (
                <div className="search-count">
                    {t('foundCount').replace('{n}', products.length)}
                </div>
            )}

            {products.length === 0 && !loading ? (
                <div className="empty-state">
                    <div className="icon">🔍</div>
                    <h3>{t('noProducts')}</h3>
                    <p>{t('tryOtherSearch')}</p>
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
