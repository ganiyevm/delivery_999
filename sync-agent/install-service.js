/**
 * Windows Service sifatida o'rnatish (markaziy ofiz Windows server uchun)
 *
 * Foydalanish:
 *   npm install -g node-windows
 *   npm link node-windows
 *   node install-service.js install   # service o'rnatish
 *   node install-service.js uninstall # service o'chirish
 *
 * Service nomi: "Apteka999 Sync Agent"
 * Avtomatik ishga tushadi, Windows qayta yoqilganda ham
 */
const path = require('path')
const { Service } = require('node-windows')

const svc = new Service({
	name: 'Apteka999 Sync Agent',
	description: 'Markaziy ofizdan filial SQL Server\'lariga ulanib qoldiqni Railway backend\'ga sinxronlaydi',
	script: path.join(__dirname, 'src', 'index.js'),
	nodeOptions: ['--harmony'],
	workingDirectory: __dirname,
	allowServiceLogon: true,
	// Xato bo'lsa avtomatik qayta ishga tushirish
	wait: 2,
	grow: 0.5,
	maxRestarts: 10,
})

svc.on('install', () => {
	console.log('✅ Service o\'rnatildi')
	console.log('Ishga tushirish: services.msc → "Apteka999 Sync Agent" → Start')
	console.log('Yoki: net start "Apteka999 Sync Agent"')
	svc.start()
})

svc.on('uninstall', () => {
	console.log('✅ Service o\'chirildi')
})

svc.on('start', () => console.log('▶ Service ishga tushdi'))
svc.on('stop', () => console.log('⏸ Service to\'xtatildi'))
svc.on('error', err => console.error('❌ Xato:', err))

const action = process.argv[2]

if (action === 'install') {
	svc.install()
} else if (action === 'uninstall') {
	svc.uninstall()
} else if (action === 'start') {
	svc.start()
} else if (action === 'stop') {
	svc.stop()
} else {
	console.log('Foydalanish:')
	console.log('  node install-service.js install    # o\'rnatish va ishga tushirish')
	console.log('  node install-service.js uninstall  # o\'chirish')
	console.log('  node install-service.js start      # ishga tushirish')
	console.log('  node install-service.js stop       # to\'xtatish')
}
