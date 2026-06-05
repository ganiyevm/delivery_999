/**
 * PRNAME ustunini ishlab chiqaruvchi + davlatga ajratish.
 *
 * Misol formatlar (SQL'dan kelgan):
 *   "COTTON CLUB/РОССИЯ"           → { manufacturer: "COTTON CLUB", country: "РОССИЯ" }
 *   "MAKSGROUP (ТУРЦИЯ)"           → { manufacturer: "MAKSGROUP",   country: "ТУРЦИЯ" }
 *   "BIOTA BITKISEL (ТУРЦ.)"       → { manufacturer: "BIOTA BITKISEL", country: "ТУРЦ." }
 *   "NOW FOODS (США)"              → { manufacturer: "NOW FOODS", country: "США" }
 *   "POLPHARMA"                    → { manufacturer: "POLPHARMA", country: "" }
 *   "LA ROCHE POSAY (Ф...)"        → { manufacturer: "LA ROCHE POSAY", country: "Ф..." }
 */
function parsePrname(raw) {
	const s = (raw || '').toString().trim()
	if (!s) return { manufacturer: '', country: '' }

	// Format 1: "Nomi (DAVLAT)" — oxiridagi qavs
	const parenMatch = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
	if (parenMatch) {
		return {
			manufacturer: parenMatch[1].trim(),
			country: normalizeCountry(parenMatch[2].trim()),
		}
	}

	// Format 2: "Nomi/DAVLAT" — slash bilan
	const slashIdx = s.lastIndexOf('/')
	if (slashIdx > 0) {
		const left = s.slice(0, slashIdx).trim()
		const right = s.slice(slashIdx + 1).trim()
		// Slash'dan keyingi qism qisqa (davlat nomi odatda 3-15 belgi) bo'lsa va raqam yo'q bo'lsa
		if (right.length <= 20 && !/\d/.test(right)) {
			return {
				manufacturer: left,
				country: normalizeCountry(right),
			}
		}
	}

	// Davlat topilmadi — faqat ishlab chiqaruvchi
	return { manufacturer: s, country: '' }
}

// Davlat nomlarini standartlash (qisqartmalarni to'liqlashtirish)
const COUNTRY_NORMALIZE = {
	'РОССИЯ': 'Россия',
	'РОС': 'Россия',
	'РФ': 'Россия',
	'ТУРЦИЯ': 'Туркия',
	'ТУРЦ': 'Туркия',
	'ТУРЦ.': 'Туркия',
	'УЗБЕКИСТАН': "O'zbekiston",
	'УЗБ': "O'zbekiston",
	'УЗБ.': "O'zbekiston",
	'США': 'AQSh',
	'ПОЛЬША': 'Polsha',
	'ШВЕЦИЯ': 'Shvetsiya',
	'ИНДИЯ': 'Hindiston',
	'ГЕРМАНИЯ': 'Germaniya',
	'ФРАНЦИЯ': 'Fransiya',
	'УКРАИНА': 'Ukraina',
	'БЕЛАРУСЬ': 'Belarus',
	'КАЗАХСТАН': "Qozog'iston",
	'КИТАЙ': 'Xitoy',
	'ИРАН': 'Eron',
	'ИСПАНИЯ': 'Ispaniya',
	'ИТАЛИЯ': 'Italiya',
}

function normalizeCountry(raw) {
	const upper = raw.toUpperCase().trim()
	if (COUNTRY_NORMALIZE[upper]) return COUNTRY_NORMALIZE[upper]
	// Birinchi harfini katta, qolganini kichik
	return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

module.exports = { parsePrname }
