import React, { useState, useEffect } from 'react';
import { paymentAPI } from '../api/index';
import { useCart } from '../context/CartContext';

const DB_POLL_INTERVAL     = 5000;  // Bazani har 5 sekundda tekshir
const CLICK_CHECK_INTERVAL = 15000; // Click API ni har 15 sekundda tekshir
const TIMEOUT_MS           = 5 * 60 * 1000; // 5 daqiqadan keyin timeout

export default function Payment({ orderId, onDone }) {
    const [status, setStatus]         = useState('pending');
    const [orderInfo, setOrderInfo]   = useState(null);
    const [timedOut, setTimedOut]     = useState(false);
    const [checking, setChecking]     = useState(false);
    const [checkError, setCheckError] = useState('');
    const { clearCart } = useCart();

    useEffect(() => {
        if (!orderId) return;
        let done = false;

        const confirm = (info) => {
            if (done) return;
            done = true;
            clearCart();
            setOrderInfo(info);
            setStatus('success');
        };

        const fail = () => {
            if (done) return;
            done = true;
            setStatus('failed');
        };

        const checkDb = async () => {
            if (done) return;
            try {
                const { data } = await paymentAPI.getStatus(orderId);
                if (data.paymentStatus === 'paid') confirm(data);
                else if (data.paymentStatus === 'failed') fail();
            } catch { /* ignore */ }
        };

        const checkClickApi = async () => {
            if (done) return;
            try {
                const { data } = await paymentAPI.checkClick(orderId);
                if (data.paid) {
                    const { data: info } = await paymentAPI.getStatus(orderId);
                    confirm(info);
                }
            } catch { /* ignore */ }
        };

        // 1. Darhol tekshir
        checkDb();

        // 2. Bazani polling
        const dbInterval = setInterval(checkDb, DB_POLL_INTERVAL);

        // 3. Click API tekshirish
        const clickInterval = setInterval(checkClickApi, CLICK_CHECK_INTERVAL);

        // 4. Foydalanuvchi Click dan qaytishi bilan — DARHOL tekshir
        const onVisible = () => {
            if (!done && document.visibilityState === 'visible') {
                checkDb();
                setTimeout(checkClickApi, 600);
            }
        };
        document.addEventListener('visibilitychange', onVisible);

        // 5. Timeout
        const timeout = setTimeout(() => {
            if (!done) setTimedOut(true);
        }, TIMEOUT_MS);

        return () => {
            clearInterval(dbInterval);
            clearInterval(clickInterval);
            clearTimeout(timeout);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [orderId]);

    if (status === 'success') {
        return (
            <div className="page">
                <div className="payment-status fade-up">
                    <div className="icon pulse">✅</div>
                    <h2>To'lov qabul qilindi!</h2>
                    <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', margin: '12px 0' }}>
                        #{orderInfo?.orderNumber}
                    </p>
                    {orderInfo?.bonusEarned > 0 && (
                        <p style={{ color: 'var(--orange)', fontWeight: 700 }}>
                            +{orderInfo.bonusEarned} bonus ball 🎉
                        </p>
                    )}
                    <button className="btn-primary"
                        style={{ marginTop: 24, maxWidth: 280, margin: '24px auto 0' }}
                        onClick={() => onDone?.('orders')}>
                        Buyurtmalarni ko'rish
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'failed') {
        return (
            <div className="page">
                <div className="payment-status fade-up">
                    <div className="icon">❌</div>
                    <h2>To'lov amalga oshmadi</h2>
                    <p>To'lovda xatolik yuz berdi. Qayta urinib ko'ring.</p>
                    <button className="btn-primary"
                        style={{ marginTop: 24, maxWidth: 280, margin: '24px auto 0' }}
                        onClick={() => onDone?.('cart')}>
                        Qayta urinish
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="payment-status">
                {timedOut ? (
                    <>
                        <div className="icon">⏱</div>
                        <h2>To'lov tekshirilmoqda</h2>
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Agar Click orqali to'lov amalga oshgan bo'lsa,
                            buyurtma tez orada yangilanadi.
                        </p>
                        <button className="btn-primary"
                            style={{ marginTop: 24, maxWidth: 280, margin: '24px auto 0' }}
                            onClick={() => onDone?.('orders')}>
                            Buyurtmalarni ko'rish
                        </button>
                        <button className="btn"
                            style={{ marginTop: 12, maxWidth: 280, margin: '12px auto 0' }}
                            onClick={() => onDone?.('cart')}>
                            Savatga qaytish
                        </button>
                    </>
                ) : (
                    <>
                        <div className="payment-loader" />
                        <h2>To'lov tasdiqlanmoqda...</h2>
                        <p>Click orqali to'lovni amalga oshiring.<br />Bu sahifa avtomatik yangilanadi.</p>

                        <button
                            className="btn-primary"
                            disabled={checking}
                            style={{ marginTop: 24, maxWidth: 280, margin: '24px auto 0', opacity: checking ? 0.7 : 1 }}
                            onClick={async () => {
                                setChecking(true);
                                setCheckError('');
                                try {
                                    const { data } = await paymentAPI.checkClick(orderId);
                                    if (data.paid) {
                                        const { data: info } = await paymentAPI.getStatus(orderId);
                                        clearCart();
                                        setOrderInfo(info);
                                        setStatus('success');
                                    } else {
                                        setCheckError(data.message || "To'lov tasdiqlanmadi");
                                    }
                                } catch {
                                    setCheckError("Serverga ulanishda xato. Qayta urinib ko'ring.");
                                }
                                setChecking(false);
                            }}>
                            {checking ? 'Tekshirilmoqda...' : "✅ To'lovni tasdiqlash"}
                        </button>

                        {checkError && (
                            <div style={{
                                marginTop: 12, padding: '10px 16px',
                                background: '#fff3f3', border: '1px solid #ffcdd2',
                                borderRadius: 10, color: '#c0392b',
                                fontSize: 13, textAlign: 'center',
                                maxWidth: 280, margin: '12px auto 0',
                            }}>
                                ❌ {checkError}
                            </div>
                        )}

                        <button className="btn"
                            style={{ marginTop: 10, maxWidth: 280, margin: '12px auto 0' }}
                            onClick={() => onDone?.('orders')}>
                            Buyurtmalarni ko'rish
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
