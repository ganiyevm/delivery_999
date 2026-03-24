import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

const TIER_BADGE = { silver: 'badge-gray', gold: 'badge-yellow', platinum: 'badge-blue' };

export default function UsersList() {
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({});
    const [filters, setFilters] = useState({ search: '', page: 1 });
    const [selected, setSelected] = useState(null);
    const [bonusPoints, setBonusPoints] = useState(0);

    useEffect(() => {
        const params = { page: filters.page, limit: 20 };
        if (filters.search) params.search = filters.search;
        api.get('/admin/users', { params }).then(r => {
            setUsers(r.data.users || []);
            setPagination(r.data.pagination || {});
        }).catch(() => { });
    }, [filters]);

    const handleBlock = async (id) => {
        await api.patch(`/admin/users/${id}/block`);
        setFilters({ ...filters });
        if (selected?._id === id) setSelected(null);
    };

    const addBonus = async () => {
        if (!selected || !bonusPoints) return;
        await api.post(`/admin/users/${selected._id}/bonus`, { points: parseInt(bonusPoints) });
        setBonusPoints(0);
        setFilters({ ...filters });
    };

    return (
        <div>
            <div className="topbar"><h2>👥 Foydalanuvchilar</h2></div>

            <div className="filters-row">
                <input className="form-input" placeholder="Ism yoki telefon..." onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} />
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead><tr><th>TG ID</th><th>Ism</th><th>Tel</th><th>Bonus</th><th>Daraja</th><th>Buyurtma</th><th>Holat</th><th>Amallar</th></tr></thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u._id}>
                                <td>{u.telegramId}</td>
                                <td style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</td>
                                <td>{u.phone || '—'}</td>
                                <td>{u.bonusPoints}</td>
                                <td><span className={`badge ${TIER_BADGE[u.bonusTier]}`}>{u.bonusTier}</span></td>
                                <td>{u.totalOrders}</td>
                                <td><span className={`badge ${u.isBlocked ? 'badge-red' : 'badge-green'}`}>{u.isBlocked ? 'Bloklangan' : 'Faol'}</span></td>
                                <td style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn" onClick={() => setSelected(u)}>👁</button>
                                    <button className="btn" onClick={() => handleBlock(u._id)}>{u.isBlocked ? '🔓' : '🚫'}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="pagination">
                    <span>{pagination.total || 0} ta foydalanuvchi</span>
                    <div className="pagination-btns">
                        <button className="btn" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>←</button>
                        <button className="btn" disabled={filters.page >= (pagination.pages || 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>→</button>
                    </div>
                </div>
            </div>

            {selected && (
                <div className="modal-overlay" onClick={() => setSelected(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>👤 {selected.firstName} {selected.lastName}</h3><button className="modal-close" onClick={() => setSelected(null)}>✕</button></div>
                        <div style={{ fontSize: 14, lineHeight: 2 }}>
                            <p><strong>Telegram:</strong> {selected.telegramId} (@{selected.username})</p>
                            <p><strong>Tel:</strong> {selected.phone || '—'}</p>
                            <p><strong>Bonus:</strong> {selected.bonusPoints} ball ({selected.bonusTier})</p>
                            <p><strong>Buyurtmalar:</strong> {selected.totalOrders} ta</p>
                            <p><strong>Umumiy xarid:</strong> {(selected.totalSpent || 0).toLocaleString()} сўм</p>
                            <p><strong>Ro'yxatdan:</strong> {new Date(selected.registeredAt).toLocaleDateString()}</p>
                        </div>
                        <h4 style={{ margin: '16px 0 8px' }}>Ball qo'shish:</h4>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input className="form-input" type="number" value={bonusPoints} onChange={e => setBonusPoints(e.target.value)} placeholder="Ball" />
                            <button className="btn btn-primary" onClick={addBonus}>⭐ Qo'shish</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
