#!/usr/bin/env node

/**
 * Database-dagi dorilarni konsolga chiqarish script
 * Ko'rish uchun: node view-medicines.js
 */

require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('./models/product.model')

const main = async () => {
	try {
		// MongoDB-ga ulanish
		console.log('\n📊 MongoDB-ga ulanish...')
		await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/click')
		console.log('✅ MongoDB-ga ulandi\n')

		// Jami dorilar soni
		const totalCount = await Product.countDocuments()
		console.log(`📈 Jami dorilar soni: ${totalCount}\n`)

		// Birinchi 20 ta dori
		console.log('=' .repeat(120))
		console.log('📋 BIRINCHI 20 TA DORI'.padEnd(120))
		console.log('=' .repeat(120))

		const medicines = await Product.find({}).limit(20).sort({ createdAt: -1 })

		medicines.forEach((med, index) => {
			console.log(`\n${index + 1}. ${med.title}`)
			console.log(`   🏭 Ishlab chiqaruvchi: ${med.manufacturer}`)
			console.log(`   💰 Narx: ${med.price.toLocaleString('uz-UZ')} so'm`)
			console.log(`   📦 Miqdor: ${med.quantity} ta`)
			console.log(`   🏢 Filial: ${med.branch}`)
			console.log(`   📝 Kategoriya: ${med.category}`)
			console.log(`   ✅ Sotiladimi: ${med.inStock ? 'Ha' : 'Yo\'q'}`)
		})

		// Narxi bo'yicha statistika
		console.log('\n' + '='.repeat(120))
		console.log('💰 NARXI BO\'YICHA STATISTIKA'.padEnd(120))
		console.log('='.repeat(120))

		const priceStats = await Product.aggregate([
			{
				$group: {
					_id: null,
					minPrice: { $min: '$price' },
					maxPrice: { $max: '$price' },
					avgPrice: { $avg: '$price' },
					totalValue: { $sum: { $multiply: ['$price', '$quantity'] } },
				},
			},
		])

		if (priceStats.length > 0) {
			const stats = priceStats[0]
			console.log(`\n  Eng arzon narx: ${stats.minPrice.toLocaleString('uz-UZ')} so'm`)
			console.log(`  Eng qimmat narx: ${stats.maxPrice.toLocaleString('uz-UZ')} so'm`)
			console.log(`  O'rtacha narx: ${Math.round(stats.avgPrice).toLocaleString('uz-UZ')} so'm`)
			console.log(`  Ombordagi jami qiymat: ${Math.round(stats.totalValue).toLocaleString('uz-UZ')} so'm`)
		}

		// Miqdor bo'yicha statistika
		console.log('\n' + '='.repeat(120))
		console.log('📦 MIQDORİ BO\'YICHA STATISTIKA'.padEnd(120))
		console.log('='.repeat(120))

		const quantityStats = await Product.aggregate([
			{
				$group: {
					_id: null,
					minQty: { $min: '$quantity' },
					maxQty: { $max: '$quantity' },
					avgQty: { $avg: '$quantity' },
					totalQty: { $sum: '$quantity' },
				},
			},
		])

		if (quantityStats.length > 0) {
			const qStats = quantityStats[0]
			console.log(`\n  Eng kam miqdor: ${qStats.minQty} ta`)
			console.log(`  Eng ko'p miqdor: ${qStats.maxQty} ta`)
			console.log(`  O'rtacha miqdor: ${Math.round(qStats.avgQty)} ta`)
			console.log(`  Jami miqdor: ${Math.round(qStats.totalQty)} ta`)
		}

		// Ishlab chiqaruvchilar
		console.log('\n' + '='.repeat(120))
		console.log('🏭 TOP 15 ISHLAB CHIQARUVCHI'.padEnd(120))
		console.log('='.repeat(120))

		const manufacturers = await Product.aggregate([
			{
				$group: {
					_id: '$manufacturer',
					count: { $sum: 1 },
					totalQty: { $sum: '$quantity' },
					avgPrice: { $avg: '$price' },
				},
			},
			{ $sort: { count: -1 } },
			{ $limit: 15 },
		])

		manufacturers.forEach((mfg, index) => {
			console.log(
				`\n${index + 1}. ${mfg._id || 'No manufacturer'}`
					.padEnd(60)
					.concat(
						`| Dori: ${mfg.count} ta | Miqdor: ${mfg.totalQty} ta | Avg: ${Math.round(mfg.avgPrice)} so'm`
					)
			)
		})

		// Kategoriyalar
		console.log('\n' + '='.repeat(120))
		console.log('📚 KATEGORIYALAR'.padEnd(120))
		console.log('='.repeat(120))

		const categories = await Product.aggregate([
			{
				$group: {
					_id: '$category',
					count: { $sum: 1 },
					totalQty: { $sum: '$quantity' },
					minPrice: { $min: '$price' },
					maxPrice: { $max: '$price' },
				},
			},
			{ $sort: { count: -1 } },
		])

		categories.forEach((cat, index) => {
			console.log(
				`\n${index + 1}. ${cat._id}`.padEnd(60) +
					`| Dori: ${cat.count} ta | Miqdor: ${cat.totalQty} ta | Narx: ${cat.minPrice}-${cat.maxPrice}`
			)
		})

		// Eng arzon dorilar
		console.log('\n' + '='.repeat(120))
		console.log('💚 ENG ARZON 10 DORI'.padEnd(120))
		console.log('='.repeat(120))

		const cheapest = await Product.find({}).sort({ price: 1 }).limit(10)

		cheapest.forEach((med, index) => {
			console.log(`\n${index + 1}. ${med.title}`)
			console.log(`   💰 Narx: ${med.price.toLocaleString('uz-UZ')} so'm`)
			console.log(`   📦 Miqdor: ${med.quantity} ta`)
			console.log(`   🏭 ${med.manufacturer}`)
		})

		// Eng qimmat dorilar
		console.log('\n' + '='.repeat(120))
		console.log('👑 ENG QIMMAT 10 DORI'.padEnd(120))
		console.log('='.repeat(120))

		const expensive = await Product.find({}).sort({ price: -1 }).limit(10)

		expensive.forEach((med, index) => {
			console.log(`\n${index + 1}. ${med.title}`)
			console.log(`   💰 Narx: ${med.price.toLocaleString('uz-UZ')} so'm`)
			console.log(`   📦 Miqdor: ${med.quantity} ta`)
			console.log(`   🏭 ${med.manufacturer}`)
		})

		// Eng ko'p miqdorda dorilar
		console.log('\n' + '='.repeat(120))
		console.log('📦 ENG KO\'P MIQDORDA 10 DORI'.padEnd(120))
		console.log('='.repeat(120))

		const mostStock = await Product.find({}).sort({ quantity: -1 }).limit(10)

		mostStock.forEach((med, index) => {
			console.log(`\n${index + 1}. ${med.title}`)
			console.log(`   📦 Miqdor: ${med.quantity} ta`)
			console.log(`   💰 Narx: ${med.price.toLocaleString('uz-UZ')} so'm`)
			console.log(`   🏭 ${med.manufacturer}`)
		})

		// Eng kam miqdorda dorilar
		console.log('\n' + '='.repeat(120))
		console.log('⚠️  ENG KAM MIQDORDA 10 DORI (Qayta sotib olish kerak)'.padEnd(120))
		console.log('='.repeat(120))

		const leastStock = await Product.find({ inStock: true }).sort({ quantity: 1 }).limit(10)

		leastStock.forEach((med, index) => {
			console.log(`\n${index + 1}. ${med.title}`)
			console.log(`   📦 Miqdor: ${med.quantity} ta ⚠️`)
			console.log(`   💰 Narx: ${med.price.toLocaleString('uz-UZ')} so'm`)
			console.log(`   🏭 ${med.manufacturer}`)
		})

		// Sotuv qiymati bo'yicha top dorilar
		console.log('\n' + '='.repeat(120))
		console.log('💎 ENG KO\'P SOTUV QIYMATI 10 DORI (Narx × Miqdor)'.padEnd(120))
		console.log('='.repeat(120))

		const topValue = await Product.aggregate([
			{
				$addFields: {
					value: { $multiply: ['$price', '$quantity'] },
				},
			},
			{ $sort: { value: -1 } },
			{ $limit: 10 },
		])

		topValue.forEach((med, index) => {
			console.log(`\n${index + 1}. ${med.title}`)
			console.log(
				`   💎 Sotuv qiymati: ${Math.round(med.value).toLocaleString('uz-UZ')} so'm (${med.price} × ${med.quantity})`
			)
			console.log(`   🏭 ${med.manufacturer}`)
		})

		console.log('\n' + '='.repeat(120))
		console.log('✅ MALUMOTLAR KONSOLGA CHIQARILDI')
		console.log('='.repeat(120) + '\n')

		process.exit(0)
	} catch (error) {
		console.error('❌ Xato:', error.message)
		process.exit(1)
	}
}

main()
