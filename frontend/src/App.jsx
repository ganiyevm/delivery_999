import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import Branches from './pages/Branches';
import Cart from './pages/Cart';
import Payment from './pages/Payment';
import Profile from './pages/profile/Profile';
import Favorites from './pages/profile/Favorites';
import Orders from './pages/profile/Orders';
import Addresses from './pages/profile/Addresses';
import Bonus from './pages/profile/Bonus';
import Settings from './pages/profile/Settings';
import Scanner from './pages/Scanner';

/* ── Toast: mahsulot qo'shildi xabarnomasi ─────────────────────── */
function CartToast() {
    const { toast } = useCart();
    if (!toast) return null;
    return (
        <div style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 9999, background: 'var(--green)', color: '#fff',
            padding: '10px 20px', borderRadius: 24,
            fontSize: 13, fontWeight: 700,
            boxShadow: '0 4px 20px rgba(39,174,96,0.4)',
            display: 'flex', alignItems: 'center', gap: 8,
            animation: 'toastIn 0.25s ease',
            maxWidth: 'calc(100vw - 32px)', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
            🛒 Savatga qo'shildi
        </div>
    );
}

/* ── Float cart bar: savat to'ldirilganda pastda ko'rinadi ─────── */
function FloatCartBar({ page, onNavigate }) {
    const { count, total } = useCart();
    const hide = count === 0 || ['cart', 'payment', 'productDetail'].includes(page);
    if (hide) return null;
    return (
        <button
            onClick={() => onNavigate('cart')}
            style={{
                position: 'fixed', bottom: 72, left: 16, right: 16,
                zIndex: 900, border: 'none', cursor: 'pointer',
                background: 'var(--green)',
                borderRadius: 16, padding: '13px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 24px rgba(39,174,96,0.45)',
                animation: 'toastIn 0.2s ease',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                    background: 'rgba(255,255,255,0.25)', borderRadius: 20,
                    width: 26, height: 26, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff',
                }}>{count}</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Savatni ko'rish</span>
            </div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>
                {total.toLocaleString()} сўм
            </span>
        </button>
    );
}

function AppContent() {
    const [page, setPage] = useState('home');
    const [productId, setProductId] = useState(null);
    const [paymentOrderId, setPaymentOrderId] = useState(null);
    const [catalogCategory, setCatalogCategory] = useState('');
    const { loading, error, retryAuth } = useAuth();

    // Dark mode persist
    useEffect(() => {
        const theme = localStorage.getItem('theme');
        if (theme) document.documentElement.setAttribute('data-theme', theme);
    }, []);

    // Click/Payme dan qaytganda — pending to'lovni tiklash
    useEffect(() => {
        const pendingId = localStorage.getItem('pendingPaymentOrderId');
        if (pendingId) {
            localStorage.removeItem('pendingPaymentOrderId');
            setPaymentOrderId(pendingId);
            setPage('payment');
        }
    }, []);

    const navigate = (p, opts) => {
        if (p === 'catalog' && opts?.category) setCatalogCategory(opts.category);
        else setCatalogCategory('');
        setPage(p);
        window.scrollTo(0, 0);
    };

    const openProduct = (product) => {
        setProductId(product._id);
        setPage('productDetail');
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', flexDirection: 'column', padding: 24, textAlign: 'center',
            }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>😔</div>
                <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Xatolik yuz berdi</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
                    Ilovani yuklashda muammo bo'ldi.<br />
                    Iltimos, qayta urinib ko'ring.
                </p>
                <button className="btn-primary" onClick={retryAuth}
                    style={{ maxWidth: 200, margin: '0 auto' }}>
                    🔄 Qayta urinish
                </button>
            </div>
        );
    }

    const showNav = !['payment', 'favorites', 'orders', 'addresses', 'bonus', 'settings', 'scanner'].includes(page);

    return (
        <>
            <CartToast />
            {page === 'home' && <Home onNavigate={navigate} onProduct={openProduct} onScanner={() => navigate('scanner')} />}
            {page === 'catalog' && <Catalog onProduct={openProduct} initialCategory={catalogCategory} />}
            {page === 'productDetail' && <ProductDetail productId={productId} onBack={() => setPage('catalog')} />}
            {page === 'branches' && <Branches />}
            {page === 'cart' && <Cart onNavigate={navigate} onPayment={id => { setPaymentOrderId(id); setPage('payment'); }} />}
            {page === 'payment' && <Payment orderId={paymentOrderId} onDone={navigate} />}
            {page === 'profile' && <Profile onNavigate={navigate} />}
            {page === 'favorites' && <Favorites onBack={() => setPage('profile')} onProduct={openProduct} />}
            {page === 'orders' && <Orders onBack={() => setPage('profile')} />}
            {page === 'addresses' && <Addresses onBack={() => setPage('profile')} />}
            {page === 'bonus' && <Bonus onBack={() => setPage('profile')} />}
            {page === 'settings' && <Settings onBack={() => setPage('profile')} />}
            {page === 'scanner' && <Scanner onBack={() => setPage('home')} />}
            {showNav && <BottomNav active={page} onNavigate={navigate} />}
            <FloatCartBar page={page} onNavigate={navigate} />
        </>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <CartProvider>
                <AppContent />
            </CartProvider>
        </AuthProvider>
    );
}
