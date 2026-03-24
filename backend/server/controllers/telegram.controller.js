const User = require('../models/user.model')
const { verifyTelegramInitData, parseTelegramUser, generateTelegramJWT } = require('../utils/telegram')

/**
 * Telegram orqali auto-login
 * POST /api/telegram/login
 */
exports.loginWithTelegram = async (req, res, next) => {
	try {
		const { initData } = req.body

		if (!initData) {
			return res.status(400).json({ error: 'initData required', error_note: 'Init data topilmadi' })
		}

		// Telegram data ni verify qilish
		const isValid = verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN)
		if (!isValid) {
			return res.status(401).json({ error: 'invalid_data', error_note: 'Telegram ma\'lumoti notog\'ri' })
		}

		// User ma'lumotlarini olish
		const telegramUser = parseTelegramUser(initData)
		if (!telegramUser) {
			return res.status(400).json({ error: 'parse_error', error_note: 'User ma\'lumoti parslanib bo\'lmadi' })
		}

		// Foydalanuvchini qidirish yoki yaratish
		let user = await User.findOne({ telegramId: telegramUser.id })

		if (!user) {
			// Yangi foydalanuvchi
			user = new User({
				email: `telegram_${telegramUser.id}@telegram.local`,
				fullName: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
				telegramId: telegramUser.id,
				telegramUsername: telegramUser.username,
				telegramPhotoUrl: telegramUser.photo_url,
				password: Math.random().toString(36), // Random password
			})
			await user.save()
			console.log('✅ Yangi Telegram user yaratildi:', telegramUser.id)
		} else {
			console.log('✅ Mavjud Telegram user:', telegramUser.id)
		}

		// JWT token yaratish
		const token = generateTelegramJWT(telegramUser, user._id)

		// Response
		res.json({
			user: {
				_id: user._id,
				email: user.email,
				fullName: user.fullName,
				telegramId: user.telegramId,
			},
			token,
			success: true,
		})
	} catch (error) {
		console.error('❌ Telegram login error:', error)
		next(error)
	}
}

/**
 * Telegram webhook (future use)
 * POST /api/telegram/webhook
 */
exports.handleWebhook = async (req, res, next) => {
	try {
		const message = req.body.message

		// Bot komandalarini qayta ishlash
		if (message && message.text) {
			console.log(`📨 Message: ${message.text} from ${message.from.id}`)
		}

		res.json({ ok: true })
	} catch (error) {
		console.error('❌ Webhook error:', error)
		next(error)
	}
}
