import { getDb, type QueryResult, safeQuery } from "../database";

export interface KanjiLevelItem {
	id: number;
	level: number;
	item_type: string;
	character: string;
	meanings: string;
	readings_on: string | null;
	readings_kun: string | null;
	reading: string | null;
	radicals: string | null;
	mnemonic_meaning: string | null;
	mnemonic_reading: string | null;
	srs_stage: number;
	unlocked_at: string | null;
	next_review: string | null;
	correct_count: number;
	incorrect_count: number;
}

export interface LevelProgress {
	level: number;
	total: number;
	guru_plus: number;
	unlocked: number;
	percentage: number;
}

export async function getKanjiByLevel(level: number): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			"SELECT * FROM kanji_levels WHERE level = ? ORDER BY item_type, character",
			[level],
		);
	});
}

export async function getKanjiItemById(id: number): Promise<QueryResult<KanjiLevelItem | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<KanjiLevelItem[]>("SELECT * FROM kanji_levels WHERE id = ?", [id]);
		return rows[0] ?? null;
	});
}

export async function getKanjiByCharacter(
	character: string,
): Promise<QueryResult<KanjiLevelItem | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<KanjiLevelItem[]>(
			"SELECT * FROM kanji_levels WHERE character = ? AND item_type = 'kanji'",
			[character],
		);
		return rows[0] ?? null;
	});
}

export async function getDueKanjiReviews(): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE srs_stage > 0 AND srs_stage < 9
			AND next_review IS NOT NULL AND next_review <= datetime('now')
			ORDER BY next_review ASC`,
		);
	});
}

export async function getUnlockedItems(level?: number): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		if (level !== undefined) {
			return db.select<KanjiLevelItem[]>(
				"SELECT * FROM kanji_levels WHERE level = ? AND srs_stage > 0 ORDER BY item_type, character",
				[level],
			);
		}
		return db.select<KanjiLevelItem[]>(
			"SELECT * FROM kanji_levels WHERE srs_stage > 0 ORDER BY level, item_type, character",
		);
	});
}

export async function getLevelProgress(level: number): Promise<QueryResult<LevelProgress>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ total: number; guru_plus: number; unlocked: number }[]>(
			`SELECT
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus,
				COUNT(CASE WHEN srs_stage > 0 THEN 1 END) as unlocked
			FROM kanji_levels WHERE level = ?`,
			[level],
		);
		const { total, guru_plus, unlocked } = rows[0];
		return {
			level,
			total,
			guru_plus,
			unlocked,
			percentage: total > 0 ? Math.round((guru_plus / total) * 100) : 0,
		};
	});
}

export async function getUserLevel(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ level: number }[]>(
			"SELECT MAX(level) as level FROM kanji_levels WHERE srs_stage > 0",
		);
		return rows[0]?.level ?? 1;
	});
}

export async function updateKanjiSrsState(
	id: number,
	srsStage: number,
	nextReview: string | null,
	correctDelta: number,
	incorrectDelta: number,
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			`UPDATE kanji_levels SET
				srs_stage = ?,
				next_review = ?,
				correct_count = correct_count + ?,
				incorrect_count = incorrect_count + ?
			WHERE id = ?`,
			[srsStage, nextReview, correctDelta, incorrectDelta, id],
		);
	});
}

export async function unlockItems(ids: number[]): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		const placeholders = ids.map(() => "?").join(",");
		await db.execute(
			`UPDATE kanji_levels SET srs_stage = 1, unlocked_at = datetime('now'), next_review = datetime('now')
			WHERE id IN (${placeholders}) AND srs_stage = 0`,
			ids,
		);
	});
}

export async function checkAndUnlockLevel(level: number): Promise<QueryResult<number[]>> {
	return safeQuery(async () => {
		const db = await getDb();

		// Get radicals at Guru+ for this level
		const radicalProgress = await db.select<{ total: number; guru: number }[]>(
			`SELECT COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru
			FROM kanji_levels WHERE level = ? AND item_type = 'radical'`,
			[level],
		);

		const unlockedIds: number[] = [];

		// If 90%+ radicals at Guru, unlock kanji for this level
		const rp = radicalProgress[0];
		if (rp.total > 0 && rp.guru / rp.total >= 0.9) {
			const lockedKanji = await db.select<{ id: number }[]>(
				"SELECT id FROM kanji_levels WHERE level = ? AND item_type = 'kanji' AND srs_stage = 0",
				[level],
			);
			const kanjiIds = lockedKanji.map((r) => r.id);
			if (kanjiIds.length > 0) {
				const ph = kanjiIds.map(() => "?").join(",");
				await db.execute(
					`UPDATE kanji_levels SET srs_stage = 1, unlocked_at = datetime('now'), next_review = datetime('now')
					WHERE id IN (${ph})`,
					kanjiIds,
				);
				unlockedIds.push(...kanjiIds);
			}
		}

		// If 90%+ kanji at Guru, unlock vocab for this level
		const kanjiProgress = await db.select<{ total: number; guru: number }[]>(
			`SELECT COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru
			FROM kanji_levels WHERE level = ? AND item_type = 'kanji'`,
			[level],
		);

		const kp = kanjiProgress[0];
		if (kp.total > 0 && kp.guru / kp.total >= 0.9) {
			const lockedVocab = await db.select<{ id: number }[]>(
				"SELECT id FROM kanji_levels WHERE level = ? AND item_type = 'vocab' AND srs_stage = 0",
				[level],
			);
			const vocabIds = lockedVocab.map((r) => r.id);
			if (vocabIds.length > 0) {
				const ph = vocabIds.map(() => "?").join(",");
				await db.execute(
					`UPDATE kanji_levels SET srs_stage = 1, unlocked_at = datetime('now'), next_review = datetime('now')
					WHERE id IN (${ph})`,
					vocabIds,
				);
				unlockedIds.push(...vocabIds);
			}
		}

		return unlockedIds;
	});
}

export async function getDueKanjiCount(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>(
			`SELECT COUNT(*) as count FROM kanji_levels
			WHERE srs_stage > 0 AND srs_stage < 9
			AND next_review IS NOT NULL AND next_review <= datetime('now')`,
		);
		return rows[0].count;
	});
}

export async function isKanjiSeeded(): Promise<QueryResult<boolean>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ value: string }[]>(
			"SELECT value FROM settings WHERE key = 'kanji_seeded'",
		);
		return rows.length > 0 && rows[0].value === "true";
	});
}

export async function markKanjiSeeded(): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			"INSERT OR REPLACE INTO settings (key, value) VALUES ('kanji_seeded', 'true')",
		);
	});
}
