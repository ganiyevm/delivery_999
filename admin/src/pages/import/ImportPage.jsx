import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';

export default function ImportPage() {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const fileRef = useRef();

    useEffect(() => {
        api.get('/import/logs').then(r => setLogs(r.data || [])).catch(() => { });
    }, [result]);

    const handleImport = async (file) => {
        if (!file) return;
        setLoading(true);
        setResult(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post('/import/excel', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult(data);
        } catch (err) {
            setResult({ error: err.response?.data?.error || 'Import xatosi' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="topbar"><h2>📤 Import</h2></div>

            <div className="drop-zone" onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleImport(e.dataTransfer.files[0]); }}>
                <div className="icon">📁</div>
                <h3>Excel faylni shu yerga torting</h3>
                <p>yoki bosib tanlang (.xlsx)</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                    onChange={e => handleImport(e.target.files[0])} />
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: '60%', animation: 'shimmer 1.5s infinite' }} /></div>
                    <p>⏳ Import jarayonda...</p>
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
