import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { useT } from '../i18n';

const API = import.meta.env.VITE_API_URL || '';

export default function Scanner({ onBack }) {
    const { t } = useT();
    const [result, setResult]     = useState(null);
    const [loading, setLoading]   = useState(false);
    const [scanning, setScanning] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [camError, setCamError] = useState(null);

    const videoRef   = useRef(null);
    const readerRef  = useRef(null);
    const controlRef = useRef(null);

    // Kamerani to'xtatish
    const stopCamera = () => {
        try { controlRef.current?.stop(); } catch (_) {}
        controlRef.current = null;
        setScanning(false);
    };

    // Kamerani ishga tushirish
    const startCamera = async () => {
        setCamError(null);
        setResult(null);
        setScanning(true);
        try {
            const reader = new BrowserMultiFormatReader();
            readerRef.current = reader;
            const controls = await reader.decodeFromConstraints(
                { video: { facingMode: 'environment' } },
                videoRef.current,
                (scanResult, err) => {
                    if (scanResult) {
                        stopCamera();
                        verify(scanResult.getText());
                    }
                    if (err && !(err instanceof NotFoundException)) {
                        console.warn(err);
                    }
                }
            );
            controlRef.current = controls;
        } catch (e) {
            setScanning(false);
            setCamError('Kameraga ruxsat berilmadi yoki qurilma topilmadi');
        }
    };

    // Komponent unmount bo'lganda kamerani o'chirish
    useEffect(() => () => stopCamera(), []);

    const verify = async (code) => {
        if (!code?.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const { data } = await axios.post(`${API}/api/verify-marking`, { code: code.trim() });
            setResult(data);
        } catch {
            setResult({ status: 'error', message: 'Server bilan bog\'lanishda xatolik' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page">
            <div className="back-bar">
                <button className="back-btn" onClick={() => { stopCamera(); onBack(); }}>←</button>
                <h2>🔍 {t('scanTitle')}</h2>
            </div>

            <div style={{ padding: '16px 20px 0' }}>

                {/* Kamera oynasi */}
                <div style={{
                    position: 'relative', borderRadius: 16, overflow: 'hidden',
                    background: '#000', aspectRatio: '4/3',
                    display: scanning ? 'block' : 'none',
                }}>
                    <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {/* Kor kesish chizig'i */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'none',
                    }}>
                        <div style={{
                            width: '65%', aspectRatio: '1',
                            border: '2px solid rgba(255,255,255,0.8)',
                            borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                        }} />
                    </div>
                    <button
                        onClick={stopCamera}
                        style={{
                            position: 'absolute', top: 10, right: 10,
                            background: 'rgba(0,0,0,0.5)', color: 'white',
                            border: 'none', borderRadius: 20, padding: '6px 14px',
                            fontSize: 13, cursor: 'pointer',
                        }}
                    >✕ {t('close')}</button>
                    <div style={{
                        position: 'absolute', bottom: 12, left: 0, right: 0,
                        textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: 12,
                    }}>
                        {t('scanInstruction')}
                    </div>
                </div>

                {/* Boshlash tugmasi */}
                {!scanning && !loading && (
                    <button
                        onClick={startCamera}
                        style={{
                            width: '100%', padding: '18px', borderRadius: 16,
                            background: 'var(--gradient)', color: 'white',
                            border: 'none', cursor: 'pointer',
                            fontSize: 16, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        }}
                    >
                        <span style={{ fontSize: 22 }}>📷</span>
                        {t('scanBtn')}
                    </button>
                )}

                {camError && (
                    <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fdecea', color: 'var(--red)', fontSize: 13, marginTop: 8 }}>
                        ⚠️ {camError}
                    </div>
                )}

                {/* Qo'lda kiritish */}
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <input
                        value={manualCode}
                        onChange={e => setManualCode(e.target.value)}
                        placeholder={t('scanManual')}
                        style={{
                            flex: 1, padding: '12px 14px', borderRadius: 12,
                            border: '1px solid var(--border)', background: 'var(--card)',
                            color: 'var(--text)', fontSize: 14,
                        }}
                        onKeyDown={e => e.key === 'Enter' && verify(manualCode)}
                    />
                    <button
                        onClick={() => verify(manualCode)}
                        disabled={!manualCode.trim() || loading}
                        style={{
                            padding: '12px 18px', borderRadius: 12,
                            background: 'var(--green)', color: 'white',
                            border: 'none', cursor: 'pointer', fontWeight: 600,
                        }}
                    >{t('check')}</button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div className="loading-spinner" />
                    <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>{t('checking')}</p>
                </div>
            )}

            {/* Natija */}
            {result && !loading && (
                <div style={{ margin: '20px 20px 0' }}>
                    <div style={{
                        borderRadius: 20, padding: '28px 20px', textAlign: 'center',
                        background: result.status === 'authentic' ? 'var(--green-light)'
                                  : result.status === 'fake'      ? '#fdecea'
                                  : 'var(--card)',
                        border: `2px solid ${
                            result.status === 'authentic' ? 'var(--green)'
                          : result.status === 'fake'      ? 'var(--red)'
                          : 'var(--border)'
                        }`,
                    }}>
                        <div style={{ fontSize: 60 }}>
                            {result.status === 'authentic' ? '✅' : result.status === 'fake' ? '❌' : '⚠️'}
                        </div>
                        <div style={{
                            fontWeight: 800, fontSize: 18, marginTop: 12,
                            color: result.status === 'authentic' ? 'var(--green)'
                                 : result.status === 'fake'      ? 'var(--red)'
                                 : 'var(--text)',
                        }}>
                            {result.status === 'authentic' && t('authentic')}
                            {result.status === 'fake'      && t('fake')}
                            {result.status === 'unknown'   && t('unknown')}
                            {result.status === 'error'     && t('scanError')}
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                            {result.message}
                        </p>
                        {result.product && (
                            <div style={{
                                marginTop: 16, padding: 14, borderRadius: 12,
                                background: 'rgba(0,0,0,0.05)', textAlign: 'left',
                            }}>
                                {result.product.name && <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{result.product.name}</div>}
                                {result.product.manufacturer && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>🏭 {result.product.manufacturer}</div>}
                                {result.product.expiry && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>📅 Yaroqlilik: {result.product.expiry}</div>}
                                {result.product.serial && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, wordBreak: 'break-all' }}>🔢 {result.product.serial}</div>}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => { setResult(null); setManualCode(''); }}
                        style={{
                            width: '100%', marginTop: 12, padding: 13,
                            borderRadius: 14, fontSize: 15, fontWeight: 600,
                            background: 'var(--card)', color: 'var(--text)',
                            border: '1px solid var(--border)', cursor: 'pointer',
                        }}
                    >🔄 {t('rescan')}</button>
                </div>
            )}

            {/* Yo'riqnoma */}
            {!result && !loading && !scanning && (
                <div style={{ margin: '16px 20px 0', padding: 16, borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>ℹ️ {t('howItWorks')}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        1. "{t('scanBtn')}"<br />
                        2. {t('scanInstruction')}<br />
                        3. {t('checking')}
                    </div>
                </div>
            )}
        </div>
    );
}
