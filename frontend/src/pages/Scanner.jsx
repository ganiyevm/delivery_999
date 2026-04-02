import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useT } from '../i18n';

const API = import.meta.env.VITE_API_URL || '';

const tg = () => window?.Telegram?.WebApp;
const tgVersion = () => parseFloat(tg()?.version || '0');

export default function Scanner({ onBack }) {
    const { t } = useT();
    const [result,     setResult]     = useState(null);
    const [loading,    setLoading]    = useState(false);
    const [camMode,    setCamMode]    = useState(false);
    const [camError,   setCamError]   = useState(null);
    const [manualCode, setManualCode] = useState('');

    const videoRef   = useRef(null);
    const controlRef = useRef(null);
    const readerRef  = useRef(null);

    const stopCamera = () => {
        try { controlRef.current?.stop(); } catch (_) {}
        controlRef.current = null;
        setCamMode(false);
    };

    useEffect(() => () => stopCamera(), []);

    const verify = async (code) => {
        const c = code?.trim();
        if (!c) return;
        setLoading(true);
        setResult(null);
        try {
            const { data } = await axios.post(`${API}/api/verify-marking`, { code: c });
            setResult(data);
        } catch {
            setResult({ status: 'error', message: t('serverError') });
        } finally {
            setLoading(false);
        }
    };

    const scanViaTelegram = () => {
        const wa = tg();
        if (!wa || tgVersion() < 6.4) {
            startCamera();
            return;
        }
        setResult(null);
        wa.showScanQrPopup(
            { text: t('scanQrPrompt') },
            (scannedText) => {
                if (scannedText) {
                    wa.closeScanQrPopup();
                    verify(scannedText);
                }
                return true;
            }
        );
    };

    const startCamera = async () => {
        setCamError(null);
        setResult(null);
        setCamMode(true);
        try {
            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            const { NotFoundException }        = await import('@zxing/library');
            const reader = new BrowserMultiFormatReader();
            readerRef.current = reader;
            const controls = await reader.decodeFromConstraints(
                { video: { facingMode: 'environment' } },
                videoRef.current,
                (scanResult, err) => {
                    if (scanResult) { stopCamera(); verify(scanResult.getText()); }
                    if (err && !(err instanceof NotFoundException)) console.warn(err);
                }
            );
            controlRef.current = controls;
        } catch {
            setCamMode(false);
            setCamError(t('cameraError'));
        }
    };

    const reset = () => { setResult(null); setManualCode(''); stopCamera(); };

    const statusMeta = {
        authentic: { icon: '✅', color: '#27AE60', bg: 'rgba(39,174,96,0.08)',  border: '#27AE60', title: t('statusAuthentic') },
        fake:      { icon: '❌', color: '#e74c3c', bg: 'rgba(231,76,60,0.08)',  border: '#e74c3c', title: t('statusFake') },
        expired:   { icon: '⚠️', color: '#F39C12', bg: 'rgba(243,156,18,0.08)', border: '#F39C12', title: t('statusExpired') },
        unknown:   { icon: '❓', color: '#8b8fa3', bg: 'var(--card)',            border: 'var(--border)', title: t('statusUnknown') },
        error:     { icon: '🔴', color: '#e74c3c', bg: 'rgba(231,76,60,0.08)',  border: '#e74c3c', title: t('scanError') },
    };
    const sm = statusMeta[result?.status] || statusMeta.unknown;

    const hasTgScanner = tg() && tgVersion() >= 6.4;

    return (
        <div className="page">
            <div className="back-bar">
                <button className="back-btn" onClick={() => { stopCamera(); onBack(); }}>←</button>
                <h2>🔍 {t('scanTitle')}</h2>
            </div>

            <div style={{ padding: '16px 20px 0' }}>

                {camMode && (
                    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '4/3', marginBottom: 12 }}>
                        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                            <div style={{ width: '65%', aspectRatio: '1', border: '2px solid rgba(255,255,255,0.85)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
                        </div>
                        <ScanLine />
                        <button onClick={stopCamera} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>
                            ✕ {t('close')}
                        </button>
                        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                            {t('scanFrameHint')}
                        </div>
                    </div>
                )}

                {!camMode && !loading && !result && (
                    <button onClick={scanViaTelegram} style={{ width: '100%', padding: '18px', borderRadius: 16, background: 'var(--gradient)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>📷</span>
                        {t('scanBtn')}
                    </button>
                )}

                {!camMode && !loading && !result && !hasTgScanner && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 6 }}>
                        {t('useTelegramHint')}
                    </div>
                )}

                {camError && (
                    <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(231,76,60,0.08)', color: '#e74c3c', fontSize: 13, marginTop: 8, border: '1px solid rgba(231,76,60,0.2)' }}>
                        ⚠️ {camError}
                    </div>
                )}

                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <input
                        value={manualCode}
                        onChange={e => setManualCode(e.target.value)}
                        placeholder={t('scanManual')}
                        style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14 }}
                        onKeyDown={e => e.key === 'Enter' && verify(manualCode)}
                    />
                    <button onClick={() => verify(manualCode)}
                        disabled={!manualCode.trim() || loading}
                        style={{ padding: '12px 18px', borderRadius: 12, background: 'var(--green)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: (!manualCode.trim() || loading) ? 0.5 : 1 }}>
                        {t('check')}
                    </button>
                </div>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: 48 }}>
                    <div className="loading-spinner" />
                    <p style={{ marginTop: 14, color: 'var(--text-secondary)', fontSize: 14 }}>
                        {t('scanChecking')}
                    </p>
                </div>
            )}

            {result && !loading && (
                <div style={{ margin: '20px 20px 0' }}>
                    <div style={{ borderRadius: 20, padding: '28px 20px', background: sm.bg, border: `2px solid ${sm.border}`, textAlign: 'center' }}>
                        <div style={{ fontSize: 58 }}>{sm.icon}</div>
                        <div style={{ fontWeight: 800, fontSize: 20, marginTop: 10, color: sm.color }}>
                            {sm.title}
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
                            {result.message}
                        </p>

                        {result.product && (result.product.name || result.product.gtin) && (
                            <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 14, background: 'rgba(0,0,0,0.05)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {result.product.name && (
                                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                                        💊 {result.product.name}
                                    </div>
                                )}
                                {result.product.manufacturer && (
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        🏭 {result.product.manufacturer}
                                    </div>
                                )}
                                {result.product.expiry && (
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        📅 {t('scanExpiry')}: <strong>{result.product.expiry}</strong>
                                    </div>
                                )}
                                {result.product.batch && (
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        📦 {t('scanBatch')}: {result.product.batch}
                                    </div>
                                )}
                                {result.product.gtin && (
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                                        🔢 {t('scanGtin')}: {result.product.gtin}
                                    </div>
                                )}
                                {result.product.serial && (
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                                        🔑 {t('scanSerial')}: {result.product.serial}
                                    </div>
                                )}
                                {result.source && (
                                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, textAlign: 'right' }}>
                                        {t('scanSource')}: {
                                            result.source === 'aslbelgisi' ? t('sourceAslBelgisi') :
                                            result.source === 'local'      ? t('sourceLocal') : result.source
                                        }
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <button onClick={reset} style={{ width: '100%', marginTop: 12, padding: 14, borderRadius: 14, fontSize: 15, fontWeight: 600, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                        🔄 {t('rescan')}
                    </button>
                </div>
            )}

            {!result && !loading && !camMode && (
                <div style={{ margin: '16px 20px 0', padding: 16, borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>
                        ℹ️ {t('howItWorks')}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                        1. 📷 {t('scanStep1')}<br />
                        2. 📦 {t('scanStep2')}<br />
                        3. ✅ {t('scanStep3')}<br />
                        4. 💊 {t('scanStep4')}
                    </div>
                </div>
            )}
        </div>
    );
}

function ScanLine() {
    return (
        <div style={{
            position: 'absolute', left: '17.5%', right: '17.5%',
            height: 2, background: 'rgba(39,174,96,0.9)',
            boxShadow: '0 0 8px rgba(39,174,96,0.8)',
            animation: 'scanLine 2s ease-in-out infinite',
            top: '17.5%',
        }} />
    );
}
