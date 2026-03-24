const crypto = require('crypto')
const jwt = require('jsonwebtoken')

/**
 * Telegram init data ni verify qilish
 * @param {string} initData - Telegram WebApp initData
 * @param {string} botToken - Telegram bot token
 * @returns {boolean} - Valid yoki yo'q
 */
const verifyTelegramInitData = (initData, botToken) => {
	try {
		const url = new URLSearchParams(initData)
		const hash = url.get('hash')

		// hash ni olish
		if (!hash) {
			console.log('❌ Hash topilmadi')
			return false
		}

		// Barcha ma'lumotlar ro'yxati (hash dan tashqari)
		const dataCheckString = Array.from(url.entries())
			.filter(([key]) => key !== 'hash')
			.sort()
			.map(([key, value]) => `${key}=${value}`)
			.join('\n')

		// Secret key
		const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()

		// Computed hash
		const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

		// Tekshiruv
		const isValid = computedHash === hash
		console.log(isValid ? '✅ Telegram data valid' : '❌ Telegram data invalid')
		return isValid
	} catch (error) {
		console.log('❌ Telegram verification error:', error.message)
		return false
	}
}

/**
 * Telegram user ma'lumotlarini olish
 * @param {string} initData - Telegram WebApp initData
 * @returns {object} - User ma'lumotlar
 */
const parseTelegramUser = initData => {
	try {
		const url = new URLSearchParams(initData)
		const userDataStr = url.get('user')

		if (!userDataStr) {
			console.log('❌ User ma\'lumoti topilmadi')
			return null
		}

		const userData = JSON.parse(userDataStr)
		console.log('✅ User ma\'lumoti:', userData)
		return userData
	} catch (error) {
		console.log('❌ User parsing error:', error.message)
		return null
	}
}

/**
 * JWT token yaratish Telegram user uchun
 * @param {object} telegramUser - Telegram user data
 * @param {string} userId - Database user ID
 * @returns {string} - JWT token
 */
const generateTelegramJWT = (telegramUser, userId) => {
	const token = jwt.sign(
		{
			_id: userId,
			telegramId: telegramUser.id,
			firstName: telegramUser.first_name,
			lastName: telegramUser.last_name || '',
			username: telegramUser.username || '',
			photoUrl: telegramUser.photo_url || '',
		},
		process.env.JWT_SECRET || 'default-secret',
		{ expiresIn: '7d' }
	)
	return token
}

module.exports = {
	verifyTelegramInitData,
	parseTelegramUser,
	generateTelegramJWT,
}
