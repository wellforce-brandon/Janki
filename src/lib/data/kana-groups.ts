/**
 * Shared kana lesson group definitions and mapping utilities.
 *
 * Used by: migrations (backfill), seeder, unlock logic, chart view, lesson picker.
 * Single source of truth for kana row definitions, group ordering, and
 * hiragana/katakana unicode detection.
 */

// --- Unicode detection ---

export function isHiragana(char: string): boolean {
	const code = char.charCodeAt(0);
	return code >= 0x3040 && code <= 0x309f;
}

export function isKatakana(char: string): boolean {
	const code = char.charCodeAt(0);
	return code >= 0x30a0 && code <= 0x30ff;
}

export type KanaScript = "hiragana" | "katakana";

export function detectScript(primaryText: string): KanaScript | null {
	if (isHiragana(primaryText)) return "hiragana";
	if (isKatakana(primaryText)) return "katakana";
	return null;
}

// --- Gojuon chart row definitions (reused by LanguageKana.svelte chart) ---

export const VOWELS: string[] = ["a", "i", "u", "e", "o"];

export const GOJUON_ROWS: { label: string; romaji: (string | null)[] }[] = [
	{ label: "", romaji: ["a", "i", "u", "e", "o"] },
	{ label: "k", romaji: ["ka", "ki", "ku", "ke", "ko"] },
	{ label: "s", romaji: ["sa", "shi", "su", "se", "so"] },
	{ label: "t", romaji: ["ta", "chi", "tsu", "te", "to"] },
	{ label: "n", romaji: ["na", "ni", "nu", "ne", "no"] },
	{ label: "h", romaji: ["ha", "hi", "fu", "he", "ho"] },
	{ label: "m", romaji: ["ma", "mi", "mu", "me", "mo"] },
	{ label: "y", romaji: ["ya", null, "yu", null, "yo"] },
	{ label: "r", romaji: ["ra", "ri", "ru", "re", "ro"] },
	{ label: "w", romaji: ["wa", null, null, null, "wo"] },
	{ label: "n", romaji: ["n", null, null, null, null] },
];

export const DAKUTEN_ROWS: { label: string; romaji: (string | null)[] }[] = [
	{ label: "g", romaji: ["ga", "gi", "gu", "ge", "go"] },
	{ label: "z", romaji: ["za", "ji", "zu", "ze", "zo"] },
	{ label: "d", romaji: ["da", "dzi", "dzu", "de", "do"] },
	{ label: "b", romaji: ["ba", "bi", "bu", "be", "bo"] },
];

export const HANDAKUTEN_ROWS: { label: string; romaji: (string | null)[] }[] = [
	{ label: "p", romaji: ["pa", "pi", "pu", "pe", "po"] },
];

export const YOON_COLS: string[] = ["ya", "yu", "yo"];

export const YOON_ROWS: { label: string; romaji: string[] }[] = [
	{ label: "ky", romaji: ["kya", "kyu", "kyo"] },
	{ label: "sh", romaji: ["sha", "shu", "sho"] },
	{ label: "ch", romaji: ["cha", "chu", "cho"] },
	{ label: "ny", romaji: ["nya", "nyu", "nyo"] },
	{ label: "hy", romaji: ["hya", "hyu", "hyo"] },
	{ label: "my", romaji: ["mya", "myu", "myo"] },
	{ label: "ry", romaji: ["rya", "ryu", "ryo"] },
	{ label: "gy", romaji: ["gya", "gyu", "gyo"] },
	{ label: "j", romaji: ["ja", "ju", "jo"] },
	{ label: "by", romaji: ["bya", "byu", "byo"] },
	{ label: "py", romaji: ["pya", "pyu", "pyo"] },
];

// --- Lesson group definitions ---

export interface KanaGroup {
	key: string;
	label: string;
	order: number;
	category: "seion" | "dakuten" | "handakuten" | "yoon" | "extended";
}

/**
 * Ordered list of kana lesson groups.
 * Groups 1-10: Hiragana seion (basic rows)
 * Groups 11-20: Katakana seion (basic rows)
 * Groups 21-23: Dakuten/Handakuten/Yoon (both scripts together)
 * Group 24: Extended/rare kana (both scripts)
 */
export const KANA_GROUPS: KanaGroup[] = [
	{ key: "hiragana-vowels", label: "Hiragana: Vowels", order: 1, category: "seion" },
	{ key: "hiragana-k", label: "Hiragana: K-row", order: 2, category: "seion" },
	{ key: "hiragana-s", label: "Hiragana: S-row", order: 3, category: "seion" },
	{ key: "hiragana-t", label: "Hiragana: T-row", order: 4, category: "seion" },
	{ key: "hiragana-n", label: "Hiragana: N-row", order: 5, category: "seion" },
	{ key: "hiragana-h", label: "Hiragana: H-row", order: 6, category: "seion" },
	{ key: "hiragana-m", label: "Hiragana: M-row", order: 7, category: "seion" },
	{ key: "hiragana-y", label: "Hiragana: Y-row", order: 8, category: "seion" },
	{ key: "hiragana-r", label: "Hiragana: R-row", order: 9, category: "seion" },
	{ key: "hiragana-w", label: "Hiragana: W & N", order: 10, category: "seion" },
	{ key: "katakana-vowels", label: "Katakana: Vowels", order: 11, category: "seion" },
	{ key: "katakana-k", label: "Katakana: K-row", order: 12, category: "seion" },
	{ key: "katakana-s", label: "Katakana: S-row", order: 13, category: "seion" },
	{ key: "katakana-t", label: "Katakana: T-row", order: 14, category: "seion" },
	{ key: "katakana-n", label: "Katakana: N-row", order: 15, category: "seion" },
	{ key: "katakana-h", label: "Katakana: H-row", order: 16, category: "seion" },
	{ key: "katakana-m", label: "Katakana: M-row", order: 17, category: "seion" },
	{ key: "katakana-y", label: "Katakana: Y-row", order: 18, category: "seion" },
	{ key: "katakana-r", label: "Katakana: R-row", order: 19, category: "seion" },
	{ key: "katakana-w", label: "Katakana: W & N", order: 20, category: "seion" },
	{ key: "dakuten", label: "Dakuten", order: 21, category: "dakuten" },
	{ key: "handakuten", label: "Handakuten", order: 22, category: "handakuten" },
	{ key: "yoon", label: "Combinations", order: 23, category: "yoon" },
	{ key: "extended", label: "Extended Kana", order: 24, category: "extended" },
];

/** Lookup group by key */
export const KANA_GROUP_MAP = new Map(KANA_GROUPS.map((g) => [g.key, g]));

// --- Romaji -> row category mapping ---

/** Seion row romaji sets, keyed by row suffix (vowels, k, s, ...) */
const SEION_ROWS: Record<string, Set<string>> = {
	vowels: new Set(["a", "i", "u", "e", "o"]),
	k: new Set(["ka", "ki", "ku", "ke", "ko"]),
	s: new Set(["sa", "shi", "su", "se", "so"]),
	t: new Set(["ta", "chi", "tsu", "te", "to"]),
	n: new Set(["na", "ni", "nu", "ne", "no"]),
	h: new Set(["ha", "hi", "fu", "he", "ho"]),
	m: new Set(["ma", "mi", "mu", "me", "mo"]),
	y: new Set(["ya", "yu", "yo"]),
	r: new Set(["ra", "ri", "ru", "re", "ro"]),
	w: new Set(["wa", "wo", "n"]),
};

const DAKUTEN_ROMAJI = new Set([
	"ga",
	"gi",
	"gu",
	"ge",
	"go",
	"za",
	"ji",
	"zu",
	"ze",
	"zo",
	"da",
	"dzi",
	"dzu",
	"de",
	"do",
	"ba",
	"bi",
	"bu",
	"be",
	"bo",
]);

const HANDAKUTEN_ROMAJI = new Set(["pa", "pi", "pu", "pe", "po"]);

const YOON_ROMAJI = new Set([
	"kya",
	"kyu",
	"kyo",
	"sha",
	"shu",
	"sho",
	"cha",
	"chu",
	"cho",
	"nya",
	"nyu",
	"nyo",
	"hya",
	"hyu",
	"hyo",
	"mya",
	"myu",
	"myo",
	"rya",
	"ryu",
	"ryo",
	"gya",
	"gyu",
	"gyo",
	"ja",
	"ju",
	"jo",
	"bya",
	"byu",
	"byo",
	"pya",
	"pyu",
	"pyo",
]);

/**
 * Given a kana item's romaji and primary_text, returns the lesson group key
 * and lesson_order number. Returns null for non-kana items.
 */
export function getKanaGroupInfo(
	romaji: string | null | undefined,
	primaryText: string,
): { group: string; order: number } | null {
	if (!romaji) return { group: "extended", order: 24 };

	const script = detectScript(primaryText);
	if (!script) return null;

	// Check seion rows (script-specific groups)
	for (const [rowKey, romajiSet] of Object.entries(SEION_ROWS)) {
		if (romajiSet.has(romaji)) {
			const prefix = script === "hiragana" ? "hiragana" : "katakana";
			const groupKey = `${prefix}-${rowKey}`;
			const group = KANA_GROUP_MAP.get(groupKey);
			return group ? { group: group.key, order: group.order } : null;
		}
	}

	// Dakuten, handakuten, yoon are shared across both scripts
	if (DAKUTEN_ROMAJI.has(romaji)) return { group: "dakuten", order: 21 };
	if (HANDAKUTEN_ROMAJI.has(romaji)) return { group: "handakuten", order: 22 };
	if (YOON_ROMAJI.has(romaji)) return { group: "yoon", order: 23 };

	// Everything else is extended
	return { group: "extended", order: 24 };
}

/**
 * Get the group label for a kana item, suitable for UI display.
 * Falls back to "Kana" if no group info can be determined.
 */
export function getKanaGroupLabel(lessonGroup: string | null | undefined): string {
	if (!lessonGroup) return "Kana";
	const group = KANA_GROUP_MAP.get(lessonGroup);
	return group?.label ?? "Kana";
}

/**
 * Determine if a kana item is Hiragana or Katakana based on its primary_text,
 * returning a user-facing label.
 */
export function getKanaScriptLabel(primaryText: string): string {
	if (isHiragana(primaryText)) return "Hiragana";
	if (isKatakana(primaryText)) return "Katakana";
	return "Kana";
}
