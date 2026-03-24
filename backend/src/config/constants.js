// ─── Kategoriyalar ───
const CATEGORIES = [
    { key: 'pain', label_uz: "Og'riq qoldiruvchi", label_ru: 'Обезболивающие', icon: '💊' },
    { key: 'antibiotics', label_uz: 'Antibiotiklar', label_ru: 'Антибиотики', icon: '🦠' },
    { key: 'vitamins', label_uz: 'Vitaminlar', label_ru: 'Витамины', icon: '🌟' },
    { key: 'heart', label_uz: 'Yurak-qon tomir', label_ru: 'Сердечно-сосудистые', icon: '❤️' },
    { key: 'children', label_uz: 'Bolalar uchun', label_ru: 'Детские', icon: '👶' },
    { key: 'cosmetics', label_uz: 'Kosmetika', label_ru: 'Косметика', icon: '💄' },
    { key: 'devices', label_uz: 'Tibbiy asboblar', label_ru: 'Мед. приборы', icon: '🩺' },
    { key: 'stomach', label_uz: "Me'da-ichak", label_ru: 'Желудочно-кишечные', icon: '🫀' },
    { key: 'other', label_uz: 'Boshqa', label_ru: 'Другое', icon: '📦' },
];

const CATEGORY_KEYS = CATEGORIES.map(c => c.key);

// ─── Buyurtma holatlari ───
const ORDER_STATUSES = [
    'awaiting_payment',
    'pending_operator',
    'confirmed',
    'rejected',
    'on_the_way',
    'delivered',
    'cancelled',
];

// Ruxsat etilgan o'tishlar
const STATUS_TRANSITIONS = {
    awaiting_payment: ['pending_operator', 'cancelled'],
    pending_operator: ['confirmed', 'rejected'],
    confirmed: ['on_the_way'],
    rejected: ['cancelled'],
    on_the_way: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
};

// ─── To'lov ───
const PAYMENT_METHODS = ['click', 'payme'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

// ─── Bonus ───
const BONUS_TIERS = {
    silver: { min: 0, max: 1999, label_uz: 'Kumush', label_ru: 'Серебро', icon: '🥈' },
    gold: { min: 2000, max: 4999, label_uz: 'Oltin', label_ru: 'Золото', icon: '🥇' },
    platinum: { min: 5000, max: Infinity, label_uz: 'Platina', label_ru: 'Платина', icon: '💎' },
};

// ─── Filiallar ───
const BRANCHES_SEED = [
    { number: 1, name: 'Максим Горький' },
    { number: 2, name: 'Юнус Абад' },
    { number: 3, name: 'Чилонзар' },
    { number: 4, name: 'Катартал' },
    { number: 5, name: 'Гунча' },
    { number: 6, name: 'Малика' },
    { number: 7, name: 'Россия' },
    { number: 8, name: 'Ганга' },
    { number: 9, name: 'ТТЗ' },
    { number: 10, name: 'Кардиология' },
    { number: 11, name: 'Юнусабад Мойкоргон' },
    { number: 12, name: 'Ялангач' },
    { number: 13, name: '(марказ)' },
    { number: 14, name: 'Беруний' },
    { number: 15, name: 'Мегапланет' },
    { number: 16, name: 'Ц-6' },
    { number: 17, name: 'Аэропорт' },
    { number: 18, name: 'Трюфель' },
    { number: 19, name: 'Ц-1' },
    { number: 20, name: 'Сайрам' },
];

// ─── Biznes qoidalar (env dan olinadi, default qiymatlar) ───
const BUSINESS = {
    MIN_ORDER_AMOUNT: parseInt(process.env.MIN_ORDER_AMOUNT) || 50000,
    FREE_DELIVERY_THRESHOLD: parseInt(process.env.FREE_DELIVERY_THRESHOLD) || 150000,
    DELIVERY_COST: parseInt(process.env.DELIVERY_COST) || 15000,
    BONUS_RATE: parseInt(process.env.BONUS_RATE) || 100,           // har 10,000 ga
    BONUS_PER_SUM: parseInt(process.env.BONUS_PER_SUM) || 1,       // 1 ball = 1 so'm
    MAX_BONUS_PERCENT: parseInt(process.env.MAX_BONUS_PERCENT) || 30,
    ORDER_PAYMENT_TIMEOUT: parseInt(process.env.ORDER_PAYMENT_TIMEOUT) || 30, // daqiqada
    WORKING_HOURS_START: parseInt(process.env.WORKING_HOURS_START) || 9,
    WORKING_HOURS_END: parseInt(process.env.WORKING_HOURS_END) || 22,
};

// ─── Auto-kategoriya regex ───
const AUTO_CATEGORY_RULES = [
    { category: 'devices', regex: /ШПРИЦ|БИНТ|ТЕРМОМЕТР|ТОНОМЕТР|ГЛЮКОМЕТР|МАСКА|ПЕРЧАТКИ/i },
    { category: 'vitamins', regex: /ВИТАМИН|VITAMIN|OMEGA|ОМЕГА|КАЛЬЦИЙ|МАГНИЙ|ЖЕЛЕЗО|ФОЛИЕВ/i },
    { category: 'antibiotics', regex: /АМОКСИЦИЛ|АУГМЕНТИН|АЗИТРОМИЦИН|ЦЕФТРИАКСОН|ЦИПРОФЛОКСАЦИН|МЕТРОНИДАЗОЛ/i },
    { category: 'heart', regex: /АСПИРИН|ЭНАП|КОНКОР|АМЛОДИПИН|НИФЕДИПИН|ЛОЗАРТАН|ВАЛСАРТАН|КАРДИО/i },
    { category: 'children', regex: /ДЕТСКИЙ|KIDS|ЮНИОР|АНАФЕРОН|НУРОФЕН ДЕТСКИЙ|ПАНАДОЛ ДЕТСКИЙ/i },
    { category: 'cosmetics', regex: /КРЕМ|ШАМПУНЬ|ГЕЛЬ ДЛЯ|ЛОСЬОН|БАЛЬЗАМ|МАЗЬ КОСМЕТИЧ/i },
    { category: 'stomach', regex: /АЛМАГЕЛЬ|ОМЕПРАЗОЛ|ЭНТЕРОЛ|ЛИНЕКС|МЕЗИМ|ФЕСТАЛ|ПАНКРЕАТИН|СМЕКТА/i },
    { category: 'pain', regex: /ПАРАЦЕТАМОЛ|ИБУПРОФЕН|НУРОФЕН|ДИКЛОФЕНАК|КЕТОНАЛ|АНАЛЬГИН|БАРАЛГИН/i },
];

function autoCategory(name) {
    const upper = (name || '').toUpperCase();
    for (const rule of AUTO_CATEGORY_RULES) {
        if (rule.regex.test(upper)) return rule.category;
    }
    return 'other';
}

module.exports = {
    CATEGORIES,
    CATEGORY_KEYS,
    ORDER_STATUSES,
    STATUS_TRANSITIONS,
    PAYMENT_METHODS,
    PAYMENT_STATUSES,
    BONUS_TIERS,
    BRANCHES_SEED,
    BUSINESS,
    AUTO_CATEGORY_RULES,
    autoCategory,
};
