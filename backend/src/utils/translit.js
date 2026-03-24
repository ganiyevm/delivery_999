/**
 * Latin ↔ Cyrillic transliteration for pharmacy drug search
 * "parasetamol" → finds "ПАРАЦЕТАМОЛ"
 * "ibuprofen" → finds "ИБУПРОФЕН"
 * "analgin" → finds "АНАЛЬГИН"
 * Supports flexible matching for pharmaceutical names
 */

/**
 * Latin → Cyrillic character-by-character mapping
 * Each Latin char/combo maps to possible Cyrillic variants
 */
const FLEX_MAP = {
    // Multi-char (longest first)
    'shch': ['щ'],
    'sch': ['щ', 'сч'],
    'tch': ['ч'],
    'ph': ['ф'],
    'th': ['т', 'ф'],
    'kh': ['х'],
    'zh': ['ж'],
    'ch': ['ч', 'х'],
    'sh': ['ш'],
    'ts': ['ц', 'тс'],
    'tz': ['ц'],
    'yo': ['ё', 'йо'],
    'ya': ['я', 'йа'],
    'yu': ['ю', 'йу'],
    'ye': ['е', 'э'],
    'ae': ['э', 'ае'],
    'ey': ['ей', 'эй'],
    'oo': ['у', 'оо'],
    'ee': ['и', 'ее'],
    'ck': ['к'],
    'qu': ['кв'],

    // Single-char
    'a': ['а'],
    'b': ['б'],
    'c': ['ц', 'к', 'с'],
    'd': ['д'],
    'e': ['е', 'э'],
    'f': ['ф'],
    'g': ['г'],
    'h': ['х', 'г', ''],    // h can be silent
    'i': ['и', 'й'],
    'j': ['й', 'дж', 'ж'],
    'k': ['к'],
    'l': ['л'],
    'm': ['м'],
    'n': ['н'],
    'o': ['о'],
    'p': ['п'],
    'q': ['к', 'кв'],
    'r': ['р'],
    's': ['с', 'з', 'ц'],   // s can be с, з, or ц (parasetamol → парацетамол)
    't': ['т'],
    'u': ['у', 'ю'],
    'v': ['в'],
    'w': ['в', 'у'],
    'x': ['кс', 'кз', 'х'],
    'y': ['и', 'й', 'ы'],
    'z': ['з', 'ц'],
};

// Cyrillic consonants after which ь or ъ may appear
const CYR_CONSONANTS = new Set('бвгджзклмнпрстфхцчшщ'.split(''));

// Pre-sorted keys by length descending for greedy matching
const FLEX_KEYS = Object.keys(FLEX_MAP).sort((a, b) => b.length - a.length);

/**
 * Detects if text contains Latin characters
 */
function hasLatin(text) {
    return /[a-zA-Z]/.test(text);
}

/**
 * Detects if text contains Cyrillic characters
 */
function hasCyrillic(text) {
    return /[а-яА-ЯёЁ]/.test(text);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a flexible regex pattern from Latin text
 * Each Latin char becomes a group that matches valid Cyrillic variant(s)
 * Optional ь/ъ is inserted after Cyrillic consonants
 */
function latinToFlexPattern(text) {
    if (!text) return '';
    const lower = text.toLowerCase();
    const parts = [];
    let i = 0;

    while (i < lower.length) {
        let matched = false;

        for (const key of FLEX_KEYS) {
            if (lower.substring(i, i + key.length) === key) {
                const variants = FLEX_MAP[key];
                if (variants.length === 1) {
                    parts.push({ pattern: escapeRegex(variants[0]), lastChar: variants[0].slice(-1) });
                } else {
                    const filtered = variants.filter(v => v.length > 0);
                    const hasEmpty = variants.some(v => v.length === 0);
                    let p;
                    if (hasEmpty) {
                        p = '(?:' + filtered.map(escapeRegex).join('|') + ')?';
                    } else {
                        p = '(?:' + variants.map(escapeRegex).join('|') + ')';
                    }
                    // lastChar is from first variant for soft-sign insertion
                    parts.push({ pattern: p, lastChar: variants[0].slice(-1) });
                }
                i += key.length;
                matched = true;
                break;
            }
        }

        if (!matched) {
            // Non-mapped character (digit, space, dash, etc.)
            parts.push({ pattern: escapeRegex(lower[i]), lastChar: lower[i] });
            i++;
        }
    }

    // Build final pattern with optional ь/ъ after consonants
    let result = '';
    for (const part of parts) {
        result += part.pattern;
        if (CYR_CONSONANTS.has(part.lastChar)) {
            result += '[ьъ]?';
        }
    }

    return result;
}

/**
 * Build a search regex for both Latin and Cyrillic input
 */
function buildSearchRegex(query) {
    if (!query || !query.trim()) return null;
    const trimmed = query.trim();

    if (hasLatin(trimmed) && !hasCyrillic(trimmed)) {
        // Pure Latin → flexible Cyrillic regex
        const flexPattern = latinToFlexPattern(trimmed);
        const escaped = escapeRegex(trimmed);
        return new RegExp(`${flexPattern}|${escaped}`, 'i');
    }

    // Cyrillic or mixed → direct regex
    return new RegExp(escapeRegex(trimmed), 'i');
}

module.exports = { buildSearchRegex, hasLatin, hasCyrillic, latinToFlexPattern };
