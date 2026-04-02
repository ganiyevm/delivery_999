import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useT } from '../../i18n';

export default function DeliverySettings() {
    const { t } = useT();
    const [form, setForm] = useState({
        baseKm:        3,
        basePrice:     15000,
        pricePerKm:    1500,
        maxDeliveryKm: 30,
        freeThreshold: 150000,
        enabled:       true,
    });
    const [loading, setLoading]   = useState(true);
    const [saving,  setSaving]    = useState(false);
    const [saved,   setSaved]     = useState(false);

    useEffect(() => {
        api.get('/delivery/settings')
            .then(r => setForm(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const save = async () => {
        setSaving(true); setSaved(false);
        try {
            await api.put('/delivery/settings', form);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch { alert('Saqlashda xatolik'); }
        finally { setSaving(false); }
    };

    // Preview hisoblash
    const preview = [1, 3, 5, 10, 15, 20].map(km => {
        if (km > form.maxDeliveryKm) return { km, cost: null };
        if (km <= form.baseKm) return { km, cost: form.basePrice };
        const extra = Math.ceil(km - form.baseKm) * form.pricePerKm;
        return { km, cost: form.basePrice + extra };
    });

    if (loading) return <div className="loading"><div className="loading-spinner" /></div>;

    return (
        <div>
            <div className="topbar">
                <h2>🚚 Yetkazib berish narxlari</h2>
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                    {saving ? '⏳ Saqlanmoqda...' : saved ? '✅ Saqlandi' : '💾 Saqlash'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 24 }}>

                {/* ── Asosiy sozlamalar ── */}
                <div className="data-table-wrapper pro" style={{ padding: 20 }}>
                    <h3 style={{ marginBottom: 20, fontSize: 15, fontWeight: 700 }}>⚙️ Asosiy sozlamalar</h3>

                    {/* Yoqish/o'chirish */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '12px 16px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Yetkazib berish</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {form.enabled ? 'Faol — mijozlar buyurtma qila oladi' : 'O\'chirilgan'}
                            </div>
                        </div>
                        <div className={`switch ${form.enabled ? 'on' : ''}`}
                            onClick={() => set('enabled', !form.enabled)} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <Field label="Asosiy masofa (km)"
                            hint="Shu km gacha baza narx olinadi"
                            value={form.baseKm}
                            onChange={v => set('baseKm', v)}
                            unit="km" />

                        <Field label="Asosiy narx"
                            hint={`0 — ${form.baseKm} km gacha`}
                            value={form.basePrice}
                            onChange={v => set('basePrice', v)}
                            unit="so'm" />

                        <Field label="Har qo'shimcha km narxi"
                            hint={`${form.baseKm} km dan oshsa, har 1 km uchun`}
                            value={form.pricePerKm}
                            onChange={v => set('pricePerKm', v)}
                            unit="so'm/km" />

                        <Field label="Maksimal yetkazish masofasi"
                            hint="Bundan uzoqqa yetkazilmaydi"
                            value={form.maxDeliveryKm}
                            onChange={v => set('maxDeliveryKm', v)}
                            unit="km" />

                        <Field label="Bepul yetkazish chegarasi"
                            hint="Buyurtma shu summadan oshsa — yetkazish bepul (0 = yo'q)"
                            value={form.freeThreshold}
                            onChange={v => set('freeThreshold', v)}
                            unit="so'm" />
                    </div>
                </div>

                {/* ── Narx jadvali preview ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="data-table-wrapper pro" style={{ padding: 20 }}>
                        <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 700 }}>📊 Narx jadvali (preview)</h3>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Masofa</th>
                                    <th>Narx</th>
                                    <th>Holat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map(({ km, cost }) => (
                                    <tr key={km}>
                                        <td><strong>{km} km</strong></td>
                                        <td style={{ fontWeight: 700, color: cost === null ? 'var(--red)' : cost === 0 ? 'var(--green)' : 'var(--text)' }}>
                                            {cost === null ? '—' : cost === 0 ? 'Bepul' : cost.toLocaleString() + ' so\'m'}
                                        </td>
                                        <td>
                                            {cost === null
                                                ? <span className="badge badge-red">Yetkazilmaydi</span>
                                                : km <= form.baseKm
                                                    ? <span className="badge badge-blue">Baza narx</span>
                                                    : <span className="badge badge-yellow">+{Math.ceil(km - form.baseKm)} km qo'shimcha</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                                {form.freeThreshold > 0 && (
                                    <tr style={{ background: 'rgba(39,174,96,0.05)' }}>
                                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700, fontSize: 13 }}>
                                            🎉 {form.freeThreshold.toLocaleString()} so'm dan yuqori buyurtmada — bepul
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Formula */}
                    <div className="data-table-wrapper pro" style={{ padding: 20 }}>
                        <h3 style={{ marginBottom: 12, fontSize: 15, fontWeight: 700 }}>🧮 Hisoblash formulasi</h3>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2 }}>
                            <div>📌 0 — <strong style={{ color: 'var(--text)' }}>{form.baseKm} km</strong>: <strong style={{ color: 'var(--green)' }}>{form.basePrice.toLocaleString()} so'm</strong></div>
                            <div>📌 {form.baseKm}+ km: <strong style={{ color: 'var(--text)' }}>{form.basePrice.toLocaleString()} + (km − {form.baseKm}) × {form.pricePerKm.toLocaleString()}</strong></div>
                            <div>🚫 {form.maxDeliveryKm} km dan uzoq: <strong style={{ color: 'var(--red)' }}>Yetkazilmaydi</strong></div>
                            {form.freeThreshold > 0 && (
                                <div>🎁 {form.freeThreshold.toLocaleString()} so'm+: <strong style={{ color: 'var(--green)' }}>Bepul</strong></div>
                            )}
                        </div>

                        {/* Misol */}
                        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 13 }}>
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>Misol: 7 km</div>
                            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                {form.basePrice.toLocaleString()} + ({Math.ceil(7 - form.baseKm)} × {form.pricePerKm.toLocaleString()})
                                {' = '}
                                <strong style={{ color: 'var(--green)' }}>
                                    {(form.basePrice + Math.ceil(7 - form.baseKm) * form.pricePerKm).toLocaleString()} so'm
                                </strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, hint, value, onChange, unit }) {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <label style={{ fontWeight: 600, fontSize: 13 }}>{label}</label>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{unit}</span>
            </div>
            {hint && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{hint}</div>}
            <input
                type="number"
                className="form-input"
                value={value}
                onChange={e => onChange(+e.target.value)}
                style={{ fontWeight: 700 }}
            />
        </div>
    );
}
