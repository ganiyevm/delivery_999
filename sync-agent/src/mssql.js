const sql = require('mssql')
const { config } = require('./config')
const { parsePrname } = require('./parse')

// 1) OSTATOK/nom — eski (ishonchli) view. Bir dorining har EXPDATA partiyasи alohida qator.
const QUERY_TOTALS = `
SELECT
    r.ID         AS externalId,
    r.GOOD_NAME  AS name,
    r.PRNAME     AS prname,
    r.PRICE      AS price,
    r.EXPDATA    AS expiryDate,
    r.KOL        AS qty,
    g.BARCODE    AS barcode,
    g.GOOD_BARCODE AS goodBarcode,
    g.REC        AS rec,
    CASE WHEN ISNULL(g.REC, 0) = 1 THEN 1 ELSE 0 END AS requiresRx,
    g.FOM_GOOD   AS fomGoodId,
    g.CLASSCODE  AS classCode
FROM dbo.T_RESEDUE_V r
LEFT JOIN dbo.GOOD g ON g.ID = r.ID
`

// 2) Partiyalar (seriya) — RESIDUE jadvalидан, ALOHIDA (join YO'Q — aks holda cartesian bo'ladi).
//    OTDEL filtri: faqat shu filialni ifodalovchi bo'lim (config.mssql.otdel).
//    OTDEL null bo'lsa — barcha OTDELlar (boshqa filiallar aralashadi, tavsiya etilmaydi).
function buildBatchQuery(otdel) {
	const otdelFilter = otdel != null ? `AND OTDEL = ${parseInt(otdel, 10)}` : ''
	return `
SELECT
    GOOD       AS gid,
    SERIA      AS seria,
    PRICEROZ1  AS price,
    EXPDATA    AS expiryDate,
    SUM(OST)   AS qty
FROM dbo.RESIDUE
WHERE OST > 0 ${otdelFilter}
GROUP BY GOOD, SERIA, PRICEROZ1, EXPDATA
`
}

async function readBranch(branch) {
	const poolConfig = {
		server: branch.host,
		port: branch.port,
		user: config.mssql.user,
		password: config.mssql.password,
		database: config.mssql.database,
		connectionTimeout: 15000,
		requestTimeout: config.queryTimeoutMs,
		options: {
			trustServerCertificate: config.mssql.options.trustServerCertificate,
			encrypt: config.mssql.options.encrypt,
			enableArithAbort: true,
		},
		pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
	}

	let pool
	try {
		pool = await new sql.ConnectionPool(poolConfig).connect()
		const totals = await pool.request().query(QUERY_TOTALS)
		let batches = { recordset: [] }
		try {
			batches = await pool.request().query(buildBatchQuery(config.mssql.otdel))
		} catch (e) {
			// Partiya so'rovи xato bersa — ostatok baribir ishlasin (partiyalarsiz)
			console.error('  ! RESIDUE (partiya) so\'rovи xato:', e.message)
		}
		return aggregate(totals.recordset, batches.recordset)
	} finally {
		if (pool) await pool.close().catch(() => {})
	}
}

// OSTATOK = T_RESEDUE_V (eski mantiq, to'g'ri). Partiyalar = RESIDUE'дан GOOD bo'yicha bog'lanadi.
// Backend dorini NOM bo'yicha moslaydi, shu sabab biz ham nom bo'yicha guruhlaymiz.
function aggregate(totalRows, batchRows) {
	// GOOD -> partiyalar
	const batchesByGood = new Map()
	for (const r of batchRows) {
		const gid = r.gid != null ? String(r.gid) : null
		if (gid == null) continue
		const price = Number(r.price) || 0
		const qty = Number(r.qty) || 0
		if (qty <= 0) continue
		const expISO = r.expiryDate ? new Date(r.expiryDate).toISOString() : null
		const seria = (r.seria || '').toString().trim()
		if (!batchesByGood.has(gid)) batchesByGood.set(gid, [])
		batchesByGood.get(gid).push({ seria, price, qty, expiryDate: expISO })
	}

	const map = new Map()
	for (const row of totalRows) {
		const id = row.externalId
		const qty = Number(row.qty) || 0
		if (qty <= 0) continue

		const name = (row.name || '').toString().trim()
		const key = name ? name.toLowerCase() : (id != null ? `#${id}` : null)
		if (!key) continue

		const price = Number(row.price) || 0
		const expISO = row.expiryDate ? new Date(row.expiryDate).toISOString() : null

		let e = map.get(key)
		if (!e) {
			const { manufacturer, country } = parsePrname(row.prname)
			e = {
				externalId: id != null ? String(id) : '',
				name, manufacturer, country,
				price, qty, expiryDate: expISO,
				barcode: normalizeBarcode(row.barcode || row.goodBarcode),
				requiresRx: Boolean(Number(row.requiresRx) || Number(row.rec)),
				fomGoodIds: [],
				classCodes: [],
				_gids: new Set(),
				_fomGoodIds: new Set(),
				_classCodes: new Set(),
			}
			map.set(key, e)
		} else {
			e.qty += qty
			if (expISO && (!e.expiryDate || new Date(expISO) < new Date(e.expiryDate))) e.expiryDate = expISO
			if (price > 0 && (e.price === 0 || price < e.price)) e.price = price
			if (!e.barcode) e.barcode = normalizeBarcode(row.barcode || row.goodBarcode)
			if (Number(row.requiresRx) || Number(row.rec)) e.requiresRx = true
		}
		if (id != null) e._gids.add(String(id))
		if (row.fomGoodId != null) e._fomGoodIds.add(Number(row.fomGoodId))
		const classCode = (row.classCode || '').toString().trim()
		if (classCode) e._classCodes.add(classCode)
	}

	return Array.from(map.values()).map(e => {
		// Shu mahsulotning barcha GOOD'laridagi partiyalarни (seria+narx+muddat bo'yicha) birlashtiramiz
		const bm = new Map()
		for (const gid of e._gids) {
			for (const b of (batchesByGood.get(gid) || [])) {
				const bk = b.seria + '|' + b.price + '|' + (b.expiryDate || '')
				const ex = bm.get(bk)
				if (ex) ex.qty += b.qty
				else bm.set(bk, { seria: b.seria, price: b.price, qty: b.qty, expiryDate: b.expiryDate })
			}
		}
		const batches = Array.from(bm.values()).sort((a, b) => {
			const ea = a.expiryDate ? Date.parse(a.expiryDate) : Infinity
			const eb = b.expiryDate ? Date.parse(b.expiryDate) : Infinity
			if (ea !== eb) return ea - eb
			return a.price - b.price
		})
		delete e._gids
		e.fomGoodIds = Array.from(e._fomGoodIds)
		e.classCodes = Array.from(e._classCodes)
		delete e._fomGoodIds
		delete e._classCodes
		e.batches = batches
		return e
	})
}

function normalizeBarcode(value) {
	const barcode = (value || '').toString().trim()
	return barcode || ''
}

module.exports = { readBranch }
