import { useState, useEffect } from 'react';
import { ordersAPI, branchesAPI } from '../api/index';
import DrugImage from '../components/DrugImages';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

export default function Cart({ onNavigate, onPayment }) {
    const { items, removeFromCart, updateQty, total } = useCart();
    const { user } = useAuth();
    const { t } = useT();
    const [deliveryType, setDeliveryType] = useState('delivery');
    const [paymentMethod, setPaymentMethod] = useState('click');
    const [useBonusPoints, setUseBonusPoints] = useState(false);
    const [phone, setPhone] = useState(user?.phone || '');
    const [name, setName] = useState(`${user?.firstName || ''} ${user?.lastName || ''}`.trim());
    const [address, setAddress] = useState('');
    const [comment, setComment] = useState('');
    const [geoLoading, setGeoLoading] = useState(false);
    const [branches, setBranches] = useState([]);
    const [availableBranchIds, setAvailableBranchIds] = useState(null);
    const [productStatus, setProductStatus] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [userLoc, setUserLoc] = useState(null);
    const [deliveryCalc, setDeliveryCalc] = useState(null);

    const getLocation = () => {
        if (!navigator.geolocation) return alert(t('geoNotSupported'));
        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                const coords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                try {
                    const res = await fetch(
                        `https://geocode-maps.yandex.ru/1.x/?apikey=b282d82a-e502-4d33-acb3-d5bd433af913&geocode=${longitude},${latitude}&format=json&results=1&lang=uz_UZ`
                    );
                    const data = await res.json();
                    const geoObj = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
                    const formatted = geoObj?.metaDataProperty?.GeocoderMetaData?.Address?.formatted || '';
                    const parts = formatted.split(',').map(s => s.trim()).filter(Boolean);
                    const humanAddr = parts.length > 1 ? parts.slice(1).join(', ') : formatted;
                    setAddress(humanAddr ? `${humanAddr} (${coords})` : coords);
                } catch {
                    setAddress(coords);
                }
                setGeoLoading(false);
            },
            () => {
                setGeoLoading(false);
                alert(t('geoError'));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    useEffect(() => {
        branchesAPI.getAll().then(res => {
            setBranches((res.data || []).filter(b => b.isOpen));
        }).catch(() => {});

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => {},
                { enableHighAccuracy: true, timeout: 8000 }
            );
        }
    }, []);

    useEffect(() => {
        if (!items.length) return;
        branchesAPI.checkStock(items.map(i => ({ productId: i.productId, qty: i.qty })))
            .then(res => {
                const ids = res.data?.availableBranchIds || [];
                setAvailableBranchIds(ids);
                setProductStatus(res.data?.productStatus || []);
                setSelectedBranch(prev => ids.includes(prev) ? prev : (ids[0] || ''));
            })
            .catch(() => { setAvailableBranchIds(null); setProductStatus([]); });
    }, [items]);

    useEffect(() => {
        if (deliveryType !== 'delivery' || !selectedBranch) return;
        const params = { branchId: selectedBranch, orderTotal: total };
        if (userLoc) { params.userLat = userLoc.lat; params.userLng = userLoc.lng; }
        import('../api/axios').then(({ default: ax }) => {
            ax.post('/delivery/calculate', params)
                .then(r => setDeliveryCalc(r.data))
                .catch(() => setDeliveryCalc(null));
        });
    }, [selectedBranch, userLoc, deliveryType, total]);

    const filteredBranches = availableBranchIds === null
        ? branches
        : branches.filter(b => availableBranchIds.includes(b._id));

    if (items.length === 0) {
        return (
            <div className="page">
                <div className="empty-state" style={{ paddingTop: 100 }}>
                    <div className="icon">🛒</div>
                    <h3>{t('cartEmpty')}</h3>
                    <p>{t('cartEmptyText')}</p>
                    <button className="btn-primary" style={{ maxWidth: 200, margin: '0 auto' }}
                        onClick={() => onNavigate('catalog')}>
                        {t('goToCatalog')}
                    </button>
                </div>
            </div>
        );
    }

    const deliveryCost = deliveryType !== 'delivery' ? 0
        : deliveryCalc?.free ? 0
        : deliveryCalc?.outOfRange ? null
        : deliveryCalc?.cost != null ? deliveryCalc.cost
        : (deliveryCalc === null ? 15000 : null);

    const maxBonusDiscount = Math.floor(total * 0.3);
    const bonusDiscount = useBonusPoints ? Math.min((user?.bonusPoints || 0), maxBonusDiscount) : 0;
    const grandTotal = total + (deliveryCost || 0) - bonusDiscount;

    const handleSubmit = async () => {
        if (!phone || !name) return alert(t('namePhoneRequired'));
        if (deliveryType === 'delivery' && !address) return alert(t('addressRequired'));
        if (!selectedBranch) return alert(t('branchRequired'));

        setSubmitting(true);
        try {
            const { data } = await ordersAPI.create({
                items: items.map(i => ({ productId: i.productId, qty: i.qty })),
                deliveryType, address, phone,
                customerName: name,
                branchId: selectedBranch,
                paymentMethod,
                useBonusPoints,
                notes: comment,
            });

            if (data.paymentUrl) {
                const tg = window.Telegram?.WebApp;
                if (tg?.openLink) {
                    tg.openLink(data.paymentUrl);
                } else {
                    localStorage.setItem('pendingPaymentOrderId', data.order.id);
                    window.location.href = data.paymentUrl;
                    return;
                }
            }

            onPayment?.(data.order.id);
        } catch (err) {
            alert(err.response?.data?.error || t('errorOccurred'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page" style={{ paddingBottom: 100 }}>
            <div className="back-bar"><h2>🛒 {t('cart')}</h2></div>

            <div className="section">
                {items.map(item => (
                    <div key={item.productId} className="cart-item fade-up">
                        <div className="cart-item-img">
                            <DrugImage imageType={item.imageType} category={item.category} size={50} />
                        </div>
                        <div className="cart-item-info">
                            <div className="cart-item-name">{item.name}</div>
                            <div className="cart-item-price">{item.price.toLocaleString()} сўм</div>
                            <div className="qty-controls">
                                <button className="qty-btn" onClick={() => updateQty(item.productId, item.qty - 1)}>−</button>
                                <span className="qty-value">{item.qty}</span>
                                <button className="qty-btn" onClick={() => updateQty(item.productId, item.qty + 1)}>+</button>
                            </div>
                        </div>
                        <button className="remove-btn" onClick={() => removeFromCart(item.productId)}>✕</button>
                    </div>
                ))}
            </div>

            <div className="section">
                <h3 className="section-title" style={{ padding: 0 }}>{t('delivery')}</h3>
                <div className="toggle-group">
                    <button className={`toggle-btn ${deliveryType === 'delivery' ? 'active' : ''}`}
                        onClick={() => setDeliveryType('delivery')}>🚚 {t('delivery')}</button>
                    <button className={`toggle-btn ${deliveryType === 'pickup' ? 'active' : ''}`}
                        onClick={() => setDeliveryType('pickup')}>🏪 {t('pickup')}</button>
                </div>

                <div className="form-group">
                    <label className="form-label">{t('branch')}</label>
                    {availableBranchIds !== null && filteredBranches.length === 0 ? (
                        <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(231,76,60,0.07)', border: '1px solid rgba(231,76,60,0.25)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontWeight: 700, color: 'var(--red)' }}>
                                ⚠️ {t('noBranchForAll')}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                {items.map(item => {
                                    const st = productStatus.find(s => s.productId === item.productId);
                                    const ok = st?.availableAnywhere;
                                    const max = st?.maxAvailableQty ?? 0;
                                    return (
                                        <div key={item.productId} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 10, background: ok ? 'rgba(39,174,96,0.07)' : 'rgba(231,76,60,0.07)' }}>
                                            <span style={{ fontSize: 15, flexShrink: 0 }}>{ok ? '⚠️' : '❌'}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {item.name}
                                                </div>
                                                <div style={{ fontSize: 11, marginTop: 2 }}>
                                                    {ok ? (
                                                        <span style={{ color: '#F39C12' }}>
                                                            {t('stockSplit').replace('{qty}', item.qty).replace('{max}', max)}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--red)' }}>
                                                            {max > 0
                                                                ? t('stockMax').replace('{qty}', item.qty).replace('{max}', max)
                                                                : t('stockNowhere')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                💡 {t('stockHint')}
                            </div>
                        </div>
                    ) : (
                        <select className="form-input" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                            {filteredBranches.map(b => (
                                <option key={b._id} value={b._id}>
                                    №{String(b.number).padStart(3, '0')} {b.name}
                                </option>
                            ))}
                        </select>
                    )}
                    {availableBranchIds !== null && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                            ✅ {t('branchesFiltered')} ({filteredBranches.length})
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">{t('yourName')}</label>
                    <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('yourName')} />
                </div>

                <div className="form-group">
                    <label className="form-label">{t('yourPhone')}</label>
                    <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998 90 123-45-67" />
                </div>

                {deliveryType === 'delivery' && (
                    <div className="form-group">
                        <label className="form-label">{t('yourAddress')}</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <textarea className="form-textarea" style={{ flex: 1 }} value={address}
                                onChange={e => setAddress(e.target.value)}
                                placeholder={t('addressPlaceholder')} />
                            <button type="button" onClick={getLocation} disabled={geoLoading}
                                style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, background: 'var(--green)', color: 'white', border: 'none', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {geoLoading ? (
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                                        <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="2.5" strokeDasharray="40" strokeDashoffset="10"/>
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <path d="M10 2C6.69 2 4 4.69 4 8c0 4.5 6 10 6 10s6-5.5 6-10c0-3.31-2.69-6-6-6z" stroke="white" strokeWidth="2" fill="none"/>
                                        <circle cx="10" cy="8" r="1.5" fill="white"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                            {t('geoHint')}
                        </div>
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">{t('comment')}</label>
                    <textarea className="form-textarea" value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder={t('comment')} />
                </div>
            </div>

            <div className="section">
                <h3 className="section-title" style={{ padding: 0 }}>{t('paymentTitle')}</h3>
                <div className="toggle-group">
                    <button className={`toggle-btn ${paymentMethod === 'click' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('click')}>💳 Click</button>
                    <button className={`toggle-btn ${paymentMethod === 'payme' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('payme')}>💳 Payme</button>
                </div>

                {user?.bonusPoints > 0 && (
                    <div className="setting-row" style={{ margin: 0 }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{t('useBonus')}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {user.bonusPoints.toLocaleString()} {t('bonusAvailable')}
                            </div>
                        </div>
                        <div className={`switch ${useBonusPoints ? 'on' : ''}`}
                            onClick={() => setUseBonusPoints(!useBonusPoints)} />
                    </div>
                )}
            </div>

            <div className="section">
                <div className="summary-block">
                    <div className="summary-row">
                        <span>{t('cartItemsLabel')}</span>
                        <span>{total.toLocaleString()} сўм</span>
                    </div>
                    {deliveryType === 'delivery' && (
                        <div className="summary-row">
                            <span>
                                {t('deliveryCost')}
                                {deliveryCalc?.distKm != null && (
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>
                                        ({deliveryCalc.distKm} km)
                                    </span>
                                )}
                            </span>
                            {deliveryCalc?.outOfRange ? (
                                <span style={{ color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>🚫 {t('outOfRangeLabel')}</span>
                            ) : deliveryCost === 0 ? (
                                <span className="free">{t('free')} 🎉</span>
                            ) : deliveryCost != null ? (
                                <span style={{ fontWeight: 700 }}>{deliveryCost.toLocaleString()} сўм</span>
                            ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('calculating')}</span>
                            )}
                        </div>
                    )}
                    {bonusDiscount > 0 && (
                        <div className="summary-row">
                            <span>{t('bonusLabel')}</span>
                            <span className="discount">−{bonusDiscount.toLocaleString()} сўм</span>
                        </div>
                    )}
                    <div className="summary-row total">
                        <span>{t('grandTotal')}</span>
                        <span>{grandTotal.toLocaleString()} сўм</span>
                    </div>
                </div>

                {deliveryCalc?.outOfRange && deliveryType === 'delivery' ? (
                    <div style={{ padding: '14px', borderRadius: 14, textAlign: 'center', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>
                        🚫 {t('outOfRangeWarn').replace('{km}', deliveryCalc.distKm)}<br />
                        <span style={{ fontWeight: 400, fontSize: 12 }}>{t('pickupHint')}</span>
                    </div>
                ) : (
                    <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                        {submitting ? `⏳ ${t('ordering')}` : `${t('placeOrder')} • ${grandTotal.toLocaleString()} сўм`}
                    </button>
                )}
            </div>
        </div>
    );
}
