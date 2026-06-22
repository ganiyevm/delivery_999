import { lazy, Suspense, useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { useT } from './i18n';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';

const importCatalog = () => import('./pages/Catalog');
const importProductDetail = () => import('./pages/ProductDetail');
const importCart = () => import('./pages/Cart');

const Catalog = lazy(importCatalog);
const ProductDetail = lazy(importProductDetail);
const Branches = lazy(() => import('./pages/Branches'));
const Cart = lazy(importCart);
const Payment = lazy(() => import('./pages/Payment'));
const Profile = lazy(() => import('./pages/profile/Profile'));
const Favorites = lazy(() => import('./pages/profile/Favorites'));
const Orders = lazy(() => import('./pages/profile/Orders'));
const Addresses = lazy(() => import('./pages/profile/Addresses'));
const Bonus = lazy(() => import('./pages/profile/Bonus'));
const Settings = lazy(() => import('./pages/profile/Settings'));
const Scanner = lazy(() => import('./pages/Scanner'));
const PrescriptionUpload = lazy(() => import('./pages/PrescriptionUpload'));

function PageLoader() {
    return <div className="loading"><div className="loading-spinner" /></div>;
}

/* ── Toast: mahsulot qo'shildi xabarnomasi ─────────────────────── */
function CartToast() {
    const { toast } = useCart();
    const { t } = useT();
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
            🛒 {t('addedToCart')}
        </div>
    );
}

/* ── Float cart bar: savat to'ldirilganda pastda ko'rinadi ─────── */
function FloatCartBar({ page, onNavigate }) {
    const { count, total } = useCart();
    const { t } = useT();
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
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{t('viewCart')}</span>
            </div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>
                {total.toLocaleString()} {t('currency')}
            </span>
        </button>
    );
}

function AppContent() {
    // Navigatsiya tarixi (stack) — orqaga qaytish va Telegram BackButton uchun
    const [stack, setStack] = useState([{ page: 'home' }]);
    const current = stack[stack.length - 1];
    const { page, productId, paymentOrderId } = current;
    const restoreScrollRef = useRef(null);
    const { loading, error, retryAuth } = useAuth();

    useLayoutEffect(() => {
        if (restoreScrollRef.current === null) return;
        const scrollY = restoreScrollRef.current;
        restoreScrollRef.current = null;
        window.scrollTo(0, scrollY);
    }, [current]);

    // Eng ko'p ochiladigan sahifalarni brauzer bo'shaganda fonda tayyorlab qo'yamiz.
    useEffect(() => {
        const preload = () => {
            importCatalog();
            importProductDetail();
            importCart();
        };
        const idleId = window.requestIdleCallback
            ? window.requestIdleCallback(preload, { timeout: 2500 })
            : window.setTimeout(preload, 1800);
        return () => {
            if (window.cancelIdleCallback && typeof idleId === 'number') window.cancelIdleCallback(idleId);
            else window.clearTimeout(idleId);
        };
    }, []);

    // Tab/sahifaga o'tish. Sahifa stackda bo'lsa — o'shanga qaytadi (tab kabi),
    // bo'lmasa — tepaga qo'shadi. Shu bilan orqaga tugmasi doim mantiqiy ishlaydi.
    const navigate = useCallback((p, opts = {}) => {
        const extra = p === 'catalog' ? { catalogCategory: opts?.category || '' } : {};
        setStack(prev => {
            const top = prev[prev.length - 1];
            if (top.page === p) return [...prev.slice(0, -1), { ...top, ...extra }];
            const idx = prev.findIndex(e => e.page === p);
            if (idx >= 0) return [...prev.slice(0, idx), { ...prev[idx], ...extra }];
            return [...prev, { page: p, ...extra }];
        });
        window.scrollTo(0, 0);
    }, []);

    const goBack = useCallback(() => {
        setStack(prev => {
            if (prev.length <= 1) return prev;
            const next = prev.slice(0, -1);
            restoreScrollRef.current = next[next.length - 1]?.scrollY || 0;
            return next;
        });
    }, []);

    const openProduct = useCallback((product) => {
        setStack(prev => {
            const top = prev[prev.length - 1];
            const withScroll = [...prev.slice(0, -1), { ...top, scrollY: window.scrollY }];
            return [...withScroll, { page: 'productDetail', productId: product._id }];
        });
        window.scrollTo(0, 0);
    }, []);

    const openPayment = useCallback((id) => {
        setStack(prev => [...prev, { page: 'payment', paymentOrderId: id }]);
        window.scrollTo(0, 0);
    }, []);

    // To'lovdan keyin yangi kontekst — orqada faqat 'home' qoladi
    const finishTo = useCallback((p) => {
        setStack(p === 'home' ? [{ page: 'home' }] : [{ page: 'home' }, { page: p }]);
        window.scrollTo(0, 0);
    }, []);

    // Telegram mavzusi (dark/light) — foydalanuvchi qo'lda tanlamagan bo'lsa, Telegram'ga ergashadi
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        const saved = localStorage.getItem('theme');
        if (saved) document.documentElement.setAttribute('data-theme', saved);
        else if (tg?.colorScheme) document.documentElement.setAttribute('data-theme', tg.colorScheme);

        const onTheme = () => {
            if (!localStorage.getItem('theme') && tg?.colorScheme)
                document.documentElement.setAttribute('data-theme', tg.colorScheme);
        };
        tg?.onEvent?.('themeChanged', onTheme);
        return () => tg?.offEvent?.('themeChanged', onTheme);
    }, []);

    // Operator tasdiqlagandan keyin ?pay=orderId bilan ochilsa — to'lov sahifasi
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param
            || params.get('tgWebAppStartParam')
            || '';
        const startMatch = /^pay_([a-f\d]{24})(?:_(.+))?$/i.exec(startParam);
        const payId = params.get('pay') || startMatch?.[1];
        const returnedClickTransId = params.get('click_trans_id')
            || params.get('payment_id')
            || params.get('paymentId')
            || params.get('transaction_id')
            || params.get('id')
            || startMatch?.[2];
        if (payId) {
            // Click web checkout qaytganda payment id turli nomlar bilan kelishi mumkin.
            if (returnedClickTransId) localStorage.setItem(`click_trans_${payId}`, returnedClickTransId);
            setStack([{ page: 'home' }, { page: 'payment', paymentOrderId: payId }]);
            return;
        }
        // Click/Payme dan qaytganda — pending to'lovni tiklash
        const pendingId = localStorage.getItem('pendingPaymentOrderId');
        if (pendingId) {
            localStorage.removeItem('pendingPaymentOrderId');
            if (returnedClickTransId) localStorage.setItem(`click_trans_${pendingId}`, returnedClickTransId);
            setStack([{ page: 'home' }, { page: 'payment', paymentOrderId: pendingId }]);
        }
    }, []);

    // Telegram BackButton — stackда birdan ortiq sahifa bo'lsa ko'rsatiladi
    useEffect(() => {
        const bb = window.Telegram?.WebApp?.BackButton;
        if (!bb) return;
        if (stack.length > 1) bb.show?.(); else bb.hide?.();
    }, [stack.length]);

    useEffect(() => {
        const bb = window.Telegram?.WebApp?.BackButton;
        if (!bb?.onClick) return;
        const handler = () => goBack();
        bb.onClick(handler);
        return () => { try { bb.offClick?.(handler); } catch { /* ignore */ } };
    }, [goBack]);

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

    const showNav = !['payment', 'favorites', 'orders', 'addresses', 'bonus', 'settings', 'scanner', 'prescription'].includes(page);
    const catalogEntry = stack.find(entry => entry.page === 'catalog');

    return (
        <>
            <CartToast />
            {page === 'home' && <Home onNavigate={navigate} onProduct={openProduct} onScanner={() => navigate('scanner')} />}
            <Suspense fallback={<PageLoader />}>
                {catalogEntry && (
                    <div style={{ display: page === 'catalog' ? 'block' : 'none' }} aria-hidden={page !== 'catalog'}>
                        <Catalog
                            key={catalogEntry.catalogCategory || 'all'}
                            onProduct={openProduct}
                            initialCategory={catalogEntry.catalogCategory}
                            active={page === 'catalog'}
                        />
                    </div>
                )}
                {page === 'productDetail' && <ProductDetail productId={productId} onBack={goBack} />}
                {page === 'branches' && <Branches />}
                {page === 'cart' && <Cart onNavigate={navigate} onPayment={openPayment} />}
                {page === 'payment' && <Payment orderId={paymentOrderId} onDone={finishTo} />}
                {page === 'profile' && <Profile onNavigate={navigate} />}
                {page === 'favorites' && <Favorites onBack={goBack} onProduct={openProduct} />}
                {page === 'orders' && <Orders onBack={goBack} />}
                {page === 'addresses' && <Addresses onBack={goBack} />}
                {page === 'bonus' && <Bonus onBack={goBack} />}
                {page === 'settings' && <Settings onBack={goBack} />}
                {page === 'scanner' && <Scanner onBack={goBack} />}
                {page === 'prescription' && <PrescriptionUpload onBack={goBack} onCart={() => navigate('cart')} />}
            </Suspense>
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
