import { useState, useEffect, useMemo, useCallback } from 'react';
import { ordersAPI, branchesAPI } from '../api/index';
import api from '../api/axios';
import DrugImage from '../components/DrugImages';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';
import { showAlert } from '../utils/telegram';

const DAY_NAMES = ['Bugun', 'Ertaga', 'Indinga'];

function DeliveryTimePicker({ deliveryDate, setDeliveryDate, deliverySlot, setDeliverySlot }) {
    const days = useMemo(() => Array.from({ length: 3 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return { iso: d.toISOString().slice(0, 10), short: DAY_NAMES[i] };
    }), []);

    // Bugun tanlanganda minimum vaqt — hozirdan 1 soat keyin
    const minTime = useMemo(() => {
        if (!deliveryDate || deliveryDate !== days[0].iso) return '08:00';
        const d = new Date();
        d.setMinutes(d.getMinutes() + 60);
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }, [deliveryDate, days]);

    return (
        <div className="form-group">
            <label className="form-label">Yetkazish vaqti</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {days.map(d => (
                    <button key={d.iso} type="button"
                        onClick={() => { setDeliveryDate(d.iso); setDeliverySlot(''); }}
                        style={{
                            flex: 1, padding: '8px 4px', borderRadius: 12, border: '1.5px solid',
                            borderColor: deliveryDate === d.iso ? 'var(--green)' : 'var(--border)',
                            background: deliveryDate === d.iso ? 'rgba(39,174,96,0.1)' : 'var(--card)',
                            color: deliveryDate === d.iso ? 'var(--green)' : 'var(--text)',
                            fontWeight: deliveryDate === d.iso ? 700 : 400,
                            fontSize: 13, cursor: 'pointer',
                        }}>
                        {d.short}
                    </button>
                ))}
            </div>
            {deliveryDate && (
                <>
                    <input
                        type="time"
                        className="form-input"
                        value={deliverySlot}
                        min={minTime}
                        max="23:00"
                        onChange={e => {
                            const val = e.target.value;
                            if (!val) { setDeliverySlot(''); return; }
                            const [h, m] = val.split(':').map(Number);
                            const [mh, mm] = minTime.split(':').map(Number);
                            if (h * 60 + m < mh * 60 + mm) {
                                setDeliverySlot(minTime);
                                e.target.value = minTime;
                            } else {
                                setDeliverySlot(val);
                            }
                        }}
                        style={{ fontSize: 16 }}
                    />
                </>
            )}
        </div>
    );
}

export default function Cart({ onNavigate, onPayment }) {
    const { items, removeFromCart, updateQty, clearCart, total } = useCart();
    const { user } = useAuth();
    const { t } = useT();
    const [deliveryType, setDeliveryType] = useState('delivery');
    const [paymentMethod, setPaymentMethod] = useState('click');
    const [useBonusPoints, setUseBonusPoints] = useState(false);
    const [phone, setPhone] = useState(user?.phone || '');
    const [name, setName] = useState(`${user?.firstName || ''} ${user?.lastName || ''}`.trim());
    const [address, setAddress] = useState('');
    const [yandexDropType, setYandexDropType] = useState('door'); // 'door' | 'entrance'
    const [apartment, setApartment] = useState('');
    const [entrance, setEntrance] = useState('');
    const [floor, setFloor] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [deliverySlot, setDeliverySlot] = useState('');
    const [comment, setComment] = useState('');
    const [geoLoading, setGeoLoading] = useState(false);
    const [branches, setBranches] = useState([]);
    const [availableBranchIds, setAvailableBranchIds] = useState(null);
    const [productStatus, setProductStatus] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(null); // { orderNumber }
    const [userLoc, setUserLoc] = useState(null);
    const [deliveryCalc, setDeliveryCalc] = useState(null);

    const getLocation = () => {
        if (!navigator.geolocation) return showAlert(t('geoNotSupported'));
        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                const coords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                // Yetkazib berish masofasini hisoblash uchun koordinatani saqlaymiz
                setUserLoc({ lat: latitude, lng: longitude });
                try {
                    // Geokodlash backend orqali (Yandex kaliti serverda yashiringan)
                    const res = await api.get('/geo/reverse', { params: { lat: latitude, lng: longitude } });
                    const humanAddr = res.data?.address || '';
                    setAddress(humanAddr ? `${humanAddr} (${coords})` : coords);
                } catch {
                    setAddress(coords);
                }
                setGeoLoading(false);
            },
            () => {
                setGeoLoading(false);
                showAlert(t('geoError'));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    useEffect(() => {
        branchesAPI.getAll().then(res => {
            setBranches((res.data || []).filter(b => b.isOpen));
        }).catch(() => {});
        // Eslatma: joylashuv ruxsati ataylab so'ralmaydi — faqat foydalanuvchi
        // "Joylashuvni aniqlash" tugmasini bossa olinadi (getLocation).
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

    // Masofadan delivery hisoblash o'chirilgan — keyinchalik yoqiladi
    // useEffect(() => { ... }, [selectedBranch, userLoc, deliveryType, total]);

    const filteredBranches = availableBranchIds === null
        ? branches
        : branches.filter(b => availableBranchIds.includes(b._id));

    if (submitted) {
        return (
            <div className="page">
                <div className="empty-state" style={{ paddingTop: 80 }}>
                    <div className="icon">✅</div>
                    <h3>Buyurtma qabul qilindi!</h3>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        <b>#{submitted.orderNumber}</b> — apteka xodimi dorilarni tekshiradi.<br />
                        Tayyor bo'lgach botdan to'lov havolasi yuboriladi.
                    </p>
                    <button className="btn-primary" style={{ maxWidth: 220, margin: '20px auto 0' }}
                        onClick={() => onNavigate('home')}>
                        Bosh sahifaga qaytish
                    </button>
                </div>
            </div>
        );
    }

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

    // yandex: narx Yandex tomonidan alohida — bizda 0
    // pickup: yetkazish yo'q
    const deliveryCost = 0;

    const maxBonusDiscount = Math.floor(total * 0.3);
    const bonusDiscount = useBonusPoints ? Math.min((user?.bonusPoints || 0), maxBonusDiscount) : 0;
    const grandTotal = total + (deliveryCost || 0) - bonusDiscount;

    const handleSubmit = async () => {
        if (!phone || !name) return showAlert(t('namePhoneRequired'));
        if (deliveryType === 'yandex' && !address) return showAlert('Manzilni kiriting');
        if (deliveryType === 'yandex' && !deliveryDate) return showAlert('Yetkazish sanasini tanlang');
        if (deliveryType === 'yandex' && !deliverySlot) return showAlert('Yetkazish vaqtini kiriting');
        if (deliveryType === 'yandex' && deliverySlot) {
            const [h] = deliverySlot.split(':').map(Number);
            if (h < 8 || h > 22) return showAlert('Vaqt 08:00 – 23:00 orasida bo\'lishi kerak');
        }
        if (!selectedBranch) return showAlert(t('branchRequired'));

        setSubmitting(true);
        try {
            const { data } = await ordersAPI.create({
                items: items.map(i => ({ productId: i.productId, qty: i.qty })),
                deliveryType, address, apartment, entrance, floor, yandexDropType,
                deliveryDate, deliverySlot, phone,
                customerName: name,
                branchId: selectedBranch,
                paymentMethod,
                useBonusPoints,
                notes: comment,
            });

            clearCart();
            setSubmitted({ orderNumber: data.order.orderNumber });
        } catch (err) {
            showAlert(err.response?.data?.error || t('errorOccurred'));
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
                            <div className="cart-item-price">{item.price.toLocaleString()} {t('currency')}</div>
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
                    <button className={`toggle-btn ${deliveryType === 'yandex' ? 'active' : ''}`}
                        onClick={() => { setDeliveryType('yandex'); setPaymentMethod(m => m === 'cash' ? 'click' : m); }}>🟡 Yandex</button>
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

                {deliveryType === 'yandex' && (
                    <>
                        <div className="form-group">
                            <label className="form-label">Yetkazish turi</label>
                            <div className="toggle-group">
                                <button className={`toggle-btn ${yandexDropType === 'door' ? 'active' : ''}`}
                                    onClick={() => setYandexDropType('door')}>🚪 Eshikka qadar</button>
                                <button className={`toggle-btn ${yandexDropType === 'entrance' ? 'active' : ''}`}
                                    onClick={() => setYandexDropType('entrance')}>🏢 Kirish oldiga</button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ko'cha, uy</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <textarea className="form-textarea" style={{ flex: 1 }} value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    placeholder="Ko'cha nomi, uy raqami" />
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
                        {yandexDropType === 'door' ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Xonadon</label>
                                    <input className="form-input" value={apartment}
                                        onChange={e => setApartment(e.target.value)} placeholder="12" />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Kirish</label>
                                    <input className="form-input" value={entrance}
                                        onChange={e => setEntrance(e.target.value)} placeholder="2" />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Qavat</label>
                                    <input className="form-input" value={floor}
                                        onChange={e => setFloor(e.target.value)} placeholder="5" />
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Kirish</label>
                                    <input className="form-input" value={entrance}
                                        onChange={e => setEntrance(e.target.value)} placeholder="2" />
                                </div>
                            </div>
                        )}
                        <DeliveryTimePicker
                            deliveryDate={deliveryDate} setDeliveryDate={setDeliveryDate}
                            deliverySlot={deliverySlot} setDeliverySlot={setDeliverySlot}
                        />
                        <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,204,0,0.1)', border: '1px solid rgba(255,204,0,0.3)', fontSize: 12, color: 'var(--text-secondary)' }}>
                            🟡 Yetkazib berish narxi Yandex tomonidan alohida hisoblanadi
                        </div>
                    </>
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
                    {deliveryType === 'pickup' && (
                        <button className={`toggle-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                            onClick={() => setPaymentMethod('cash')}>🏪 Aptekada</button>
                    )}
                    <button className={`toggle-btn ${paymentMethod === 'click' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('click')}>💳 Click</button>
                    <button className={`toggle-btn ${paymentMethod === 'payme' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('payme')}>💳 Payme</button>
                </div>
                {paymentMethod === 'cash' && (
                    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.2)', fontSize: 12, color: 'var(--text-secondary)' }}>
                        💵 Aptekaga kelganda naqd yoki kartada to'laysiz
                    </div>
                )}

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
                        <span>{total.toLocaleString()} {t('currency')}</span>
                    </div>
                    {deliveryType === 'yandex' && (
                        <div className="summary-row">
                            <span>Yetkazish (Yandex)</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>alohida</span>
                        </div>
                    )}
                    {bonusDiscount > 0 && (
                        <div className="summary-row">
                            <span>{t('bonusLabel')}</span>
                            <span className="discount">−{bonusDiscount.toLocaleString()} {t('currency')}</span>
                        </div>
                    )}
                    <div className="summary-row total">
                        <span>{t('grandTotal')}</span>
                        <span>{grandTotal.toLocaleString()} {t('currency')}</span>
                    </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 8, lineHeight: 1.5 }}>
                    📋 Buyurtma berilgach apteka tekshiradi — to'lov havolasi botdan yuboriladi
                </div>
                <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? '⏳ Yuborilmoqda...' : `📋 Buyurtma berish • ${grandTotal.toLocaleString()} ${t('currency')}`}
                </button>
            </div>
        </div>
    );
}
