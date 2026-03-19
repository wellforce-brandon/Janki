import { getDb } from "../database";
import { isKanjiSeeded, markKanjiSeeded } from "../queries/kanji";

interface WkMeaning {
	meaning: string;
	primary: boolean;
	accepted: boolean;
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
	for (const r of radicals) {
		const meanings = r.meanings.map((m) => m.meaning);
		const character = r.character || r.slug;
		await db.execute(
			`INSERT INTO kanji_levels (level, item_type, character, meanings, mnemonic_meaning, image_url, wk_id)
			VALUES (?, 'radical', ?, ?, ?, ?, ?)`,
			[
				r.level,
				character,
				JSON.stringify(meanings),
				r.meaning_mnemonic || null,
				r.image_url || null,
				r.id,
			],
		);
	}

	// Insert kanji
	for (const k of kanji) {
		const meanings = k.meanings.map((m) => m.meaning);
		const onReadings = k.readings
			.filter((r) => r.type === "onyomi")
			.map((r) => (r.accepted ? r.reading : `!${r.reading}`));
		const kunReadings = k.readings
			.filter((r) => r.type === "kunyomi")
			.map((r) => (r.accepted ? r.reading : `!${r.reading}`));

		await db.execute(
			`INSERT INTO kanji_levels (level, item_type, character, meanings, readings_on, readings_kun, mnemonic_meaning, mnemonic_reading, wk_id)
			VALUES (?, 'kanji', ?, ?, ?, ?, ?, ?, ?)`,
			[
				k.level,
				k.character,
				JSON.stringify(meanings),
				JSON.stringify(onReadings),
				JSON.stringify(kunReadings),
				k.meaning_mnemonic || null,
				k.reading_mnemonic || null,
				k.id,
			],
		);
	}

	// Insert vocabulary with component dependencies
	for (const v of vocab) {
		const meanings = v.meanings.map((m) => m.meaning);
		const acceptedReadings = v.readings.filter((r) => r.accepted).map((r) => r.reading);
		const primaryReading = v.readings.find((r) => r.primary)?.reading ?? acceptedReadings[0] ?? "";
		const componentIds =
			v.component_subject_ids.length > 0 ? JSON.stringify(v.component_subject_ids) : null;

		await db.execute(
			`INSERT INTO kanji_levels (level, item_type, character, meanings, reading, readings_on, mnemonic_meaning, mnemonic_reading, wk_id, component_ids)
			VALUES (?, 'vocab', ?, ?, ?, ?, ?, ?, ?, ?)`,
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
			],
		);
	}

	// Level 1 radicals start unlocked (accelerated: 2h for levels 1-2, rounded to top of hour)
	const next = new Date();
	next.setTime(next.getTime() + 2 * 60 * 60 * 1000);
	next.setMinutes(0, 0, 0);
	if (next.getTime() <= Date.now()) next.setTime(next.getTime() + 3600000);
	const firstReview = next
		.toISOString()
		.replace("T", " ")
		.replace(/\.\d{3}Z$/, "");
	await db.execute(
		`UPDATE kanji_levels SET srs_stage = 1, unlocked_at = datetime('now'), next_review = ?
		WHERE level = 1 AND item_type = 'radical'`,
		[firstReview],
	);

	await markKanjiSeeded();
	console.log(`Seeded: ${radicals.length} radicals, ${kanji.length} kanji, ${vocab.length} vocab`);
}
