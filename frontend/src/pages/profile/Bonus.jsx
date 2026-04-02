import { useState, useEffect } from 'react';
import { userAPI } from '../../api/index';
import { useT } from '../../i18n';

export default function Bonus({ onBack }) {
    const { t } = useT();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        userAPI.getBonus()
            .then(res => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading"><div className="loading-spinner" /></div>;
    if (!data) return null;

    const tierConfig = {
        silver:   { label: t('silver'),   color: '#95a5a6', nextKey: 'gold',     target: 2000 },
        gold:     { label: t('gold'),     color: '#f39c12', nextKey: 'platinum', target: 5000 },
        platinum: { label: t('platinum'), color: '#9b59b6', nextKey: null,       target: null },
    };

    const tier = tierConfig[data.tier] || tierConfig.silver;
    const progress = tier.target ? Math.min((data.points / tier.target) * 100, 100) : 100;

    return (
        <div className="page">
            <div className="back-bar">
                <button className="back-btn" onClick={onBack}>←</button>
                <h2>⭐ {t('bonusPageTitle')}</h2>
            </div>

            <div style={{ margin: '0 20px 16px', background: `linear-gradient(135deg, ${tier.color}, var(--green))`, borderRadius: 20, padding: 24, color: 'white' }}>
                <div style={{ fontSize: 12, opacity: 0.85 }}>{tier.label}</div>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{data.points.toLocaleString()}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>{t('bonusBallsLabel')}</div>
                {tier.target && (
                    <>
                        <div className="bonus-progress">
                            <div className="bonus-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
                            {t('pointsToNext')
                                .replace('{tier}', t(`tier${tier.nextKey.charAt(0).toUpperCase() + tier.nextKey.slice(1)}`))
                                .replace('{n}', tier.target - data.points)}
                        </div>
                    </>
                )}
            </div>

            <h3 className="section-title">{t('ballHistory')}</h3>
            {data.transactions?.length === 0 ? (
                <div className="empty-state"><div className="icon">⭐</div><h3>{t('noTransactions')}</h3></div>
            ) : (
                data.transactions?.map((tr, i) => (
                    <div key={i} className="card fade-up" style={{ margin: '0 20px 8px' }}>
                        <div className="flex-between">
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{tr.description?.uz || tr.type}</div>
                                <div className="text-sm text-gray">{new Date(tr.createdAt).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontWeight: 800, fontSize: 16, color: tr.points > 0 ? 'var(--green)' : 'var(--red)' }}>
                                {tr.points > 0 ? '+' : ''}{tr.points}
                            </span>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
