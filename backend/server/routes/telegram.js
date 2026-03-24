const express = require('express')
const { loginWithTelegram, handleWebhook } = require('../controllers/telegram.controller')

const router = express.Router()

/**
 * Telegram orqali login
 * POST /api/telegram/login
 */
router.post('/login', loginWithTelegram)

/**
 * Telegram webhook
 * POST /api/telegram/webhook
 */
router.post('/webhook', handleWebhook)

module.exports = router
