
const clickService = require('../services/click.service')
const userModel = require('../models/user.model')
const productModel = require('../models/product.model')
const orderModel = require('../models/order.model')
class ClickController {
	async prepare(req, res, next) {
		try {
			const data = req.body
			const result = await clickService.prepare(data)
			res.set({ headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } }).send(result)
		} catch (error) {
			next(error)
		}
	}
	async complete(req, res, next) {
		try {
			const data = req.body
			const result = await clickService.complete(data)
			res.set({ headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } }).send(result)
		} catch (error) {
			next(error)
		}
	}
	async checkout(req, res, next) {
		try {
			const currentUser = req.user
			const { productId, url } = req.body
			const MERCHANT_ID = process.env.CLICK_MERCHANT_ID
			const SERVICE_ID = process.env.CLICK_SERVICE_ID
			const MERCHANT_USER_ID = process.env.CLICK_MERCHANT_USER_ID

			const product = await productModel.findById(productId)
			if (!product) return res.json({ failure: 'Product not found' })

			const user = await userModel.findById(currentUser._id)
			if (!user) return res.json({ failure: 'User not found' })

			await orderModel.deleteMany({ user: user._id, product: product._id, state: 'pending confirm', provider: 'click' })
			const order = await orderModel.create({ user: user._id, product: product._id, price: product.price, provider: 'click' })

			const checkoutUrl = `https://my.click.uz/services/pay?service_id=${SERVICE_ID}&merchant_id=${MERCHANT_ID}&amount=${product.price}&transaction_param=${order._id}&merchant_order_id=${MERCHANT_USER_ID}&return_url=${url}`
			return res.json({ url: checkoutUrl })
		} catch (error) {
			next(error)
		}
	}
}

module.exports = new ClickController()