const axios = require('axios')
const { config } = require('./config')

const CHUNK_SIZE = 500

async function sendBranchStock(branchNumber, items, syncStartedAt) {
	const url = `${config.backendUrl}/api/sync/inbound`
	const total = items.length

	if (total === 0) {
		await postChunk(url, {
			branchNumber,
			syncStartedAt,
			chunkIndex: 0,
			totalChunks: 1,
			isLast: true,
			items: [],
		})
		return { sent: 0, chunks: 1 }
	}

	const totalChunks = Math.ceil(total / CHUNK_SIZE)
	let sent = 0

	for (let i = 0; i < totalChunks; i++) {
		const chunk = items.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
		await postChunk(url, {
			branchNumber,
			syncStartedAt,
			chunkIndex: i,
			totalChunks,
			isLast: i === totalChunks - 1,
			items: chunk,
		})
		sent += chunk.length
	}

	return { sent, chunks: totalChunks }
}

async function postChunk(url, body) {
	const attempts = 3
	let lastErr
	for (let i = 1; i <= attempts; i++) {
		try {
			await axios.post(url, body, {
				headers: { 'x-sync-key': config.apiKey, 'content-type': 'application/json' },
				timeout: 60000,
			})
			return
		} catch (err) {
			lastErr = err
			if (i < attempts) await sleep(1000 * i)
		}
	}
	throw lastErr
}

function sleep(ms) {
	return new Promise(r => setTimeout(r, ms))
}

module.exports = { sendBranchStock }
