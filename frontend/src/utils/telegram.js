// Telegram WebApp uchun yagona yordamchi funksiyalar.
// Mini App ichida nativ ko'rinishlardan foydalanish, brauzerда esa fallback.

export const getTg = () =>
    (typeof window !== 'undefined' ? window.Telegram?.WebApp : null);

// Brauzer alert() o'rniga — Telegram ichida nativ showAlert.
export function showAlert(message) {
    const tg = getTg();
    if (tg?.showAlert) {
        try {
            tg.showAlert(String(message));
            return;
        } catch { /* fallback */ }
    }
    // eslint-disable-next-line no-alert
    alert(message);
}

// Yengil tebranish (mavjud bo'lsa).
export function haptic(type = 'light') {
    try {
        getTg()?.HapticFeedback?.impactOccurred?.(type);
    } catch { /* ignore */ }
}
