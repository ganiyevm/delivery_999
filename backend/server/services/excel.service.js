const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

/**
 * Excel fayldan dori ma'lumotlarini o'qish
 * @param {string} filePath - Excel fayl yo'li
 * @returns {array} - Dori ma'lumotlari
 */
const parseExcelMedicines = (filePath) => {
	try {
		// Excel faylni o'qish
		const workbook = XLSX.readFile(filePath)
		const sheetName = workbook.SheetNames[0] // Birinchi sheet
		const worksheet = workbook.Sheets[sheetName]

		// Worksheet-ni JSON-ga o'girish
		const data = XLSX.utils.sheet_to_json(worksheet)

		console.log(`✅ ${data.length} ta dori o'qildi Excel-dan`)
		return data
	} catch (error) {
		console.error('❌ Excel parsing error:', error.message)
		throw error
	}
}

/**
 * Excel data-ni database format-iga o'girish
 * @param {array} excelData - Excel-dan o'qilgan data
 * @returns {array} - Transformatsiya qilingan dori ma'lumotlar
 */
const transformExcelToProducts = (excelData) => {
	try {
		const products = excelData
			.map((row, index) => {
				// Excel column names o'rnatilgan field-larga joylashtirish
				// __EMPTY = Наименование (dori nomi)
				// __EMPTY_1 = Производитель (ishlab chiqaruvchi)
				// __EMPTY_2 = Цена продажная (narx)
				// __EMPTY_3 = Кол-во (miqdor/quantity)

				const branch = row['Остатки товаров на дату 18.02.2026'] || ''
				const title = row['__EMPTY'] || ''
				const manufacturer = row['__EMPTY_1'] || ''
				const price = parseFloat((row['__EMPTY_2'] || 0).toString().replace(/[^\d.]/g, '')) || 0
				const quantity = parseInt((row['__EMPTY_3'] || 0).toString().replace(/[^\d]/g, '')) || 0

				// Validatsiya
				if (!title || title.trim() === '' || quantity === 0 || price === 0) {
					return null
				}

				return {
					title: title.trim(),
					activeIngredient: '', // Keyinchalik qo'shiladi
					dosage: '', // Keyinchalik qo'shiladi
					manufacturer: manufacturer.trim(),
					quantity: quantity,
					price: price,
					category: 'Boshqa', // Default category
					inStock: quantity > 0,
					description: `${title} - ${manufacturer}`.trim(),
					image: null, // Keyinchalik qo'shiladi
					expiryDate: null, // Keyinchalik qo'shiladi
					branch: branch.trim(), // Filial ma'lumoti
					createdAt: new Date(),
					updatedAt: new Date(),
				}
			})
			.filter(product => product !== null) // Null elementlarni o'chirish

		console.log(`✅ ${products.length} ta dori o'rnatildi`)
		return products
	} catch (error) {
		console.error('❌ Transformation error:', error.message)
		throw error
	}
}

/**
 * Excel fayldan to'liq oqish va transformatsiya qilish
 * @param {string} filePath - Excel fayl yo'li
 * @returns {array} - Tayyorlangan dori ma'lumotlar
 */
const readAndTransformExcel = (filePath) => {
	try {
		const excelData = parseExcelMedicines(filePath)
		const products = transformExcelToProducts(excelData)
		return products
	} catch (error) {
		console.error('❌ Error:', error.message)
		throw error
	}
}

module.exports = {
	parseExcelMedicines,
	transformExcelToProducts,
	readAndTransformExcel,
}
