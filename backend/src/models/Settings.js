const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    key:   { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);

// Default delivery settings
const DEFAULT_DELIVERY = {
    baseKm:        3,        // Asosiy masofa (km) — shu km gacha baza narx
    basePrice:     15000,    // Asosiy narx (so'm)
    pricePerKm:    1500,     // Qo'shimcha har 1 km uchun (so'm)
    maxDeliveryKm: 30,       // Maksimal yetkazish masofasi (km)
    freeThreshold: 150000,   // Shu summadan yuqori bo'lsa yetkazish bepul (0 = yo'q)
    enabled:       true,
};

async function getDeliverySettings() {
    const doc = await Settings.findOne({ key: 'delivery' }).lean();
    return doc ? { ...DEFAULT_DELIVERY, ...doc.value } : DEFAULT_DELIVERY;
}

async function setDeliverySettings(value) {
    return Settings.findOneAndUpdate(
        { key: 'delivery' },
        { $set: { value } },
        { upsert: true, new: true }
    );
}

module.exports = { Settings, getDeliverySettings, setDeliverySettings, DEFAULT_DELIVERY };
