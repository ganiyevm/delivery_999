import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
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

    const showNav = !['productDetail', 'payment', 'favorites', 'orders', 'addresses', 'bonus', 'settings', 'scanner'].includes(page);

    return (
        <>
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
