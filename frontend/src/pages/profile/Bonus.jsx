import React, { useState, useEffect } from 'react';
import { userAPI } from '../../api/index';

export default function Bonus({ onBack }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        userAPI.getBonus()
            .then(res => setData(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading"><div className="loading-spinner" /></div>;
    if (!data) return null;

    const tierConfig = {
        silver: { label: '🥈 Kumush', color: '#95a5a6', next: 'Oltin', target: 2000 },
        gold: { label: '🥇 Oltin', color: '#f39c12', next: 'Platina', target: 5000 },
        platinum: { label: '💎 Platina', color: '#9b59b6', next: null, target: null },
    };

    const tier = tierConfig[data.tier] || tierConfig.silver;
    const progress = tier.target ? Math.min((data.points / tier.target) * 100, 100) : 100;

    return (
        <div className="page">
            <div className="back-bar"><button className="back-btn" onClick={onBack}>←</button><h2>⭐ Bonus</h2></div>

            <div style={{ margin: '0 20px 16px', background: `linear-gradient(135deg, ${tier.color}, var(--green))`, borderRadius: 20, padding: 24, color: 'white' }}>
                <div style={{ fontSize: 12, opacity: 0.85 }}>{tier.label}</div>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{data.points.toLocaleString()}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>bonus ball</div>
                {tier.target && (
                    <>
                        <div className="bonus-progress"><div className="bonus-progress-fill" style={{ width: `${progress}%` }} /></div>
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>{tier.next} darajaga {tier.target - data.points} ball qoldi</div>
                    </>
                )}
            </div>

            <h3 className="section-title">Ball tarixi</h3>
            {data.transactions?.length === 0 ? (
                <div className="empty-state"><div className="icon">⭐</div><h3>Hali tranzaksiyalar yo'q</h3></div>
            ) : (
                data.transactions?.map((t, i) => (
                    <div key={i} className="card fade-up" style={{ margin: '0 20px 8px' }}>
                        <div className="flex-between">
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{t.description?.uz || t.type}</div>
                                <div className="text-sm text-gray">{new Date(t.createdAt).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontWeight: 800, fontSize: 16, color: t.points > 0 ? 'var(--green)' : 'var(--red)' }}>
                                {t.points > 0 ? '+' : ''}{t.points}
                            </span>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
