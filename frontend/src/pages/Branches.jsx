import React, { useState, useEffect } from 'react';
import { branchesAPI } from '../api/index';

export default function Branches() {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        branchesAPI.getAll()
            .then(res => setBranches(res.data || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const openCount = branches.filter(b => b.isOpen).length;
    const closedCount = branches.length - openCount;

    if (loading) return <div className="loading"><div className="loading-spinner" /></div>;

    return (
        <div className="page">
            <div className="back-bar">
                <h2>🏥 Filiallar</h2>
            </div>

            <div style={{ padding: '0 20px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                {branches.length} filial • <span className="text-green">{openCount} ochiq</span> • <span className="text-gray">{closedCount} yopiq</span>
            </div>

            {branches.map(b => (
                <div key={b._id} className={`branch-card ${b.isOpen ? '' : 'closed'}`}>
                    <div className="branch-info">
                        <h4>№{String(b.number).padStart(3, '0')} {b.name}</h4>
                        <p>📍 {b.address || 'Manzil kiritilmagan'}</p>
                        {b.phone && <p>📞 {b.phone}</p>}
                        <p>🕐 {b.hours || '09:00 — 22:00'}</p>
                        <span className={`badge ${b.isOpen ? 'badge-instock' : 'badge-outstock'}`}>
                            {b.isOpen ? '🟢 Ochiq' : '🔴 Yopiq'}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
