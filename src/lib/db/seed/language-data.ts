import { getKanaGroupInfo } from "$lib/data/kana-groups";
import type { QueryResult } from "../database";
import { getDb, safeQuery } from "../database";

interface LanguageItem {
	content_type: string;
	item_key: string;
	primary_text: string;
	reading?: string;
	meaning?: string;
	part_of_speech?: string;
	pitch_accent?: string;
	frequency_rank?: number;
	audio?: string[];
	formation?: string;
	explanation?: string;
	sentence_ja?: string;
	sentence_en?: string;
	sentence_reading?: string;
	sentence_audio?: string[];
	romaji?: string;
	stroke_order?: string;
	conjugation_forms?: Record<string, string>;
	verb_group?: string;
	example_sentences?: { ja: string; en: string; reading?: string }[];
	related_items?: string[];
	images?: string[];
	context_notes?: string;
	source_decks?: string[];
	jlpt_level?: string;
	wk_level?: number;
	tags?: string[];
	prerequisite_keys?: string[];
	mnemonic?: string;
}

const CONTENT_TYPE_MAP: Record<string, string> = {
	"vocabulary.json": "vocabulary",
	"grammar.json": "grammar",
	"sentence.json": "sentence",
	"kana.json": "kana",
	"conjugation.json": "conjugation",
};

const BATCH_SIZE = 100;

async function isLanguageSeeded(): Promise<QueryResult<boolean>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ value: string }[]>(
			"SELECT value FROM settings WHERE key = 'language_seeded_v2'",
		);
		return rows.length > 0 && rows[0].value === "true";
	});
}

async function markLanguageSeeded(): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			"INSERT OR REPLACE INTO settings (key, value) VALUES ('language_seeded_v2', 'true')",
		);
	});
}

function jsonOrNull(value: unknown): string | null {
	if (value == null) return null;
	if (Array.isArray(value) && value.length === 0) return null;
	if (typeof value === "object" && Object.keys(value).length === 0) return null;
	return JSON.stringify(value);
}

function insertItem(item: LanguageItem, contentType: string): { sql: string; params: unknown[] } {
	// Determine lesson group/order for kana items
	let lessonGroup: string | null = null;
	let lessonOrder: number | null = null;
	if (contentType === "kana") {
		const groupInfo = getKanaGroupInfo(item.romaji, item.primary_text);
		if (groupInfo) {
			lessonGroup = groupInfo.group;
			lessonOrder = groupInfo.order;
		}
	}

	const sql = `INSERT OR IGNORE INTO language_items (
		content_type, item_key, primary_text, reading, meaning,
		part_of_speech, pitch_accent, frequency_rank, audio_file,
		formation, explanation,
		sentence_ja, sentence_en, sentence_reading, sentence_audio,
		romaji, stroke_order,
		conjugation_forms, verb_group,
		example_sentences, related_items, images, context_notes, source_decks,
		jlpt_level, wk_level, tags,
		prerequisite_keys,
		lesson_group, lesson_order
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

	const params = [
		contentType,
		item.item_key,
		item.primary_text,
		item.reading ?? null,
		item.meaning ?? null,
		item.part_of_speech ?? null,
		item.pitch_accent ?? null,
		item.frequency_rank ?? null,
		jsonOrNull(item.audio),
		item.formation ?? null,
		item.explanation ?? null,
		item.sentence_ja ?? null,
		item.sentence_en ?? null,
		item.sentence_reading ?? null,
		jsonOrNull(item.sentence_audio),
		item.romaji ?? null,
		item.stroke_order ?? null,
		jsonOrNull(item.conjugation_forms),
		item.verb_group ?? null,
		jsonOrNull(item.example_sentences),
		jsonOrNull(item.related_items),
		jsonOrNull(item.images),
		item.context_notes ?? null,
		jsonOrNull(item.source_decks),
		item.jlpt_level ?? null,
		item.wk_level ?? null,
		jsonOrNull(item.tags),
		jsonOrNull(item.prerequisite_keys),
		lessonGroup,
		lessonOrder,
	];

	return { sql, params };
}

export async function seedLanguageData(): Promise<void> {
	const seeded = await isLanguageSeeded();
	if (seeded.ok && seeded.data) return;

	console.log("Seeding language data from merged deck export...");

	const db = await getDb();

	// Clear old data for clean re-seed (vocab data was cleaned in v2)
	await db.execute("DELETE FROM language_review_log");
	await db.execute("DELETE FROM language_items");
	console.log("[Seed] Cleared old language data for fresh import.");

	let totalInserted = 0;

	for (const [filename, contentType] of Object.entries(CONTENT_TYPE_MAP)) {
		let items: LanguageItem[];

		try {
			const res = await fetch(`/data/language/${filename}`);
			if (!res.ok) {
				console.warn(`Language data file not found: ${filename}, skipping`);
				continue;
			}
			items = await res.json();
		} catch (e) {
			console.warn(`Failed to load ${filename}:`, e);
			continue;
		}

		console.log(`Seeding ${items.length} ${contentType} items...`);

		// Batch insert in groups of BATCH_SIZE, wrapped in transaction for performance
		await db.execute("BEGIN");
		try {
			for (let i = 0; i < items.length; i += BATCH_SIZE) {
				const batch = items.slice(i, i + BATCH_SIZE);
				for (const item of batch) {
					const { sql, params } = insertItem(item, contentType);
					await db.execute(sql, params);
				}
			}
			await db.execute("COMMIT");
			totalInserted += items.length;
		} catch (e) {
			await db.execute("ROLLBACK").catch(() => {});
			console.error(`[Seed] Failed to seed ${contentType}:`, e);
		}
	}

	await markLanguageSeeded();
	console.log(`Language seed complete: ${totalInserted} items inserted`);
}

/**
 * Apply vocab topic ordering that migration v15 couldn't do
 * (migration runs before seed, so vocab items don't exist yet).
 * Idempotent: only updates items with lesson_group IS NULL.
 */
export async function applyVocabTopicOrdering(): Promise<void> {
	const db = await getDb();
	const rows = await db.select<{ value: string }[]>(
		"SELECT value FROM settings WHERE key = 'vocab_topics_v1'",
	);
	if (rows.length > 0) return;

	console.log("Applying N5 vocabulary topic ordering...");

	const updates = [
		`UPDATE language_items SET lesson_group = 'vocab-pronouns', lesson_order = 1
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND LOWER(part_of_speech) LIKE '%pronoun%'`,

		`UPDATE language_items SET lesson_group = 'vocab-numbers', lesson_order = 2
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND LOWER(part_of_speech) LIKE '%numeral%'`,

		`UPDATE language_items SET lesson_group = 'vocab-days', lesson_order = 3
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND TRIM(meaning) IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')`,

		`UPDATE language_items SET lesson_group = 'vocab-months', lesson_order = 4
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND TRIM(meaning) IN ('January','February','March','April','May','June','July','August','September','October','November','December')`,

		`UPDATE language_items SET lesson_group = 'vocab-hours', lesson_order = 5
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND LOWER(meaning) LIKE '%o''clock%'`,

		`UPDATE language_items SET lesson_group = 'vocab-minutes', lesson_order = 6
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND LOWER(meaning) LIKE '%minute%'`,

		`UPDATE language_items SET lesson_group = 'vocab-day-numbers', lesson_order = 7
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (meaning LIKE '%First Day%' OR meaning LIKE '%Day One%'
			OR meaning LIKE '%Second Day%' OR meaning LIKE '%Day Two%'
			OR meaning LIKE '%Third Day%' OR meaning LIKE '%Day Three%'
			OR meaning LIKE '%Fourth Day%' OR meaning LIKE '%Day Four%'
			OR meaning LIKE '%Fifth Day%' OR meaning LIKE '%Day Five%'
			OR meaning LIKE '%Sixth Day%' OR meaning LIKE '%Day Six%'
			OR meaning LIKE '%Seventh Day%' OR meaning LIKE '%Day Seven%'
			OR meaning LIKE '%Eighth Day%' OR meaning LIKE '%Day Eight%'
			OR meaning LIKE '%Ninth Day%' OR meaning LIKE '%Day Nine%'
			OR meaning LIKE '%Tenth Day%' OR meaning LIKE '%Day Ten%'
			OR meaning LIKE '%day 1%' OR meaning LIKE '%day 11%')`,

		`UPDATE language_items SET lesson_group = 'vocab-hundreds', lesson_order = 8
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND meaning LIKE '%Hundred%'`,

		`UPDATE language_items SET lesson_group = 'vocab-thousands', lesson_order = 9
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (meaning LIKE '%Thousand%' OR meaning LIKE '%thousand%')`,

		`UPDATE language_items SET lesson_group = 'vocab-year-students', lesson_order = 10
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND LOWER(meaning) LIKE '%year student%'`,

		`UPDATE language_items SET lesson_group = 'vocab-age', lesson_order = 11
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND LOWER(meaning) LIKE '%year%old%'`,

		`UPDATE language_items SET lesson_group = 'vocab-people-counters', lesson_order = 12
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (meaning LIKE '%Persons%' OR (meaning LIKE '%People%' AND meaning LIKE '%Person%'))`,

		`UPDATE language_items SET lesson_group = 'vocab-seasons', lesson_order = 13
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND LOWER(TRIM(meaning)) IN ('spring','summer','fall','winter','autumn')`,

		`UPDATE language_items SET lesson_group = 'vocab-family', lesson_order = 14
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (item_key IN ('vocab:家族','vocab:兄弟','vocab:両親')
			OR item_key LIKE 'vocab:お父%' OR item_key LIKE 'vocab:お母%'
			OR item_key LIKE 'vocab:お兄%' OR item_key LIKE 'vocab:お姉%'
			OR item_key LIKE 'vocab:おじい%' OR item_key LIKE 'vocab:おばあ%'
			OR item_key LIKE 'vocab:赤ちゃん%'
			OR LOWER(TRIM(meaning)) IN ('family','older brother','older sister',
				'younger brother','younger sister','child, kid',
				'grandfather','grandmother','daughter','husband','wife','baby','baby (colloquial)')
			OR meaning LIKE '(speaker''s) father%' OR meaning LIKE '(speaker''s) mother%')`,

		`UPDATE language_items SET lesson_group = 'vocab-places', lesson_order = 15
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND LOWER(part_of_speech) LIKE '%proper noun%'`,
	];

	await db.execute("BEGIN");
	try {
		for (const stmt of updates) {
			await db.execute(stmt);
		}
		await db.execute(
			"INSERT OR REPLACE INTO settings (key, value) VALUES ('vocab_topics_v1', 'true')",
		);
		await db.execute("COMMIT");
		console.log("N5 vocabulary topic ordering applied");
	} catch (e) {
		await db.execute("ROLLBACK").catch(() => {});
		console.error("[VocabTopics] Failed:", e);
	}
}

/** Helper: run a batch of UPDATEs in a transaction, gated by a settings flag */
async function runFixup(flagKey: string, label: string, updates: string[]): Promise<void> {
	const db = await getDb();
	const rows = await db.select<{ value: string }[]>(
		`SELECT value FROM settings WHERE key = '${flagKey}'`,
	);
	if (rows.length > 0) return;

	console.log(`${label}...`);
	await db.execute("BEGIN");
	try {
		for (const stmt of updates) {
			await db.execute(stmt);
		}
		await db.execute(`INSERT OR REPLACE INTO settings (key, value) VALUES ('${flagKey}', 'true')`);
		await db.execute("COMMIT");
		console.log(`${label} complete`);
	} catch (e) {
		await db.execute("ROLLBACK").catch(() => {});
		console.error(`[${label}] Failed:`, e);
	}
}

/**
 * Step 1: Assign part_of_speech to vocab items that have NULL.
 * Extracts PoS from embedded JMdict data in meaning field, pattern matching, and defaults.
 */
export async function applyVocabPartOfSpeech(): Promise<void> {
	return runFixup("vocab_pos_v1", "Applying vocab part-of-speech", [
		// Godan verbs (embedded JMdict)
		`UPDATE language_items SET part_of_speech = 'verb'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND meaning LIKE '%Godan verb%'`,

		// Ichidan verbs (embedded JMdict)
		`UPDATE language_items SET part_of_speech = 'verb'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND meaning LIKE '%Ichidan verb%'`,

		// Suru verbs (embedded JMdict "Takes the aux. verb")
		`UPDATE language_items SET part_of_speech = 'noun\nする verb'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND meaning LIKE '%Takes the aux. verb%'`,

		// Verbs by "to " prefix in meaning (first line)
		`UPDATE language_items SET part_of_speech = 'verb'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND LOWER(TRIM(meaning)) LIKE 'to %'`,

		// Na-adjectives from inline annotation
		`UPDATE language_items SET part_of_speech = 'な adjective'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND meaning LIKE '%(na-adj)%'`,

		// Na-adjectives from embedded JMdict
		`UPDATE language_items SET part_of_speech = 'な adjective'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND meaning LIKE '%Na-adjective%'`,

		// I-adjectives from embedded JMdict
		`UPDATE language_items SET part_of_speech = 'い adjective'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND meaning LIKE '%I-adjective%'`,

		// Adverbs (embedded JMdict)
		`UPDATE language_items SET part_of_speech = 'adverb'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND meaning LIKE '%Adverb%'`,

		// Counters
		`UPDATE language_items SET part_of_speech = 'counter'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND meaning LIKE '%Counter%'`,

		// Expressions
		`UPDATE language_items SET part_of_speech = 'expression'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND (meaning LIKE '%Expression%' OR meaning LIKE '%Interjection%')`,

		// Pronouns (embedded JMdict)
		`UPDATE language_items SET part_of_speech = 'pronoun'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND meaning LIKE '%Pronoun%'`,

		// Common nouns (embedded JMdict "Common noun")
		`UPDATE language_items SET part_of_speech = 'noun'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL
		AND meaning LIKE '%Common noun%'`,

		// Default: everything remaining is a noun
		`UPDATE language_items SET part_of_speech = 'noun'
		WHERE content_type = 'vocabulary' AND part_of_speech IS NULL`,
	]);
}

/**
 * Step 2: Expanded vocab topic groups (16-32) for ungrouped N5 items.
 * Runs after v1 topics (1-15). Semantic keyword matching on meaning field.
 */
export async function applyVocabTopicOrderingV2(): Promise<void> {
	return runFixup("vocab_topics_v2", "Applying expanded vocab topics", [
		// 16: Greetings & Expressions
		`UPDATE language_items SET lesson_group = 'vocab-greetings', lesson_order = 16
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(part_of_speech) LIKE '%expression%'
			OR LOWER(meaning) LIKE '%hello%'
			OR LOWER(meaning) LIKE '%goodbye%'
			OR LOWER(meaning) LIKE '%good morning%'
			OR LOWER(meaning) LIKE '%good evening%'
			OR LOWER(meaning) LIKE '%good night%'
			OR LOWER(meaning) LIKE '%thank you%'
			OR LOWER(meaning) LIKE '%thanks%'
			OR LOWER(meaning) LIKE '%sorry%'
			OR LOWER(meaning) LIKE '%excuse me%'
			OR LOWER(meaning) LIKE '%welcome%'
			OR LOWER(meaning) LIKE '%congratulation%'
			OR LOWER(meaning) LIKE '%greeting%'
			OR LOWER(meaning) LIKE '%nice to meet%'
			OR LOWER(meaning) LIKE '%please%take care%')`,

		// 17: Question Words
		`UPDATE language_items SET lesson_group = 'vocab-question-words', lesson_order = 17
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND LENGTH(primary_text) <= 6
		AND (LOWER(TRIM(meaning)) LIKE 'who%'
			OR LOWER(TRIM(meaning)) LIKE 'what%'
			OR LOWER(TRIM(meaning)) LIKE 'where%'
			OR LOWER(TRIM(meaning)) LIKE 'when%'
			OR LOWER(TRIM(meaning)) LIKE 'why%'
			OR LOWER(TRIM(meaning)) LIKE 'how%'
			OR LOWER(TRIM(meaning)) LIKE 'which%')`,

		// 18: Food & Drink
		`UPDATE language_items SET lesson_group = 'vocab-food', lesson_order = 18
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%rice%'
			OR LOWER(meaning) LIKE '%tea%'
			OR LOWER(meaning) LIKE '%meat%'
			OR LOWER(meaning) LIKE '%fish%'
			OR LOWER(meaning) LIKE '%egg%'
			OR LOWER(meaning) LIKE '%vegetable%'
			OR LOWER(meaning) LIKE '%fruit%'
			OR LOWER(meaning) LIKE '%coffee%'
			OR LOWER(meaning) LIKE '%bread%'
			OR LOWER(meaning) LIKE '%lunch%'
			OR LOWER(meaning) LIKE '%dinner%'
			OR LOWER(meaning) LIKE '%breakfast%'
			OR LOWER(meaning) LIKE '%meal%'
			OR LOWER(meaning) LIKE '%food%'
			OR LOWER(meaning) LIKE '%steak%'
			OR LOWER(meaning) LIKE '%soup%'
			OR LOWER(meaning) LIKE '%cake%'
			OR LOWER(meaning) LIKE '%sugar%'
			OR LOWER(meaning) LIKE '%salt%'
			OR LOWER(meaning) LIKE '%beer%'
			OR LOWER(meaning) LIKE '%wine%'
			OR LOWER(meaning) LIKE '%juice%'
			OR LOWER(meaning) LIKE '%milk%'
			OR LOWER(meaning) LIKE '%water%'
			OR LOWER(meaning) LIKE '%cooking%'
			OR LOWER(meaning) LIKE '%noodle%'
			OR LOWER(meaning) LIKE '%sushi%'
			OR LOWER(meaning) LIKE '%ramen%'
			OR LOWER(meaning) LIKE '%butter%'
			OR LOWER(meaning) LIKE '%cheese%'
			OR LOWER(meaning) LIKE '%pizza%'
			OR LOWER(meaning) LIKE '%chocolate%'
			OR LOWER(meaning) LIKE '%snack%'
			OR LOWER(meaning) LIKE '%bento%'
			OR LOWER(meaning) LIKE '%miso%'
			OR LOWER(meaning) LIKE '%soy sauce%'
			OR LOWER(meaning) LIKE '%tofu%'
			OR LOWER(meaning) LIKE '%chopstick%')`,

		// 19: Body & Health
		`UPDATE language_items SET lesson_group = 'vocab-body', lesson_order = 19
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%hand%'
			OR LOWER(meaning) LIKE '%foot%'
			OR LOWER(meaning) LIKE '%eye%'
			OR LOWER(meaning) LIKE '%head%'
			OR LOWER(meaning) LIKE '%face%'
			OR LOWER(meaning) LIKE '%mouth%'
			OR LOWER(meaning) LIKE '%ear%'
			OR LOWER(meaning) LIKE '%nose%'
			OR LOWER(meaning) LIKE '%tooth%'
			OR LOWER(meaning) LIKE '%hair%'
			OR LOWER(meaning) LIKE '%finger%'
			OR LOWER(meaning) LIKE '%heart%'
			OR LOWER(meaning) LIKE '%stomach%'
			OR LOWER(meaning) LIKE '%body%'
			OR LOWER(meaning) LIKE '%leg%'
			OR LOWER(meaning) LIKE '%arm%'
			OR LOWER(meaning) LIKE '%neck%'
			OR LOWER(meaning) LIKE '%shoulder%'
			OR LOWER(meaning) LIKE '%knee%'
			OR LOWER(meaning) LIKE '%back%'
			OR LOWER(meaning) LIKE '%chest%'
			OR LOWER(meaning) LIKE '%skin%'
			OR LOWER(meaning) LIKE '%bone%'
			OR LOWER(meaning) LIKE '%blood%')`,

		// 20: School & Education
		`UPDATE language_items SET lesson_group = 'vocab-school', lesson_order = 20
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%school%'
			OR LOWER(meaning) LIKE '%student%'
			OR LOWER(meaning) LIKE '%teacher%'
			OR LOWER(meaning) LIKE '%class%'
			OR LOWER(meaning) LIKE '%study%'
			OR LOWER(meaning) LIKE '%learn%'
			OR LOWER(meaning) LIKE '%test%'
			OR LOWER(meaning) LIKE '%exam%'
			OR LOWER(meaning) LIKE '%university%'
			OR LOWER(meaning) LIKE '%college%'
			OR LOWER(meaning) LIKE '%lesson%'
			OR LOWER(meaning) LIKE '%homework%'
			OR LOWER(meaning) LIKE '%textbook%'
			OR LOWER(meaning) LIKE '%library%'
			OR LOWER(meaning) LIKE '%education%'
			OR LOWER(meaning) LIKE '%grade%'
			OR LOWER(meaning) LIKE '%notebook%'
			OR LOWER(meaning) LIKE '%pencil%'
			OR LOWER(meaning) LIKE '%pen %'
			OR LOWER(meaning) LIKE '%eraser%'
			OR LOWER(meaning) LIKE '%paper%'
			OR LOWER(meaning) LIKE '%book%'
			OR LOWER(meaning) LIKE '%read%'
			OR LOWER(meaning) LIKE '%write%'
			OR LOWER(meaning) LIKE '%kanji%'
			OR LOWER(meaning) LIKE '%language%'
			OR LOWER(meaning) LIKE '%math%'
			OR LOWER(meaning) LIKE '%science%'
			OR LOWER(meaning) LIKE '%history%')`,

		// 21: House & Home
		`UPDATE language_items SET lesson_group = 'vocab-house', lesson_order = 21
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%house%'
			OR LOWER(meaning) LIKE '%home%'
			OR LOWER(meaning) LIKE '%room%'
			OR LOWER(meaning) LIKE '%door%'
			OR LOWER(meaning) LIKE '%window%'
			OR LOWER(meaning) LIKE '%kitchen%'
			OR LOWER(meaning) LIKE '%bed%'
			OR LOWER(meaning) LIKE '%table%'
			OR LOWER(meaning) LIKE '%chair%'
			OR LOWER(meaning) LIKE '%floor%'
			OR LOWER(meaning) LIKE '%wall%'
			OR LOWER(meaning) LIKE '%garden%'
			OR LOWER(meaning) LIKE '%apartment%'
			OR LOWER(meaning) LIKE '%bathroom%'
			OR LOWER(meaning) LIKE '%toilet%'
			OR LOWER(meaning) LIKE '%shower%'
			OR LOWER(meaning) LIKE '%stairs%'
			OR LOWER(meaning) LIKE '%roof%'
			OR LOWER(meaning) LIKE '%furniture%'
			OR LOWER(meaning) LIKE '%living room%'
			OR LOWER(meaning) LIKE '%bedroom%')`,

		// 22: Transportation
		`UPDATE language_items SET lesson_group = 'vocab-transport', lesson_order = 22
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%car %'
			OR LOWER(meaning) LIKE '%bus%'
			OR LOWER(meaning) LIKE '%train%'
			OR LOWER(meaning) LIKE '%airplane%'
			OR LOWER(meaning) LIKE '%aeroplane%'
			OR LOWER(meaning) LIKE '%bicycle%'
			OR LOWER(meaning) LIKE '%bike%'
			OR LOWER(meaning) LIKE '%station%'
			OR LOWER(meaning) LIKE '%airport%'
			OR LOWER(meaning) LIKE '%road%'
			OR LOWER(meaning) LIKE '%driv%'
			OR LOWER(meaning) LIKE '%ticket%'
			OR LOWER(meaning) LIKE '%taxi%'
			OR LOWER(meaning) LIKE '%subway%'
			OR LOWER(meaning) LIKE '%ship%'
			OR LOWER(meaning) LIKE '%boat%'
			OR LOWER(meaning) LIKE '%ride%'
			OR LOWER(meaning) LIKE '%traffic%'
			OR LOWER(meaning) LIKE '%highway%'
			OR LOWER(meaning) LIKE '%crossing%'
			OR LOWER(meaning) LIKE '%turn%')`,

		// 23: Nature & Weather
		`UPDATE language_items SET lesson_group = 'vocab-nature', lesson_order = 23
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%rain%'
			OR LOWER(meaning) LIKE '%snow%'
			OR LOWER(meaning) LIKE '%wind%'
			OR LOWER(meaning) LIKE '%cloud%'
			OR LOWER(meaning) LIKE '%sky%'
			OR LOWER(meaning) LIKE '%sun%'
			OR LOWER(meaning) LIKE '%moon%'
			OR LOWER(meaning) LIKE '%star%'
			OR LOWER(meaning) LIKE '%mountain%'
			OR LOWER(meaning) LIKE '%river%'
			OR LOWER(meaning) LIKE '%sea%'
			OR LOWER(meaning) LIKE '%ocean%'
			OR LOWER(meaning) LIKE '%tree%'
			OR LOWER(meaning) LIKE '%flower%'
			OR LOWER(meaning) LIKE '%weather%'
			OR LOWER(meaning) LIKE '%forest%'
			OR LOWER(meaning) LIKE '%lake%'
			OR LOWER(meaning) LIKE '%island%'
			OR LOWER(meaning) LIKE '%earth%'
			OR LOWER(meaning) LIKE '%field%'
			OR LOWER(meaning) LIKE '%garden%'
			OR LOWER(meaning) LIKE '%season%'
			OR LOWER(meaning) LIKE '%typhoon%'
			OR LOWER(meaning) LIKE '%earthquake%'
			OR LOWER(meaning) LIKE '%temperature%')`,

		// 24: Clothing & Accessories
		`UPDATE language_items SET lesson_group = 'vocab-clothes', lesson_order = 24
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%clothes%'
			OR LOWER(meaning) LIKE '%shirt%'
			OR LOWER(meaning) LIKE '%shoe%'
			OR LOWER(meaning) LIKE '%hat%'
			OR LOWER(meaning) LIKE '%wear%'
			OR LOWER(meaning) LIKE '%coat%'
			OR LOWER(meaning) LIKE '%dress%'
			OR LOWER(meaning) LIKE '%skirt%'
			OR LOWER(meaning) LIKE '%pants%'
			OR LOWER(meaning) LIKE '%bag%'
			OR LOWER(meaning) LIKE '%umbrella%'
			OR LOWER(meaning) LIKE '%glasses%'
			OR LOWER(meaning) LIKE '%sock%'
			OR LOWER(meaning) LIKE '%jacket%'
			OR LOWER(meaning) LIKE '%uniform%'
			OR LOWER(meaning) LIKE '%necktie%'
			OR LOWER(meaning) LIKE '%ring%'
			OR LOWER(meaning) LIKE '%watch%'
			OR LOWER(meaning) LIKE '%wallet%')`,

		// 25: Colors
		`UPDATE language_items SET lesson_group = 'vocab-colors', lesson_order = 25
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(TRIM(meaning)) IN ('red','blue','green','yellow','white','black','brown','pink','purple','orange','grey','gray','color','colour')
			OR LOWER(meaning) LIKE '%color,%'
			OR LOWER(meaning) LIKE '%colour,%')`,

		// 26: Animals
		`UPDATE language_items SET lesson_group = 'vocab-animals', lesson_order = 26
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%dog%'
			OR LOWER(meaning) LIKE '%cat%'
			OR LOWER(meaning) LIKE '%bird%'
			OR LOWER(meaning) LIKE '%cow%'
			OR LOWER(meaning) LIKE '%horse%'
			OR LOWER(meaning) LIKE '%rabbit%'
			OR LOWER(meaning) LIKE '%bear%'
			OR LOWER(meaning) LIKE '%insect%'
			OR LOWER(meaning) LIKE '%animal%'
			OR LOWER(meaning) LIKE '%monkey%'
			OR LOWER(meaning) LIKE '%elephant%'
			OR LOWER(meaning) LIKE '%pig%'
			OR LOWER(meaning) LIKE '%mouse%'
			OR LOWER(meaning) LIKE '%snake%'
			OR LOWER(meaning) LIKE '%frog%'
			OR LOWER(meaning) LIKE '%turtle%'
			OR LOWER(meaning) LIKE '%pet%')`,

		// 27: Work & Office
		`UPDATE language_items SET lesson_group = 'vocab-work', lesson_order = 27
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%work%'
			OR LOWER(meaning) LIKE '%job%'
			OR LOWER(meaning) LIKE '%office%'
			OR LOWER(meaning) LIKE '%company%'
			OR LOWER(meaning) LIKE '%meeting%'
			OR LOWER(meaning) LIKE '%business%'
			OR LOWER(meaning) LIKE '%employee%'
			OR LOWER(meaning) LIKE '%bank%'
			OR LOWER(meaning) LIKE '%salary%'
			OR LOWER(meaning) LIKE '%boss%'
			OR LOWER(meaning) LIKE '%project%'
			OR LOWER(meaning) LIKE '%career%'
			OR LOWER(meaning) LIKE '%occupation%'
			OR LOWER(meaning) LIKE '%profession%')`,

		// 28: Places & Directions
		`UPDATE language_items SET lesson_group = 'vocab-location', lesson_order = 28
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%north%'
			OR LOWER(meaning) LIKE '%south%'
			OR LOWER(meaning) LIKE '%east%'
			OR LOWER(meaning) LIKE '%west%'
			OR LOWER(meaning) LIKE '% left%'
			OR LOWER(meaning) LIKE '% right%'
			OR LOWER(meaning) LIKE '%front%'
			OR LOWER(meaning) LIKE '%behind%'
			OR LOWER(meaning) LIKE '%above%'
			OR LOWER(meaning) LIKE '%below%'
			OR LOWER(meaning) LIKE '%inside%'
			OR LOWER(meaning) LIKE '%outside%'
			OR LOWER(meaning) LIKE '%near%'
			OR LOWER(meaning) LIKE '%far %'
			OR LOWER(meaning) LIKE '%map%'
			OR LOWER(meaning) LIKE '%park%'
			OR LOWER(meaning) LIKE '%store%'
			OR LOWER(meaning) LIKE '%shop%'
			OR LOWER(meaning) LIKE '%town%'
			OR LOWER(meaning) LIKE '%city%'
			OR LOWER(meaning) LIKE '%village%'
			OR LOWER(meaning) LIKE '%area%'
			OR LOWER(meaning) LIKE '%place%'
			OR LOWER(meaning) LIKE '%temple%'
			OR LOWER(meaning) LIKE '%shrine%'
			OR LOWER(meaning) LIKE '%bridge%'
			OR LOWER(meaning) LIKE '%street%'
			OR LOWER(meaning) LIKE '%corner%'
			OR LOWER(meaning) LIKE '%entrance%'
			OR LOWER(meaning) LIKE '%exit%')`,

		// 29: Time Expressions
		`UPDATE language_items SET lesson_group = 'vocab-time', lesson_order = 29
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%today%'
			OR LOWER(meaning) LIKE '%tomorrow%'
			OR LOWER(meaning) LIKE '%yesterday%'
			OR LOWER(meaning) LIKE '%morning%'
			OR LOWER(meaning) LIKE '%afternoon%'
			OR LOWER(meaning) LIKE '%evening%'
			OR LOWER(meaning) LIKE '%night%'
			OR LOWER(meaning) LIKE '%now%'
			OR LOWER(meaning) LIKE '%later%'
			OR LOWER(meaning) LIKE '%always%'
			OR LOWER(meaning) LIKE '%sometimes%'
			OR LOWER(meaning) LIKE '%often%'
			OR LOWER(meaning) LIKE '%usually%'
			OR LOWER(meaning) LIKE '%early%'
			OR LOWER(meaning) LIKE '%late%'
			OR LOWER(meaning) LIKE '%soon%'
			OR LOWER(meaning) LIKE '%ago%'
			OR LOWER(meaning) LIKE '%last year%'
			OR LOWER(meaning) LIKE '%next year%'
			OR LOWER(meaning) LIKE '%this year%'
			OR LOWER(meaning) LIKE '%last week%'
			OR LOWER(meaning) LIKE '%next week%'
			OR LOWER(meaning) LIKE '%this week%'
			OR LOWER(meaning) LIKE '%weekend%'
			OR LOWER(meaning) LIKE '%holiday%'
			OR LOWER(meaning) LIKE '%vacation%'
			OR LOWER(meaning) LIKE '%birthday%')`,

		// 30: Common Verbs (catch-all for remaining verbs)
		`UPDATE language_items SET lesson_group = 'vocab-actions', lesson_order = 30
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND LOWER(part_of_speech) LIKE '%verb%'`,

		// 31: Descriptors (catch-all for remaining adjectives/adverbs)
		`UPDATE language_items SET lesson_group = 'vocab-descriptors', lesson_order = 31
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
		AND (LOWER(part_of_speech) LIKE '%adjective%'
			OR LOWER(part_of_speech) LIKE '%adverb%')`,

		// 32: General (catch-all for everything remaining)
		`UPDATE language_items SET lesson_group = 'vocab-general', lesson_order = 32
		WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL`,
	]);
}

/**
 * Step 3: Assign grammar items to Tae Kim groups.
 * Covers 603 N5 pattern cards, 64 quiz questions, 181 example sentences.
 */
export async function applyGrammarGroupOrdering(): Promise<void> {
	return runFixup("grammar_groups_v1", "Applying grammar group ordering", [
		// --- Priority order: most specific grammar concept first ---

		// Transitivity (order 8)
		`UPDATE language_items SET lesson_group = 'grammar-transitivity', lesson_order = 8
		WHERE content_type = 'grammar' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%transitive%'
			OR LOWER(meaning) LIKE '%intransitive%'
			OR LOWER(primary_text) LIKE '%transitive%'
			OR LOWER(primary_text) LIKE '%intransitive%')`,

		// Clauses (order 9)
		`UPDATE language_items SET lesson_group = 'grammar-clauses', lesson_order = 9
		WHERE content_type = 'grammar' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%relative clause%'
			OR LOWER(meaning) LIKE '%nominalization%'
			OR LOWER(meaning) LIKE '%subordinate%'
			OR LOWER(meaning) LIKE '%explanatory%'
			OR LOWER(primary_text) LIKE '%relative clause%'
			OR primary_text LIKE '%ば%'
			OR primary_text LIKE '%たら%'
			OR primary_text LIKE '%なら%'
			OR primary_text LIKE '%させ%')`,

		// Adverbs & sentence-enders (order 11)
		`UPDATE language_items SET lesson_group = 'grammar-adverbs-gobi', lesson_order = 11
		WHERE content_type = 'grammar' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%adverb%'
			OR LOWER(meaning) LIKE '%sentence end%'
			OR LOWER(meaning) LIKE '%exclamat%'
			OR LOWER(primary_text) LIKE '%adverb%'
			OR primary_text LIKE '%〜ね%'
			OR primary_text LIKE '%〜よ%'
			OR primary_text LIKE '%〜わ%'
			OR primary_text LIKE '%〜ぞ%'
			OR primary_text LIKE '%〜ぜ%'
			OR primary_text LIKE '%~ね%'
			OR primary_text LIKE '%~よ%')`,

		// Noun-related particles (order 10)
		`UPDATE language_items SET lesson_group = 'grammar-noun-particles', lesson_order = 10
		WHERE content_type = 'grammar' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%noun modif%'
			OR primary_text LIKE '%〜の%'
			OR primary_text LIKE '%〜こと%'
			OR primary_text LIKE '%〜もの%'
			OR primary_text LIKE '%~の%'
			OR primary_text LIKE '%~こと%'
			OR primary_text LIKE '%~もの%')`,

		// Past tense (order 6)
		`UPDATE language_items SET lesson_group = 'grammar-past-tense', lesson_order = 6
		WHERE content_type = 'grammar' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%past tense%'
			OR LOWER(meaning) LIKE '%past form%'
			OR LOWER(primary_text) LIKE '%past%'
			OR primary_text LIKE '%〜た%'
			OR primary_text LIKE '%〜だった%'
			OR primary_text LIKE '%~た%'
			OR primary_text LIKE '%~だった%'
			OR primary_text LIKE '%ました%'
			OR primary_text LIKE '%でした%')`,

		// Negative verbs (order 5)
		`UPDATE language_items SET lesson_group = 'grammar-negative-verbs', lesson_order = 5
		WHERE content_type = 'grammar' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%negat%'
			OR LOWER(meaning) LIKE '% not %'
			OR LOWER(meaning) LIKE '%without%'
			OR LOWER(primary_text) LIKE '%negat%'
			OR LOWER(primary_text) LIKE '%negate%'
			OR primary_text LIKE '%〜ない%'
			OR primary_text LIKE '%〜ず%'
			OR primary_text LIKE '%~ない%'
			OR primary_text LIKE '%~ず%'
			OR primary_text LIKE '%ません%'
			OR primary_text LIKE '%なかった%'
			OR primary_text LIKE '%じゃない%')`,

		// Verb particles / compound forms (order 7)
		`UPDATE language_items SET lesson_group = 'grammar-verb-particles', lesson_order = 7
		WHERE content_type = 'grammar' AND lesson_group IS NULL
		AND (primary_text LIKE '%〜てから%'
			OR primary_text LIKE '%〜ために%'
			OR primary_text LIKE '%〜ながら%'
			OR primary_text LIKE '%〜ように%'
			OR primary_text LIKE '%〜ところ%'
			OR primary_text LIKE '%~てから%'
			OR primary_text LIKE '%~ために%'
			OR primary_text LIKE '%~ながら%'
			OR primary_text LIKE '%~ように%'
			OR primary_text LIKE '%~ところ%'
			OR primary_text LIKE '%られ%'
			OR primary_text LIKE '%された%')`,

		// Verb basics (order 4)
		`UPDATE language_items SET lesson_group = 'grammar-verb-basics', lesson_order = 4
		WHERE content_type = 'grammar' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%verb%'
			OR LOWER(meaning) LIKE '%conjugat%'
			OR LOWER(meaning) LIKE '%te-form%'
			OR LOWER(meaning) LIKE '%masu form%'
			OR LOWER(meaning) LIKE '%dictionary form%'
			OR LOWER(primary_text) LIKE '%verb%'
			OR LOWER(primary_text) LIKE '%conjugat%'
			OR LOWER(primary_text) LIKE '%ru-verb%'
			OR LOWER(primary_text) LIKE '%u-verb%'
			OR primary_text LIKE '%〜ます%'
			OR primary_text LIKE '%〜て%'
			OR primary_text LIKE '%〜ている%'
			OR primary_text LIKE '%~ます%'
			OR primary_text LIKE '%~て%'
			OR primary_text LIKE '%~ている%'
			OR primary_text LIKE '%ている%'
			OR primary_text LIKE '%ています%'
			OR primary_text LIKE '%ていた%')`,

		// Adjectives (order 3)
		`UPDATE language_items SET lesson_group = 'grammar-adjectives', lesson_order = 3
		WHERE content_type = 'grammar' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%adjective%'
			OR LOWER(meaning) LIKE '%i-adjective%'
			OR LOWER(meaning) LIKE '%na-adjective%'
			OR LOWER(primary_text) LIKE '%adjective%'
			OR LOWER(primary_text) LIKE '%i-adjective%'
			OR LOWER(primary_text) LIKE '%na-adjective%')`,

		// Particles (order 2) -- single particle patterns
		`UPDATE language_items SET lesson_group = 'grammar-particles', lesson_order = 2
		WHERE content_type = 'grammar' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%particle%'
			OR LOWER(primary_text) LIKE '%particle%'
			OR primary_text LIKE '%〜は%'
			OR primary_text LIKE '%〜が%'
			OR primary_text LIKE '%〜を%'
			OR primary_text LIKE '%〜に%'
			OR primary_text LIKE '%〜で%'
			OR primary_text LIKE '%〜と%'
			OR primary_text LIKE '%〜か%'
			OR primary_text LIKE '%〜へ%'
			OR primary_text LIKE '%〜から%'
			OR primary_text LIKE '%〜まで%'
			OR primary_text LIKE '%〜も%'
			OR primary_text LIKE '%~は%'
			OR primary_text LIKE '%~が%'
			OR primary_text LIKE '%~を%'
			OR primary_text LIKE '%~に%'
			OR primary_text LIKE '%~で%'
			OR primary_text LIKE '%~と%')`,

		// Copula (order 1)
		`UPDATE language_items SET lesson_group = 'grammar-copula', lesson_order = 1
		WHERE content_type = 'grammar' AND lesson_group IS NULL
		AND (LOWER(meaning) LIKE '%copula%'
			OR LOWER(meaning) LIKE '%state of being%'
			OR LOWER(primary_text) LIKE '%copula%'
			OR LOWER(primary_text) LIKE '%state of being%'
			OR primary_text LIKE '%〜だ%'
			OR primary_text LIKE '%〜です%'
			OR primary_text LIKE '%~だ%'
			OR primary_text LIKE '%~です%'
			OR primary_text LIKE '%だ' OR primary_text LIKE '%です')`,

		// Supplemental catch-all (order 12)
		`UPDATE language_items SET lesson_group = 'grammar-supplemental', lesson_order = 12
		WHERE content_type = 'grammar' AND lesson_group IS NULL`,
	]);
}

/**
 * Step 4: Tag untagged sentences as N5.
 * All 2054 are from Tae Kim anime grammar course (avg 9.7 chars, foundational examples).
 */
export async function applySentenceJlptTagging(): Promise<void> {
	return runFixup("sentence_jlpt_v1", "Applying sentence JLPT tagging", [
		`UPDATE language_items SET jlpt_level = 'N5'
		WHERE content_type = 'sentence' AND jlpt_level IS NULL`,
	]);
}

/**
 * Tag Tae Kim grammar items as N5.
 * These are quiz questions and example sentences from the Tae Kim guide,
 * which covers N5-level grammar (copula, particles, adjectives, verb basics, etc.).
 */
export async function applyGrammarJlptTagging(): Promise<void> {
	return runFixup("grammar_jlpt_v1", "Applying grammar JLPT tagging", [
		`UPDATE language_items SET jlpt_level = 'N5'
		WHERE content_type = 'grammar' AND jlpt_level IS NULL`,
	]);
}
