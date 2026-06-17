/**
 * TTL asosidagi oddiy in-memory cache.
 * Faqat kichik, tez-tez o'zgarmaydigan ma'lumotlar uchun.
 */
const store = new Map(); // key → { value, expiresAt }

function get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    return entry.value;
}

function set(key, value, ttlMs) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function del(key) {
    store.delete(key);
}

function delByPrefix(prefix) {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key);
    }
}

module.exports = { get, set, del, delByPrefix };
