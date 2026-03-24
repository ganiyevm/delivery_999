const router = require('express').Router()

router.use('/user', require('./user'))
router.use('/click', require('./click'))
router.use('/telegram', require('./telegram'))
router.use('/medicine', require('./medicine'))

module.exports = router
