require('dotenv').config()

/**
 * Filial konfiguratsiyasini olish.
 *
 * 2 ta rejim qo'llab-quvvatlanadi:
 *
 * 1) SINGLE-FILIAL (asosiy production rejim) — har filialga alohida o'rnatiladi:
 *    BRANCH_NUMBER=4
 *    MSSQL_HOST=localhost
 *
 * 2) MULTI-FILIAL (eski rejim, markaziy ofiz uchun) — bitta agent 16 filialga:
 *    BRANCH_1=10.253.1.10
 *    BRANCH_2=10.253.2.10
 *    ...
 */
function parseBranches() {
	const branches = []

	// Single-filial rejim — BRANCH_NUMBER bo'lsa
	if (process.env.BRANCH_NUMBER) {
		branches.push({
			number: parseInt(process.env.BRANCH_NUMBER, 10),
			host: (process.env.MSSQL_HOST || 'localhost').trim(),
			port: parseInt(process.env.MSSQL_PORT || '1433', 10),
		})
		return branches
	}

	// Multi-filial rejim — BRANCH_<N>=<ip> yozuvlari
	for (const key of Object.keys(process.env)) {
		const match = key.match(/^BRANCH_(\d+)$/)
		if (!match) continue
		const value = process.env[key].trim()
		if (!value) continue
		const [host, portStr] = value.split(':')
		branches.push({
			number: parseInt(match[1], 10),
			host: host.trim(),
			port: portStr ? parseInt(portStr, 10) : parseInt(process.env.MSSQL_PORT || '1433', 10),
		})
	}
	return branches.sort((a, b) => a.number - b.number)
}

const config = {
	backendUrl: (process.env.BACKEND_URL || '').replace(/\/+$/, ''),
	apiKey: process.env.SYNC_API_KEY || '',
	intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '5', 10),
	queryTimeoutMs: parseInt(process.env.QUERY_TIMEOUT_SECONDS || '60', 10) * 1000,
	concurrency: parseInt(process.env.CONCURRENCY || '4', 10),
	mssql: {
		user: process.env.MSSQL_USER || '',
		password: process.env.MSSQL_PASSWORD || '',
		database: process.env.MSSQL_DATABASE || 'NAPTSKLAD',
		// OTDEL — RESIDUE jadvalidagi bu filialni ifodalovchi bo'lim raqami.
		// Shu raqam bilan partiyalar faqat shu filialdan olinadi (boshqa filiallar aralashmaydi).
		// Topish: SELECT OTDEL, SUM(OST) FROM RESIDUE WHERE GOOD=<id> GROUP BY OTDEL
		// va T_RESEDUE_V.KOL bilan taqqoslang — mos kelgan OTDEL shu filialniki.
		otdel: process.env.MSSQL_OTDEL ? parseInt(process.env.MSSQL_OTDEL, 10) : null,
		options: {
			trustServerCertificate: process.env.MSSQL_TRUST_CERT !== 'false',
			encrypt: process.env.MSSQL_ENCRYPT === 'true',
		},
	},
	branches: parseBranches(),
}

function validate() {
	const errors = []
	if (!config.backendUrl) errors.push('BACKEND_URL kerak')
	if (!config.apiKey || config.apiKey.length < 16) errors.push('SYNC_API_KEY juda qisqa (16+ belgi bo\'lsin)')
	if (!config.mssql.user) errors.push('MSSQL_USER kerak')
	if (!config.mssql.password) errors.push('MSSQL_PASSWORD kerak')
	if (config.branches.length === 0) errors.push('BRANCH_NUMBER yoki BRANCH_<N> kerak')
	return errors
}

module.exports = { config, validate }
