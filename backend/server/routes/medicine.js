const express = require('express')
const {
	importMedicinesFromExcel,
	getAllMedicines,
	searchMedicines,
	getMedicinesByCategory,
	updateMedicine,
	deleteMedicine,
} = require('../controllers/medicine.controller')
const userMiddleware = require('../middlewares/user.middleware')

const router = express.Router()

/**
 * Excel-dan import qilish
 * POST /api/medicine/import
 */
router.post('/import', importMedicinesFromExcel)

/**
 * Barcha dorilarni olish
 * GET /api/medicine
 */
router.get('/', getAllMedicines)

/**
 * Dorilarni qidiruv va filter
 * GET /api/medicine/search?q=paracetamol&category=Issiqlik
 */
router.get('/search', searchMedicines)

/**
 * Kategoriya bo'yicha
 * GET /api/medicine/category/:category
 */
router.get('/category/:category', getMedicinesByCategory)

/**
 * Dorilarni update qilish (inventori o'zgarish)
 * PUT /api/medicine/:id
 */
router.put('/:id', userMiddleware, updateMedicine)

/**
 * Dorilarni o'chirish
 * DELETE /api/medicine/:id
 */
router.delete('/:id', userMiddleware, deleteMedicine)

module.exports = router
