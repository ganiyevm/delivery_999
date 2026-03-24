/**
 * addProductImages.js
 * Barcha mahsulotlarga rasm URL larini qo'shadi.
 * Ishlash: cd backend && node scripts/addProductImages.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../src/models/Product');

// ──────────────────────────────────────────────
// RASM URL HARITASI (kalit so'z → URL)
// Agar mahsulot nomida kalit so'z bo'lsa — rasm qo'yiladi.
// Katta-kichik harf farqi yo'q. Birinchi mos kelgan ishlatiladi.
// ──────────────────────────────────────────────
const IMAGE_MAP = [
    // ── OG'RIQ QOLDIRUVCHILAR ──
    { keys: ['ПАРАЦЕТАМОЛ', 'PARACETAMOL'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Paracetamol_pills.jpg/320px-Paracetamol_pills.jpg' },
    { keys: ['АНАЛЬГИН', 'ANALGIN', 'МЕТАМИЗОЛ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Analgin.jpg/320px-Analgin.jpg' },
    { keys: ['ИБУПРОФЕН', 'IBUPROFEN', 'НУРОФЕН', 'NUROFEN'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Ibuprofen_200mg.jpg/320px-Ibuprofen_200mg.jpg' },
    { keys: ['ДИКЛОФЕНАК', 'DICLOFENAC'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Diclofenac_50mg_1.jpg/320px-Diclofenac_50mg_1.jpg' },
    { keys: ['КЕТОНАЛ', 'КЕТОПРОФЕН', 'KETOPROFEN'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Ketoprofen.jpg/320px-Ketoprofen.jpg' },
    { keys: ['АСПИРИН', 'ASPIRIN', 'АЦЕТИЛСАЛИЦИЛ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Aspirin_1.JPG/320px-Aspirin_1.JPG' },

    // ── ANTIBIOTIKLAR ──
    { keys: ['АЗИТРОМИЦИН', 'AZITHROMYCIN', 'СУМАМЕД', 'SUMAMED'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Zithromax_Z-pak.jpg/320px-Zithromax_Z-pak.jpg' },
    { keys: ['АУГМЕНТИН', 'AMOXICLAV', 'АМОКСИКЛАВ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Amoxicillin_capsules.jpg/320px-Amoxicillin_capsules.jpg' },
    { keys: ['АМОКСИЦИЛLIN', 'АМОКСИЦИЛЛИН', 'AMOXICILLIN'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Amoxicillin_capsules.jpg/320px-Amoxicillin_capsules.jpg' },
    { keys: ['МЕТРОНИДАЗОЛ', 'METRONIDAZOLE', 'ФЛАГИЛ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Metronidazol.jpg/320px-Metronidazol.jpg' },
    { keys: ['ЦЕФТРИАКСОН', 'CEFTRIAXONE'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Ceftriaxone_vial.jpg/320px-Ceftriaxone_vial.jpg' },
    { keys: ['ЦИПРОФЛОКСАЦИН', 'CIPROFLOXACIN', 'ЦИПРОЛЕТ', 'ЦИФРАН'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Ciprofloxacin_500mg_tablets.jpg/320px-Ciprofloxacin_500mg_tablets.jpg' },
    { keys: ['ДОКСИЦИКЛИН', 'DOXYCYCLINE'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Doxycycline_100mg_capsules.jpg/320px-Doxycycline_100mg_capsules.jpg' },

    // ── YURAK-QON TOMIRLARI ──
    { keys: ['НИФЕДИПИН', 'NIFEDIPINE', 'КОРДАФЕН', 'КОРИНФАР'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Nifedipine_tablets.jpg/320px-Nifedipine_tablets.jpg' },
    { keys: ['ЭНАЛАПРИЛ', 'ENALAPRIL', 'ЭНАП', 'ЭНАМ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Enalapril_10mg.jpg/320px-Enalapril_10mg.jpg' },
    { keys: ['АМЛОДИПИН', 'AMLODIPINE', 'АМЛОВАС', 'НОРВАСК'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amlodipine_5mg_tab.jpg/320px-Amlodipine_5mg_tab.jpg' },
    { keys: ['МЕТОПРОЛОЛ', 'METOPROLOL', 'БЕТАЛОК', 'ЭГИЛОК'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Metoprolol_Tartrat_50mg.jpg/320px-Metoprolol_Tartrat_50mg.jpg' },
    { keys: ['КАПТОПРИЛ', 'CAPTOPRIL', 'КАПОТЕН'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Captopril_25mg.jpg/320px-Captopril_25mg.jpg' },
    { keys: ['АТЕНОЛОЛ', 'ATENOLOL'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Atenolol_50mg_tablet.jpg/320px-Atenolol_50mg_tablet.jpg' },
    { keys: ['ЛОЗАРТАН', 'LOSARTAN'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Losartan_potassium_100mg.jpg/320px-Losartan_potassium_100mg.jpg' },
    { keys: ['БИСОПРОЛОЛ', 'BISOPROLOL', 'КОНКОР'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Bisoprolol_5mg.jpg/320px-Bisoprolol_5mg.jpg' },

    // ── ME'DA-ICHAK ──
    { keys: ['ОМЕПРАЗОЛ', 'OMEPRAZOLE', 'ОМЕЗ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Omeprazole_20mg.jpg/320px-Omeprazole_20mg.jpg' },
    { keys: ['НО-ШПА', 'НО ШПА', 'ДРОТАВЕРИН', 'DROTAVERINE'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/No-spa_tablets.jpg/320px-No-spa_tablets.jpg' },
    { keys: ['МЕЗИМ', 'ПАНКРЕАТИН', 'ПАНЗИНОРМ', 'CREОН', 'CREON'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Pancreatin_tablets.jpg/320px-Pancreatin_tablets.jpg' },
    { keys: ['ФОСФАЛЮГEL', 'ФОСФАЛЮГЕЛЬ', 'АЛЬМАГEL', 'АЛЬМАГЕЛЬ', 'ГЕВИСКОН'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Antacid_suspension.jpg/320px-Antacid_suspension.jpg' },
    { keys: ['ЛОПЕРАМИД', 'LOPERAMIDE', 'ИМОДИУМ', 'IMODIUM'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Loperamide_2mg.jpg/320px-Loperamide_2mg.jpg' },
    { keys: ['СМЕКТА', 'SMECTA', 'ДИОСМЕКТIT', 'ДИОСМЕКТИТ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Smecta_sachet.jpg/320px-Smecta_sachet.jpg' },
    { keys: ['МЕТОКЛОПРАМИД', 'METOCLOPRAMIDE', 'ЦЕРУКАЛ', 'CERUCAL'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Metoclopramide_10mg.jpg/320px-Metoclopramide_10mg.jpg' },
    { keys: ['ЛАКТОФИЛЬТРУМ', 'АКТИВИРОВАННЫЙ УГОЛЬ', 'ПОЛИСОРБ', 'ЭНТЕРОС'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Activated_charcoal.jpg/320px-Activated_charcoal.jpg' },

    // ── VITAMINLAR ──
    { keys: ['ВИТАМИН C', 'ВИТАМИН С', 'АСКОРБИН', 'VITAMIN C'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Vitamin_C_tablets.jpg/320px-Vitamin_C_tablets.jpg' },
    { keys: ['ВИТАМИН D', 'VITAMIN D', 'АКВАДЕТРИМ', 'ВИГАНТОЛ', 'ХОЛЕКАЛЬЦИФЕР'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Vitamin_D3_softgels.jpg/320px-Vitamin_D3_softgels.jpg' },
    { keys: ['ВИТАМИН B', 'VITAMIN B', 'НЕЙРОВИТАН', 'НЕЙРОМУЛЬТИВИТ', 'МИЛЬГАММА'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Vitamin_B_tablets.jpg/320px-Vitamin_B_tablets.jpg' },
    { keys: ['ФОЛИЕВАЯ КИСЛОТА', 'ФОЛИЕВОЙ', 'FOLIC ACID', 'ФОЛАТ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Folic_acid_tablets.jpg/320px-Folic_acid_tablets.jpg' },
    { keys: ['МАГНИЙ', 'MAGNESIUM', 'МАГНЕ B6', 'МАГНЕЛИС'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Magnesium_tablets.jpg/320px-Magnesium_tablets.jpg' },
    { keys: ['КАЛЬЦИЙ', 'CALCIUM', 'КАЛЬЦЕМИН', 'КАЛЬЦИЙ Д3'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Calcium_tablets.jpg/320px-Calcium_tablets.jpg' },
    { keys: ['ЖЕЛЕЗО', 'FERRUM', 'ФЕРРО', 'МАЛЬТОФЕР', 'ТОТЕМА'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Iron_supplements.jpg/320px-Iron_supplements.jpg' },
    { keys: ['ЦИНК', 'ZINC', 'ZINKIT'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Zinc_tablets.jpg/320px-Zinc_tablets.jpg' },
    { keys: ['ОМЕГА', 'OMEGA', 'РЫБИЙ ЖИР', 'FISH OIL'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Fish_oil_capsules.jpg/320px-Fish_oil_capsules.jpg' },
    { keys: ['МУЛЬТИВИТАМИН', 'SUPRADYN', 'СУПРАДИН', 'ALPHABET', 'АЛФАВИТ', 'CENTRUM', 'ЦЕНТРУМ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Multivitamin_tablets.jpg/320px-Multivitamin_tablets.jpg' },
    { keys: ['CHILD LIFE', 'ДЕТСКИЕ ВИТАМИН'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Childrens_vitamins.jpg/320px-Childrens_vitamins.jpg' },

    // ── BOLALAR UCHUN ──
    { keys: ['НУРОФЕН ДЛЯ ДЕТЕЙ', 'ИБУПРОФЕН ДЕТСКИЙ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Nurofen_for_children.jpg/320px-Nurofen_for_children.jpg' },
    { keys: ['ДЕТСКИЙ', 'ДЕТСКАЯ', 'ДЕТСКОЕ', 'ДЛЯ ДЕТЕЙ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Childrens_medicine.jpg/320px-Childrens_medicine.jpg' },

    // ── ALLERGIA ──
    { keys: ['ЛОРАТАДИН', 'LORATADINE', 'КЛАРИТИН', 'CLARITINE', 'ЛОРАНО'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Loratadine_10mg.jpg/320px-Loratadine_10mg.jpg' },
    { keys: ['ЦЕТИРИЗИН', 'CETIRIZINE', 'ЗИРТЕК', 'ZYRTEC', 'ЦЕТРИН'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Cetirizine_10mg.jpg/320px-Cetirizine_10mg.jpg' },
    { keys: ['СУПРАСТИН', 'CHLOROPYRAMINE', 'ХЛОРОПИРАМИН'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Suprastin_tablets.jpg/320px-Suprastin_tablets.jpg' },

    // ── DIABET ──
    { keys: ['МЕТФОРМИН', 'METFORMIN', 'СИОФОР', 'ГЛЮКОФАЖ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Metformin_500mg.jpg/320px-Metformin_500mg.jpg' },
    { keys: ['ИНСУЛИН', 'INSULIN', 'ХУМАЛОГ', 'ЛАНТУС'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Insulin_vials.jpg/320px-Insulin_vials.jpg' },
    { keys: ['ГЛЮКОМЕТР', 'GLUCOMETER', 'ACCU-CHEK', 'АККУ-ЧЕК'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Glucometer_with_test_strips.jpg/320px-Glucometer_with_test_strips.jpg' },

    // ── QO'ZG'ALMAS KASALLIKLAR ──
    { keys: ['ФЛУКОНАЗОЛ', 'FLUCONAZOLE', 'ФЛЮКОСТАТ', 'ДИФЛЮКАН', 'МИКОСИСТ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Fluconazole_150mg.jpg/320px-Fluconazole_150mg.jpg' },
    { keys: ['АЦИКЛОВИР', 'ACICLOVIR', 'ЗОВИРАКС', 'ZOVIRAX'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Aciclovir_200mg.jpg/320px-Aciclovir_200mg.jpg' },

    // ── YUQORI NAFAS YO'LLARI ──
    { keys: ['СТРЕПСИЛС', 'STREPSILS', 'ФАЛИМИНТ', 'СЕПТЕФРИЛ', 'ХЛОРОФИЛЛИПТ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Throat_lozenges.jpg/320px-Throat_lozenges.jpg' },
    { keys: ['ГЕКСОРАЛ', 'HEXORAL', 'ТАНТУМ ВЕРДЕ', 'TANTUM VERDE'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Throat_spray.jpg/320px-Throat_spray.jpg' },
    { keys: ['АМБРОКСОЛ', 'AMBROXOL', 'ЛАЗОЛВАН', 'LAZOLVAN', 'ФЛАВАМЕД'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Ambroxol_syrup.jpg/320px-Ambroxol_syrup.jpg' },
    { keys: ['АЦЦ', 'ACC', 'АЦЕТИЛЦИСТЕИН', 'ACETYLCYSTEINE', 'ФЛУИМУЦИЛ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Acetylcysteine_effervescent.jpg/320px-Acetylcysteine_effervescent.jpg' },
    { keys: ['НАЗИВИН', 'НАФТИЗИН', 'ОТРИВИН', 'КСИМЕЛИН', 'ТИЗИН'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Nasal_drops.jpg/320px-Nasal_drops.jpg' },

    // ── KO'Z TOMCHILAR ──
    { keys: ['ГЛАЗНЫЕ КАПЛИ', 'ОФТАЛЬМИК', 'ВИЗИН', 'VISINE', 'СИСТЕЙН', 'ТОБРЕКС', 'ЦИПРОМЕД'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Eye_drops.jpg/320px-Eye_drops.jpg' },

    // ── QULOQ ──
    { keys: ['УШНЫЕ КАПЛИ', 'ОТИПАКС', 'ОТИНУМ', 'ГАРАСОН'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Ear_drops.jpg/320px-Ear_drops.jpg' },

    // ── KOSMETIKA ──
    { keys: ['КРЕМ', 'CREAM', 'МАЗЬ', 'OINTMENT', 'GEL', 'ГЕЛЬ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Cream_tube.jpg/320px-Cream_tube.jpg' },
    { keys: ['ШАМПУНЬ', 'SHAMPOO', 'SHAMPO'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Shampoo_bottle.jpg/320px-Shampoo_bottle.jpg' },
    { keys: ['МЫЛО', 'SOAP', 'ЖИДКОЕ МЫЛО'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Liquid_soap.jpg/320px-Liquid_soap.jpg' },
    { keys: ['ДЕЗОДОРАНТ', 'DEODORANT'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Deodorant_spray.jpg/320px-Deodorant_spray.jpg' },

    // ── QURILMALAR ──
    { keys: ['ШПРИЦ', 'SYRINGE', 'ШПРИЦЫ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Disposable_syringe.jpg/320px-Disposable_syringe.jpg' },
    { keys: ['ТОНОМЕТР', 'TONOMETER', 'ДАВЛЕНИЕ', 'BLOOD PRESSURE'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Blood_pressure_monitor.jpg/320px-Blood_pressure_monitor.jpg' },
    { keys: ['ТЕРМОМЕТР', 'THERMOMETER'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Medical_thermometer.jpg/320px-Medical_thermometer.jpg' },
    { keys: ['МАСКА', 'MASK', 'РЕСПИРАТОР'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Medical_mask.jpg/320px-Medical_mask.jpg' },
    { keys: ['ПЕРЧАТКИ', 'GLOVES'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Medical_gloves.jpg/320px-Medical_gloves.jpg' },
    { keys: ['БИНТ', 'BANDAGE', 'ПОВЯЗКА'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Medical_bandage.jpg/320px-Medical_bandage.jpg' },
    { keys: ['ВАТНЫЙ', 'ВАТА', 'ВАТНЫЕ ДИСКИ', 'COTTON'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Cotton_pads.jpg/320px-Cotton_pads.jpg' },
    { keys: ['ПЛАСТЫРЬ', 'PLASTER', 'ЛЕЙКОПЛАСТЫРЬ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Bandaid_plasters.jpg/320px-Bandaid_plasters.jpg' },
    { keys: ['НЕБУЛАЙЗЕР', 'NEBULIZER', 'ИНГАЛЯТОР'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nebuliser_with_mask.jpg/320px-Nebuliser_with_mask.jpg' },

    // ── MAHSUS DORULAR ──
    { keys: ['НО-ШПА', 'НО ШПА'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/No-spa_tablets.jpg/320px-No-spa_tablets.jpg' },
    { keys: ['ВАЛЕРЬЯНА', 'VALERIAN', 'ПУСТЫРНИК'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Valerian_tablets.jpg/320px-Valerian_tablets.jpg' },
    { keys: ['ЛИНЕКС', 'LINEX', 'БИФИДУМБАКТЕРИН', 'ЛАКТОБАКТЕРИН', 'ПРОБИОТИК', 'ХИЛАК'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Probiotic_capsules.jpg/320px-Probiotic_capsules.jpg' },
    { keys: ['ДИАБЕТОН', 'GLIBENCLAMIDE', 'ГЛИБЕНКЛАМИД', 'МАНИНИЛ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Glibenclamide_tablets.jpg/320px-Glibenclamide_tablets.jpg' },
    { keys: ['ПРЕДУКТАЛ', 'ТРИМЕТАЗИДИН', 'TRIMETAZIDINE'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Heart_medication_tablets.jpg/320px-Heart_medication_tablets.jpg' },
    { keys: ['КОНКОР', 'БИСОПРОЛОЛ', 'BISOPROLOL'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Bisoprolol_5mg.jpg/320px-Bisoprolol_5mg.jpg' },
    { keys: ['ЦИПРОЛЕТ', 'CIPROLET', 'ЦИФРАН'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Ciprofloxacin_500mg_tablets.jpg/320px-Ciprofloxacin_500mg_tablets.jpg' },
    { keys: ['СЕНАДЕ', 'СЕННА', 'СЛАБИТЕЛЬН'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Senna_tablets.jpg/320px-Senna_tablets.jpg' },
    { keys: ['ГЛИЦЕРИН', 'GLYCERIN', 'ГЛИЦЕРИНОВЫЕ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Glycerin_suppositories.jpg/320px-Glycerin_suppositories.jpg' },
    { keys: ['ЛЕВОМИЦЕТИН', 'CHLORAMPHENICOL', 'ХЛОРАМФЕНИКОЛ'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Chloramphenicol_eye_drops.jpg/320px-Chloramphenicol_eye_drops.jpg' },
    { keys: ['ДЕКСАМЕТАЗОН', 'DEXAMETHASONE', 'ПРЕДНИЗОЛОН', 'PREDNISOLONE'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Dexamethasone_tablets.jpg/320px-Dexamethasone_tablets.jpg' },
    { keys: ['РАСТВОР ДЛЯ ЛИНЗ', 'ЛИНЗЫ', 'AVIZOR'], url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Contact_lens_solution.jpg/320px-Contact_lens_solution.jpg' },
];

// ──────────────────────────────────────────────
// KATEGORIYA UCHUN ZAXIRA RASMLAR
// Agar nom bo'yicha mos kelmasa, kategoriya rasmidan foydalaniladi
// ──────────────────────────────────────────────
const CATEGORY_FALLBACK = {
    pain:        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Assorted_blister_packs.jpg/320px-Assorted_blister_packs.jpg',
    antibiotics: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Amoxicillin_capsules.jpg/320px-Amoxicillin_capsules.jpg',
    vitamins:    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Multivitamin_tablets.jpg/320px-Multivitamin_tablets.jpg',
    heart:       'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Heart_medication_tablets.jpg/320px-Heart_medication_tablets.jpg',
    stomach:     'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Omeprazole_20mg.jpg/320px-Omeprazole_20mg.jpg',
    children:    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Childrens_medicine.jpg/320px-Childrens_medicine.jpg',
    cosmetics:   'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Cream_tube.jpg/320px-Cream_tube.jpg',
    devices:     'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Disposable_syringe.jpg/320px-Disposable_syringe.jpg',
    other:       null, // "other" uchun zaxira yo'q — nomga mos kelmasa o'tkazib yuboramiz
};

function findImageUrl(name, category) {
    const upper = name.toUpperCase();
    for (const entry of IMAGE_MAP) {
        for (const key of entry.keys) {
            if (upper.includes(key.toUpperCase())) {
                return entry.url;
            }
        }
    }
    return CATEGORY_FALLBACK[category] || null;
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB ulandi\n');

    const products = await Product.find({}, 'name category imageUrl').lean();
    console.log(`📦 Jami mahsulotlar: ${products.length}\n`);

    let updated = 0;
    let skipped = 0;
    let noMatch = 0;

    for (const p of products) {
        // Allaqachon rasmi bor → o'tkazib yuboramiz
        if (p.imageUrl) { skipped++; continue; }

        const url = findImageUrl(p.name, p.category);
        if (!url) { noMatch++; continue; }

        await Product.updateOne({ _id: p._id }, { imageUrl: url });
        updated++;
        console.log(`✅ [${p.category}] ${p.name.substring(0, 60)}`);
    }

    console.log('\n─────────────────────────────────────');
    console.log(`✅ Rasm qo'yildi:     ${updated}`);
    console.log(`⏩ Allaqachon bor:    ${skipped}`);
    console.log(`❌ Mos kelmadi:       ${noMatch}`);
    console.log('─────────────────────────────────────');

    await mongoose.disconnect();
    console.log('\n✅ Tugadi!');
}

main().catch(err => {
    console.error('Xato:', err.message);
    process.exit(1);
});
