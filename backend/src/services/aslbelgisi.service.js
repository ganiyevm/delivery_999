/**
 * Asl Belgisi (O'zbekiston dori markirovkasi) API integratsiyasi
 * Hujjatlar: aslbelgisi.uz
 * Env: ASLBELGISI_API_URL, ASLBELGISI_CLIENT_ID, ASLBELGISI_SECRET_KEY
 */
const axios = require('axios');

const BASE   = (process.env.ASLBELGISI_API_URL || 'https://api.aslbelgisi.uz').replace(/\/$/, '');
const CID    = process.env.ASLBELGISI_CLIENT_ID;
const CSEC   = process.env.ASLBELGISI_SECRET_KEY;

let _token    = null;
let _tokenExp = 0;

// ── Token olish (keshda saqlash) ──────────────────────────────────────────────
async function getToken() {
    if (_token && Date.now() < _tokenExp) return _token;

    const resp = await axios.post(`${BASE}/api/v1/auth/token`, {
        client_id:  CID,
        secret_key: CSEC,
    }, { timeout: 8000 });

    const data = resp.data;
    _token    = data.token || data.access_token || data.data?.token;
    _tokenExp = Date.now() + ((data.expires_in || 3600) * 1000) - 60_000;

    if (!_token) throw new Error('Asl Belgisi: token olinmadi');
    return _token;
}

// ── Asosiy tekshirish funksiyasi ─────────────────────────────────────────────
async function verify(rawCode) {
    if (!CID || !CSEC) return null; // sozlanmagan — o'tkazib yubor

    try {
        const token = await getToken();

        // API bir nechta formatni qabul qilishi mumkin
        const resp = await axios.get(`${BASE}/api/v1/codes/check`, {
            params: { code: rawCode },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10_000,
        });

        return normalise(resp.data);
    } catch (err) {
        // Token eskirgan bo'lsa — yangilash
        if (err?.response?.status === 401) {
            _token = null;
            try {
                const token2 = await getToken();
                const resp2 = await axios.get(`${BASE}/api/v1/codes/check`, {
                    params: { code: rawCode },
                    headers: { Authorization: `Bearer ${token2}` },
                    timeout: 10_000,
                });
                return normalise(resp2.data);
            } catch { return null; }
        }
        // Boshqa xatolikda null qaytarib, fallback ishlaydi
        console.error('Asl Belgisi API xatosi:', err?.response?.data || err?.message);
        return null;
    }
}

// ── Turli API javob formatlarini bir xil shaklga keltirish ──────────────────
function normalise(data) {
    if (!data) return null;

    // API-ga qarab field nomlari farqlashi mumkin
    const d = data.data || data.result || data;

    const statusMap = {
        IN_CIRCULATION:   'authentic',
        SOLD:             'authentic',
        EMITTED:          'authentic',
        APPLIED:          'authentic',
        RETIRED:          'expired',
        EXPIRED:          'expired',
        WRITTEN_OFF:      'expired',
        COUNTERFEIT:      'fake',
        FRAUD:            'fake',
    };

    const rawStatus = d.status || d.marking_status || d.cis_status || 'UNKNOWN';
    const status    = statusMap[rawStatus.toUpperCase()] || 'unknown';

    return {
        status,
        apiSource: 'aslbelgisi',
        product: {
            name:         d.product_name || d.name || d.drug_name || null,
            manufacturer: d.manufacturer || d.producer || d.owner_name || null,
            expiry:       d.expiry_date  || d.expire_date || null,
            serial:       d.serial       || d.sgtin || null,
            batch:        d.batch        || d.series || null,
            gtin:         d.gtin         || d.ean   || null,
            rawStatus,
        },
    };
}

module.exports = { verify };
