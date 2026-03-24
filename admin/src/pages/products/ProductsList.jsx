import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

const CATEGORIES = ['', 'pain', 'antibiotics', 'vitamins', 'heart', 'children', 'cosmetics', 'devices', 'stomach', 'other'];
const EMPTY_FORM = { name: '', category: 'other', manufacturer: '', country: '', barcode: '', ingredient: '', description_uz: '', description_ru: '', imageUrl: '', requiresRx: false };
const isSuperAdmin = localStorage.getItem('is_super_admin') === '1';

export default function ProductsList() {
    const [products, setProducts] = useState([]);
    const [pagination, setPagination] = useState({});
    const [filters, setFilters] = useState({ search: '', category: '', page: 1 });
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

    // Narx tahrirlash
    const [showPrices, setShowPrices] = useState(false);
    const [priceProduct, setPriceProduct] = useState(null);
    const [prices, setPrices] = useState([]);
    const [priceLoading, setPriceLoading] = useState(false);

    useEffect(() => {
        const params = { page: filters.page, limit: 20 };
        if (filters.search) params.search = filters.search;
        if (filters.category) params.category = filters.category;
        api.get('/admin/products', { params }).then(r => {
            setProducts(r.data.products || []);
            setPagination(r.data.pagination || {});
        }).catch(() => { });
    }, [filters]);

    const handleSave = async () => {
        try {
            const payload = {
                ...form,
                description: { uz: form.description_uz, ru: form.description_ru },
            };
            delete payload.description_uz;
            delete payload.description_ru;

            if (editing) {
                await api.put(`/admin/products/${editing._id}`, payload);
            } else {
                await api.post('/admin/products', payload);
            }
            setShowForm(false);
            setEditing(null);
            setFilters({ ...filters });
        } catch (err) { alert(err.response?.data?.error || 'Xato'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Rostdan o\'chirmoqchimisiz?')) return;
        await api.delete(`/admin/products/${id}`);
        setFilters({ ...filters });
    };

    const handleToggle = async (id) => {
        await api.patch(`/admin/products/${id}/toggle`);
        setFilters({ ...filters });
    };

    const openEdit = (p) => {
        setForm({
            name: p.name,
            category: p.category,
            manufacturer: p.manufacturer || '',
            country: p.country || '',
            barcode: p.barcode || '',
            ingredient: p.ingredient || '',
            description_uz: p.description?.uz || '',
            description_ru: p.description?.ru || '',
            imageUrl: p.imageUrl || '',
            requiresRx: p.requiresRx,
        });
        setEditing(p);
        setShowForm(true);
    };

    const openPrices = async (p) => {
        setPriceProduct(p);
        setPriceLoading(true);
        setShowPrices(true);
        try {
            const r = await api.get(`/admin/products/${p._id}/prices`);
            setPrices(r.data.map(s => ({ stockId: s._id, branchName: `#${s.branch?.number} ${s.branch?.name}`, price: s.price, qty: s.qty })));
        } catch { }
        setPriceLoading(false);
    };

    const savePrices = async () => {
        try {
            await api.put(`/admin/products/${priceProduct._id}/prices`, {
                prices: prices.map(p => ({ stockId: p.stockId, price: p.price })),
            });
            setShowPrices(false);
            setFilters({ ...filters });
        } catch (err) { alert(err.response?.data?.error || 'Xato'); }
    };

    return (
        <div>
            <div className="topbar">
                <h2>💊 Mahsulotlar</h2>
                <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }}>+ Yangi</button>
            </div>

            <div className="filters-row">
                <input className="form-input" placeholder="Qidirish..." onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} />
                <select className="form-select" onChange={e => setFilters({ ...filters, category: e.target.value, page: 1 })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c || 'Barchasi'}</option>)}
                </select>
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead><tr><th>Nomi</th><th>Kategoriya</th><th>Rx</th><th>Filiallar</th><th>Qoldiq</th><th>Faol</th><th>Amallar</th></tr></thead>
                    <tbody>
                        {products.map(p => (
                            <tr key={p._id}>
                                <td style={{ fontWeight: 600 }}>{p.name}</td>
                                <td><span className="badge badge-blue">{p.category}</span></td>
                                <td>{p.requiresRx ? '✅' : '—'}</td>
                                <td>{p.branchCount || 0}</td>
                                <td>{p.totalQty || 0}</td>
                                <td><span className={`badge ${p.isActive ? 'badge-green' : 'badge-gray'}`}>{p.isActive ? 'Faol' : 'Nofaol'}</span></td>
                                <td style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn" onClick={() => openEdit(p)}>✏️</button>
                                    {isSuperAdmin && (
                                        <button className="btn" title="Narxni tahrirlash" onClick={() => openPrices(p)}>💰</button>
                                    )}
                                    <button className="btn" onClick={() => handleToggle(p._id)}>{p.isActive ? '🔴' : '🟢'}</button>
                                    <button className="btn btn-danger" onClick={() => handleDelete(p._id)}>🗑</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="pagination">
                    <span>{pagination.total || 0} ta mahsulot</span>
                    <div className="pagination-btns">
                        <button className="btn" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>←</button>
                        <button className="btn" disabled={filters.page >= (pagination.pages || 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>→</button>
                    </div>
                </div>
            </div>

            {/* Mahsulot tahrirlash modali */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editing ? '✏️ Tahrirlash' : '+ Yangi mahsulot'}</h3>
                            <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="form-group"><label className="form-label">Nomi</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Kategoriya</label><select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        <div className="form-group"><label className="form-label">Ishlab chiqaruvchi</label><input className="form-input" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Mamlakat</label><input className="form-input" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Barcode</label><input className="form-input" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Tarkib (ingredient)</label><input className="form-input" value={form.ingredient} onChange={e => setForm({ ...form, ingredient: e.target.value })} /></div>
                        <div className="form-group">
                            <label className="form-label">Tavsif — O'zbekcha</label>
                            <textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={form.description_uz} onChange={e => setForm({ ...form, description_uz: e.target.value })} placeholder="Qo'llanma, ta'siri..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tavsif — Ruscha</label>
                            <textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={form.description_ru} onChange={e => setForm({ ...form, description_ru: e.target.value })} placeholder="Инструкция, действие..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Rasm URL (ixtiyoriy)</label>
                            <input className="form-input" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
                            {form.imageUrl && (
                                <img src={form.imageUrl} alt="" style={{ marginTop: 8, height: 80, objectFit: 'contain', borderRadius: 8, border: '1px solid #eee' }} onError={e => e.target.style.display = 'none'} />
                            )}
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={form.requiresRx} onChange={e => setForm({ ...form, requiresRx: e.target.checked })} />
                                <span className="form-label" style={{ margin: 0 }}>Retsept talab qiladi (Rx)</span>
                            </label>
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave}>Saqlash</button>
                    </div>
                </div>
            )}

            {/* Narx tahrirlash modali — faqat super admin */}
            {showPrices && (
                <div className="modal-overlay" onClick={() => setShowPrices(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>💰 Narxlar: {priceProduct?.name}</h3>
                            <button className="modal-close" onClick={() => setShowPrices(false)}>✕</button>
                        </div>
                        {priceLoading ? (
                            <p style={{ textAlign: 'center', padding: 20 }}>Yuklanmoqda...</p>
                        ) : prices.length === 0 ? (
                            <p style={{ textAlign: 'center', padding: 20, color: '#888' }}>Bu mahsulot hech bir filialda mavjud emas</p>
                        ) : (
                            <>
                                <table className="data-table" style={{ marginBottom: 16 }}>
                                    <thead>
                                        <tr><th>Filial</th><th>Qoldiq</th><th>Narx (so'm)</th></tr>
                                    </thead>
                                    <tbody>
                                        {prices.map((item, i) => (
                                            <tr key={item.stockId}>
                                                <td>{item.branchName}</td>
                                                <td>{item.qty}</td>
                                                <td>
                                                    <input
                                                        className="form-input"
                                                        type="number"
                                                        min="0"
                                                        style={{ width: 120 }}
                                                        value={item.price}
                                                        onChange={e => {
                                                            const updated = [...prices];
                                                            updated[i] = { ...updated[i], price: e.target.value };
                                                            setPrices(updated);
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <button className="btn btn-primary" style={{ width: '100%' }} onClick={savePrices}>
                                    Saqlash
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
