const { Schema, model } = require('mongoose')

const orderSchema = new Schema(
	{
		user: { type: Schema.Types.ObjectId, ref: 'User' },
		product: { type: Schema.Types.ObjectId, ref: 'Product' },
		state: { type: String, default: 'pending' },
		provider: { type: String },
	},
	{ timestamps: true }
)

module.exports = model('Order', orderSchema)
