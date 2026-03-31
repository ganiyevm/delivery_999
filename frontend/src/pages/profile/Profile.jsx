import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n';

export default function Profile({ onNavigate }) {
    const { user } = useAuth();
    const { t } = useT();

    return (
        <div className="page">
            <div className="profile-header">
                <div className="profile-avatar">👤</div>
                <div className="profile-name">{user?.firstName} {user?.lastName}</div>
                {user?.username && <div className="profile-username">@{user.username}</div>}
                <div className="profile-stats">
                    <div className="profile-stat">
                        <div className="value">{user?.totalOrders || 0}</div>
                        <div className="label">{t('ordersCount')}</div>
                    </div>
                    <div className="profile-stat">
                        <div className="value">{user?.bonusPoints || 0}</div>
                        <div className="label">{t('ballCount')}</div>
                    </div>
                </div>
            </div>

            <div className="profile-menu">
                {[
                    { icon: '❤️', labelKey: 'favorites', key: 'favorites' },
                    { icon: '📦', labelKey: 'myOrders', key: 'orders' },
                    { icon: '📍', labelKey: 'myAddresses', key: 'addresses' },
                    { icon: '⭐', labelKey: 'bonusLabel', key: 'bonus', suffix: ` — ${t(user?.bonusTier || 'silver')}` },
                    { icon: '⚙️', labelKey: 'settings', key: 'settings' },
                ].map(item => (
                    <div key={item.key} className="profile-menu-item" onClick={() => onNavigate(item.key)}>
                        <span className="icon">{item.icon}</span>
                        <span className="text">{t(item.labelKey)}{item.suffix || ''}</span>
                        <span className="arrow">›</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
