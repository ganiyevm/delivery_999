import React, { useState, useEffect } from 'react';
import { ordersAPI, branchesAPI } from '../api/index';
import DrugImage from '../components/DrugImages';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Cart({ onNavigate, onPayment }) {
    const { items, removeFromCart, updateQty, total } = useCart();
    const { user } = useAuth();
    const [deliveryType, setDeliveryType] = useState('delivery');
    const [paymentMethod, setPaymentMethod] = useState('click');
    const [useBonusPoints, setUseBonusPoints] = useState(false);
    const [phone, setPhone] = useState(user?.phone || '');
    const [name, setName] = useState(`${user?.firstName || ''} ${user?.lastName || ''}`.trim());
    const [address, setAddress] = useState('');
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        branchesAPI.getAll().then(res => {
            const open = (res.data || []).filter(b => b.isOpen);
            setBranches(open);
            if (open.length > 0) setSelectedBranch(open[0]._id);
        }).catch(() => { });
    }, []);

    if (items.length === 0) {
        return (
            <div className="page">
                <div className="empty-state" style={{ paddingTop: 100 }}>
                    <div className="icon">🛒</div>
                    <h3>Savat bo'sh</h3>
                    <p>Katalogdan dori tanlang</p>
                    <button className="btn-primary" style={{ maxWidth: 200, margin: '0 auto' }}
                        onClick={() => onNavigate('catalog')}>
                        Katalogga o'tish
                    </button>
                </div>
            </div>
        );
    }

    const DELIVERY_COST = 15000;
    const FREE_THRESHOLD = 150000;
    const deliveryCost = deliveryType === 'delivery' ? (total >= FREE_THRESHOLD ? 0 : DELIVERY_COST) : 0;
    const maxBonusDiscount = Math.floor(total * 0.3);
    const bonusDiscount = useBonusPoints ? Math.min((user?.bonusPoints || 0), maxBonusDiscount) : 0;
    const grandTotal = total + deliveryCost - bonusDiscount;

    const handleSubmit = async () => {
        if (!phone || !name) return alert('Ism va telefon kiritilmagan');
        if (deliveryType === 'delivery' && !address) return alert('Manzil kiritilmagan');
        if (!selectedBranch) return alert('Filial tanlanmagan');

        setSubmitting(true);
        try {
            const { data } = await ordersAPI.create({
                items: items.map(i => ({ productId: i.productId, qty: i.qty })),
                deliveryType,
                address,
                phone,
                customerName: name,
                branchId: selectedBranch,
                paymentMethod,
                useBonusPoints,
            });

            // Savatni bu yerda tozalamay, to'lov tasdiqlangandan keyin Payment.jsx da tozalanadi
            if (data.paymentUrl) {
                const tg = window.Telegram?.WebApp;
                if (tg?.openLink) {
                    tg.openLink(data.paymentUrl);
                } else {
                    window.open(data.paymentUrl, '_blank');
                }
            }

            onPayment?.(data.order.id);
        } catch (err) {
            alert(err.response?.data?.error || 'Xatolik yuz berdi');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page" style={{ paddingBottom: 100 }}>
            <div className="back-bar"><h2>🛒 Savat</h2></div>

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
                <h3 className="section-title" style={{ padding: 0 }}>Yetkazib berish</h3>
                <div className="toggle-group">
                    <button className={`toggle-btn ${deliveryType === 'delivery' ? 'active' : ''}`}
                        onClick={() => setDeliveryType('delivery')}>🚚 Dostavka</button>
                    <button className={`toggle-btn ${deliveryType === 'pickup' ? 'active' : ''}`}
                        onClick={() => setDeliveryType('pickup')}>🏪 Olib ketish</button>
                </div>

                <div className="form-group">
                    <label className="form-label">Filial</label>
                    <select className="form-input" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                        {branches.map(b => (
                            <option key={b._id} value={b._id}>№{String(b.number).padStart(3, '0')} {b.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Ism</label>
                    <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ismingiz" />
                </div>

                <div className="form-group">
                    <label className="form-label">Telefon</label>
                    <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998 90 123-45-67" />
                </div>

                {deliveryType === 'delivery' && (
                    <div className="form-group">
                        <label className="form-label">Manzil</label>
                        <textarea className="form-textarea" value={address} onChange={e => setAddress(e.target.value)}
                            placeholder="Tuman, ko'cha, uy raqami..." />
                    </div>
                )}
            </div>

            <div className="section">
                <h3 className="section-title" style={{ padding: 0 }}>To'lov usuli</h3>
                <div className="toggle-group">
                    <button className={`toggle-btn ${paymentMethod === 'click' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('click')}>💳 Click</button>
                    <button className={`toggle-btn ${paymentMethod === 'payme' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('payme')}>💳 Payme</button>
                </div>

                {user?.bonusPoints > 0 && (
                    <div className="setting-row" style={{ margin: 0 }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Bonus ball ishlatish</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {user.bonusPoints.toLocaleString()} ball mavjud
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
                        <span>Tovarlar</span>
                        <span>{total.toLocaleString()} сўм</span>
                    </div>
                    <div className="summary-row">
                        <span>Dostavka</span>
                        {deliveryCost === 0 ? (
                            <span className="free">Bepul 🎉</span>
                        ) : (
                            <span>{deliveryCost.toLocaleString()} сўм</span>
                        )}
                    </div>
                    {bonusDiscount > 0 && (
                        <div className="summary-row">
                            <span>Bonus</span>
                            <span className="discount">−{bonusDiscount.toLocaleString()} сўм</span>
                        </div>
                    )}
                    <div className="summary-row total">
                        <span>JAMI</span>
                        <span>{grandTotal.toLocaleString()} сўм</span>
                    </div>
                </div>

                <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? '⏳ Kutilmoqda...' : `Buyurtma berish • ${grandTotal.toLocaleString()} сўм`}
                </button>
            </div>
        </div>
    );
}
