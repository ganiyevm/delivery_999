import { useEffect, useMemo, useRef, useState } from 'react';
import { prescriptionsAPI } from '../api/index';
import { useCart } from '../context/CartContext';
import DrugImage from '../components/DrugImages';
import { useT } from '../i18n';

export default function PrescriptionUpload({ onBack, onCart }) {
    const { t } = useT();
    const { addToCart } = useCart();
    const fileRef = useRef(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [addedIds, setAddedIds] = useState(() => new Set());

    useEffect(() => {
        if (!file) {
            setPreview('');
            return;
        }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const foundItems = useMemo(() => (result?.items || []).filter(item => item.found && item.product), [result]);
    const missingItems = useMemo(() => (result?.items || []).filter(item => !item.found), [result]);

    const pickFile = (nextFile) => {
        if (!nextFile) return;
        setFile(nextFile);
        setResult(null);
        setError('');
        setAddedIds(new Set());
    };

    const analyze = async () => {
        if (!file || loading) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const formData = new FormData();
            formData.append('image', file);
            const { data } = await prescriptionsAPI.analyze(formData);
            setResult(data);
        } catch (err) {
            setError(err.response?.data?.error || err.message || t('prescriptionError'));
        } finally {
            setLoading(false);
        }
    };

    const addItem = (item) => {
        if (!item?.product) return;
        const product = {
            ...item.product,
            price: item.product.price || 0,
            imageType: item.product.imageType || 'blister',
        };
        addToCart(product, null, item.quantity || 1);
        setAddedIds(prev => new Set([...prev, String(product._id)]));
    };

    const addAll = () => {
        foundItems.forEach(addItem);
    };

    return (
        <div className="page">
            <div className="back-bar">
                <button className="back-btn" onClick={onBack}>←</button>
                <h2>🧾 {t('prescriptionTitle')}</h2>
            </div>

            <div style={{ padding: '16px 20px 0' }}>
                <div style={{ borderRadius: 18, background: 'var(--card)', border: '1px solid var(--border)', padding: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
                        {t('prescriptionUploadTitle')}
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                        {t('prescriptionUploadText')}
                    </p>

                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={event => pickFile(event.target.files?.[0])}
                    />

                    <button
                        onClick={() => fileRef.current?.click()}
                        disabled={loading}
                        style={{
                            width: '100%', marginTop: 16, padding: '15px 16px', border: 'none',
                            borderRadius: 14, background: 'var(--green)', color: '#fff',
                            fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: loading ? 0.6 : 1,
                        }}>
                        📷 {t('prescriptionChoose')}
                    </button>
                </div>

                {preview && (
                    <div style={{ marginTop: 14, borderRadius: 18, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)' }}>
                        <img src={preview} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', display: 'block' }} />
                    </div>
                )}

                {file && (
                    <button
                        onClick={analyze}
                        disabled={loading}
                        style={{
                            width: '100%', marginTop: 14, padding: '15px 16px', border: 'none',
                            borderRadius: 14, background: loading ? 'var(--border)' : 'var(--gradient)',
                            color: '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'default' : 'pointer',
                        }}>
                        {loading ? t('prescriptionChecking') : t('prescriptionCheck')}
                    </button>
                )}

                {loading && (
                    <div style={{ textAlign: 'center', padding: 32 }}>
                        <div className="loading-spinner" />
                    </div>
                )}

                {error && (
                    <div style={{ marginTop: 14, padding: 14, borderRadius: 14, color: '#e74c3c', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.22)', fontSize: 13, lineHeight: 1.5 }}>
                        {error}
                    </div>
                )}

                {result && !loading && (
                    <div style={{ marginTop: 18, paddingBottom: 28 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                            <div style={{ borderRadius: 14, padding: 14, background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.2)' }}>
                                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)' }}>{result.summary?.foundCount || 0}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('prescriptionFound')}</div>
                            </div>
                            <div style={{ borderRadius: 14, padding: 14, background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.18)' }}>
                                <div style={{ fontSize: 22, fontWeight: 900, color: '#e74c3c' }}>{result.summary?.unavailableCount || 0}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('prescriptionMissing')}</div>
                            </div>
                        </div>

                        {foundItems.length > 0 && (
                            <button
                                onClick={addAll}
                                style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 800, marginBottom: 14 }}>
                                🛒 {t('prescriptionAddAll')}
                            </button>
                        )}

                        {foundItems.map(item => (
                            <div key={`${item.requestedName}-${item.product._id}`} style={{ display: 'flex', gap: 12, padding: 12, marginBottom: 10, borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)' }}>
                                <DrugImage imageType={item.product.imageType} imageUrl={item.product.imageUrl} category={item.product.category} size={58} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>
                                        {item.requestedName}{item.dose ? ` · ${item.dose}` : ''}
                                    </div>
                                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', lineHeight: 1.35 }}>
                                        {item.product.name}
                                    </div>
                                    <div style={{ marginTop: 5, fontSize: 13, color: 'var(--green)', fontWeight: 800 }}>
                                        {(item.product.price || 0).toLocaleString()} {t('currency')} · {t('inStock')}
                                    </div>
                                </div>
                                <button
                                    onClick={() => addItem(item)}
                                    disabled={addedIds.has(String(item.product._id))}
                                    style={{
                                        alignSelf: 'center', width: 40, height: 40, borderRadius: 12,
                                        border: 'none', background: addedIds.has(String(item.product._id)) ? 'var(--border)' : 'var(--green)',
                                        color: '#fff', fontWeight: 900, fontSize: 18,
                                    }}>
                                    {addedIds.has(String(item.product._id)) ? '✓' : '+'}
                                </button>
                            </div>
                        ))}

                        {missingItems.map(item => (
                            <div key={`${item.requestedName}-${item.dose}`} style={{ padding: 14, marginBottom: 10, borderRadius: 16, background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.16)' }}>
                                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{item.requestedName}</div>
                                <div style={{ marginTop: 4, fontSize: 13, color: '#e74c3c' }}>{t('prescriptionNotAvailable')}</div>
                            </div>
                        ))}

                        {foundItems.length > 0 && (
                            <button
                                onClick={onCart}
                                style={{ width: '100%', marginTop: 4, padding: 14, borderRadius: 14, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 800 }}>
                                {t('viewCart')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
