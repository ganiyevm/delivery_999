const { Schema, model } = require('mongoose')

const productSchema = new Schema(
	{
		title: { type: String, required: true }, // Dori nomi
		category: { type: String, required: true }, // Kategoriya (Issiqlik, Yo'tal, etc.)
		price: { type: Number, required: true }, // Narx
		description: { type: String, required: true }, // Tavsifi
		image: { type: String }, // Rasmi
		imageKey: { type: String }, // Rasm kaliti
		// Dori-specific fields
		activeIngredient: { type: String }, // Asosiy tarkibi (masalan, Paracetamol)
		dosage: { type: String }, // Doza (masalan, 500mg)
		manufacturer: { type: String }, // Ishlab chiqaruvchi
		expiryDate: { type: Date }, // Ish vaqti tugash
		inStock: { type: Boolean, default: true }, // Sotiladimi
		quantity: { type: Number, default: 0 }, // Ombordan qolgan miqdor
	},
	{ timestamps: true }
)

// Qidiruv uchun index
productSchema.index({ title: 'text', activeIngredient: 'text', description: 'text' })

module.exports = model('Product', productSchema)
