import { getDb, safeQuery } from "../database";

/**
 * Assigns language_items to language_level (1-60) based on a curated curriculum.
 * Runs once on startup, idempotent via settings key.
 *
 * Level structure:
 *   1-10  (Pleasant): Kana mastery + kana-only vocab. No grammar.
 *                      ~15-20 kana per level. Vocab gated behind kana review.
 *   11-20 (Painful):  Grammar begins + N5 vocab/conjugation/sentences.
 *   21-30 (Death):    N4 grammar + vocab + sentences.
 *   31-40 (Hell):     N3 content.
 *   41-50 (Paradise): N2 content.
 *   51-60 (Reality):  N1 + untagged content.
 */

const SETTINGS_KEY = "language_levels_v4";

export async function assignLanguageLevels(): Promise<void> {
	const check = await safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ value: string }[]>(
			"SELECT value FROM settings WHERE key = ?",
			[SETTINGS_KEY],
		);
		return rows.length > 0 && rows[0].value === "true";
	});
	if (check.ok && check.data) return; // Already assigned

	console.log("[language-levels] Assigning language levels (v2)...");
	const result = await safeQuery(async () => {
		const db = await getDb();

		// Clear any previous assignments and reset SRS state for clean reassignment
		await db.execute("UPDATE language_items SET language_level = NULL WHERE language_level IS NOT NULL");
		await db.execute(
			`UPDATE language_items SET srs_stage = 0, unlocked_at = NULL, next_review = NULL,
			 lesson_completed_at = NULL, correct_count = 0, incorrect_count = 0
			 WHERE srs_stage > 0`,
		);
		await db.execute("DELETE FROM language_review_log");

		// --- Phase 1: Kana levels (1-10) ---
		await assignKanaLevels(db);

		// --- Phase 2: Kana-only vocab for levels 1-10 ---
		await assignKanaOnlyVocab(db);

		// --- Phase 3: Grammar + N5 vocab for levels 11-20 ---
		await assignGrammarAndN5Vocab(db);

		// --- Phase 4: N4 content for levels 21-30 ---
		await assignByJlptTier(db, "N4", 21, 30);

		// --- Phase 5: N3 content for levels 31-40 ---
		await assignByJlptTier(db, "N3", 31, 40);

		// --- Phase 6: N2 content for levels 41-50 ---
		await assignByJlptTier(db, "N2", 41, 50);

		// --- Phase 7: N1 + untagged for levels 51-60 ---
		await assignN1AndUntagged(db);

		// --- Phase 8: Compute sentence prerequisites ---
		await computeSentencePrerequisites(db);

		// --- Phase 9: Auto-unlock level 1 kana only ---
		await bootstrapLevel1(db);

		// Mark as done
		await db.execute(
			"INSERT OR REPLACE INTO settings (key, value) VALUES (?, 'true')",
			[SETTINGS_KEY],
		);
	});

	if (!result.ok) {
		console.error("[language-levels] Failed to assign levels:", result.error);
	} else {
		console.log("[language-levels] Level assignment complete.");
	}
}

// --- Kana level assignment (15-20 per level) ---

// Hiragana: 3 levels of 15-16 chars (reordered for early word utility)
const HIRAGANA_ROWS: Record<number, string[]> = {
	1: [ // vowels + h-row + k-row (15) -- enables はい, いく, かう
		"あ", "い", "う", "え", "お",
		"は", "ひ", "ふ", "へ", "ほ",
		"か", "き", "く", "け", "こ",
	],
	2: [ // t-row + s-row + m-row (15) -- enables すし, ます, たべ...
		"た", "ち", "つ", "て", "と",
		"さ", "し", "す", "せ", "そ",
		"ま", "み", "む", "め", "も",
	],
	3: [ // n-row + y-row + r-row + w-row + ん (16) -- completes all hiragana
		"な", "に", "ぬ", "ね", "の",
		"や", "ゆ", "よ",
		"ら", "り", "る", "れ", "ろ",
		"わ", "を", "ん",
	],
};

// Katakana: 2 levels of 20-21 chars
const KATAKANA_ROWS: Record<number, string[]> = {
	4: [ // vowels + k + s + t rows (20)
		"ア", "イ", "ウ", "エ", "オ",
		"カ", "キ", "ク", "ケ", "コ",
		"サ", "シ", "ス", "セ", "ソ",
		"タ", "チ", "ツ", "テ", "ト",
	],
	5: [ // n + h + m + y + r + w + ン rows (21)
		"ナ", "ニ", "ヌ", "ネ", "ノ",
		"ハ", "ヒ", "フ", "ヘ", "ホ",
		"マ", "ミ", "ム", "メ", "モ",
		"ヤ", "ユ", "ヨ",
		"ラ", "リ", "ル", "レ", "ロ",
		"ワ", "ヲ", "ン",
	],
};

// Dakuten: both scripts (40 chars) -> level 6
const DAKUTEN_CHARS = [
	"が", "ぎ", "ぐ", "げ", "ご", "ざ", "じ", "ず", "ぜ", "ぞ",
	"だ", "ぢ", "づ", "で", "ど", "ば", "び", "ぶ", "べ", "ぼ",
	"ガ", "ギ", "グ", "ゲ", "ゴ", "ザ", "ジ", "ズ", "ゼ", "ゾ",
	"ダ", "ヂ", "ヅ", "デ", "ド", "バ", "ビ", "ブ", "ベ", "ボ",
];

// Handakuten: both scripts (10 chars)
const HANDAKUTEN_CHARS = [
	"ぱ", "ぴ", "ぷ", "ぺ", "ぽ",
	"パ", "ピ", "プ", "ペ", "ポ",
];

// Yoon pt1: unvoiced hiragana + katakana (18 combos)
const YOON_PT1 = [
	"きゃ", "きゅ", "きょ", "しゃ", "しゅ", "しょ", "ちゃ", "ちゅ", "ちょ",
	"キャ", "キュ", "キョ", "シャ", "シュ", "ショ", "チャ", "チュ", "チョ",
];

// Yoon pt2: remaining combos (hiragana + katakana)
const YOON_PT2 = [
	"にゃ", "にゅ", "にょ", "ひゃ", "ひゅ", "ひょ", "みゃ", "みゅ", "みょ",
	"りゃ", "りゅ", "りょ", "ぎゃ", "ぎゅ", "ぎょ", "じゃ", "じゅ", "じょ",
	"びゃ", "びゅ", "びょ", "ぴゃ", "ぴゅ", "ぴょ",
	"ニャ", "ニュ", "ニョ", "ヒャ", "ヒュ", "ヒョ", "ミャ", "ミュ", "ミョ",
	"リャ", "リュ", "リョ", "ギャ", "ギュ", "ギョ", "ジャ", "ジュ", "ジョ",
	"ビャ", "ビュ", "ビョ", "ピャ", "ピュ", "ピョ",
];

// All kana assigned to specific levels (for cumulative set building)
const KANA_BY_LEVEL: Record<number, string[]> = {
	1: HIRAGANA_ROWS[1],
	2: HIRAGANA_ROWS[2],
	3: HIRAGANA_ROWS[3],
	4: KATAKANA_ROWS[4],
	5: KATAKANA_ROWS[5],
	6: DAKUTEN_CHARS,
	7: [...HANDAKUTEN_CHARS, ...YOON_PT1],
	8: YOON_PT2,
	// 9-10: extended/remaining kana (assigned by fallback)
};

interface DbHandle {
	execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
	select<T>(sql: string, params?: unknown[]): Promise<T>;
}

async function assignKanaLevels(db: DbHandle): Promise<void> {
	// Levels 1-8: assign specific kana characters (batch per level)
	for (const [levelStr, chars] of Object.entries(KANA_BY_LEVEL)) {
		const level = Number(levelStr);
		const placeholders = chars.map(() => "?").join(",");
		await db.execute(
			`UPDATE language_items SET language_level = ? WHERE content_type = 'kana' AND primary_text IN (${placeholders}) AND language_level IS NULL`,
			[level, ...chars],
		);
	}

	// Level 9: remaining unassigned kana (extended/rare variants)
	await db.execute(
		"UPDATE language_items SET language_level = 9 WHERE content_type = 'kana' AND language_level IS NULL",
	);
}

// Build cumulative kana set for a level (all kana learned by that level)
function getKanaSetForLevel(level: number): Set<string> {
	const set = new Set<string>();
	for (let l = 1; l <= Math.min(level, 9); l++) {
		const chars = KANA_BY_LEVEL[l];
		if (chars) chars.forEach((c) => set.add(c));
	}
	return set;
}

// Check if a string contains only characters from the given kana set
function isKanaOnly(text: string, kanaSet: Set<string>): boolean {
	for (const char of text) {
		if (kanaSet.has(char)) continue;
		// Allow common punctuation/whitespace
		if (/[\s・ー〜～。、！？!?,.\-()（）「」『』]/.test(char)) continue;
		// Allow small kana variants
		if (/[ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ]/.test(char)) continue;
		return false;
	}
	return true;
}

async function assignKanaOnlyVocab(db: DbHandle): Promise<void> {
	const items = await db.select<{ id: number; primary_text: string }[]>(
		`SELECT id, primary_text FROM language_items
		 WHERE language_level IS NULL
		 AND content_type IN ('vocabulary', 'conjugation')
		 ORDER BY COALESCE(frequency_rank, 999999), id`,
	);

	const assigned = new Set<number>();
	const levelCaps: Record<number, number> = {
		1: 15, 2: 20, 3: 25, 4: 20, 5: 20,
		6: 20, 7: 20, 8: 25, 9: 30, 10: 40,
	};

	for (let level = 1; level <= 10; level++) {
		const kanaSet = getKanaSetForLevel(level);
		const ids: number[] = [];
		const cap = levelCaps[level];

		for (const item of items) {
			if (assigned.has(item.id)) continue;
			if (ids.length >= cap) break;
			if (item.primary_text.length === 0) continue;

			if (isKanaOnly(item.primary_text, kanaSet)) {
				ids.push(item.id);
				assigned.add(item.id);
			}
		}

		if (ids.length > 0) {
			const placeholders = ids.map(() => "?").join(",");
			await db.execute(
				`UPDATE language_items SET language_level = ? WHERE id IN (${placeholders})`,
				[level, ...ids],
			);
		}
	}
}

async function assignGrammarAndN5Vocab(db: DbHandle): Promise<void> {
	const grammarMapping: [string, number][] = [
		["grammar-copula", 11],
		["grammar-particles", 12],
		["grammar-adjectives", 13],
		["grammar-verb-basics", 14],
		["grammar-negative-verbs", 14],
		["grammar-past-tense", 15],
		["grammar-verb-particles", 16],
		["grammar-transitivity", 17],
		["grammar-clauses", 17],
		["grammar-noun-particles", 18],
		["grammar-adverbs-gobi", 19],
		["grammar-supplemental", 20],
	];

	for (const [group, level] of grammarMapping) {
		await db.execute(
			"UPDATE language_items SET language_level = ? WHERE content_type = 'grammar' AND lesson_group = ? AND language_level IS NULL",
			[level, group],
		);
	}

	const vocabMapping: [string, number][] = [
		["vocab-pronouns", 11],
		["vocab-numbers", 11],
		["vocab-days", 12],
		["vocab-months", 12],
		["vocab-hours", 13],
		["vocab-minutes", 13],
		["vocab-day-numbers", 14],
		["vocab-hundreds", 14],
		["vocab-thousands", 15],
		["vocab-year-students", 15],
		["vocab-age", 16],
		["vocab-people-counters", 16],
		["vocab-seasons", 16],
		["vocab-family", 17],
		["vocab-places", 17],
	];

	for (const [group, level] of vocabMapping) {
		await db.execute(
			"UPDATE language_items SET language_level = ? WHERE content_type = 'vocabulary' AND lesson_group = ? AND language_level IS NULL",
			[level, group],
		);
	}

	await distributeItems(db, "content_type = 'conjugation' AND language_level IS NULL", 14, 18);
	await distributeItems(db, "content_type = 'sentence' AND jlpt_level = 'N5' AND language_level IS NULL", 16, 20);
	await distributeItems(db, "content_type = 'vocabulary' AND jlpt_level = 'N5' AND language_level IS NULL", 11, 20);
	await distributeItems(db, "content_type = 'grammar' AND jlpt_level = 'N5' AND language_level IS NULL", 11, 20);
}

async function assignByJlptTier(
	db: DbHandle,
	jlptLevel: string,
	startLevel: number,
	endLevel: number,
): Promise<void> {
	await distributeItems(db, `content_type = 'grammar' AND jlpt_level = '${jlptLevel}' AND language_level IS NULL`, startLevel, endLevel);
	await distributeItems(db, `content_type = 'vocabulary' AND jlpt_level = '${jlptLevel}' AND language_level IS NULL`, startLevel, endLevel);
	await distributeItems(db, `content_type = 'sentence' AND jlpt_level = '${jlptLevel}' AND language_level IS NULL`, startLevel, endLevel);
}

async function assignN1AndUntagged(db: DbHandle): Promise<void> {
	await assignByJlptTier(db, "N1", 51, 60);
	await distributeItems(db, "content_type = 'grammar' AND jlpt_level IS NULL AND language_level IS NULL", 51, 60);
	await distributeItems(db, "content_type = 'vocabulary' AND jlpt_level IS NULL AND language_level IS NULL", 51, 60);
	await distributeItems(db, "content_type = 'sentence' AND jlpt_level IS NULL AND language_level IS NULL", 51, 60);
}

async function distributeItems(
	db: DbHandle,
	whereClause: string,
	startLevel: number,
	endLevel: number,
): Promise<void> {
	const items = await db.select<{ id: number }[]>(
		`SELECT id FROM language_items WHERE ${whereClause} ORDER BY COALESCE(frequency_rank, 999999), id`,
	);
	if (items.length === 0) return;

	const levelCount = endLevel - startLevel + 1;
	const perLevel = Math.ceil(items.length / levelCount);

	// Group IDs by target level, then batch update
	const levelBuckets = new Map<number, number[]>();
	for (let i = 0; i < items.length; i++) {
		const level = startLevel + Math.min(Math.floor(i / perLevel), levelCount - 1);
		const bucket = levelBuckets.get(level) ?? [];
		bucket.push(items[i].id);
		levelBuckets.set(level, bucket);
	}

	for (const [level, ids] of levelBuckets) {
		// Batch in chunks of 500 to stay within SQLite variable limits
		for (let i = 0; i < ids.length; i += 500) {
			const chunk = ids.slice(i, i + 500);
			const placeholders = chunk.map(() => "?").join(",");
			await db.execute(
				`UPDATE language_items SET language_level = ? WHERE id IN (${placeholders})`,
				[level, ...chunk],
			);
		}
	}
}

/**
 * If no language items are unlocked yet, auto-unlock level 1 KANA only.
 * Vocab stays locked until kana lessons are completed.
 */
async function bootstrapLevel1(db: DbHandle): Promise<void> {
	const unlocked = await db.select<{ cnt: number }[]>(
		"SELECT COUNT(*) as cnt FROM language_items WHERE srs_stage > 0",
	);
	if (unlocked[0].cnt > 0) return; // User has already progressed

	// Only unlock kana in level 1 -- vocab unlocks after kana lessons are done
	await db.execute(
		`UPDATE language_items
		 SET srs_stage = 1, unlocked_at = datetime('now')
		 WHERE language_level = 1 AND srs_stage = 0 AND content_type = 'kana'`,
	);
	console.log("[language-levels] Auto-unlocked level 1 kana.");
}

// Kanji unicode range: CJK Unified Ideographs
const KANJI_MIN = 0x4E00;
const KANJI_MAX = 0x9FFF;

function extractKanji(text: string): string[] {
	const kanji = new Set<string>();
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (code >= KANJI_MIN && code <= KANJI_MAX) {
			kanji.add(char);
		}
	}
	return [...kanji];
}

/**
 * Pre-compute prerequisite_keys for sentences based on kanji in their text.
 * Each kanji character becomes a "kanji:<char>" prerequisite key.
 * Sentences without kanji get empty prerequisites (unlock with level).
 */
async function computeSentencePrerequisites(db: DbHandle): Promise<void> {
	const sentences = await db.select<{ id: number; primary_text: string; sentence_ja: string | null }[]>(
		`SELECT id, primary_text, sentence_ja FROM language_items
		 WHERE content_type = 'sentence' AND language_level IS NOT NULL`,
	);

	// Batch updates by prerequisite key content
	const updates: { id: number; keys: string }[] = [];

	for (const sentence of sentences) {
		const text = sentence.sentence_ja ?? sentence.primary_text;
		const kanjiChars = extractKanji(text);

		if (kanjiChars.length === 0) {
			updates.push({ id: sentence.id, keys: "[]" });
		} else {
			const prereqKeys = kanjiChars.map((k) => `kanji:${k}`);
			updates.push({ id: sentence.id, keys: JSON.stringify(prereqKeys) });
		}
	}

	// Batch update in chunks
	for (let i = 0; i < updates.length; i += 200) {
		const chunk = updates.slice(i, i + 200);
		for (const { id, keys } of chunk) {
			await db.execute(
				"UPDATE language_items SET prerequisite_keys = ? WHERE id = ?",
				[keys, id],
			);
		}
	}

	console.log(`[language-levels] Computed prerequisites for ${sentences.length} sentences.`);
}
