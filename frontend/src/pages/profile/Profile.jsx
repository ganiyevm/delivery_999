import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function Profile({ onNavigate }) {
    const { user } = useAuth();
    const tierLabel = { silver: '🥈 Kumush', gold: '🥇 Oltin', platinum: '💎 Platina' };

    return (
        <div className="page">
            <div className="profile-header">
                <div className="profile-avatar">👤</div>
                <div className="profile-name">{user?.firstName} {user?.lastName}</div>
                {user?.username && <div className="profile-username">@{user.username}</div>}
                <div className="profile-stats">
                    <div className="profile-stat">
                        <div className="value">{user?.totalOrders || 0}</div>
                        <div className="label">Buyurtma</div>
                    </div>
                    <div className="profile-stat">
                        <div className="value">{user?.bonusPoints || 0}</div>
                        <div className="label">Ball</div>
                    </div>
                </div>
            </div>

            <div className="profile-menu">
                {[
                    { icon: '❤️', text: 'Sevimlilar', key: 'favorites' },
                    { icon: '📦', text: 'Buyurtmalarim', key: 'orders' },
                    { icon: '📍', text: 'Manzillarim', key: 'addresses' },
                    { icon: '⭐', text: `Bonus — ${tierLabel[user?.bonusTier] || 'Kumush'}`, key: 'bonus' },
                    { icon: '⚙️', text: 'Sozlamalar', key: 'settings' },
                ].map(item => (
                    <div key={item.key} className="profile-menu-item" onClick={() => onNavigate(item.key)}>
                        <span className="icon">{item.icon}</span>
                        <span className="text">{item.text}</span>
                        <span className="arrow">›</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
