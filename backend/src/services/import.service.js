const XLSX = require('xlsx');
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
const ImportLog = require('../models/ImportLog');
const { autoCategory } = require('../config/constants');

class ImportService {
    /**
     * Excel fayldan dori va stock import qilish
     * Ustunlar: A: Filial | B: Naименование | C: Производитель | D: Цена | E: Кол-во
     */
    static async importExcel(filePath, importedBy = 0) {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // 1-qator header, o'tkazib yuborish
        const dataRows = rows.slice(1).filter(r => r && r.length >= 2);

        const errors = [];
        let successCount = 0;

        // Barcha filiallarni cache qilish
        const allBranches = await Branch.find().lean();
        const branchCache = {};
        allBranches.forEach(b => {
            branchCache[b.name.toLowerCase()] = b;
            branchCache[`аптека №${String(b.number).padStart(3, '0')}`] = b;
            branchCache[`аптека ${b.number}`] = b;
            branchCache[`№${String(b.number).padStart(3, '0')}`] = b;
            branchCache[`${b.number}`] = b;
        });

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowNum = i + 2; // Excel qator raqami

            try {
                const branchName = String(row[0] || '').trim();
                const productName = String(row[1] || '').trim();
                const manufacturer = String(row[2] || '').trim();
                const price = parseFloat(row[3]) || 0;
                const qty = parseInt(row[4]) || 0;

                if (!productName) {
                    errors.push({ row: rowNum, message: 'Nomi bo\'sh' });
                    continue;
                }

                // Filial topish (fuzzy)
                let branch = ImportService.findBranch(branchName, branchCache);
                if (!branch) {
                    // Filial avtomatik yaratish
                    let branchNumber = null;
                    const lower = branchName.toLowerCase().trim();

                    // "Аптека №001" pattern
                    const aptMatch = branchName.match(/[аА]птека\s*№?\s*(\d+)/i);
                    if (aptMatch) {
                        branchNumber = parseInt(aptMatch[1]);
                    }
                    // "Склад2", "Склад 3" — ombor (1000+ offset)
                    else if (/склад/i.test(branchName)) {
                        const skladNum = branchName.match(/(\d+)/);
                        branchNumber = 1000 + (skladNum ? parseInt(skladNum[1]) : 0);
                    }
                    // "ОФИС", "АПТЕКА ОФИС" — ofis
                    else if (/офис/i.test(branchName)) {
                        branchNumber = 0;
                    }
                    // Boshqa — raqam izlash
                    else {
                        const numMatch = branchName.match(/(\d+)/);
                        branchNumber = numMatch ? parseInt(numMatch[1]) + 2000 : null;
                    }

                    if (branchNumber === null) {
                        errors.push({ row: rowNum, message: `"${branchName}" filial topilmadi` });
                        continue;
                    }

                    // Bazadan raqam bo'yicha tekshirish
                    let existingBranch = await Branch.findOne({ number: branchNumber });
                    if (!existingBranch) {
                        existingBranch = await Branch.create({
                            number: branchNumber,
                            name: branchName,
                        });
                    }

                    // Cache ga qo'shish
                    branch = existingBranch.toObject ? existingBranch.toObject() : existingBranch;
                    branchCache[branch.name.toLowerCase()] = branch;
                    branchCache[`аптека №${String(branch.number).padStart(3, '0')}`] = branch;
                    branchCache[`аптека ${branch.number}`] = branch;
                    branchCache[`№${String(branch.number).padStart(3, '0')}`] = branch;
                    branchCache[`${branch.number}`] = branch;
                }

                if (price <= 0) {
                    errors.push({ row: rowNum, message: 'Narx noto\'g\'ri' });
                    continue;
                }

                // Product upsert
                let product = await Product.findOne({
                    name: { $regex: new RegExp(`^${productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                });

                if (!product) {
                    product = new Product({
                        name: productName,
                        manufacturer,
                        category: autoCategory(productName),
                    });
                    await product.save();
                } else if (manufacturer && !product.manufacturer) {
                    product.manufacturer = manufacturer;
                    await product.save();
                }

                // Stock upsert
                await Stock.findOneAndUpdate(
                    { product: product._id, branch: branch._id },
                    { price, qty, updatedAt: new Date() },
                    { upsert: true, new: true }
                );

                successCount++;
            } catch (err) {
                errors.push({ row: rowNum, message: err.message });
            }
        }

        // Import log yozish
        const log = await ImportLog.create({
            filename: filePath.split('/').pop(),
            importedBy,
            totalRows: dataRows.length,
            successRows: successCount,
            errorRows: errors.length,
            errors: errors.slice(0, 100), // Max 100 ta xato saqlash
            importDate: new Date(),
        });

        return {
            totalRows: dataRows.length,
            successRows: successCount,
            errorRows: errors.length,
            errors,
            logId: log._id,
        };
    }

    // Filial nomi bo'yicha fuzzy search
    static findBranch(name, cache) {
        if (!name) return null;
        const lower = name.toLowerCase().trim();

        // To'g'ridan-to'g'ri
        if (cache[lower]) return cache[lower];

        // Raqam bo'yicha
        const numMatch = lower.match(/(\d+)/);
        if (numMatch) {
            const num = numMatch[1];
            if (cache[num]) return cache[num];
        }

        // Partial match
        for (const [key, branch] of Object.entries(cache)) {
            if (key.includes(lower) || lower.includes(key)) {
                return branch;
            }
        }

        return null;
    }
}

module.exports = ImportService;
