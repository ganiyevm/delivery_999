const { Schema, model } = require('mongoose')

const UserSchema = new Schema(
	{
		fullName: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		password: { type: String, required: true },
		// Telegram integration
		telegramId: { type: Number, unique: true, sparse: true },
		telegramUsername: { type: String },
		telegramPhotoUrl: { type: String },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true }
)

module.exports = model('User', UserSchema)
