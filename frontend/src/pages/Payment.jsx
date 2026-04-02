import { useState, useEffect } from 'react';
import { paymentAPI } from '../api/index';
import { useCart } from '../context/CartContext';
import { useT } from '../i18n';

const DB_POLL_INTERVAL  = 5000;
const API_CHECK_INTERVAL = 15000;
const TIMEOUT_MS = 5 * 60 * 1000;

export default function Payment({ orderId, onDone }) {
    const { t } = useT();
    const [status, setStatus] = useState('pending');
    const [orderInfo, setOrderInfo] = useState(null);
    const [timedOut, setTimedOut] = useState(false);
    const [checking, setChecking] = useState(false);
    const [checkError, setCheckError] = useState('');
    const [payMethod, setPayMethod] = useState('');
    const { clearCart } = useCart();

    useEffect(() => {
        if (!orderId) return;
        let done = false;
        let detectedMethod = '';

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
                if (data.paymentMethod && !detectedMethod) {
                    detectedMethod = data.paymentMethod;
                    setPayMethod(data.paymentMethod);
                }
                if (data.paymentStatus === 'paid') confirm(data);
                else if (data.paymentStatus === 'failed') fail();
            } catch { /* ignore */ }
        };

        const checkPaymentApi = async () => {
            if (done) return;
            try {
                let data;
                if (detectedMethod === 'payme') {
                    const res = await paymentAPI.checkPayme(orderId);
                    data = res.data;
                } else {
                    const res = await paymentAPI.checkClick(orderId);
                    data = res.data;
                }
                if (data.paid) {
                    const { data: info } = await paymentAPI.getStatus(orderId);
                    confirm(info);
                }
            } catch { /* ignore */ }
        };

        checkDb();
        const dbInterval  = setInterval(checkDb, DB_POLL_INTERVAL);
        const apiInterval = setInterval(checkPaymentApi, API_CHECK_INTERVAL);

        const onVisible = () => {
            if (!done && document.visibilityState === 'visible') {
                checkDb();
                setTimeout(checkPaymentApi, 600);
            }
        };
        document.addEventListener('visibilitychange', onVisible);

        const timeout = setTimeout(() => {
            if (!done) setTimedOut(true);
        }, TIMEOUT_MS);

        return () => {
            clearInterval(dbInterval);
            clearInterval(apiInterval);
            clearTimeout(timeout);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [orderId]);

    const providerName = payMethod === 'payme' ? 'Payme' : 'Click';

    if (status === 'success') {
        return (
            <div className="page">
                <div className="payment-status fade-up">
                    <div className="icon pulse">✅</div>
                    <h2>{t('paymentReceived')}</h2>
                    <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', margin: '12px 0' }}>
                        #{orderInfo?.orderNumber}
                    </p>
                    {orderInfo?.bonusEarned > 0 && (
                        <p style={{ color: 'var(--orange)', fontWeight: 700 }}>
                            +{orderInfo.bonusEarned} {t('bonusBall')} 🎉
                        </p>
                    )}
                    <button className="btn-primary"
                        style={{ marginTop: 24, maxWidth: 280, margin: '24px auto 0' }}
                        onClick={() => onDone?.('orders')}>
                        {t('viewOrders')}
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
                    <h2>{t('paymentFailed')}</h2>
                    <p>{t('paymentError')}</p>
                    <button className="btn-primary"
                        style={{ marginTop: 24, maxWidth: 280, margin: '24px auto 0' }}
                        onClick={() => onDone?.('cart')}>
                        {t('tryAgain')}
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
                        <h2>{t('paymentVerifying')}</h2>
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {providerName} {t('paymentProviderMsg')}
                        </p>
                        <button className="btn-primary"
                            style={{ marginTop: 24, maxWidth: 280, margin: '24px auto 0' }}
                            onClick={() => onDone?.('orders')}>
                            {t('viewOrders')}
                        </button>
                        <button className="btn"
                            style={{ marginTop: 12, maxWidth: 280, margin: '12px auto 0' }}
                            onClick={() => onDone?.('cart')}>
                            {t('backToCart')}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="payment-loader" />
                        <h2>{t('confirmingPayment')}</h2>
                        <p>
                            {providerName || t('paymentSystem')} {t('paymentProviderMsg')}<br />
                            {t('autoUpdateMsg')}
                        </p>

                        <button
                            className="btn-primary"
                            disabled={checking}
                            style={{ marginTop: 24, maxWidth: 280, margin: '24px auto 0', opacity: checking ? 0.7 : 1 }}
                            onClick={async () => {
                                setChecking(true);
                                setCheckError('');
                                try {
                                    let data;
                                    if (payMethod === 'payme') {
                                        const res = await paymentAPI.checkPayme(orderId);
                                        data = res.data;
                                    } else {
                                        const res = await paymentAPI.checkClick(orderId);
                                        data = res.data;
                                    }
                                    if (data.paid) {
                                        const { data: info } = await paymentAPI.getStatus(orderId);
                                        clearCart();
                                        setOrderInfo(info);
                                        setStatus('success');
                                    } else {
                                        setCheckError(data.message || t('paymentNotConfirmed'));
                                    }
                                } catch {
                                    setCheckError(t('serverConnectError'));
                                }
                                setChecking(false);
                            }}>
                            {checking ? t('checking') : `✅ ${t('confirmPayment')}`}
                        </button>

                        {checkError && (
                            <div style={{ marginTop: 12, padding: '10px 16px', background: '#fff3f3', border: '1px solid #ffcdd2', borderRadius: 10, color: '#c0392b', fontSize: 13, textAlign: 'center', maxWidth: 280, margin: '12px auto 0' }}>
                                ❌ {checkError}
                            </div>
                        )}

                        <button className="btn"
                            style={{ marginTop: 10, maxWidth: 280, margin: '12px auto 0' }}
                            onClick={() => onDone?.('orders')}>
                            {t('viewOrders')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
