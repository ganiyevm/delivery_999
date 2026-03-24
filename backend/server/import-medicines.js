#!/usr/bin/env node

/**
 * Excel fayldan dorilarni import qilish script
 * Usage: node import-medicines.js "/path/to/file.xlsx"
 */

require('dotenv').config()
const mongoose = require('mongoose')
const { readAndTransformExcel } = require('./services/excel.service')
const Product = require('./models/product.model')
const path = require('path')

const main = async () => {
	try {
		// MongoDB-ga ulanish
		console.log('📊 MongoDB-ga ulanish...')
		await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/click')
		console.log('✅ MongoDB-ga ulandi')

		// Fayl yo'li olish
		const filePath = process.argv[2]
		if (!filePath) {
			console.log('❌ Faylning yo\'li kerak: node import-medicines.js "/path/to/file.xlsx"')
			process.exit(1)
		}

		// Excel-dan dorilarni o'qish
		console.log(`\n📂 Faylni o'qish: ${filePath}`)
		const medicines = readAndTransformExcel(filePath)

		if (medicines.length === 0) {
			console.log('❌ Excel faylda dori topilmadi')
			process.exit(1)
		}

		// Duplicate tekshiruvi
		const existingTitles = await Product.find({
			title: { $in: medicines.map(m => m.title) },
		}).select('title')

		const existingTitleSet = new Set(existingTitles.map(p => p.title))
		const newMedicines = medicines.filter(m => !existingTitleSet.has(m.title))
		const duplicates = medicines.filter(m => existingTitleSet.has(m.title))

		console.log(`\n📊 Statistika:`)
		console.log(`  - Jami o'qilgan: ${medicines.length}`)
		console.log(`  - Yangi dorilar: ${newMedicines.length}`)
		console.log(`  - Duplikatlar: ${duplicates.length}`)

		// Duplikatlarni ko'rsatish
		if (duplicates.length > 0) {
			console.log(`\n⚠️ Duplikat dorilar (qo'shilmadi):`)
			duplicates.slice(0, 10).forEach(m => {
				console.log(`  • ${m.title} (${m.activeIngredient})`)
			})
			if (duplicates.length > 10) {
				console.log(`  ... va ${duplicates.length - 10} ta ko'p`)
			}
		}

		// Yangi dorilarni qo'shish
		if (newMedicines.length > 0) {
			console.log(`\n💾 Yangi dorilarni database-ga qo'shish...`)
			const inserted = await Product.insertMany(newMedicines)
			console.log(`✅ ${inserted.length} ta dori qo'shildi!`)

			// Birinchi 5 ta dorilarni ko'rsatish
			console.log(`\n✅ Birinchi ${Math.min(5, inserted.length)} ta dori:`)
			inserted.slice(0, 5).forEach(m => {
				console.log(`  • ${m.title}`)
				console.log(`    - Tarkib: ${m.activeIngredient}`)
				console.log(`    - Doza: ${m.dosage}`)
				console.log(`    - Miqdor: ${m.quantity}`)
				console.log(`    - Narx: ${m.price}`)
			})
		} else {
			console.log('\n⚠️ Qo\'shish uchun yangi dori yo\'q')
		}

		// Database statistika
		const totalMedicines = await Product.countDocuments()
		console.log(`\n📊 Database statistika:`)
		console.log(`  - Jami dorilar: ${totalMedicines}`)

		// Kategoriya statistika
		const categories = await Product.aggregate([
			{
				$group: {
					_id: '$category',
					count: { $sum: 1 },
				},
			},
			{ $sort: { count: -1 } },
		])

		console.log(`\n📚 Kategoriyalar:`)
		categories.forEach(cat => {
			console.log(`  • ${cat._id}: ${cat.count} ta dori`)
		})

		console.log('\n✅ Import yakunlandi!')
		process.exit(0)
	} catch (error) {
		console.error('❌ Xato:', error.message)
		process.exit(1)
	}
}

main()
