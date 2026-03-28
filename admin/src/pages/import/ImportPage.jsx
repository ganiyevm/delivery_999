import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';

export default function ImportPage() {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploadPct, setUploadPct] = useState(0);
    const [phase, setPhase] = useState(''); // 'uploading' | 'processing'
    const [logs, setLogs] = useState([]);
    const fileRef = useRef();

    useEffect(() => {
        api.get('/import/logs').then(r => setLogs(r.data || [])).catch(() => { });
    }, [result]);

    const handleImport = async (file) => {
        if (!file) return;
        setLoading(true);
        setResult(null);
        setUploadPct(0);
        setPhase('uploading');
        try {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post('/import/excel', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 600000, // 10 daqiqa — katta fayllar uchun
                onUploadProgress: (e) => {
                    const pct = Math.round((e.loaded * 100) / (e.total || 1));
                    setUploadPct(pct);
                    if (pct >= 100) setPhase('processing');
                },
            });
            setResult(data);
        } catch (err) {
            const msg = err.code === 'ECONNABORTED'
                ? 'Timeout: server javob bermadi (fayl juda katta yoki server band)'
                : (err.response?.data?.error || err.message || 'Import xatosi');
            setResult({ error: msg });
        } finally {
            setLoading(false);
            setPhase('');
        }
    };

    return (
        <div>
            <div className="topbar"><h2>📤 Import</h2></div>

            <div className="drop-zone" onClick={() => !loading && fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleImport(e.dataTransfer.files[0]); }}
                style={{ cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                <div className="icon">📁</div>
                <h3>Excel faylni shu yerga torting</h3>
                <p>yoki bosib tanlang (.xlsx)</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                    onChange={e => handleImport(e.target.files[0])} />
            </div>

            {loading && (
                <div style={{ padding: '24px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                        <span>{phase === 'uploading' ? '⬆️ Fayl yuklanmoqda...' : '⚙️ Server qayta ishlayapti...'}</span>
                        <span style={{ color: 'var(--primary)' }}>
                            {phase === 'uploading' ? `${uploadPct}%` : ''}
                        </span>
                    </div>
                    <div style={{ background: 'var(--border)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            borderRadius: 8,
                            background: 'var(--primary)',
                            transition: 'width 0.3s ease',
                            width: phase === 'uploading' ? `${uploadPct}%` : '100%',
                            animation: phase === 'processing' ? 'shimmer 1.5s infinite' : 'none',
                        }} />
                    </div>
                    {phase === 'processing' && (
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                            57 000+ qator ishlanmoqda, 1-3 daqiqa kutiladi...
                        </p>
                    )}
                </div>
            )}

            {result && !result.error && (
                <div className="chart-card" style={{ marginTop: 16 }}>
                    <h3>✅ Import natijasi</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, margin: '16px 0' }}>
                        <div className="stat-card"><div className="label">Jami</div><div className="value">{result.totalRows?.toLocaleString()}</div></div>
                        <div className="stat-card"><div className="label" style={{ color: '#2ECC71' }}>Muvaffaqiyat</div><div className="value" style={{ color: '#2ECC71' }}>{result.successRows?.toLocaleString()}</div></div>
                        <div className="stat-card"><div className="label" style={{ color: '#e74c3c' }}>Xatolar</div><div className="value" style={{ color: '#e74c3c' }}>{result.errorRows}</div></div>
                    </div>
                    {result.errors?.length > 0 && (
                        <div className="data-table-wrapper" style={{ marginTop: 12 }}>
                            <div className="data-table-header"><h3>❌ Xatolar</h3></div>
                            <table className="data-table">
                                <thead><tr><th>Qator</th><th>Xato</th></tr></thead>
                                <tbody>
                                    {result.errors.slice(0, 20).map((e, i) => (
                                        <tr key={i}><td>{e.row}</td><td>{e.message}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {result?.error && (
                <div style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', padding: 16, borderRadius: 12, marginTop: 16 }}>❌ {result.error}</div>
            )}

            {/* Import tarixi */}
            <div className="data-table-wrapper" style={{ marginTop: 24 }}>
                <div className="data-table-header"><h3>📋 Import tarixi</h3></div>
                <table className="data-table">
                    <thead><tr><th>Sana</th><th>Fayl</th><th>Jami</th><th>✅</th><th>❌</th></tr></thead>
                    <tbody>
                        {logs.map((l, i) => (
                            <tr key={i}>
                                <td>{new Date(l.importDate).toLocaleDateString()}</td>
                                <td>{l.filename}</td>
                                <td>{l.totalRows}</td>
                                <td style={{ color: '#2ECC71' }}>{l.successRows}</td>
                                <td style={{ color: '#e74c3c' }}>{l.errorRows}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
