const { config, validate } = require('./config')
const { readBranch } = require('./mssql')
const { sendBranchStock } = require('./sender')

async function syncOne(branch) {
	const t0 = Date.now()
	const syncStartedAt = new Date().toISOString()
	try {
		const items = await readBranch(branch)
		const { sent, chunks } = await sendBranchStock(branch.number, items, syncStartedAt)
		const ms = Date.now() - t0
		console.log(`  ✓ Filial #${branch.number} (${branch.host}) — ${sent} tovar, ${chunks} chunk, ${ms}ms`)
		return { ok: true, branch: branch.number, sent }
	} catch (err) {
		const ms = Date.now() - t0
		console.error(`  ✗ Filial #${branch.number} (${branch.host}) — ${err.message} (${ms}ms)`)
		return { ok: false, branch: branch.number, error: err.message }
	}
}

async function runWithConcurrency(items, worker, limit) {
	const results = []
	const queue = items.slice()
	const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
		while (queue.length) {
			const item = queue.shift()
			results.push(await worker(item))
		}
	})
	await Promise.all(workers)
	return results
}

async function syncAll() {
	const stamp = new Date().toISOString()
	console.log(`\n[${stamp}] Sync boshlandi — ${config.branches.length} filial, concurrency=${config.concurrency}`)
	const results = await runWithConcurrency(config.branches, syncOne, config.concurrency)
	const ok = results.filter(r => r.ok).length
	const failed = results.length - ok
	const totalSent = results.reduce((s, r) => s + (r.sent || 0), 0)
	console.log(`[${new Date().toISOString()}] Tugadi — muvaffaqiyatli: ${ok}, xato: ${failed}, jami yuborilgan: ${totalSent}`)
}

async function main() {
	const errors = validate()
	if (errors.length) {
		console.error('Konfiguratsiya xatosi:')
		errors.forEach(e => console.error(`  - ${e}`))
		process.exit(1)
	}

	console.log(`Apteka999 Sync Agent`)
	console.log(`Backend: ${config.backendUrl}`)
	console.log(`Filiallar: ${config.branches.map(b => `#${b.number}`).join(', ')}`)
	console.log(`Interval: ${config.intervalMinutes} daqiqa`)

	const once = process.argv.includes('--once')

	await syncAll()

	if (once) {
		console.log('--once rejimida, chiqyapman')
		process.exit(0)
	}

	const intervalMs = config.intervalMinutes * 60 * 1000
	setInterval(() => {
		syncAll().catch(err => console.error('Sync xatosi:', err))
	}, intervalMs)
}

process.on('uncaughtException', err => console.error('uncaughtException:', err))
process.on('unhandledRejection', err => console.error('unhandledRejection:', err))

main().catch(err => {
	console.error('Fatal:', err)
	process.exit(1)
})
