import { getDb } from "../database";
import { isKanjiSeeded, markKanjiSeeded, computeFirstReviewTime } from "../queries/kanji";

interface WkMeaning {
	meaning: string;
	primary: boolean;
	accepted: boolean;
}

interface WkCharacterImage {
	url: string;
	content_type: string;
	metadata: Record<string, unknown>;
}

interface WkRadical {
	id: number;
	level: number;
	character: string | null;
	slug: string;
	meanings: WkMeaning[];
	auxiliary_meanings: { meaning: string; type: string }[];
	meaning_mnemonic: string;
	image_url: string | null;
	character_images: WkCharacterImage[];
	amalgamation_subject_ids: number[];
}

interface WkKanji {
	id: number;
	level: number;
	character: string;
	slug: string;
	meanings: WkMeaning[];
	auxiliary_meanings: { meaning: string; type: string }[];
	readings: { reading: string; type: string; primary: boolean; accepted: boolean }[];
	meaning_mnemonic: string;
	reading_mnemonic: string;
	meaning_hint: string;
	reading_hint: string;
	component_subject_ids: number[];
	amalgamation_subject_ids: number[];
	visually_similar_subject_ids: number[];
}

interface WkContextSentence {
	en: string;
	ja: string;
}

interface WkPronunciationAudio {
	url: string;
	content_type: string;
	metadata: {
		gender: string;
		source_id: number;
		pronunciation: string;
		voice_actor_id: number;
		voice_actor_name: string;
		voice_description: string;
	};
}

interface WkVocab {
	id: number;
	object: string;
	level: number;
	character: string;
	slug: string;
	meanings: WkMeaning[];
	auxiliary_meanings: { meaning: string; type: string }[];
	readings: { reading: string; primary: boolean; accepted: boolean }[];
	meaning_mnemonic: string;
	reading_mnemonic: string;
	component_subject_ids: number[];
	parts_of_speech: string[];
	context_sentences: WkContextSentence[];
	pronunciation_audios: WkPronunciationAudio[];
}

export async function seedKanjiData(): Promise<void> {
	const seeded = await isKanjiSeeded();
	if (seeded.ok && seeded.data) return;

	console.log("Seeding kanji data from WK export...");

	let radicals: WkRadical[];
	let kanji: WkKanji[];
	let vocab: WkVocab[];

	try {
		const [radRes, kanjiRes, vocabRes] = await Promise.all([
			fetch("/data/wk-radicals.json"),
			fetch("/data/wk-kanji.json"),
			fetch("/data/wk-vocabulary.json"),
		]);
		if (!radRes.ok || !kanjiRes.ok || !vocabRes.ok) {
			console.warn("WK data files not found, skipping seed");
			return;
		}
		radicals = await radRes.json();
		kanji = await kanjiRes.json();
		vocab = await vocabRes.json();
	} catch (e) {
		console.warn("Failed to load WK data:", e);
		return;
	}

	const db = await getDb();
	console.log(
		`Seeding ${radicals.length} radicals, ${kanji.length} kanji, ${vocab.length} vocab...`,
	);

	// Insert radicals
	await db.execute("BEGIN");
	try {
	for (const r of radicals) {
		const meanings = r.meanings.map((m) => m.meaning);
		const character = r.character || r.slug;
		const charImages =
			r.character_images?.length > 0 ? JSON.stringify(r.character_images) : null;
		await db.execute(
			`INSERT INTO kanji_levels (level, item_type, character, meanings, mnemonic_meaning, image_url, wk_id, character_images)
			VALUES (?, 'radical', ?, ?, ?, ?, ?, ?)`,
			[
				r.level,
				character,
				JSON.stringify(meanings),
				r.meaning_mnemonic || null,
				r.image_url || null,
				r.id,
				charImages,
			],
		);
	}
	await db.execute("COMMIT");
	} catch (e) {
		await db.execute("ROLLBACK").catch(() => {});
		throw e;
	}

	// Insert kanji
	await db.execute("BEGIN");
	try {
	for (const k of kanji) {
		const meanings = k.meanings.map((m) => m.meaning);
		const onReadings = k.readings
			.filter((r) => r.type === "onyomi")
			.map((r) => (r.accepted ? r.reading : `!${r.reading}`));
		const kunReadings = k.readings
			.filter((r) => r.type === "kunyomi")
			.map((r) => (r.accepted ? r.reading : `!${r.reading}`));

		const visuallySimilar =
			k.visually_similar_subject_ids?.length > 0
				? JSON.stringify(k.visually_similar_subject_ids)
				: null;
		const componentIds =
			k.component_subject_ids?.length > 0
				? JSON.stringify(k.component_subject_ids)
				: null;
		await db.execute(
			`INSERT INTO kanji_levels (level, item_type, character, meanings, readings_on, readings_kun, mnemonic_meaning, mnemonic_reading, wk_id, visually_similar_ids, meaning_hint, reading_hint, component_ids)
			VALUES (?, 'kanji', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				k.level,
				k.character,
				JSON.stringify(meanings),
				JSON.stringify(onReadings),
				JSON.stringify(kunReadings),
				k.meaning_mnemonic || null,
				k.reading_mnemonic || null,
				k.id,
				visuallySimilar,
				k.meaning_hint || null,
				k.reading_hint || null,
				componentIds,
			],
		);
	}
	await db.execute("COMMIT");
	} catch (e) {
		await db.execute("ROLLBACK").catch(() => {});
		throw e;
	}

	// Insert vocabulary with component dependencies
	await db.execute("BEGIN");
	try {
	for (const v of vocab) {
		const meanings = v.meanings.map((m) => m.meaning);
		const acceptedReadings = v.readings.filter((r) => r.accepted).map((r) => r.reading);
		const primaryReading = v.readings.find((r) => r.primary)?.reading ?? acceptedReadings[0] ?? "";
		const componentIds =
			v.component_subject_ids.length > 0 ? JSON.stringify(v.component_subject_ids) : null;

		const partsOfSpeech =
			v.parts_of_speech?.length > 0 ? JSON.stringify(v.parts_of_speech) : null;
		const contextSentences =
			v.context_sentences?.length > 0 ? JSON.stringify(v.context_sentences) : null;
		const pronunciationAudios =
			v.pronunciation_audios?.length > 0 ? JSON.stringify(v.pronunciation_audios) : null;

		await db.execute(
			`INSERT INTO kanji_levels (level, item_type, character, meanings, reading, readings_on, mnemonic_meaning, mnemonic_reading, wk_id, component_ids, parts_of_speech, context_sentences, pronunciation_audios)
			VALUES (?, 'vocab', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				v.level,
				v.character,
				JSON.stringify(meanings),
				primaryReading,
				JSON.stringify(acceptedReadings),
				v.meaning_mnemonic || null,
				v.reading_mnemonic || null,
				v.id,
				componentIds,
				partsOfSpeech,
				contextSentences,
				pronunciationAudios,
			],
		);
	}
	await db.execute("COMMIT");
	} catch (e) {
		await db.execute("ROLLBACK").catch(() => {});
		throw e;
	}

	// Level 1 radicals start unlocked
	const firstReview = computeFirstReviewTime(1);
	await db.execute(
		`UPDATE kanji_levels SET srs_stage = 1, unlocked_at = datetime('now'), next_review = ?
		WHERE level = 1 AND item_type = 'radical'`,
		[firstReview],
	);

	await markKanjiSeeded();
	console.log(`Seeded: ${radicals.length} radicals, ${kanji.length} kanji, ${vocab.length} vocab`);
}

/**
 * Backfill enriched WK data for existing installs.
 * Runs once after migration v6 adds the new columns, updating rows by wk_id.
 */
export async function backfillEnrichedData(): Promise<void> {
	const db = await getDb();

	// Check if backfill already ran
	const rows = await db.select<{ value: string }[]>(
		"SELECT value FROM settings WHERE key = 'enriched_data_v2'",
	);
	if (rows.length > 0 && rows[0].value === "1") return;

	// Check if columns exist (migration v6 ran)
	try {
		await db.select("SELECT parts_of_speech FROM kanji_levels LIMIT 1");
	} catch {
		return; // Columns don't exist yet
	}

	// Check if there's data to backfill
	const countRows = await db.select<{ cnt: number }[]>(
		"SELECT COUNT(*) as cnt FROM kanji_levels WHERE wk_id IS NOT NULL AND ((item_type = 'vocab' AND parts_of_speech IS NULL) OR (item_type = 'kanji' AND component_ids IS NULL))",
	);
	if (countRows[0].cnt === 0) {
		// Either no data or already backfilled, mark done
		await db.execute(
			"INSERT OR REPLACE INTO settings (key, value) VALUES ('enriched_data_v2', '1')",
		);
		return;
	}

	console.log("Backfilling enriched WK data...");

	let radicals: WkRadical[];
	let kanji: WkKanji[];
	let vocab: WkVocab[];

	try {
		const [radRes, kanjiRes, vocabRes] = await Promise.all([
			fetch("/data/wk-radicals.json"),
			fetch("/data/wk-kanji.json"),
			fetch("/data/wk-vocabulary.json"),
		]);
		if (!radRes.ok || !kanjiRes.ok || !vocabRes.ok) {
			console.warn("WK data files not found, skipping backfill");
			return;
		}
		radicals = await radRes.json();
		kanji = await kanjiRes.json();
		vocab = await vocabRes.json();
	} catch (e) {
		console.warn("Failed to load WK data for backfill:", e);
		return;
	}

	// Backfill all item types in a single transaction
	await db.execute("BEGIN");
	try {
	// Backfill radicals: character_images
	for (const r of radicals) {
		if (r.character_images?.length > 0) {
			await db.execute(
				"UPDATE kanji_levels SET character_images = ? WHERE wk_id = ?",
				[JSON.stringify(r.character_images), r.id],
			);
		}
	}

	// Backfill kanji: visually_similar_subject_ids, meaning_hint, reading_hint, component_ids
	for (const k of kanji) {
		await db.execute(
			"UPDATE kanji_levels SET visually_similar_ids = ?, meaning_hint = ?, reading_hint = ?, component_ids = ? WHERE wk_id = ?",
			[
				k.visually_similar_subject_ids?.length > 0
					? JSON.stringify(k.visually_similar_subject_ids)
					: null,
				k.meaning_hint || null,
				k.reading_hint || null,
				k.component_subject_ids?.length > 0
					? JSON.stringify(k.component_subject_ids)
					: null,
				k.id,
			],
		);
	}

	// Backfill vocabulary: parts_of_speech, context_sentences, pronunciation_audios
	for (const v of vocab) {
		await db.execute(
			"UPDATE kanji_levels SET parts_of_speech = ?, context_sentences = ?, pronunciation_audios = ? WHERE wk_id = ?",
			[
				v.parts_of_speech?.length > 0 ? JSON.stringify(v.parts_of_speech) : null,
				v.context_sentences?.length > 0 ? JSON.stringify(v.context_sentences) : null,
				v.pronunciation_audios?.length > 0 ? JSON.stringify(v.pronunciation_audios) : null,
				v.id,
			],
		);
	}
	await db.execute("COMMIT");
	} catch (e) {
		await db.execute("ROLLBACK").catch(() => {});
		throw e;
	}

	await db.execute(
		"INSERT OR REPLACE INTO settings (key, value) VALUES ('enriched_data_v2', '1')",
	);
	console.log("Backfill complete: enriched data applied to existing items");
}
