import { useState, useEffect } from 'react';
import { userAPI } from '../../api/index';
import { useT } from '../../i18n';

export default function Addresses({ onBack }) {
    const { t } = useT();
    const [addresses, setAddresses] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [address, setAddress] = useState('');

    useEffect(() => {
        userAPI.getAddresses().then(res => setAddresses(res.data || [])).catch(() => {});
    }, []);

    const addAddr = async () => {
        if (!title || !address) return;
        const { data } = await userAPI.addAddress({ title, address });
        setAddresses(data.addresses || []);
        setTitle(''); setAddress(''); setShowForm(false);
    };

    const removeAddr = async (id) => {
        await userAPI.removeAddress(id);
        setAddresses(prev => prev.filter(a => a._id !== id));
    };

    return (
        <div className="page">
            <div className="back-bar">
                <button className="back-btn" onClick={onBack}>←</button>
                <h2>📍 {t('addressesTitle')}</h2>
            </div>
            {addresses.map(a => (
                <div key={a._id} className="card fade-up" style={{ margin: '0 20px 10px' }}>
                    <div className="flex-between">
                        <div>
                            <div style={{ fontWeight: 800 }}>{a.title}</div>
                            <div className="text-sm text-gray">{a.address}</div>
                        </div>
                        <button className="remove-btn" onClick={() => removeAddr(a._id)}>✕</button>
                    </div>
                </div>
            ))}
            {showForm ? (
                <div className="section">
                    <div className="form-group">
                        <label className="form-label">{t('addrName')}</label>
                        <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('addrNamePlaceholder')} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('addrAddr')}</label>
                        <textarea className="form-textarea" value={address} onChange={e => setAddress(e.target.value)} placeholder={t('addrAddrPlaceholder')} />
                    </div>
                    <button className="btn-primary" onClick={addAddr}>{t('save')}</button>
                </div>
            ) : (
                <div className="section">
                    <button className="btn-secondary" onClick={() => setShowForm(true)}>+ {t('addAddress')}</button>
                </div>
            )}
        </div>
    );
}
