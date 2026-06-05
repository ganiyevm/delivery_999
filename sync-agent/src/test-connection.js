const { config, validate } = require('./config')
const { readBranch } = require('./mssql')

async function main() {
	const errors = validate()
	if (errors.length) {
		console.error('Konfiguratsiya xatosi:')
		errors.forEach(e => console.error(`  - ${e}`))
		process.exit(1)
	}

	const arg = process.argv[2]
	const branches = arg
		? config.branches.filter(b => String(b.number) === String(arg))
		: config.branches.slice(0, 1)

	if (branches.length === 0) {
		console.error(`Filial topilmadi. Mavjud: ${config.branches.map(b => b.number).join(', ')}`)
		process.exit(1)
	}

	for (const branch of branches) {
		console.log(`\nFilial #${branch.number} (${branch.host}:${branch.port}) ga ulanish...`)
		try {
			const items = await readBranch(branch)
			console.log(`✓ Ulanish muvaffaqiyatli. Tovarlar soni: ${items.length}`)
			if (items.length > 0) {
				console.log('\nBirinchi 3 ta tovar:')
				items.slice(0, 3).forEach(it => {
					console.log(`  • [${it.externalId}] ${it.name}`)
					console.log(`    ishlab chiqaruvchi: ${it.manufacturer} | davlat: ${it.country || '-'}`)
					console.log(`    narx: ${it.price}, qoldiq: ${it.qty}, expiry: ${it.expiryDate || '-'}`)
				})
			}
		} catch (err) {
			console.error(`✗ Xato: ${err.message}`)
			process.exit(1)
		}
	}
}

main().catch(err => {
	console.error('Fatal:', err)
	process.exit(1)
})
