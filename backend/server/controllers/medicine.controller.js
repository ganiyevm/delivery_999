const Product = require('../models/product.model')
const { readAndTransformExcel } = require('../services/excel.service')

/**
 * Excel fayldan dorilarni import qilish
 * POST /api/user/import-medicines
 */
exports.importMedicinesFromExcel = async (req, res, next) => {
	try {
		const { filePath } = req.body

		if (!filePath) {
			return res.status(400).json({
				error: 'MISSING_FILE_PATH',
				error_note: 'Excel fayl yo\'li kiritilishi kere',
			})
		}

		console.log(`📂 Excel faylni import qilish: ${filePath}`)

		// Excel-dan dorilarni o'qish va transformatsiya qilish
		const medicines = readAndTransformExcel(filePath)

		if (medicines.length === 0) {
			return res.status(400).json({
				error: 'NO_MEDICINES',
				error_note: 'Excel faylda dori topilmadi',
			})
		}

		// Duplicate tekshiruvi - bir xil nomli dorilar
		const existingTitles = await Product.find({
			title: { $in: medicines.map(m => m.title) },
		}).select('title')

		const existingTitleSet = new Set(existingTitles.map(p => p.title))
		const newMedicines = medicines.filter(m => !existingTitleSet.has(m.title))
		const duplicates = medicines.filter(m => existingTitleSet.has(m.title))

		console.log(`✅ Yangi dorilar: ${newMedicines.length}`)
		console.log(`⚠️ Duplikatlar: ${duplicates.length}`)

		// Database-ga yangi dorilarni qo'shish
		let inserted = []
		if (newMedicines.length > 0) {
			inserted = await Product.insertMany(newMedicines)
			console.log(`✅ ${inserted.length} ta dori database-ga qo'shildi`)
		}

		// Response
		res.json({
			success: true,
			totalRead: medicines.length,
			newInserted: inserted.length,
			duplicates: duplicates.length,
			skipped: medicines.length - newMedicines.length,
			medicines: inserted.map(m => ({
				_id: m._id,
				title: m.title,
				activeIngredient: m.activeIngredient,
				dosage: m.dosage,
				quantity: m.quantity,
				price: m.price,
			})),
		})
	} catch (error) {
		console.error('❌ Import error:', error)
		next(error)
	}
}

/**
 * Barcha dorilarni olish
 * GET /api/user/medicines
 */
exports.getAllMedicines = async (req, res, next) => {
	try {
		const medicines = await Product.find({}).sort({ createdAt: -1 })

		res.json({
			medicines,
			total: medicines.length,
		})
	} catch (error) {
		console.error('❌ Get medicines error:', error)
		next(error)
	}
}

/**
 * Dorilarni qidiruv bo'yicha olish
 * GET /api/user/medicines/search?q=paracetamol
 */
exports.searchMedicines = async (req, res, next) => {
	try {
		const { q, category } = req.query

		let query = {}

		if (q) {
			query.$or = [
				{ title: { $regex: q, $options: 'i' } },
				{ activeIngredient: { $regex: q, $options: 'i' } },
				{ description: { $regex: q, $options: 'i' } },
			]
		}

		if (category) {
			query.category = category
		}

		const medicines = await Product.find(query).sort({ createdAt: -1 })

		res.json({
			medicines,
			total: medicines.length,
		})
	} catch (error) {
		console.error('❌ Search error:', error)
		next(error)
	}
}

/**
 * Dorilarni kategoriya bo'yicha olish
 * GET /api/user/medicines/category/:category
 */
exports.getMedicinesByCategory = async (req, res, next) => {
	try {
		const { category } = req.params

		const medicines = await Product.find({ category }).sort({ createdAt: -1 })

		res.json({
			medicines,
			total: medicines.length,
		})
	} catch (error) {
		console.error('❌ Category error:', error)
		next(error)
	}
}

/**
 * Dorilarni soniqlari bo'yicha update qilish (inventori)
 * PUT /api/user/medicines/:id
 */
exports.updateMedicine = async (req, res, next) => {
	try {
		const { id } = req.params
		const updates = req.body

		const medicine = await Product.findByIdAndUpdate(id, updates, {
			new: true,
			runValidators: true,
		})

		if (!medicine) {
			return res.status(404).json({
				error: 'NOT_FOUND',
				error_note: 'Dori topilmadi',
			})
		}

		res.json({
			medicine,
			success: true,
		})
	} catch (error) {
		console.error('❌ Update error:', error)
		next(error)
	}
}

/**
 * Dorilarni o'chirish
 * DELETE /api/user/medicines/:id
 */
exports.deleteMedicine = async (req, res, next) => {
	try {
		const { id } = req.params

		const medicine = await Product.findByIdAndDelete(id)

		if (!medicine) {
			return res.status(404).json({
				error: 'NOT_FOUND',
				error_note: 'Dori topilmadi',
			})
		}

		res.json({
			success: true,
			deletedId: id,
		})
	} catch (error) {
		console.error('❌ Delete error:', error)
		next(error)
	}
}
