import { getDb } from "../database";
import { isKanjiSeeded, markKanjiSeeded } from "../queries/kanji";

interface KanjiEntry {
	strokes: number;
	grade: number;
	freq: number;
	jlpt_old: number;
	jlpt_new: number;
	meanings: string[];
	readings_on: string[];
	readings_kun: string[];
	wk_level: number | null;
	wk_meanings: string[];
	wk_readings_on: string[];
	wk_readings_kun: string[];
	wk_radicals: string[];
}

type KanjiData = Record<string, KanjiEntry>;

export async function seedKanjiData(): Promise<void> {
	const seeded = await isKanjiSeeded();
	if (seeded.ok && seeded.data) return;

	console.log("Seeding kanji data...");

	let data: KanjiData;
	try {
		const response = await fetch("/data/kanji-data.json");
		if (!response.ok) {
			console.warn("kanji-data.json not found, skipping kanji seed");
			return;
		}
		data = await response.json();
	} catch (e) {
		console.warn("Failed to load kanji data:", e);
		return;
	}

	const db = await getDb();

	// Collect unique radicals per level from wk_radicals references
	const radicalsByLevel = new Map<number, Set<string>>();

	// First pass: insert kanji with WK levels
	for (const [character, entry] of Object.entries(data)) {
		if (!entry.wk_level) continue;

		const level = entry.wk_level;
		const meanings = entry.wk_meanings?.length > 0 ? entry.wk_meanings : entry.meanings;

		await db.execute(
			`INSERT INTO kanji_levels (level, item_type, character, meanings, readings_on, readings_kun, radicals)
			VALUES (?, 'kanji', ?, ?, ?, ?, ?)`,
			[
				level,
				character,
				JSON.stringify(meanings),
				JSON.stringify(entry.wk_readings_on ?? entry.readings_on ?? []),
				JSON.stringify(entry.wk_readings_kun ?? entry.readings_kun ?? []),
				entry.wk_radicals?.length > 0 ? JSON.stringify(entry.wk_radicals) : null,
			],
		);

		// Track radicals for this level
		if (entry.wk_radicals) {
			if (!radicalsByLevel.has(level)) radicalsByLevel.set(level, new Set());
			const set = radicalsByLevel.get(level);
			if (set) {
				for (const r of entry.wk_radicals) set.add(r);
			}
		}
	}

	// Second pass: insert radicals (unique per level)
	for (const [level, radicals] of radicalsByLevel) {
		for (const radical of radicals) {
			await db.execute(
				`INSERT INTO kanji_levels (level, item_type, character, meanings)
				VALUES (?, 'radical', ?, ?)`,
				[level, radical, JSON.stringify([radical])],
			);
		}
	}

	// Level 1 items start unlocked
	await db.execute(
		`UPDATE kanji_levels SET srs_stage = 1, unlocked_at = datetime('now'), next_review = datetime('now')
		WHERE level = 1`,
	);

	await markKanjiSeeded();
	console.log("Kanji data seeded");
}
