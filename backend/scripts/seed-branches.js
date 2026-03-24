/**
 * Seed missing branches from Excel file or hardcoded list
 * Usage: node scripts/seed-branches.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Branch = require('../src/models/Branch');

// 2026-02-18 holatidagi barcha filiallar ro'yxati
const ALL_BRANCHES = [
    { number: 0, name: 'АПТЕКА ОФИС' },
    { number: 1, name: 'Аптека №001 (Максим Горький)' },
    { number: 2, name: 'Аптека №002 (Юнус Абад)' },
    { number: 3, name: 'Аптека №003 (Чилонзар)' },
    { number: 4, name: 'Аптека №004 (Катартал)' },
    { number: 5, name: 'Аптека №005 (Гунча)' },
    { number: 6, name: 'Аптека №006 (Малика)' },
    { number: 7, name: 'Аптека №007 (Россия)' },
    { number: 8, name: 'Аптека №008 (Ганга)' },
    { number: 9, name: 'Аптека №009 (ТТЗ)' },
    { number: 10, name: 'Аптека №010 (Кардиология)' },
    { number: 11, name: 'Аптека №011 (Юнусабад ул.Мойкоргон)' },
    { number: 12, name: 'Аптека №012 (Ялангач)' },
    { number: 13, name: 'Аптека №013' },
    { number: 14, name: 'Аптека №014 (Беруний)' },
    { number: 15, name: 'Аптека №015 (Мегапланет)' },
    { number: 16, name: 'Аптека №016 (Ц-6)' },
    { number: 17, name: 'Аптека №017 (Аэропорт)' },
    { number: 18, name: 'Аптека №018 (Трюфель)' },
    { number: 19, name: 'Аптека №019 (Ц-1)' },
    { number: 20, name: 'Аптека №020 (Сайрам)' },
    { number: 1002, name: 'Склад2' },
];

async function seedBranches() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apteka999';
    console.log('Connecting to:', uri);
    await mongoose.connect(uri);
    console.log('Connected!\n');

    let created = 0;
    let skipped = 0;

    for (const b of ALL_BRANCHES) {
        const existing = await Branch.findOne({ number: b.number });
        if (existing) {
            console.log(`  ✓ №${String(b.number).padStart(3, '0')} ${b.name} — mavjud`);
            skipped++;
        } else {
            await Branch.create({
                number: b.number,
                name: b.name,
                isOpen: true,
                isActive: true,
            });
            console.log(`  + №${String(b.number).padStart(3, '0')} ${b.name} — YARATILDI`);
            created++;
        }
    }

    console.log(`\n✅ Tayyor! Yaratildi: ${created}, Mavjud edi: ${skipped}`);
    await mongoose.disconnect();
}

seedBranches().catch(err => {
    console.error('❌ Xatolik:', err.message);
    process.exit(1);
});
